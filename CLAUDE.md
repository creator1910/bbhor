# CLAUDE.md

We are building $JOB, a hackathon MVP.

Concept:
Turn a user's employer into a synthetic career stock.

User input:
- company: string
- role: string
- riskAppetite: "safe" | "balanced" | "ambitious" | "founder"

Backend goal:
Expose POST /api/analyze-job-stock.

The endpoint should:
1. Accept company, role, riskAppetite
2. Query Tavily for public company signals
3. Extract:
   - company overview
   - recent news
   - hiring/careers signals
   - funding/layoff/product momentum if available
4. Send summarized research to an LLM
5. Return strict structured JSON matching the schema below

Response schema:
{
  "ticker": "string",
  "rating": "BUY" | "HOLD" | "SELL" | "SHORT",
  "oneLineVerdict": "string",
  "scores": {
    "momentum": number,
    "salaryYield": number,
    "volatility": number,
    "upside": number
  },
  "chartData": [
    { "month": "string", "price": number }
  ],
  "bullCase": ["string"],
  "bearCase": ["string"],
  "recommendation": "string",
  "alternatives": [
    {
      "label": "string",
      "description": "string",
      "risk": "Low" | "Medium" | "High"
    }
  ],
  "sources": [
    {
      "title": "string",
      "url": "string",
      "snippet": "string"
    }
  ],
  "debugSignals": {
    "companySummary": "string",
    "newsSignals": ["string"],
    "hiringSignals": ["string"],
    "riskSignals": ["string"]
  }
}

Rules:
- Prioritize demo reliability over perfect accuracy.
- If Tavily fails, return a high-quality fallback response.
- Never block the frontend.
- Always return valid JSON.
- Keep implementation simple.
- Add clear comments.
- Add README documentation for setup, APIs, tools, and judging.
- Environment variables:
  TAVILY_API_KEY
  GOOGLE_API_KEY depending on implementation
