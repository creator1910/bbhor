"""
$JOB — FastAPI serves both the API and the built React frontend.

Pipeline:
  1. Tavily researches the company
  2. Gemini scores the job as a synthetic stock
  3. On any failure, a high-quality fallback is returned

Dev:   cd frontend && bun dev   (port 8080, proxies /api to port 8000)
       uvicorn backend.main:app --reload --port 8000

Demo:  bun --cwd frontend run build
       uvicorn backend.main:app --port 8000
"""

import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()  # picks up .env before any os.getenv calls in helpers

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.helpers.tavily_research import research_company
from backend.helpers.llm_scoring import score_job
from backend.helpers.fallback import get_fallback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="$JOB API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


class JobRequest(BaseModel):
    company: str = Field(..., min_length=1, max_length=200, example="N26")
    role: str = Field(..., min_length=1, max_length=200, example="Product Manager")
    riskAppetite: str = Field(
        default="balanced",
        pattern="^(safe|balanced|ambitious|founder)$",
        example="balanced",
    )


@app.post("/api/analyze-job-stock")
async def analyze_job_stock(req: JobRequest):
    """
    Main endpoint. Returns a synthetic stock analysis for the given job.
    Never raises — always returns valid JSON to keep the frontend unblocked.
    """
    company = req.company.strip()
    role = req.role.strip()
    risk_appetite = req.riskAppetite

    logger.info("Analyzing: company=%s role=%s risk=%s", company, role, risk_appetite)

    # Step 1: Research via Tavily
    research = {}
    sources = []
    try:
        research = await research_company(company, role)
        sources = research.pop("sources", [])
        logger.info("Tavily research complete")
    except Exception as e:
        logger.warning("Tavily failed (%s) — proceeding with empty research", e)

    # Step 2: LLM scoring via Gemini
    try:
        result = score_job(company, role, risk_appetite, research)
        # Attach real sources from Tavily if we got them
        if sources:
            result["sources"] = sources
        logger.info("LLM scoring complete — rating=%s", result.get("rating"))
        return result
    except Exception as e:
        logger.warning("LLM scoring failed (%s) — using fallback response", e)
        fallback = get_fallback(company, role, risk_appetite)
        if sources:
            fallback["sources"] = sources
        return fallback


# --- Static frontend (built with: bun --cwd frontend run build) ---
_DIST = Path(__file__).parent.parent / "frontend" / "dist"

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
        return {"status": "ok", "hint": "Run 'bun --cwd frontend run build' to serve the UI here."}
