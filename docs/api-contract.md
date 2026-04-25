# $JOB API Contract

## POST /api/analyze-job-stock

### Request

```json
{
  "company": "string",
  "role": "string",
  "riskAppetite": "safe" | "balanced" | "ambitious" | "founder"
}
```

### Response

```json
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
```

### Notes

- `ticker` is a synthetic symbol derived from company + role (e.g. `N26-PM`)
- `rating` maps to: BUY = strong upside, HOLD = stable, SELL = caution, SHORT = avoid
- `scores` are all 0–100
- `chartData` contains 12 months of synthetic price history
- The frontend polls this single endpoint; no auth required
- On Tavily failure the endpoint still returns a valid response using LLM-only fallback
