"""
Gemini 2.5 Flash + Google Search Grounding research module for $JOB.

Runs a grounded research pass autonomously — Gemini decides what to search,
results are grounded in real Google Search data, and citations are extracted
from grounding_metadata (never from LLM hallucination).

Used in parallel with Tavily Research (salary/culture) and structured APIs.
Yields SSE-compatible signal events as research progresses.
"""

import asyncio
import logging
import os

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
MODEL = "gemini-2.5-flash"

RESEARCH_PROMPT = """Research {company} as an employer for someone considering a {role} position.

Find and summarize the following — use Google Search to get current information:
1. Company health: latest funding round, valuation, revenue trajectory, investor confidence
2. Recent news (last 30 days): layoffs, hiring announcements, leadership changes, product launches
3. Competitive position: how does {company} rank vs. direct competitors? Growing or losing ground?
4. General company outlook: IPO plans, expansion, partnerships, risk signals

Be factual and direct. Only report what you find — do not invent figures.
Format as a brief structured summary with clear section headers."""


def _extract_grounding_sources(response) -> list:
    """Extract real source URLs from Gemini grounding metadata."""
    sources = []
    try:
        candidate = response.candidates[0] if response.candidates else None
        if not candidate:
            return []
        gm = getattr(candidate, "grounding_metadata", None)
        if not gm:
            return []
        chunks = getattr(gm, "grounding_chunks", []) or []
        seen = set()
        for chunk in chunks:
            web = getattr(chunk, "web", None)
            if web:
                url = getattr(web, "uri", "") or ""
                title = getattr(web, "title", "") or ""
                if url and url not in seen:
                    seen.add(url)
                    sources.append({"title": title, "url": url, "snippet": ""})
    except Exception as e:
        logger.warning("Failed to extract grounding sources: %s", e)
    return sources


def _research_sync(company: str, role: str) -> dict:
    """
    Synchronous grounded research call. Returns:
      {"summary": str, "sources": [...], "signal_items": [...]}
    Designed to run inside asyncio.to_thread.
    """
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY not set")

    client = genai.Client(api_key=GOOGLE_API_KEY)
    prompt = RESEARCH_PROMPT.format(company=company, role=role)

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            temperature=1.0,
        ),
    )

    summary = response.text or ""
    sources = _extract_grounding_sources(response)

    # Extract signal items from the summary for the loading feed
    signal_items = []
    for line in summary.split("\n"):
        line = line.strip()
        if line and len(line) > 20 and not line.startswith("#"):
            # Take first 3 substantive lines as signal items
            signal_items.append(line[:200])
            if len(signal_items) >= 3:
                break

    return {"summary": summary, "sources": sources, "signal_items": signal_items}


async def research_with_grounding(company: str, role: str) -> dict:
    """
    Async wrapper for grounded research. Returns the full result dict.
    Use this for the non-streaming POST endpoint.
    """
    return await asyncio.to_thread(_research_sync, company, role)


async def research_with_grounding_stream(company: str, role: str):
    """
    Async generator. Yields SSE-compatible event dicts as research progresses.

    Events:
      {"type": "signal", "category": "grounding", "items": [str, ...]}
      {"type": "grounding_done", "summary": str, "sources": [...]}
    """
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_research_sync, company, role),
            timeout=20.0,
        )
        if result["signal_items"]:
            yield {"type": "signal", "category": "grounding", "items": result["signal_items"]}
        yield {"type": "grounding_done", "summary": result["summary"], "sources": result["sources"]}
    except asyncio.TimeoutError:
        logger.warning("Gemini grounding timed out after 20s")
        yield {"type": "grounding_done", "summary": "", "sources": []}
    except Exception as e:
        logger.warning("Gemini grounding failed: %s", e)
        yield {"type": "grounding_done", "summary": "", "sources": []}
