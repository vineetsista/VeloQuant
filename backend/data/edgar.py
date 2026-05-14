import re
import time
import xml.etree.ElementTree as ET
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


def _parse_form4_xml(xml_text: str) -> list[dict]:
    """Parse a Form 4 XML document and return structured insider transactions."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    name_el = root.find(".//rptOwnerName")
    name = name_el.text.strip() if name_el is not None and name_el.text else "Unknown"

    title_el = root.find(".//officerTitle")
    is_dir = root.find(".//isDirector")
    is_ten_pct = root.find(".//isTenPercentOwner")
    if title_el is not None and title_el.text and title_el.text.strip():
        title = title_el.text.strip()
    elif is_dir is not None and is_dir.text and is_dir.text.strip() == "1":
        title = "Director"
    elif is_ten_pct is not None and is_ten_pct.text and is_ten_pct.text.strip() == "1":
        title = "10%+ Owner"
    else:
        title = "Insider"

    transactions = []
    for txn in root.findall(".//nonDerivativeTransaction"):
        date_el  = txn.find(".//transactionDate/value")
        shares_el = txn.find(".//transactionAmounts/transactionShares/value")
        price_el  = txn.find(".//transactionAmounts/transactionPricePerShare/value")
        code_el   = txn.find(".//transactionAmounts/transactionAcquiredDisposedCode/value")
        if not all([date_el, shares_el, code_el]):
            continue
        try:
            shares = float(shares_el.text)
            price  = float(price_el.text) if price_el is not None and price_el.text else 0.0
            code   = (code_el.text or "").strip().upper()
            date   = (date_el.text or "").strip()[:10]
            txn_type = "buy" if code == "A" else "sell" if code == "D" else None
            if not txn_type or shares < 100:
                continue
            transactions.append({
                "name":  name,
                "title": title,
                "type":  txn_type,
                "shares": shares,
                "price":  price,
                "date":   date,
                "value":  round(shares * price),
            })
        except (ValueError, TypeError):
            continue

    return transactions


def get_insider_transactions(tickers: list[str], days_back: int = 14) -> dict:
    """Fetch recent Form 4 insider transactions for portfolio tickers via EDGAR.

    Returns {TICKER: [{"name", "title", "type" (buy/sell), "shares", "price", "date", "value"}]}.
    Only non-derivative (common stock) transactions >= 100 shares are included.
    Rate-limited to stay under SEC's 10 req/sec guideline.
    """
    result = {}

    for ticker in tickers:
        try:
            filings = get_recent_filings(ticker, filing_types=("4",), days_back=days_back)
        except Exception:
            time.sleep(0.15)
            continue

        all_txns = []
        for filing in filings[:6]:
            time.sleep(0.15)
            try:
                accession_clean = filing["accession_number"].replace("-", "")
                cik = filing["cik"]
                url = (f"{SEC_BASE}/Archives/edgar/data/{int(cik)}"
                       f"/{accession_clean}/{filing['primary_document']}")
                resp = requests.get(url, headers=HEADERS, timeout=10)
                if resp.status_code != 200:
                    continue
                all_txns.extend(_parse_form4_xml(resp.text))
            except Exception:
                continue

        if all_txns:
            result[ticker.upper()] = all_txns

        time.sleep(0.15)

    return result


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
