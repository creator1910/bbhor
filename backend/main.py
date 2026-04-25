"""
$JOB — FastAPI serves both the API and the built React frontend.

Pipeline:
  1. Tavily research (5 searches + Extract) and structured data (YC/HN/SEC/Bundesagentur/Handelsregister)
     run in parallel — 20s hard cap
  2. Results merged into a typed ResearchContext
  3. Gemini 2.5 Flash + thinking mode synthesises the analysis — 30s cap
  4. _validate_and_patch enforces all frontend contracts deterministically
  5. On any failure, a curated fallback is returned

Dev:   cd frontend && bun dev   (port 8080, proxies /api to port 8000)
       uvicorn backend.main:app --reload --port 8000

Demo:  bun --cwd frontend run build
       uvicorn backend.main:app --port 8000
"""

import asyncio
import json
import logging
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()  # picks up .env before any os.getenv calls in helpers

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.helpers.tavily_research import research_company, research_company_stream, research_salary_culture
from backend.helpers.gemini_research import research_with_grounding_stream
from backend.helpers.structured_data import fetch_structured_signals
from backend.helpers.research_context import build_context, count_sources_hit
from backend.helpers.llm_scoring import score_job, score_job_stream_async
from backend.helpers.fallback import get_fallback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="$JOB API", version="2.0.0")

# CORS open for Lovable/Vercel frontend during hackathon
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


class JobRequest(BaseModel):
    company: str = Field(..., min_length=1, max_length=200, example="N26")
    role:    str = Field(..., min_length=1, max_length=200, example="Product Manager")


@app.post("/api/analyze-job-stock")
async def analyze_job_stock(req: JobRequest):
    """
    Main endpoint. Always returns complete, valid JSON — never raises.
    dataQuality field indicates how many data sources contributed.
    """
    company = req.company.strip()
    role    = req.role.strip()
    logger.info("Analyzing: company=%s role=%s", company, role)

    # ── Phase 1: Parallel data collection — 20s hard cap ────────────────────
    tavily_res:     dict = {}
    structured_res: dict = {}
    try:
        results = await asyncio.wait_for(
            asyncio.gather(
                research_company(company, role),
                fetch_structured_signals(company, role),
                return_exceptions=True,
            ),
            timeout=20.0,
        )
        t, s = results
        if isinstance(t, Exception):
            logger.warning("Tavily failed: %s", t)
        else:
            tavily_res = t

        if isinstance(s, Exception):
            logger.warning("Structured data failed: %s", s)
        else:
            structured_res = s

    except asyncio.TimeoutError:
        logger.warning("Research phase timed out after 20s — proceeding with partial signals")

    logger.info(
        "Research complete — tavily_keys=%d structured_keys=%d",
        len(tavily_res), len(structured_res),
    )

    # ── Phase 2: Build typed signal context ──────────────────────────────────
    ctx     = build_context(tavily_res, structured_res)
    sources = ctx.pop("sources", [])

    # ── Phase 3: LLM synthesis — 30s cap ─────────────────────────────────────
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(score_job, company, role, ctx),
            timeout=30.0,
        )
        # Sources always come from Tavily, never from LLM
        result["sources"] = sources

        # dataQuality is deterministic — not LLM-generated
        hits = count_sources_hit(ctx)
        result["dataQuality"] = "high" if hits >= 6 else "medium" if hits >= 3 else "low"

        # Expose data provenance in debugSignals
        ds = result.get("debugSignals", {})
        ds["ycStatus"]               = ctx.get("ycStatus")
        ds["secFilingCount"]         = ctx.get("secFilingCount")
        ds["hnJobPostCount"]         = ctx.get("hnJobPostCount")
        ds["bundesagenturVacancies"] = ctx.get("bundesagenturVacancies")
        ds["dataSourcesHit"]         = hits
        result["debugSignals"] = ds

        logger.info(
            "Scoring complete — rating=%s dataQuality=%s sources_hit=%d",
            result.get("rating"), result.get("dataQuality"), hits,
        )
        return result

    except asyncio.TimeoutError:
        logger.warning("LLM timed out after 30s — using fallback")
    except Exception as e:
        logger.warning("LLM scoring failed (%s) — using fallback", e)

    # ── Phase 4: Fallback ─────────────────────────────────────────────────────
    fallback = get_fallback(company, role)
    fallback["sources"]     = sources
    fallback["dataQuality"] = "low"
    return fallback


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@app.post("/api/analyze-job-stock/stream")
async def analyze_job_stock_stream(req: JobRequest):
    """
    SSE streaming endpoint. Emits signal events as Tavily searches complete,
    then Gemini thinking chunks, then the validated result object.
    Always emits exactly one {"type":"result"} event — never leaves client hanging.
    """
    company = req.company.strip()
    role    = req.role.strip()
    logger.info("Stream: company=%s role=%s", company, role)

    async def event_stream():
        sources: list = []
        tavily_data: dict = {}

        try:
            # Phase 1: all 3 research engines fire in parallel
            structured_task = asyncio.create_task(
                asyncio.wait_for(fetch_structured_signals(company, role), timeout=15.0)
            )
            salary_culture_task = asyncio.create_task(
                asyncio.wait_for(research_salary_culture(company, role), timeout=20.0)
            )

            yield _sse({"type": "status", "label": "Searching company data…"})

            # Tavily 5-search stream (yields signal events live)
            try:
                async for event in research_company_stream(company, role):
                    if event["type"] == "tavily_done":
                        tavily_data = event["data"]
                        sources = tavily_data.get("sources", [])
                    else:
                        yield _sse(event)
            except Exception as e:
                logger.warning("Tavily stream failed: %s", e)

            # Gemini grounding stream (yields signal + grounding_done)
            grounding_summary = ""
            grounding_sources: list = []
            try:
                async for event in research_with_grounding_stream(company, role):
                    if event["type"] == "grounding_done":
                        grounding_summary = event.get("summary", "")
                        grounding_sources = event.get("sources", [])
                    else:
                        yield _sse(event)
            except Exception as e:
                logger.warning("Gemini grounding stream failed: %s", e)

            # Collect structured data (usually already done)
            structured_res: dict = {}
            try:
                structured_res = await structured_task
            except Exception as e:
                logger.warning("Structured data failed in stream: %s", e)

            # Collect salary/culture data
            salary_culture: dict = {}
            try:
                salary_culture = await salary_culture_task
            except Exception as e:
                logger.warning("Tavily Research (salary/culture) failed in stream: %s", e)

            # Emit structured signals
            items = []
            if structured_res.get("ycStatus") and structured_res["ycStatus"] != "unknown":
                items.append(f"YC {structured_res.get('ycBatch', '?')} · {structured_res['ycStatus']}")
            if structured_res.get("hnJobPostCount"):
                items.append(f"{structured_res['hnJobPostCount']} HN job posts")
            if structured_res.get("secFilingCount"):
                items.append(f"{structured_res['secFilingCount']} SEC filings since 2024")
            if structured_res.get("bundesagenturVacancies"):
                items.append(
                    f"{structured_res['bundesagenturVacancies']} open {role!r} roles in Germany"
                )
            if salary_culture.get("salaryMin") and salary_culture.get("salaryMax"):
                cur = salary_culture.get("salaryCurrency", "")
                items.append(
                    f"Salary range: {cur}{int(salary_culture['salaryMin']):,}–{cur}{int(salary_culture['salaryMax']):,}"
                )
            if items:
                yield _sse({"type": "signal", "category": "structured", "items": items})

            # Merge all sources: Tavily search + grounding + salary/culture
            all_sources = (
                sources
                + grounding_sources
                + salary_culture.get("sources", [])
            )
            # Deduplicate by URL
            seen_urls: set = set()
            deduped_sources = []
            for s in all_sources:
                url = s.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    deduped_sources.append(s)

            # Phase 2: build context + stream LLM
            merged_tavily = {
                **tavily_data,
                **salary_culture,
                "groundingSummary": grounding_summary,
            }
            ctx = build_context(merged_tavily, structured_res)
            ctx_sources = deduped_sources or ctx.pop("sources", sources)

            yield _sse({"type": "status", "label": "Analyzing with Gemini 2.5 Flash…"})

            result = None
            async for event in score_job_stream_async(company, role, ctx):
                if event["type"] == "result":
                    result = event["data"]
                    result["sources"] = ctx_sources
                    hits = count_sources_hit(ctx)
                    result["dataQuality"] = "high" if hits >= 6 else "medium" if hits >= 3 else "low"
                    ds = result.get("debugSignals", {})
                    ds["ycStatus"]               = ctx.get("ycStatus")
                    ds["secFilingCount"]         = ctx.get("secFilingCount")
                    ds["hnJobPostCount"]         = ctx.get("hnJobPostCount")
                    ds["bundesagenturVacancies"] = ctx.get("bundesagenturVacancies")
                    ds["salaryMin"]              = ctx.get("salaryMin")
                    ds["salaryMax"]              = ctx.get("salaryMax")
                    ds["salaryCurrency"]         = ctx.get("salaryCurrency")
                    ds["cultureScore"]           = ctx.get("cultureScore")
                    ds["dataSourcesHit"]         = hits
                    result["debugSignals"] = ds
                    yield _sse({"type": "result", "data": result})
                elif event["type"] == "error":
                    logger.warning("LLM stream error: %s", event.get("message"))
                else:
                    yield _sse(event)  # thinking chunks

            if result is None:
                raise RuntimeError("LLM did not emit a result")

        except Exception as e:
            logger.warning("Stream pipeline failed (%s) — emitting fallback", e)
            fallback = get_fallback(company, role)
            fallback["sources"]     = sources
            fallback["dataQuality"] = "low"
            yield _sse({"type": "result", "data": fallback})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Static frontend (built with: bun --cwd frontend run build) ───────────────
_DIST = Path(__file__).parent.parent / "dist"

if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        candidate = _DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")
else:
    @app.get("/")
    def dev_root():
        return {"status": "ok", "service": "$JOB API", "version": "2.0.0"}
