"""Royalty schedule rules from the BookLeaf knowledge base.

Royalties are calculated quarterly and paid within 45 days of the quarter ending.
Payouts only happen once pending royalty reaches the Rs 1,000 threshold.
"""

from datetime import date, timedelta
from decimal import Decimal

PAYOUT_THRESHOLD = Decimal("1000")
PAYOUT_WINDOW_DAYS = 45


def _quarter_end(year: int, quarter: int) -> date:
    month = quarter * 3
    next_month_start = date(year + (month == 12), month % 12 + 1, 1)
    return next_month_start - timedelta(days=1)


def _previous_quarter_end(today: date) -> date:
    quarter = (today.month - 1) // 3  # 0 means the previous quarter is Q4 of last year
    return _quarter_end(today.year - 1, 4) if quarter == 0 else _quarter_end(today.year, quarter)


def next_payout_date(today: date | None = None) -> date:
    """The next date by which a royalty payout is due.

    If we're still inside the 45-day window after the last quarter ended, that
    payout is the next one; otherwise it's 45 days after the current quarter ends.
    """
    today = today or date.today()
    last_end = _previous_quarter_end(today)
    if today <= last_end + timedelta(days=PAYOUT_WINDOW_DAYS):
        return last_end + timedelta(days=PAYOUT_WINDOW_DAYS)
    current_end = _quarter_end(today.year, (today.month - 1) // 3 + 1)
    return current_end + timedelta(days=PAYOUT_WINDOW_DAYS)


def below_threshold(pending: Decimal | None) -> bool:
    return pending is not None and Decimal("0") < pending < PAYOUT_THRESHOLD
