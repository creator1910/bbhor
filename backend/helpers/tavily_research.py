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

TAVILY_API_URL      = "https://api.tavily.com/search"
TAVILY_EXTRACT_URL  = "https://api.tavily.com/extract"
TAVILY_RESEARCH_URL = "https://api.tavily.com/research"
TAVILY_API_KEY      = os.getenv("TAVILY_API_KEY", "")

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


# ── streaming entry point ────────────────────────────────────────────────────

async def research_company_stream(company: str, role: str):
    """
    Async generator. Yields {"type":"signal","category":str,"items":[str,...]}
    as each of the 5 Tavily searches completes (in arrival order), then yields
    {"type":"tavily_done","data":{...}} with the full merged research dict.
    Raises ValueError if TAVILY_API_KEY not set.
    """
    if not TAVILY_API_KEY:
        raise ValueError("TAVILY_API_KEY not set")

    queue: asyncio.Queue = asyncio.Queue()

    SEARCHES = [
        ("funding", dict(
            query=f"{company} funding valuation investors revenue growth",
            search_depth="basic",
            include_domains=[
                "crunchbase.com", "techcrunch.com", "sifted.eu",
                "gruenderszene.de", "eu-startups.com", "bloomberg.com",
            ],
            include_answer="basic",
            max_results=5,
        )),
        ("news", dict(
            query=f"{company} layoffs hiring restructuring growth news",
            search_depth="basic",
            topic="news",
            time_range="month",
            include_answer="basic",
            max_results=7,
        )),
        ("salary", dict(
            query=f"{role} salary compensation {company} total comp equity",
            search_depth="advanced",
            include_domains=[
                "levels.fyi", "glassdoor.com", "blind.co",
                "stepstone.de", "gehalt.de", "gehaltsvergleich.com", "payscale.com",
            ],
            include_answer="advanced",
            max_results=5,
        )),
        ("hiring", dict(
            query=f"{company} {role} job opening careers hiring",
            search_depth="basic",
            include_domains=[
                "greenhouse.io", "lever.co", "jobs.ashbyhq.com",
                "linkedin.com", "xing.com", "stepstone.de", "wellfound.com",
            ],
            include_answer="basic",
            max_results=6,
        )),
        ("sentiment", dict(
            query=f"{company} employee review culture Mitarbeiter Bewertung",
            search_depth="advanced",
            include_domains=["glassdoor.com", "kununu.com", "blind.co", "reddit.com"],
            include_answer="advanced",
            max_results=5,
        )),
    ]

    async with httpx.AsyncClient() as client:
        async def _run(category: str, kwargs: dict):
            try:
                q = kwargs.pop("query")
                result = await _search(client, q, **kwargs)
                await queue.put((category, result, None))
            except Exception as e:
                logger.warning("Tavily %s search failed in stream: %s", category, e)
                await queue.put((category, [], e))

        tasks = [asyncio.create_task(_run(cat, dict(kw))) for cat, kw in SEARCHES]

        raw_by_cat: dict = {}
        filtered_by_cat: dict = {}

        for _ in range(len(SEARCHES)):
            category, raw, error = await queue.get()
            raw_by_cat[category] = raw
            filtered = _filter_results(raw, company) if not error else []
            filtered_by_cat[category] = filtered
            snippets = _snippets(filtered, 3)
            if snippets:
                yield {"type": "signal", "category": category, "items": snippets}

        await asyncio.gather(*tasks, return_exceptions=True)

        # Extract API on top signal-rich URLs
        all_signal = (
            filtered_by_cat.get("funding", [])
            + filtered_by_cat.get("news", [])
            + filtered_by_cat.get("salary", [])
        )
        extract_urls = list({r["url"] for r in all_signal if r.get("url")})
        extracts: list = []
        if extract_urls:
            try:
                raw_extracts = await _extract(client, extract_urls[:10])
                extracts = [
                    {"url": e.get("url", ""), "content": (e.get("raw_content") or "")[:EXTRACT_CONTENT_CAP]}
                    for e in raw_extracts
                    if e.get("raw_content")
                ]
            except Exception as e:
                logger.warning("Tavily Extract failed in stream: %s", e)

    def _ans(cat: str) -> str:
        raw = raw_by_cat.get(cat, [])
        return raw[0].get("_answer", "") if raw else ""

    all_res = sum((filtered_by_cat.get(c, []) for c in ["funding", "news", "salary", "hiring", "sentiment"]), [])

    yield {"type": "tavily_done", "data": {
        "fundingAnswer":     _ans("funding"),
        "fundingSnippets":   _snippets(filtered_by_cat.get("funding",   [])),
        "fundingExtracts":   extracts,
        "newsAnswer":        _ans("news"),
        "newsSnippets":      _snippets(filtered_by_cat.get("news",      [])),
        "salaryAnswer":      _ans("salary"),
        "salarySnippets":    _snippets(filtered_by_cat.get("salary",    [])),
        "hiringAnswer":      _ans("hiring"),
        "hiringSnippets":    _snippets(filtered_by_cat.get("hiring",    [])),
        "sentimentAnswer":   _ans("sentiment"),
        "sentimentSnippets": _snippets(filtered_by_cat.get("sentiment", [])),
        "sources":           _sources(all_res)[:8],
    }}


# ── Tavily Research API (agentic salary+culture) ─────────────────────────────

async def research_salary_culture(company: str, role: str) -> dict:
    """
    Calls the Tavily Research API (agentic, multi-step) with domain filtering
    and a structured output_schema. Returns salary + culture structured data.

    Falls back to an empty dict on any error — callers must check hasSalaryRangeData.
    """
    if not TAVILY_API_KEY:
        return {}

    payload = {
        "api_key": TAVILY_API_KEY,
        "query": (
            f"What is the salary range for {role} at {company}? "
            f"What do employees say about the culture and work environment at {company}? "
            f"Include specific numbers from Glassdoor, Levels.fyi, Kununu, or Stepstone."
        ),
        "search_depth": "advanced",
        "include_domains": [
            "levels.fyi", "glassdoor.com", "stepstone.de", "gehalt.de",
            "kununu.com", "blind.co", "reddit.com", "payscale.com",
            "gehaltsvergleich.com",
        ],
        "max_results": 8,
        "output_schema": {
            "salary_range": {
                "min": "number (annual, in local currency, null if unknown)",
                "max": "number (annual, in local currency, null if unknown)",
                "currency": "string (ISO code like EUR, USD, GBP)",
                "source": "string (which site this came from)",
            },
            "culture_summary": "string (2-3 sentence summary of employee sentiment)",
            "culture_score": "number between 1 and 5 (Glassdoor/Kununu style, null if unknown)",
            "sources": [{"title": "string", "url": "string", "snippet": "string"}],
        },
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(TAVILY_RESEARCH_URL, json=payload, timeout=25.0)
            resp.raise_for_status()
            data = resp.json()

        structured = data.get("output_schema", data)
        salary = structured.get("salary_range") or {}
        sources_raw = structured.get("sources") or data.get("sources") or []

        result: dict = {
            "salaryMin":      _safe_num(salary.get("min")),
            "salaryMax":      _safe_num(salary.get("max")),
            "salaryCurrency": salary.get("currency") or "EUR",
            "salarySource":   salary.get("source") or "",
            "cultureSummary": structured.get("culture_summary") or "",
            "cultureScore":   _safe_num(structured.get("culture_score")),
            "sources": [
                {"title": s.get("title", ""), "url": s.get("url", ""), "snippet": s.get("snippet", "")}
                for s in sources_raw if s.get("url")
            ][:6],
        }
        return result

    except Exception as e:
        logger.warning("Tavily Research API failed: %s", e)
        return {}


def _safe_num(v) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


# ── batch entry point ─────────────────────────────────────────────────────────

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
