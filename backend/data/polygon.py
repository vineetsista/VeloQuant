import os
import threading
import time as _time
import requests
from datetime import datetime, timedelta


POLYGON_BASE = "https://api.polygon.io"

_price_cache:   dict = {}
_news_cache:    dict = {}
_grouped_cache: dict = {}
_PRICE_TTL   = 900    # 15 min
_NEWS_TTL    = 1800   # 30 min
_GROUPED_TTL = 3600   # 1 hour

# Per-date locks prevent concurrent threads from fetching the same date twice.
_fetch_locks: dict = {}
_locks_mutex = threading.Lock()


def _key() -> str:
    k = os.getenv("POLYGON_API_KEY", "")
    if not k:
        raise ValueError("POLYGON_API_KEY not set in environment")
    return k


def _recent_trading_days(n: int = 2) -> list[str]:
    """Return the n most recent Mon–Fri dates, starting from YESTERDAY.

    Polygon free tier returns 403 for today's grouped daily until after their
    end-of-day processing window (not immediately after market close).
    Starting from yesterday ensures we always hit available data.
    """
    dates = []
    d = datetime.now() - timedelta(days=1)   # start yesterday
    while len(dates) < n:
        if d.weekday() < 5:
            dates.append(d.strftime("%Y-%m-%d"))
        d -= timedelta(days=1)
    return dates


# ── Grouped daily bars (free-tier, 1 call = all US stocks) ───────────────────

def _fetch_grouped_daily(date_str: str) -> dict:
    """GET /v2/aggs/grouped/locale/us/market/stocks/{date}

    Thread-safe: only one in-flight request per date at a time.
    Caches results for _GROUPED_TTL seconds.
    """
    # Fast path — already cached
    cached = _grouped_cache.get(date_str)
    if cached and _time.time() - cached["ts"] < _GROUPED_TTL:
        return cached["data"]

    # Get (or create) a per-date lock so concurrent requests don't double-fetch
    with _locks_mutex:
        if date_str not in _fetch_locks:
            _fetch_locks[date_str] = threading.Lock()
        lock = _fetch_locks[date_str]

    with lock:
        # Re-check after acquiring the lock (another thread may have just filled it)
        cached = _grouped_cache.get(date_str)
        if cached and _time.time() - cached["ts"] < _GROUPED_TTL:
            return cached["data"]

        try:
            resp = requests.get(
                f"{POLYGON_BASE}/v2/aggs/grouped/locale/us/market/stocks/{date_str}",
                params={"adjusted": "true", "apiKey": _key()},
                timeout=30,
            )
            if resp.status_code == 429:
                print(f"[polygon] rate-limited on grouped/{date_str} — skipping", flush=True)
                return cached["data"] if cached else {}
            if resp.status_code == 403:
                print(f"[polygon] grouped/{date_str}: 403 (not yet available on free tier)", flush=True)
                return {}
            resp.raise_for_status()

            raw  = resp.json().get("results") or []
            data = {(item.get("T") or "").upper(): item
                    for item in raw if item.get("T")}
            print(f"[polygon] grouped/{date_str}: {len(data)} tickers", flush=True)
            if data:
                _grouped_cache[date_str] = {"data": data, "ts": _time.time()}
            return data

        except requests.HTTPError as e:
            print(f"[polygon] grouped/{date_str}: HTTP {e.response.status_code}", flush=True)
            return cached["data"] if cached else {}
        except Exception as e:
            print(f"[polygon] grouped/{date_str} error: {type(e).__name__}", flush=True)
            return cached["data"] if cached else {}


# ── Snapshot (2 API calls total, shared across all pages) ────────────────────

def get_snapshot_batch(tickers: list[str]) -> dict:
    """Return price + pct_change for tickers using grouped daily bars.

    Uses yesterday and the day before (Polygon free tier: today is 403).
    Two API calls total, results cached 1 hour and shared across MarketBar + Holdings.
    First cold-cache load takes ~15 s (rate-limit pause); subsequent loads are instant.
    """
    if not tickers:
        return {}

    days = _recent_trading_days(2)

    today_raw = _fetch_grouped_daily(days[0])

    # Respect Polygon's 5-calls/minute free-tier limit.
    # Sleep only when the prev-day isn't already cached (i.e., cold start only).
    if not _grouped_cache.get(days[1]):
        print("[polygon] waiting 12s between grouped calls (rate limit)", flush=True)
        _time.sleep(12)
    prev_raw = _fetch_grouped_daily(days[1])

    result = {}
    for ticker in tickers:
        tu = ticker.upper()
        td = today_raw.get(tu) or {}
        pd = prev_raw.get(tu)  or {}

        close      = td.get("c") or pd.get("c")
        prev_close = pd.get("c")

        if not close:
            continue

        pct = None
        if close and prev_close and prev_close != 0:
            pct = round((close - prev_close) / prev_close * 100, 2)

        ts_ms    = td.get("t") or pd.get("t")
        date_out = (datetime.utcfromtimestamp(ts_ms / 1000).strftime("%Y-%m-%d")
                    if ts_ms else days[0])

        result[tu] = {
            "ticker":      tu,
            "close":       close,
            "open":        td.get("o") or pd.get("o"),
            "high":        td.get("h") or pd.get("h"),
            "low":         td.get("l") or pd.get("l"),
            "volume":      td.get("v") or pd.get("v"),
            "pct_change":  pct,
            "prior_close": prev_close,
            "date":        date_out,
        }
    return result


def _refresh_snapshot(tickers: list[str]) -> dict:
    snaps = get_snapshot_batch(tickers)
    now = _time.time()
    for t, p in snaps.items():
        _price_cache[t] = {"data": p, "ts": now}
    return snaps


# ── Public price helpers ──────────────────────────────────────────────────────

def get_prices_batch(tickers: list[str]) -> dict:
    """Batch price fetch — cache-backed. Used by the market-indices endpoint."""
    if not tickers:
        return {}
    now   = _time.time()
    stale = [t for t in tickers
             if t.upper() not in _price_cache
             or now - _price_cache[t.upper()]["ts"] >= _PRICE_TTL]
    if stale:
        _refresh_snapshot(tickers)
    result = {}
    for t in tickers:
        cached = _price_cache.get(t.upper())
        result[t.upper()] = {
            "price": cached["data"] if cached else {"ticker": t.upper(), "error": "no data"}
        }
    return result


def get_overnight_change_cached(ticker: str) -> dict:
    key = ticker.upper()
    now = _time.time()
    cached = _price_cache.get(key)
    if cached and now - cached["ts"] < _PRICE_TTL:
        return cached["data"]
    snaps = _refresh_snapshot([ticker])
    if key in snaps:
        return snaps[key]
    if cached:
        return cached["data"]
    return get_overnight_change(ticker)


# ── Legacy single-ticker (kept for briefing generation) ──────────────────────

def get_overnight_change(ticker: str) -> dict:
    """Individual aggs call. Use get_overnight_change_cached when possible."""
    end   = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    resp = requests.get(
        f"{POLYGON_BASE}/v2/aggs/ticker/{ticker.upper()}/range/1/day/{start}/{end}",
        params={"adjusted": "true", "sort": "desc", "limit": 2, "apiKey": _key()},
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json().get("results", [])
    if not results:
        return {"ticker": ticker.upper(), "error": "No price data available"}
    latest = results[0]
    prior  = results[1] if len(results) > 1 else None
    pct_change = None
    if prior and prior.get("c"):
        pct_change = round((latest["c"] - prior["c"]) / prior["c"] * 100, 2)
    return {
        "ticker":      ticker.upper(),
        "date":        datetime.fromtimestamp(latest["t"] / 1000).strftime("%Y-%m-%d"),
        "open":        latest.get("o"),
        "high":        latest.get("h"),
        "low":         latest.get("l"),
        "close":       latest.get("c"),
        "volume":      latest.get("v"),
        "pct_change":  pct_change,
        "prior_close": prior.get("c") if prior else None,
    }


# ── News ──────────────────────────────────────────────────────────────────────

def get_ticker_news(ticker: str, limit: int = 5) -> list[dict]:
    key = ticker.upper()
    now = _time.time()
    cached = _news_cache.get(key)
    if cached and now - cached["ts"] < _NEWS_TTL:
        return cached["data"]
    try:
        resp = requests.get(
            f"{POLYGON_BASE}/v2/reference/news",
            params={"ticker": key, "limit": limit,
                    "sort": "published_utc", "order": "desc", "apiKey": _key()},
            timeout=10,
        )
        resp.raise_for_status()
        articles = []
        for item in resp.json().get("results", []):
            articles.append({
                "title":         item.get("title"),
                "published_utc": item.get("published_utc"),
                "publisher":     item.get("publisher", {}).get("name"),
                "description":   item.get("description"),
                "article_url":   item.get("article_url"),
                "tickers":       item.get("tickers", []),
            })
        _news_cache[key] = {"data": articles, "ts": now}
        return articles
    except Exception:
        return cached["data"] if cached else []


# ── Portfolio ─────────────────────────────────────────────────────────────────

def get_portfolio_market_data(tickers: list[str]) -> dict:
    """Return price + news for every ticker. 2 grouped daily calls for all prices."""
    if not tickers:
        return {}
    snaps = _refresh_snapshot(tickers)
    portfolio = {}
    for ticker in tickers:
        tu = ticker.upper()
        if tu in snaps:
            price = snaps[tu]
        elif tu in _price_cache:
            price = _price_cache[tu]["data"]
        else:
            price = {"ticker": tu, "error": "No price data available"}
        news = []
        try:
            news = get_ticker_news(ticker, limit=3)
        except Exception:
            pass
        portfolio[tu] = {"price": price, "news": news}
    return portfolio
