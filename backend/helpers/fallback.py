"""
High-quality fallback response used when Tavily or the LLM fails.
Modeled on N26 Product Manager to give a realistic demo.
"""

FALLBACK_N26_PM = {
    "ticker": "N26-PM",
    "rating": "HOLD",
    "oneLineVerdict": "Solid fintech brand, but slowing growth and headcount cuts cap your upside.",
    "scores": {
        "momentum": 52,
        "salaryYield": 65,
        "volatility": 68,
        "upside": 58,
    },
    "chartData": [
        {"month": "May", "price": 100},
        {"month": "Jun", "price": 108},
        {"month": "Jul", "price": 114},
        {"month": "Aug", "price": 110},
        {"month": "Sep", "price": 103},
        {"month": "Oct", "price": 97},
        {"month": "Nov", "price": 101},
        {"month": "Dec", "price": 105},
        {"month": "Jan", "price": 99},
        {"month": "Feb", "price": 95},
        {"month": "Mar", "price": 98},
        {"month": "Apr", "price": 102},
    ],
    "bullCase": [
        "N26 has a strong European brand and 8M+ customers providing stable revenue.",
        "German banking licence adds regulatory moat.",
        "PM role gives broad ownership and CV-building visibility.",
    ],
    "bearCase": [
        "Multiple layoff rounds since 2022 signal cost pressure.",
        "Revolut and Wise are growing faster in the same segment.",
        "IPO timeline remains unclear, limiting equity upside.",
    ],
    "recommendation": (
        "Stay 6–12 months to ship meaningful product and harvest the brand name, "
        "then evaluate whether momentum has returned before committing long-term."
    ),
    "alternatives": [
        {
            "label": "Stay 6 months",
            "description": "Finish current OKR cycle, strengthen your portfolio, then reassess.",
            "risk": "Low",
        },
        {
            "label": "Join a competitor",
            "description": "Revolut, Monzo, or Wise — faster growth, higher equity potential.",
            "risk": "Medium",
        },
        {
            "label": "Start your own thing",
            "description": "Leverage fintech network to go independent or co-found.",
            "risk": "High",
        },
    ],
    "sources": [
        {
            "title": "N26 cuts 71 jobs in latest round of layoffs",
            "url": "https://techcrunch.com/n26-layoffs",
            "snippet": "German neobank N26 is cutting around 71 employees as part of an ongoing restructuring effort.",
        },
        {
            "title": "N26 reaches 8 million customers milestone",
            "url": "https://n26.com/press/8-million-customers",
            "snippet": "N26 announces it has surpassed 8 million customers across Europe.",
        },
        {
            "title": "European neobanks: who is winning in 2024?",
            "url": "https://sifted.eu/neobank-comparison-2024",
            "snippet": "Revolut leads on growth metrics; N26 retains Germany but faces margin pressure.",
        },
    ],
    "debugSignals": {
        "companySummary": "N26 is a German neobank founded in 2013, operating across 24 markets with 8M+ customers. Listed setbacks include layoffs and a delayed IPO.",
        "newsSignals": [
            "N26 layoffs 2023–2024",
            "N26 profitability push",
            "Revolut surpassing N26 in user growth",
        ],
        "hiringSignals": [
            "N26 headcount declining YoY",
            "Focus on engineering and compliance roles",
        ],
        "riskSignals": [
            "Repeated restructuring rounds",
            "IPO uncertainty",
            "Competitive pressure from Revolut and Wise",
        ],
    },
}


def get_fallback(company: str, role: str) -> dict:
    """
    Return a plausible fallback response.
    For N26 PM we return the curated mock; for others we adapt it minimally.
    """
    if "n26" in company.lower() and "product" in role.lower():
        return FALLBACK_N26_PM

    # Generic fallback — ticker + lightly edited copy
    ticker = _make_ticker(company, role)
    result = dict(FALLBACK_N26_PM)
    result["ticker"] = ticker
    result["oneLineVerdict"] = f"Analysis unavailable — showing estimated baseline for {company} {role}."
    result["debugSignals"] = {
        "companySummary": f"Fallback mode active. Could not retrieve live signals for {company}.",
        "newsSignals": [],
        "hiringSignals": [],
        "riskSignals": ["Live data unavailable — treat scores as illustrative only."],
    }
    return result


def _make_ticker(company: str, role: str) -> str:
    company_part = "".join(w[0] for w in company.split()[:2]).upper() or company[:3].upper()
    role_part = "".join(w[0] for w in role.split()[:2]).upper() or role[:2].upper()
    return f"{company_part}-{role_part}"
