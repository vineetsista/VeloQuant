from data.polygon import get_ticker_news


def get_portfolio_news(tickers: list[str], limit_per_ticker: int = 5) -> list[dict]:
    """Aggregate and date-sort recent news across all portfolio holdings."""
    all_articles = []
    for ticker in tickers:
        try:
            articles = get_ticker_news(ticker, limit=limit_per_ticker)
            all_articles.extend(articles)
        except Exception:
            pass

    all_articles.sort(key=lambda x: x.get("published_utc") or "", reverse=True)
    return all_articles
