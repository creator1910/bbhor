"""
$JOB Backend — FastAPI
Exposes POST /api/analyze-job-stock

Pipeline:
  1. Tavily researches the company
  2. Gemini scores the job as a synthetic stock
  3. On any failure, a high-quality fallback is returned

Run locally:
  uvicorn backend.main:app --reload --port 8000
"""

import asyncio
import logging
from dotenv import load_dotenv
load_dotenv()  # picks up .env before any os.getenv calls in helpers

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.helpers.tavily_research import research_company
from backend.helpers.llm_scoring import score_job
from backend.helpers.fallback import get_fallback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="$JOB API", version="1.0.0")

# Allow the Lovable/Vercel frontend to call this API during the hackathon
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


class JobRequest(BaseModel):
    company: str = Field(..., min_length=1, max_length=200, example="N26")
    role: str = Field(..., min_length=1, max_length=200, example="Product Manager")


@app.get("/")
def health():
    return {"status": "ok", "service": "$JOB API"}


@app.post("/api/analyze-job-stock")
async def analyze_job_stock(req: JobRequest):
    """
    Main endpoint. Returns a synthetic stock analysis for the given job.
    Never raises — always returns valid JSON to keep the frontend unblocked.
    """
    company = req.company.strip()
    role = req.role.strip()

    logger.info("Analyzing: company=%s role=%s", company, role)

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
        result = score_job(company, role, research)
        # Attach real sources from Tavily if we got them
        if sources:
            result["sources"] = sources
        logger.info("LLM scoring complete — rating=%s", result.get("rating"))
        return result
    except Exception as e:
        logger.warning("LLM scoring failed (%s) — using fallback response", e)
        fallback = get_fallback(company, role)
        if sources:
            fallback["sources"] = sources
        return fallback
