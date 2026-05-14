"""
FINRA consolidated daily short sale volume — free, no API key required.

Source: cdn.finra.org/equity/regsho/daily/CNMSshvol{YYYYMMDD}.txt
Updated each evening for the prior trading session.

SHORT VOLUME vs SHORT INTEREST:
  - Short volume (this module): what % of a day's trading was short sales.
    Normal range for large-caps is 40–55%. Above 60% = elevated short pressure.
    Above 70% = very heavy. This is a real-time daily signal.
  - Short interest (bi-monthly FINRA report): total outstanding short positions.
    More authoritative but 2-week lag. Not implemented here.

The short_pct metric is useful in the briefing when it deviates meaningfully
from a stock's typical range — a stock that usually sees 45% short volume
suddenly printing 68% is worth flagging even without knowing the "why".
"""

import time
import requests
from datetime import datetime, timedelta

FINRA_CDN = "https://cdn.finra.org/equity/regsho/daily"

_cache: dict = {"data": None, "ts": 0.0}
_CACHE_TTL = 3600 * 4  # 4 hours — file only updates once per day


def _recent_trading_days(n: int = 5) -> list[str]:
    dates = []
    d = datetime.now() - timedelta(days=1)
    while len(dates) < n:
        if d.weekday() < 5:
            dates.append(d.strftime("%Y%m%d"))
        d -= timedelta(days=1)
    return dates


def _fetch_file(date_str: str) -> dict | None:
    """Download and parse one FINRA short volume file.

    Aggregates across all market venues (CBOE, NASDAQ, NYSE, etc.) per ticker.
    Returns {TICKER: {"short_volume", "total_volume", "short_pct", "date"}} or None.
    """
    url = f"{FINRA_CDN}/CNMSshvol{date_str}.txt"
    try:
        resp = requests.get(url, timeout=25)
        if resp.status_code != 200:
            return None

        result: dict = {}
        for line in resp.text.splitlines():
            parts = line.strip().split("|")
            if len(parts) < 5 or parts[0] == "Date":
                continue
            symbol = parts[1].strip().upper()
            if not symbol:
                continue
            try:
                short_vol  = int(parts[2])
                exempt_vol = int(parts[3])
                total_vol  = int(parts[4])
            except (ValueError, IndexError):
                continue
            if total_vol <= 0:
                continue

            combined_short = short_vol + exempt_vol
            if symbol in result:
                result[symbol]["short_volume"] += combined_short
                result[symbol]["total_volume"] += total_vol
            else:
                date_fmt = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
                result[symbol] = {
                    "short_volume": combined_short,
                    "total_volume": total_vol,
                    "date": date_fmt,
                }

        # Compute short_pct once after aggregating all venues
        for sym, d in result.items():
            d["short_pct"] = round(d["short_volume"] / d["total_volume"] * 100, 1)

        return result if result else None

    except Exception:
        return None


def _load_cache() -> dict | None:
    now = time.time()
    if _cache["data"] and now - _cache["ts"] < _CACHE_TTL:
        return _cache["data"]

    for date_str in _recent_trading_days(5):
        data = _fetch_file(date_str)
        if data:
            _cache["data"] = data
            _cache["ts"]   = now
            return data

    return _cache["data"]  # stale fallback


def get_short_volume(tickers: list[str]) -> dict:
    """Return short sale volume data for the given tickers.

    Result per ticker:
      short_volume  — shares sold short that session (all venues combined)
      total_volume  — total shares traded
      short_pct     — short sales as % of total volume
      date          — session date (YYYY-MM-DD)

    Interpretation guide:
      < 40%  : unusually low short activity (possible short covering)
      40–55% : normal range for large-cap US equities
      55–65% : elevated — worth noting in the briefing
      > 65%  : heavy short pressure — flag specifically
    """
    if not tickers:
        return {}

    full_data = _load_cache()
    if not full_data:
        return {}

    return {
        t.upper(): full_data[t.upper()]
        for t in tickers
        if t.upper() in full_data
    }
