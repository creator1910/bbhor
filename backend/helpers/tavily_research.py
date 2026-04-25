"""
Tavily research helper.
Runs parallel searches for company overview, news, and hiring signals.
Returns a flat dict of strings/lists ready to be injected into the LLM prompt.
"""

import os
import asyncio
import httpx

TAVILY_API_URL = "https://api.tavily.com/search"
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")


async def _search(client: httpx.AsyncClient, query: str, max_results: int = 5) -> list[dict]:
    """Single Tavily search call. Returns list of result dicts."""
    payload = {
        "api_key": TAVILY_API_KEY,
        "query": query,
        "search_depth": "basic",
        "max_results": max_results,
        "include_answer": True,
    }
    resp = await client.post(TAVILY_API_URL, json=payload, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    return data.get("results", [])


async def research_company(company: str, role: str) -> dict:
    """
    Run three parallel Tavily queries and aggregate signals.
    Raises on network/API error — caller should catch and fall back.
    """
    if not TAVILY_API_KEY:
        raise ValueError("TAVILY_API_KEY not set")

    queries = {
        "overview": f"{company} company overview business model funding",
        "news": f"{company} latest news 2024 2025 layoffs growth product",
        "hiring": f"{company} hiring {role} jobs careers team size",
    }

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            _search(client, queries["overview"]),
            _search(client, queries["news"]),
            _search(client, queries["hiring"]),
        )

    overview_results, news_results, hiring_results = results

    def _snippets(items: list[dict]) -> list[str]:
        return [f"{r.get('title','')}: {r.get('content','')[:200]}" for r in items]

    def _sources(items: list[dict]) -> list[dict]:
        return [
            {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("content", "")[:300]}
            for r in items
            if r.get("url")
        ]

    company_summary = (overview_results[0].get("content", "") if overview_results else "")[:600]

    return {
        "companySummary": company_summary,
        "newsSignals": _snippets(news_results),
        "hiringSignals": _snippets(hiring_results),
        "sources": _sources(overview_results + news_results)[:6],
    }
