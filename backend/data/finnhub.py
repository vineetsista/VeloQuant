"""
Finnhub data module — company news, market news, earnings calendar, analyst data.

Requires FINNHUB_API_KEY environment variable (free tier: finnhub.io).
All functions degrade gracefully if the key is missing or the API is unavailable.
"""
import os
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

FINNHUB_BASE = "https://finnhub.io/api/v1"

_company_news_cache: dict = {}
_market_news_cache: dict = {"data": None, "ts": 0.0}
_earnings_cache: dict = {}
_analyst_cache: dict = {}

_NEWS_TTL     = 1800   # 30 min
_EARNINGS_TTL = 3600   # 1 hour
_ANALYST_TTL  = 3600   # 1 hour


def _key() -> str:
    return os.getenv("FINNHUB_API_KEY", "")


def _get(path: str, params: dict, timeout: int = 10) -> dict | list | None:
    k = _key()
    if not k:
        return None
    try:
        params["token"] = k
        resp = requests.get(f"{FINNHUB_BASE}{path}", params=params, timeout=timeout)
        if resp.status_code == 429:
            time.sleep(1)
            resp = requests.get(f"{FINNHUB_BASE}{path}", params=params, timeout=timeout)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


def get_company_news(ticker: str, days_back: int = 3) -> list[dict]:
    """Multi-source company news from Finnhub (aggregates 100+ outlets).

    Returns up to 10 articles sorted newest-first.
    """
    if not _key():
        return []
    tu = ticker.upper()
    now = time.time()
    cached = _company_news_cache.get(tu)
    if cached and now - cached["ts"] < _NEWS_TTL:
        return cached["data"]

    from_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    to_date   = datetime.now().strftime("%Y-%m-%d")

    raw = _get("/company-news", {"symbol": tu, "from": from_date, "to": to_date})
    articles = []
    if isinstance(raw, list):
        for item in raw[:10]:
            ts = item.get("datetime", 0)
            pub_time = (datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")
                        if ts else "")
            headline = (item.get("headline") or "").strip()
            summary  = (item.get("summary")  or "").strip()
            if not headline:
                continue
            articles.append({
                "title":     headline,
                "summary":   summary[:300] if summary else "",
                "source":    item.get("source", ""),
                "published": pub_time,
                "url":       item.get("url", ""),
            })

    _company_news_cache[tu] = {"data": articles, "ts": now}
    return articles


def get_market_news() -> list[dict]:
    """Broad market / macro news from Finnhub (general + forex + mergers categories).

    Returns up to 20 unique articles. Covers Fed statements, economic data, macro moves.
    """
    if not _key():
        return []
    now = time.time()
    if _market_news_cache["data"] is not None and now - _market_news_cache["ts"] < _NEWS_TTL:
        return _market_news_cache["data"]

    seen, articles = set(), []
    for category in ("general", "forex", "merger"):
        raw = _get("/news", {"category": category, "minId": 0})
        if not isinstance(raw, list):
            continue
        for item in raw[:15]:
            headline = (item.get("headline") or "").strip()
            if not headline or headline in seen:
                continue
            seen.add(headline)
            ts = item.get("datetime", 0)
            articles.append({
                "title":     headline,
                "summary":   (item.get("summary") or "").strip()[:250],
                "source":    item.get("source", ""),
                "published": datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M") if ts else "",
                "category":  category,
            })
        if len(articles) >= 20:
            break

    _market_news_cache["data"] = articles[:20]
    _market_news_cache["ts"]   = now
    return _market_news_cache["data"]


def get_earnings_calendar(tickers: list[str], days_ahead: int = 21) -> dict:
    """Real scheduled earnings dates from Finnhub (not estimates).

    Returns {TICKER: {"date": "2025-05-20", "days_out": 7, "hour": "amc",
                       "eps_estimate": 1.23, "revenue_estimate": 12.4e9}}
    hour: 'amc' = after market close, 'bmo' = before market open
    """
    if not _key() or not tickers:
        return {}

    from_date = datetime.now().strftime("%Y-%m-%d")
    to_date   = (datetime.now() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    cache_key = f"{from_date}_{to_date}"

    now = time.time()
    cached = _earnings_cache.get(cache_key)
    if cached and now - cached["ts"] < _EARNINGS_TTL:
        return cached["data"]

    raw = _get("/calendar/earnings", {"from": from_date, "to": to_date}, timeout=15)
    result = {}
    if isinstance(raw, dict):
        ticker_set = {t.upper() for t in tickers}
        for item in raw.get("earningsCalendar", []):
            symbol = (item.get("symbol") or "").upper()
            if symbol not in ticker_set:
                continue
            date_str = item.get("date", "")
            if not date_str:
                continue
            try:
                days_out = (datetime.strptime(date_str, "%Y-%m-%d") - datetime.now()).days
            except ValueError:
                continue
            eps_est = item.get("epsEstimate")
            rev_est = item.get("revenueEstimate")
            result[symbol] = {
                "date":             date_str,
                "days_out":         days_out,
                "hour":             item.get("hour", ""),
                "eps_estimate":     round(float(eps_est), 2) if eps_est else None,
                "revenue_estimate": float(rev_est) if rev_est else None,
            }

    _earnings_cache[cache_key] = {"data": result, "ts": now}
    return result


def _fetch_analyst_for_ticker(ticker: str) -> tuple[str, dict]:
    """Fetch recommendation consensus + price target for one ticker. Returns (ticker, data)."""
    tu  = ticker.upper()
    now = time.time()
    cached = _analyst_cache.get(tu)
    if cached and now - cached["ts"] < _ANALYST_TTL:
        return tu, cached["data"]

    result: dict = {}

    rec = _get("/stock/recommendation", {"symbol": tu})
    if isinstance(rec, list) and rec:
        latest = rec[0]
        total = (latest.get("buy", 0) + latest.get("hold", 0) + latest.get("sell", 0)
                 + latest.get("strongBuy", 0) + latest.get("strongSell", 0))
        result["consensus"] = {
            "strong_buy":  latest.get("strongBuy", 0),
            "buy":         latest.get("buy", 0),
            "hold":        latest.get("hold", 0),
            "sell":        latest.get("sell", 0),
            "strong_sell": latest.get("strongSell", 0),
            "total":       total,
            "period":      latest.get("period", ""),
        }

    pt = _get("/stock/price-target", {"symbol": tu})
    if isinstance(pt, dict) and pt.get("targetMean"):
        result["price_target"] = {
            "mean":   round(float(pt["targetMean"]), 2),
            "high":   round(float(pt["targetHigh"]), 2) if pt.get("targetHigh") else None,
            "low":    round(float(pt["targetLow"]),  2) if pt.get("targetLow")  else None,
            "median": round(float(pt["targetMedian"]), 2) if pt.get("targetMedian") else None,
            "count":  pt.get("numberOfAnalysts"),
        }

    _analyst_cache[tu] = {"data": result, "ts": now}
    return tu, result


def get_analyst_data(tickers: list[str]) -> dict:
    """Fetch real analyst consensus + price targets for all tickers in parallel.

    Returns {TICKER: {"consensus": {...}, "price_target": {...}}}
    Data is actual aggregated analyst coverage from Finnhub — not training-data hallucinations.
    """
    if not _key() or not tickers:
        return {}

    result = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(_fetch_analyst_for_ticker, t): t for t in tickers}
        for fut in as_completed(futures):
            try:
                ticker, data = fut.result(timeout=12)
                if data:
                    result[ticker] = data
            except Exception:
                pass
    return result


def get_all_company_news(tickers: list[str], days_back: int = 3) -> dict:
    """Fetch company news for all tickers in parallel.

    Returns {TICKER: [articles]}
    """
    if not _key() or not tickers:
        return {}

    result = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(get_company_news, t, days_back): t for t in tickers}
        for fut in as_completed(futures):
            t = futures[fut]
            try:
                articles = fut.result(timeout=12)
                if articles:
                    result[t.upper()] = articles
            except Exception:
                pass
    return result
