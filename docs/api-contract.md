# $JOB API Contract

## POST /api/analyze-job-stock

### Request

```json
{
  "company": "string",
  "role": "string"
}
```

### Response

```json
{
  "ticker": "string (e.g. N26-PM — always system-generated, never LLM)",
  "rating": "BUY" | "HOLD" | "SELL" | "SHORT",
  "oneLineVerdict": "string",
  "scores": {
    "momentum":    "integer 0-100",
    "salaryYield": "integer 0-100",
    "volatility":  "integer 0-100",
    "upside":      "integer 0-100"
  },
  "chartData": [
    { "month": "string", "price": "number" }
  ],
  "bullCase":        ["string", "string", "string"],
  "bearCase":        ["string", "string", "string"],
  "recommendation":  "string (exactly 2 sentences)",
  "alternatives": [
    { "label": "string", "description": "string", "risk": "Low" | "Medium" | "High" }
  ],
  "sources": [
    { "title": "string", "url": "string", "snippet": "string" }
  ],
  "dataQuality": "high" | "medium" | "low",
  "debugSignals": {
    "companySummary":          "string",
    "newsSignals":             ["string"],
    "hiringSignals":           ["string"],
    "riskSignals":             ["string"],
    "ycStatus":                "string | null",
    "secFilingCount":          "number | null",
    "hnJobPostCount":          "number | null",
    "bundesagenturVacancies":  "number | null",
    "dataSourcesHit":          "number"
  }
}
```

### Frontend Guarantees (enforced by backend, never breaks)

| Field | Guarantee |
|---|---|
| `ticker` | Always present, format `ABBREV-ABBREV` |
| `rating` | Always one of: BUY, HOLD, SELL, SHORT |
| `scores.*` | Always integers in [0, 100] |
| `chartData` | Always exactly 12 entries; direction consistent with rating |
| `bullCase` | Always exactly 3 strings |
| `bearCase` | Always exactly 3 strings |
| `recommendation` | Always exactly 2 sentences |
| `alternatives` | Always exactly 3 items; `risk` always Low/Medium/High |
| `sources` | Always from Tavily, never LLM-generated |
| `dataQuality` | Always present: high (≥6 sources), medium (≥3), low (<3) |

### Score-to-rating consistency

The backend enforces internal consistency:
- `BUY`: momentum ≥ 55, upside ≥ 60
- `SHORT`: momentum ≤ 40, upside ≤ 35
- `SELL`: momentum ≤ 60

### Data sources

The backend combines up to 10 sources:

| Source | Type | Signal |
|---|---|---|
| Tavily funding search | Web | upside |
| Tavily news search (30 days) | Web | momentum, volatility |
| Tavily salary search (stepstone.de, glassdoor, levels.fyi) | Web | salaryYield |
| Tavily hiring search (xing.com, greenhouse, linkedin) | Web | momentum |
| Tavily sentiment search (kununu.com, glassdoor) | Web | volatility |
| Tavily Extract API | Web | all |
| YC API | Structured | upside, stage |
| HN Algolia | Structured | momentum |
| SEC EDGAR | Structured | volatility (US public cos) |
| Bundesagentur für Arbeit | Structured | salaryYield (DE role demand) |
| Handelsregister.ai | Structured | stability, volatility (DE cos) |

Each source fails independently. `dataQuality` reflects how many returned data.

### `dataQuality` display suggestion

```
high   → no badge needed (well-grounded analysis)
medium → subtle "Based on X sources" footnote
low    → yellow badge "Limited data — analysis uses AI estimates"
```

### Example curl

```bash
curl -X POST http://localhost:8000/api/analyze-job-stock \
  -H "Content-Type: application/json" \
  -d '{"company":"N26","role":"Product Manager"}'
```
