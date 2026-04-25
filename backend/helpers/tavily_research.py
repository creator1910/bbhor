"""
Tavily research helper for $JOB.

Runs 5 parallel targeted searches (with DACH-specific domain lists),
then optionally calls the Extract API on top URLs for full article content.

Result filtering applied before injecting into the LLM prompt:
  - Company name must appear in result title or first 100 chars of content
  - Tavily relevance score must be >= 0.5
  - Deduplicated by URL
  - Max 3 snippets per signal type
"""

import asyncio
import logging
import os
from typing import List, Optional

import httpx

logger = logging.getLogger(__name__)

TAVILY_API_URL    = "https://api.tavily.com/search"
TAVILY_EXTRACT_URL = "https://api.tavily.com/extract"
TAVILY_API_KEY    = os.getenv("TAVILY_API_KEY", "")

RELEVANCE_THRESHOLD = 0.5
MAX_SNIPPETS        = 3
EXTRACT_CONTENT_CAP = 1500   # chars per extracted article
TIMEOUT             = 15.0


# ── low-level helpers ────────────────────────────────────────────────────────

async def _search(
    client: httpx.AsyncClient,
    query: str,
    *,
    search_depth: str = "basic",
    topic: str = "general",
    time_range: Optional[str] = None,
    max_results: int = 5,
    include_domains: Optional[List[str]] = None,
    include_answer: object = True,
) -> List[dict]:
    payload: dict = {
        "api_key": TAVILY_API_KEY,
        "query": query,
        "search_depth": search_depth,
        "topic": topic,
        "max_results": max_results,
        "include_answer": include_answer,
    }
    if time_range:
        payload["time_range"] = time_range
    if include_domains:
        payload["include_domains"] = include_domains

    resp = await client.post(TAVILY_API_URL, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    # Attach the synthesized answer to each result for easy extraction
    answer = data.get("answer", "")
    results = data.get("results", [])
    for r in results:
        r.setdefault("_answer", answer)
    return results


async def _extract(client: httpx.AsyncClient, urls: List[str]) -> List[dict]:
    if not urls:
        return []
    payload = {
        "api_key": TAVILY_API_KEY,
        "urls": urls[:10],
        "extract_depth": "basic",
    }
    resp = await client.post(TAVILY_EXTRACT_URL, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json().get("results", [])


# ── result filtering ─────────────────────────────────────────────────────────

def _filter_results(results: List[dict], company: str) -> List[dict]:
    """
    Keep only results that:
      1. Mention the company name in title or first 100 chars of content
      2. Have Tavily relevance score >= 0.5
    """
    name = company.lower()
    filtered = []
    for r in results:
        title   = (r.get("title") or "").lower()
        content = (r.get("content") or "")[:100].lower()
        score   = r.get("score", 1.0)   # default 1.0 if missing (older API versions)
        if name in title or name in content:
            if score >= RELEVANCE_THRESHOLD:
                filtered.append(r)
    return filtered


def _snippets(results: List[dict], cap: int = MAX_SNIPPETS) -> List[str]:
    return [
        f"{r.get('title', '')}: {(r.get('content') or '')[:250]}"
        for r in results[:cap]
    ]


def _sources(results: List[dict]) -> List[dict]:
    seen_urls: set[str] = set()
    out = []
    for r in results:
        url = r.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            out.append({
                "title":   r.get("title", ""),
                "url":     url,
                "snippet": (r.get("content") or "")[:300],
            })
    return out


# ── main entry point ─────────────────────────────────────────────────────────

async def research_company(company: str, role: str) -> dict:
    """
    5 parallel Tavily searches + conditional Extract on top URLs.
    Returns a dict matching the ResearchContext keys expected by build_context().
    Raises on total API failure — caller should catch.
    """
    if not TAVILY_API_KEY:
        raise ValueError("TAVILY_API_KEY not set")

    async with httpx.AsyncClient() as client:
        # Run all 5 searches in parallel
        (
            funding_raw,
            news_raw,
            salary_raw,
            hiring_raw,
            sentiment_raw,
        ) = await asyncio.gather(
            _search(
                client,
                f"{company} funding valuation investors revenue growth",
                search_depth="basic",
                include_domains=[
                    "crunchbase.com", "techcrunch.com", "sifted.eu",
                    "gruenderszene.de", "eu-startups.com", "bloomberg.com",
                ],
                include_answer="basic",
                max_results=5,
            ),
            _search(
                client,
                f"{company} layoffs hiring restructuring growth news",
                search_depth="basic",
                topic="news",
                time_range="month",
                include_answer="basic",
                max_results=7,
            ),
            _search(
                client,
                f"{role} salary compensation {company} total comp equity",
                search_depth="advanced",
                include_domains=[
                    "levels.fyi", "glassdoor.com", "blind.co",
                    "stepstone.de", "gehalt.de", "gehaltsvergleich.com",
                    "payscale.com",
                ],
                include_answer="advanced",
                max_results=5,
            ),
            _search(
                client,
                f"{company} {role} job opening careers hiring",
                search_depth="basic",
                include_domains=[
                    "greenhouse.io", "lever.co", "jobs.ashbyhq.com",
                    "linkedin.com", "xing.com", "stepstone.de", "wellfound.com",
                ],
                include_answer="basic",
                max_results=6,
            ),
            _search(
                client,
                f"{company} employee review culture Mitarbeiter Bewertung",
                search_depth="advanced",
                include_domains=[
                    "glassdoor.com", "kununu.com", "blind.co", "reddit.com",
                ],
                include_answer="advanced",
                max_results=5,
            ),
            return_exceptions=True,
        )

        # Replace exceptions with empty lists
        def _safe(r):
            if isinstance(r, Exception):
                logger.warning("Tavily search failed: %s", r)
                return []
            return r

        funding_raw   = _safe(funding_raw)
        news_raw      = _safe(news_raw)
        salary_raw    = _safe(salary_raw)
        hiring_raw    = _safe(hiring_raw)
        sentiment_raw = _safe(sentiment_raw)

        # Filter each result set — only keep on-target results
        funding_res   = _filter_results(funding_raw,   company)
        news_res      = _filter_results(news_raw,      company)
        salary_res    = _filter_results(salary_raw,    company)
        hiring_res    = _filter_results(hiring_raw,    company)
        sentiment_res = _filter_results(sentiment_raw, company)

        # Extract API — fires only if we have URLs from the signal-rich searches
        extract_urls = list({
            r["url"] for r in (funding_res + news_res + salary_res)
            if r.get("url")
        })
        extracts = []
        if extract_urls:
            try:
                raw_extracts = await _extract(client, extract_urls[:10])
                extracts = [
                    {
                        "url":     e.get("url", ""),
                        "content": (e.get("raw_content") or "")[:EXTRACT_CONTENT_CAP],
                    }
                    for e in raw_extracts
                    if e.get("raw_content")
                ]
            except Exception as e:
                logger.warning("Tavily Extract failed: %s", e)

    # Build source list — deduplicated across all searches
    all_results = funding_res + news_res + salary_res + hiring_res + sentiment_res
    sources = _sources(all_results)[:8]

    # Pull include_answer strings from the first result of each search
    def _answer(raw: list[dict]) -> str:
        return raw[0].get("_answer", "") if raw else ""

    return {
        # Funding
        "fundingAnswer":    _answer(funding_raw),
        "fundingSnippets":  _snippets(funding_res),
        "fundingExtracts":  extracts,
        # News
        "newsAnswer":       _answer(news_raw),
        "newsSnippets":     _snippets(news_res),
        # Salary
        "salaryAnswer":     _answer(salary_raw),
        "salarySnippets":   _snippets(salary_res),
        # Hiring
        "hiringAnswer":     _answer(hiring_raw),
        "hiringSnippets":   _snippets(hiring_res),
        # Sentiment
        "sentimentAnswer":  _answer(sentiment_raw),
        "sentimentSnippets": _snippets(sentiment_res),
        # Sources (for frontend cards — never from LLM)
        "sources": sources,
    }
