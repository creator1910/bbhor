"""
Structured data layer for $JOB.
Five independent async fetchers — each fails silently and returns {}.
All share one httpx.AsyncClient and have individual 12s timeouts.

Sources:
  - YC API        (global startup registry, free)
  - HN Algolia    (tech community hiring signal, free)
  - SEC EDGAR     (US public company filings, free)
  - Bundesagentur (German job market demand, free)
  - Handelsregister (German company registry, optional — needs HANDELSREGISTER_API_KEY)
"""

import asyncio
import logging
import os

import httpx

logger = logging.getLogger(__name__)

HANDELSREGISTER_API_KEY = os.getenv("HANDELSREGISTER_API_KEY", "")

TIMEOUT = 12.0  # seconds per source


async def _fetch_yc(client: httpx.AsyncClient, company: str) -> dict:
    """
    YC public API — matches company by name.
    Returns batch/status/team_size/industry on match; ycStatus="unknown" on miss.
    """
    resp = await client.get(
        "https://yc-oss.github.io/api/companies/all.json",
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    companies = resp.json()
    name_lower = company.lower().strip()
    match = next(
        (c for c in companies if c.get("name", "").lower().strip() == name_lower),
        None,
    )
    if not match:
        return {"hasYcData": True, "ycStatus": "unknown", "ycBatch": None, "ycTeamSize": None, "ycIndustry": None}
    return {
        "hasYcData": True,
        "ycStatus": match.get("status", "unknown"),
        "ycBatch": match.get("batch"),
        "ycTeamSize": match.get("team_size"),
        "ycIndustry": match.get("industry"),
    }


async def _fetch_hn(client: httpx.AsyncClient, company: str) -> dict:
    """
    HN Algolia — job post count as hiring signal.
    0 results means company may not recruit via HN, not that they aren't hiring.
    """
    resp = await client.get(
        "https://hn.algolia.com/api/v1/search",
        params={"query": company, "tags": "job", "hitsPerPage": 10},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    hits = data.get("hits", [])
    job_count = data.get("nbHits", 0)
    top_titles = [h.get("title", "") for h in hits[:3] if h.get("title")]
    return {
        "hasHnData": True,
        "hnJobPostCount": job_count,
        "hnTopJobTitles": top_titles,
    }


async def _fetch_sec(client: httpx.AsyncClient, company: str) -> dict:
    """
    SEC EDGAR — 8-K/10-K filings since 2024.
    0 results = private company (neutral), NOT low-volatility.
    """
    resp = await client.get(
        "https://efts.sec.gov/LATEST/search-index",
        params={
            "q": f'"{company}"',
            "forms": "8-K,10-K",
            "dateRange": "custom",
            "startdt": "2024-01-01",
        },
        headers={"User-Agent": "job-stock-analyzer contact@example.com"},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    hits = data.get("hits", {})
    total = hits.get("total", {}).get("value", 0) if isinstance(hits, dict) else 0
    recent_filings = [
        f"{h.get('_source', {}).get('form_type', '')} on {h.get('_source', {}).get('file_date', '')}"
        for h in (hits.get("hits", []) if isinstance(hits, dict) else [])[:3]
    ]
    return {
        "hasSecData": True,
        "secFilingCount": total,
        "secRecentFiling": recent_filings[0] if recent_filings else None,
        "secFilingSummaries": recent_filings,
    }


async def _fetch_bundesagentur(client: httpx.AsyncClient, role: str) -> dict:
    """
    Bundesagentur fur Arbeit — German market-wide vacancies for this role type.
    This is NOT company-specific — it measures role demand across Germany.
    High vacancy count = high market demand = candidate leverage for salaryYield.
    """
    resp = await client.get(
        "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs",
        params={
            "was": role,
            "wo": "Deutschland",
            "angebotsart": "1",
            "pav": "false",
            "size": "10",
        },
        headers={"X-API-Key": "jobboerse-jobsuche"},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    total = data.get("maxErgebnisse", 0)
    employers = [
        s.get("arbeitgeber", "")
        for s in data.get("stellenangebote", [])[:3]
        if s.get("arbeitgeber")
    ]
    return {
        "hasBundesagenturData": True,
        "bundesagenturVacancies": total,
        "bundesagenturTopEmployers": employers,
    }


async def _fetch_handelsregister(client: httpx.AsyncClient, company: str) -> dict:
    """
    Handelsregister.ai — German company registry.
    Only called if HANDELSREGISTER_API_KEY is set.
    Insolvency notice in publications = hard SHORT signal.
    """
    if not HANDELSREGISTER_API_KEY:
        return {}
    resp = await client.get(
        "https://api.handelsregister.ai/v1/company/search",
        params={"name": company},
        headers={"Authorization": f"Bearer {HANDELSREGISTER_API_KEY}"},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    results = data.get("results", [])
    if not results:
        return {"hasHandelsregisterData": True, "handelsregisterStatus": "not_found"}
    top = results[0]
    publications = top.get("publications", [])
    insolvency = any("insolvenz" in str(p).lower() for p in publications)
    return {
        "hasHandelsregisterData": True,
        "handelsregisterStatus": top.get("current_status", "unknown"),
        "handelsregisterFounded": top.get("founding_date"),
        "handelsregisterLegalForm": top.get("legal_form"),
        "handelsregisterInsolvency": insolvency,
    }


async def fetch_structured_signals(company: str, role: str) -> dict:
    """
    Run all five fetchers concurrently. Each has a 12s timeout.
    Any failure returns {} and is logged — never raises.
    Returns a merged dict of whatever succeeded.
    """
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            asyncio.wait_for(_fetch_yc(client, company), timeout=TIMEOUT),
            asyncio.wait_for(_fetch_hn(client, company), timeout=TIMEOUT),
            asyncio.wait_for(_fetch_sec(client, company), timeout=TIMEOUT),
            asyncio.wait_for(_fetch_bundesagentur(client, role), timeout=TIMEOUT),
            asyncio.wait_for(_fetch_handelsregister(client, company), timeout=TIMEOUT),
            return_exceptions=True,
        )

    merged = {}
    names = ["YC", "HN", "SEC", "Bundesagentur", "Handelsregister"]
    for name, result in zip(names, results):
        if isinstance(result, Exception):
            logger.warning("Structured data source %s failed: %s", name, result)
        else:
            merged.update(result)

    return merged
