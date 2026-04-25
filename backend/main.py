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
import logging
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()  # picks up .env before any os.getenv calls in helpers

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.helpers.tavily_research import research_company
from backend.helpers.structured_data import fetch_structured_signals
from backend.helpers.research_context import build_context, count_sources_hit
from backend.helpers.llm_scoring import score_job
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
