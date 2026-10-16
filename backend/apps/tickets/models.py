from django.conf import settings
from django.db import models


class Ticket(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    class Category(models.TextChoices):
        ROYALTY = "royalty_payments", "Royalty & Payments"
        ISBN = "isbn_metadata", "ISBN & Metadata Issues"
        PRINTING = "printing_quality", "Printing & Quality"
        DISTRIBUTION = "distribution", "Distribution & Availability"
        PRODUCTION = "production_status", "Book Status & Production Updates"
        GENERAL = "general", "General Inquiry"

    class Priority(models.TextChoices):
        CRITICAL = "critical", "Critical"
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    class AIStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"  # AI was down: ticket still exists, admin triages manually

    author = models.ForeignKey("books.Author", on_delete=models.CASCADE, related_name="tickets")
    # Null book means "General / Account Level".
    book = models.ForeignKey("books.Book", on_delete=models.SET_NULL, null=True, blank=True, related_name="tickets")
    subject = models.CharField(max_length=200)
    description = models.TextField()
    attachment_name = models.CharField(max_length=255, blank=True)  # UI-only attachment for now

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    category = models.CharField(max_length=30, choices=Category.choices, blank=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, blank=True)

    # AI outputs are stored separately from the final values so we can show
    # "AI suggested X, admin changed to Y" and measure classification accuracy.
    ai_status = models.CharField(max_length=10, choices=AIStatus.choices, default=AIStatus.PENDING)
    ai_category = models.CharField(max_length=30, choices=Category.choices, blank=True)
    ai_priority = models.CharField(max_length=10, choices=Priority.choices, blank=True)
    ai_reasoning = models.TextField(blank=True)
    category_overridden = models.BooleanField(default=False)
    priority_overridden = models.BooleanField(default=False)

    # Cached AI draft so reopening a ticket doesn't pay for another LLM call.
    ai_draft = models.TextField(blank=True)
    ai_draft_generated_at = models.DateTimeField(null=True, blank=True)

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_tickets"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["author", "-created_at"]),
            models.Index(fields=["updated_at"]),
        ]

    def __str__(self):
        return f"#{self.pk} {self.subject}"


class TicketMessage(models.Model):
    """A visible reply on a ticket (from the author or an admin)."""

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    body = models.TextField()
    was_ai_drafted = models.BooleanField(default=False)  # sent response started from the AI draft
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class InternalNote(models.Model):
    """Admin-only note. Never serialized for authors."""

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="internal_notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
