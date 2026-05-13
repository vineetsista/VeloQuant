import re
import time
import requests
from datetime import datetime, timedelta

EDGAR_BASE = "https://data.sec.gov"
SEC_BASE = "https://www.sec.gov"

HEADERS = {
    "User-Agent": "VeloQuant vineet.sista@gmail.com",
    "Accept-Encoding": "gzip, deflate",
}

_ticker_cik_cache = None


def _get_ticker_cik_map() -> dict:
    global _ticker_cik_cache
    if _ticker_cik_cache is not None:
        return _ticker_cik_cache

    resp = requests.get(f"{SEC_BASE}/files/company_tickers.json", headers=HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    # SEC returns {0: {cik_str, ticker, title}, 1: ...}
    _ticker_cik_cache = {
        v["ticker"].upper(): str(v["cik_str"]).zfill(10)
        for v in data.values()
    }
    return _ticker_cik_cache


def get_cik(ticker: str) -> str | None:
    """Return zero-padded 10-digit CIK for a ticker, or None if not found."""
    return _get_ticker_cik_map().get(ticker.upper())


def get_recent_filings(ticker: str, filing_types=("10-K", "10-Q", "8-K"), days_back=7) -> list[dict]:
    """Return list of recent filings for a ticker within the last days_back days."""
    cik = get_cik(ticker)
    if not cik:
        return []

    resp = requests.get(f"{EDGAR_BASE}/submissions/CIK{cik}.json", headers=HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    dates = recent.get("filingDate", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])
    descriptions = recent.get("primaryDocDescription", [])

    cutoff = datetime.now() - timedelta(days=days_back)
    results = []

    for form, date_str, accession, doc, desc in zip(forms, dates, accessions, primary_docs, descriptions):
        if form not in filing_types:
            continue
        if datetime.strptime(date_str, "%Y-%m-%d") < cutoff:
            continue

        results.append({
            "ticker": ticker.upper(),
            "company_name": data.get("name", ticker.upper()),
            "cik": cik,
            "form": form,
            "filing_date": date_str,
            "accession_number": accession,
            "primary_document": doc,
            "description": desc,
        })

    return results


def get_filing_text(cik: str, accession_number: str, primary_document: str) -> str:
    """Fetch and return plain text of a filing document, truncated to 60k chars."""
    accession_clean = accession_number.replace("-", "")
    url = f"{SEC_BASE}/Archives/edgar/data/{int(cik)}/{accession_clean}/{primary_document}"

    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()

    text = resp.text
    if re.search(r"<html|<HTML|<htm|<HTM", text[:500]):
        text = _strip_html(text)

    # For long filings (10-K), grab front matter + end matter where key signal lives
    if len(text) > 60000:
        text = text[:40000] + "\n\n[... middle section omitted ...]\n\n" + text[-20000:]

    return text.strip()


def _strip_html(html: str) -> str:
    text = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&#\d+;", " ", text)
    text = re.sub(r"\s{3,}", "\n\n", text)
    return text.strip()


def get_new_filings_for_portfolio(tickers: list[str], days_back: int = 1) -> list[dict]:
    """
    Fetch all recent filings (with full text) for a list of tickers.
    Rate-limited to stay under SEC's 10 req/sec limit.
    """
    all_filings = []

    for ticker in tickers:
        try:
            filings = get_recent_filings(ticker, days_back=days_back)
        except Exception as e:
            all_filings.append({"ticker": ticker, "error": f"Metadata fetch failed: {e}"})
            time.sleep(0.15)
            continue

        for filing in filings:
            time.sleep(0.15)
            try:
                filing["text"] = get_filing_text(
                    filing["cik"],
                    filing["accession_number"],
                    filing["primary_document"],
                )
            except Exception as e:
                filing["text"] = ""
                filing["fetch_error"] = str(e)

            all_filings.append(filing)

        time.sleep(0.15)

    return all_filings
