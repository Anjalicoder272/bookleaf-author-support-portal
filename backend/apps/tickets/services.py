"""Ticket workflows that involve the AI: triage on creation and draft replies for admins."""

import logging
import threading
from datetime import date

from django.conf import settings
from django.db import close_old_connections, transaction
from django.utils import timezone

from apps.ai import fallback
from apps.ai.service import AIUnavailable, draft_reply, triage_ticket
from apps.books.royalty import PAYOUT_THRESHOLD, below_threshold, next_payout_date

from .models import Ticket

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 6  # cost control: only the recent conversation goes to the model
MAX_MESSAGE_CHARS = 800


# ---------- Triage ----------


def _book_line(ticket: Ticket) -> str:
    if not ticket.book:
        return "General / Account level (no specific book)"
    return f"{ticket.book.title} (status: {ticket.book.status})"


def run_triage(ticket_id: int) -> None:
    """Classify a ticket with the AI, falling back to rules if the AI is unavailable.

    Admin overrides are never replaced: if an admin already changed the category or
    priority, only the ai_* suggestion fields are updated.
    """
    ticket = Ticket.objects.select_related("book").get(pk=ticket_id)
    try:
        result = triage_ticket(ticket.subject, ticket.description, _book_line(ticket)).model_dump()
        ticket.ai_status = Ticket.AIStatus.DONE
    except AIUnavailable:
        result = fallback.classify(ticket.subject, ticket.description)
        ticket.ai_status = Ticket.AIStatus.FAILED

    ticket.ai_category = result["category"]
    ticket.ai_priority = result["priority"]
    ticket.ai_reasoning = result["reasoning"]
    if not ticket.category_overridden:
        ticket.category = result["category"]
    if not ticket.priority_overridden:
        ticket.priority = result["priority"]
    ticket.save()


def _triage_in_background(ticket_id: int) -> None:
    try:
        run_triage(ticket_id)
    except Exception:
        logger.exception("Triage failed for ticket %s", ticket_id)
    finally:
        close_old_connections()


def schedule_triage(ticket: Ticket) -> None:
    """Triage after the ticket is committed, so creating a ticket never waits on (or fails because of) the AI."""
    if settings.AI_TRIAGE_SYNC:
        transaction.on_commit(lambda: run_triage(ticket.pk))
    else:
        transaction.on_commit(lambda: threading.Thread(target=_triage_in_background, args=(ticket.pk,), daemon=True).start())


# ---------- Draft replies ----------


def _money(value) -> str:
    return "not set yet" if value is None else f"Rs {value:,.0f}"


def _book_facts(book) -> str:
    lines = [
        f"- Title: {book.title} (ISBN {book.isbn or 'not assigned'})",
        f"- Status: {book.status}",
    ]
    if book.is_published:
        lines += [
            f"- Published: {book.publication_date}, MRP {_money(book.mrp)}, available on: {', '.join(book.available_on) or 'none'}",
            f"- Copies sold: {book.total_copies_sold}; royalty earned {_money(book.total_royalty_earned)}, "
            f"paid {_money(book.royalty_paid)}, pending {_money(book.royalty_pending)}",
            f"- Last payout: {book.last_royalty_payout_date or 'no payout yet'}",
            f"- Next royalty payout due by: {next_payout_date():%d %B %Y}",
        ]
        if below_threshold(book.royalty_pending):
            lines.append(f"- Pending royalty is below the Rs {PAYOUT_THRESHOLD:,.0f} payout threshold, so it rolls over")
    else:
        lines.append("- Not yet published, so there are no sales or royalties yet")
    return "\n".join(lines)


def _all_books_summary(author) -> str:
    books = list(author.books.all())
    if not books:
        return "- The author has no books on record."
    return "\n".join(
        f"- {b.title}: {b.status}; pending royalty {_money(b.royalty_pending)}" for b in books
    )


def _conversation(ticket: Ticket) -> str:
    entries = [f"[Author, original query] Subject: {ticket.subject}\n{ticket.description[:MAX_MESSAGE_CHARS]}"]
    recent = list(ticket.messages.select_related("sender").order_by("-created_at")[:MAX_HISTORY_MESSAGES])
    for msg in reversed(recent):
        who = "BookLeaf support" if msg.sender and msg.sender.is_admin else "Author"
        entries.append(f"[{who}] {msg.body[:MAX_MESSAGE_CHARS]}")
    return "\n\n".join(entries)


def _draft_is_stale(ticket: Ticket) -> bool:
    if not ticket.ai_draft or not ticket.ai_draft_generated_at:
        return True
    latest = ticket.messages.order_by("-created_at").values_list("created_at", flat=True).first()
    return bool(latest and latest > ticket.ai_draft_generated_at)


def get_draft(ticket: Ticket, *, regenerate: bool = False) -> tuple[str, bool]:
    """Return (draft_text, ai_available).

    The draft is cached on the ticket and only regenerated when asked or when the
    conversation has moved on, so reopening a ticket doesn't cost another LLM call.
    """
    if not regenerate and not _draft_is_stale(ticket):
        return ticket.ai_draft, True

    author = ticket.author
    try:
        text = draft_reply(
            category=ticket.category or "general",
            category_label=ticket.get_category_display() or "General Inquiry",
            author_name=author.name,
            book_facts=_book_facts(ticket.book) if ticket.book else _all_books_summary(author),
            conversation=_conversation(ticket),
            today=f"{date.today():%d %B %Y}",
        )
    except AIUnavailable:
        return ticket.ai_draft, False  # may be an older cached draft, or empty: admin writes manually

    ticket.ai_draft = text
    ticket.ai_draft_generated_at = timezone.now()
    ticket.save(update_fields=["ai_draft", "ai_draft_generated_at", "updated_at"])
    return text, True
