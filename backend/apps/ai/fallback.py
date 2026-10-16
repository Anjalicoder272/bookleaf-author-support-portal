"""Rule-based triage used when the LLM is unavailable (no key, timeout, rate limit, outage).

It's deliberately simple: good enough to sort the queue sensibly until the AI is back,
and the ticket is marked so admins know the labels came from rules, not the model.
"""

import re

CATEGORY_KEYWORDS = [
    ("isbn_metadata", r"\bisbn\b|metadata|wrong (title|author name|description)"),
    ("royalty_payments", r"royalt|payout|payment|paid|bank|statement|earning|₹|\brs\.?\b|inr"),
    ("printing_quality", r"print|blurr|misalign|binding|defect|damaged|torn|colou?r|quality|copies"),
    ("distribution", r"amazon|flipkart|unavailable|not available|out of stock|listing|not live|store"),
    ("production_status", r"typeset|proofread|cover design|editing|production|still in|when will.*(done|publish)"),
]

NEGATION = r"(\bno\b|\bnot\b|\bnever\b|n't)"
CRITICAL = (
    rf"(\d+|six|several)\s*months?.*{NEGATION}.*(royalt|pay)"
    rf"|{NEGATION}.*(royalt|pay).*(\d+|six|several)\s*months?"
    r"|legal|lawyer|consumer court"
)
HIGH = (
    r"\bisbn\b|unavailable|not available|overdue|still (not|haven)|again|urgent|immediately"
    r"|defect|misprint|blurr|misalign|binding|damaged|torn"
)
LOW = r"\bbio\b|profile|how (do|can) i|can i update|just wanted to know|question about"


def classify(subject: str, description: str) -> dict:
    text = f"{subject}\n{description}".lower()

    category = next((cat for cat, pattern in CATEGORY_KEYWORDS if re.search(pattern, text)), "general")

    if re.search(CRITICAL, text):
        priority = "critical"
    elif re.search(HIGH, text) or category == "isbn_metadata":
        priority = "high"
    elif re.search(LOW, text):
        priority = "low"
    else:
        priority = "medium"

    return {"category": category, "priority": priority, "reasoning": "Rule-based fallback (AI unavailable)."}
