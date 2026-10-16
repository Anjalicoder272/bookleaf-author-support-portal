"""BookLeaf knowledge base, split by ticket category.

Cost control: instead of sending the whole knowledge base on every LLM call,
the draft-response prompt includes only COMPANY_OVERVIEW + TONE_GUIDELINES +
the one section matching the ticket's category (see sections_for()).
"""

COMPANY_OVERVIEW = """\
- BookLeaf Publishing is a self-publishing company operating in India and the US.
- Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid, with marketing and distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management.
- In-house printing facility and warehouse in Delhi; print partners include Repro India and Epitome Books."""

TONE_GUIDELINES = """\
- Always empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the author's concern before jumping to solutions.
- Be specific: include actual numbers, dates and statuses wherever possible, not vague reassurances.
- If something is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- If the issue needs escalation or investigation, give a clear timeline (e.g. "within 48 hours"), not open-ended promises.
- Always end with a clear next step for the author and/or the BookLeaf team."""

SECTIONS = {
    "royalty_payments": """\
Royalty Policy:
- 80/20 split: 80% of net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold: Rs 1,000. Below this, royalties roll over to the next quarter.
- Payouts are by bank transfer to the account linked in the author's dashboard.
- Authors can see a detailed royalty breakdown per platform in their dashboard.
Example guidance:
- "No royalty after 4 months": acknowledge frustration, explain quarterly cycle + 45-day window, check bank details are linked, give the specific next payout date; if genuinely overdue, escalate with a 48-hour timeline.
- "Royalty seems too low": explain the net profit calculation, offer a line-by-line breakdown, be transparent, not defensive.""",
    "isbn_metadata": """\
ISBN Policy:
- Every BookLeaf book gets a unique ISBN assigned by BookLeaf, registered under BookLeaf's publisher imprint.
- Authors wanting an ISBN under their own imprint must obtain it independently.
- ISBN errors (duplicate, wrong book linked) are HIGH PRIORITY and escalated to the production team.
- Metadata updates (e.g. book description) can be submitted via the dashboard or by email; changes reflect on platforms within 3-5 business days.
Example guidance:
- "Different ISBN on Amazon vs the physical copy": treat as high priority, acknowledge it is a serious data issue, confirm immediate escalation to production, give a 48-hour resolution timeline.""",
    "printing_quality": """\
Printing & Quality:
- In-house printing handles most orders; overflow or special formats go to Repro India or Epitome Books.
- Standard print turnaround: 5-7 business days from order confirmation.
- Quality issues (misprints, binding defects, colour inconsistency): BookLeaf arranges a FREE reprint after verification; the author may need to share photos of the defective copy.
Example guidance:
- "Blurry images, misaligned pages": apologise sincerely, ask for photos, confirm free reprint once verified, 5-7 business day timeline.""",
    "distribution": """\
Distribution & Availability:
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings typically go live within 7-10 business days after publication is complete.
- "Currently unavailable" on a platform usually means a stock sync issue; the team can trigger a re-sync within 24-48 hours.
Example guidance:
- Explain it is typically a stock sync issue, confirm a re-sync is being triggered, set a 24-48 hour expectation.""",
    "production_status": """\
Production Stages:
- Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
- Authors are updated by email at each stage.
- Delays usually happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).
Example guidance:
- "3 weeks and still in typesetting": check the actual status, be honest about the reason, give a specific updated timeline, never blame the author; frame it collaboratively.""",
    "general": """\
General:
- Metadata updates (e.g. book description on Amazon) can be submitted through the dashboard or by emailing the BookLeaf team; changes reflect within 3-5 business days.
- Author profile and account changes are handled by the support team.""",
}


def sections_for(category: str) -> str:
    """Only the knowledge relevant to this ticket, to keep prompts small."""
    return SECTIONS.get(category, SECTIONS["general"])
