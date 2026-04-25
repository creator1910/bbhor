"""
LLM scoring helper using Google Gemini.
Takes aggregated research signals and returns a structured $JOB analysis.
"""

import os
import json
import re
import google.generativeai as genai

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# Configure Gemini once at import time
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)


SYSTEM_PROMPT = """You are a sharp, opinionated career analyst who prices jobs like financial assets.
Given research signals about a company and role, produce a synthetic stock analysis in strict JSON.
Be concise, insightful, and slightly provocative — this is a hackathon product called $JOB.
Never make up URLs. Never include markdown. Return only valid JSON."""

RESPONSE_SCHEMA = """{
  "ticker": "<COMPANY_ABBREV>-<ROLE_ABBREV>",
  "rating": "BUY" | "HOLD" | "SELL" | "SHORT",
  "oneLineVerdict": "<one punchy sentence>",
  "scores": {
    "momentum": <0-100>,
    "salaryYield": <0-100>,
    "volatility": <0-100>,
    "upside": <0-100>
  },
  "chartData": [
    {"month": "May", "price": <number>},
    ... 12 months total, starting from current month - 11
  ],
  "bullCase": ["<string>", "<string>", "<string>"],
  "bearCase": ["<string>", "<string>", "<string>"],
  "recommendation": "<2-3 sentence actionable advice>",
  "alternatives": [
    {"label": "Stay 6 months", "description": "<string>", "risk": "Low"},
    {"label": "Join a competitor", "description": "<string>", "risk": "Medium"},
    {"label": "Start your own thing", "description": "<string>", "risk": "High"}
  ],
  "debugSignals": {
    "companySummary": "<string>",
    "newsSignals": ["<string>"],
    "hiringSignals": ["<string>"],
    "riskSignals": ["<string>"]
  }
}"""


def _build_prompt(company: str, role: str, risk_appetite: str, research: dict) -> str:
    return f"""Analyze this job as a synthetic career stock.

Company: {company}
Role: {role}
Candidate risk appetite: {risk_appetite}

Research signals:
Company summary: {research.get('companySummary', 'N/A')}

Recent news:
{chr(10).join(research.get('newsSignals', ['No news signals available']))}

Hiring signals:
{chr(10).join(research.get('hiringSignals', ['No hiring signals available']))}

Return ONLY valid JSON matching this schema exactly:
{RESPONSE_SCHEMA}

Important:
- chartData must have exactly 12 entries with realistic price movement (start ~100, vary ±30)
- riskSignals should list concrete risks you identified
- Adjust scores and rating based on the {risk_appetite} risk appetite
"""


def score_job(company: str, role: str, risk_appetite: str, research: dict) -> dict:
    """
    Call Gemini to produce a structured job stock analysis.
    Raises on API error — caller should catch and use fallback.
    """
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY not set")

    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            temperature=0.7,
            response_mime_type="application/json",
        ),
    )

    prompt = _build_prompt(company, role, risk_appetite, research)
    response = model.generate_content(prompt)
    raw = response.text.strip()

    # Strip markdown code fences if model ignores mime type hint
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    parsed = json.loads(raw)
    return _validate_and_patch(parsed, company, role)


def _validate_and_patch(data: dict, company: str, role: str) -> dict:
    """Ensure required keys exist; patch missing ones with safe defaults."""
    required_keys = [
        "ticker", "rating", "oneLineVerdict", "scores",
        "chartData", "bullCase", "bearCase", "recommendation",
        "alternatives", "debugSignals",
    ]
    for key in required_keys:
        if key not in data:
            raise ValueError(f"LLM response missing required key: {key}")

    # Clamp scores to 0–100
    for score_key in ["momentum", "salaryYield", "volatility", "upside"]:
        if score_key in data.get("scores", {}):
            data["scores"][score_key] = max(0, min(100, int(data["scores"][score_key])))

    # Ensure rating is one of the allowed values
    if data.get("rating") not in {"BUY", "HOLD", "SELL", "SHORT"}:
        data["rating"] = "HOLD"

    # Ensure chartData has at least some entries
    if not data.get("chartData"):
        data["chartData"] = [{"month": f"M{i}", "price": 100} for i in range(12)]

    return data
