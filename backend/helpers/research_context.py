"""
Builds the typed ResearchContext dict from Tavily + structured data results.
All has* flags are always set (True/False) so the prompt builder
and main.py can check them without KeyError.
"""


def build_context(tavily: dict, structured: dict) -> dict:
    """
    Merge tavily_research output and structured_data output into a
    single context object with explicit presence flags.
    """
    ctx: dict = {}

    # ── Tavily signals ──────────────────────────────────────────────────────
    ctx["hasFundingData"]   = bool(tavily.get("fundingAnswer") or tavily.get("fundingSnippets"))
    ctx["hasRecentNews"]    = bool(tavily.get("newsAnswer") or tavily.get("newsSnippets"))
    ctx["hasSalaryData"]    = bool(tavily.get("salaryAnswer") or tavily.get("salarySnippets"))
    ctx["hasHiringData"]    = bool(tavily.get("hiringAnswer") or tavily.get("hiringSnippets"))
    ctx["hasSentimentData"] = bool(tavily.get("sentimentAnswer") or tavily.get("sentimentSnippets"))

    ctx["fundingAnswer"]    = tavily.get("fundingAnswer", "")
    ctx["fundingSnippets"]  = tavily.get("fundingSnippets", [])
    ctx["fundingExtracts"]  = tavily.get("fundingExtracts", [])
    ctx["newsAnswer"]       = tavily.get("newsAnswer", "")
    ctx["newsSnippets"]     = tavily.get("newsSnippets", [])
    ctx["salaryAnswer"]     = tavily.get("salaryAnswer", "")
    ctx["salarySnippets"]   = tavily.get("salarySnippets", [])
    ctx["hiringAnswer"]     = tavily.get("hiringAnswer", "")
    ctx["hiringSnippets"]   = tavily.get("hiringSnippets", [])
    ctx["sentimentAnswer"]  = tavily.get("sentimentAnswer", "")
    ctx["sentimentSnippets"]= tavily.get("sentimentSnippets", [])
    ctx["sources"]          = tavily.get("sources", [])

    # ── YC ──────────────────────────────────────────────────────────────────
    ctx["hasYcData"]    = structured.get("hasYcData", False)
    ctx["ycStatus"]     = structured.get("ycStatus")
    ctx["ycBatch"]      = structured.get("ycBatch")
    ctx["ycTeamSize"]   = structured.get("ycTeamSize")
    ctx["ycIndustry"]   = structured.get("ycIndustry")

    # ── HN ──────────────────────────────────────────────────────────────────
    ctx["hasHnData"]        = structured.get("hasHnData", False)
    ctx["hnJobPostCount"]   = structured.get("hnJobPostCount")
    ctx["hnTopJobTitles"]   = structured.get("hnTopJobTitles", [])

    # ── SEC ─────────────────────────────────────────────────────────────────
    ctx["hasSecData"]          = structured.get("hasSecData", False)
    ctx["secFilingCount"]      = structured.get("secFilingCount")
    ctx["secRecentFiling"]     = structured.get("secRecentFiling")
    ctx["secFilingSummaries"]  = structured.get("secFilingSummaries", [])

    # ── Bundesagentur ────────────────────────────────────────────────────────
    ctx["hasBundesagenturData"]      = structured.get("hasBundesagenturData", False)
    ctx["bundesagenturVacancies"]    = structured.get("bundesagenturVacancies")
    ctx["bundesagenturTopEmployers"] = structured.get("bundesagenturTopEmployers", [])

    # ── Handelsregister ──────────────────────────────────────────────────────
    ctx["hasHandelsregisterData"]    = structured.get("hasHandelsregisterData", False)
    ctx["handelsregisterStatus"]     = structured.get("handelsregisterStatus")
    ctx["handelsregisterFounded"]    = structured.get("handelsregisterFounded")
    ctx["handelsregisterLegalForm"]  = structured.get("handelsregisterLegalForm")
    ctx["handelsregisterInsolvency"] = structured.get("handelsregisterInsolvency", False)

    return ctx


def count_sources_hit(ctx: dict) -> int:
    """Count how many data sources returned real data."""
    flags = [
        "hasFundingData", "hasRecentNews", "hasSalaryData",
        "hasHiringData", "hasSentimentData",
        "hasYcData", "hasHnData", "hasSecData",
        "hasBundesagenturData", "hasHandelsregisterData",
    ]
    return sum(1 for f in flags if ctx.get(f))
