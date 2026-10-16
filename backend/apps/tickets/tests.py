from datetime import date
from unittest import mock

from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.ai import fallback
from apps.ai.service import AIUnavailable, TriageResult
from apps.books.royalty import next_payout_date

from .models import Ticket

PASSWORD = "author123"


@override_settings(AI_TRIAGE_SYNC=True, GEMINI_API_KEY="")
class TicketApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_data", stdout=mock.MagicMock())

    def login(self, email, password=PASSWORD):
        client = APIClient()
        res = client.post("/api/auth/login/", {"email": email, "password": password}, format="json")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        return client

    def setUp(self):
        self.priya = self.login("priya.sharma@email.com")  # owns BK001, BK002
        self.rohit = self.login("rohit.kapoor@email.com")
        self.admin = self.login("admin@bookleaf.com", "admin123")

    def create_ticket(self, client=None, **overrides):
        payload = {
            "book_id": "BK001",
            "subject": "Royalty not received",
            "description": "I haven't received any royalty for 6 months. Please check.",
        }
        payload.update(overrides)
        with self.captureOnCommitCallbacks(execute=True):
            return (client or self.priya).post("/api/me/tickets/", payload, format="json")

    # --- access control ---

    def test_every_route_requires_login(self):
        for url in ["/api/me/books/", "/api/me/tickets/", "/api/admin/tickets/"]:
            self.assertEqual(APIClient().get(url).status_code, 401, url)

    def test_author_cannot_use_admin_routes(self):
        self.assertEqual(self.priya.get("/api/admin/tickets/").status_code, 403)

    def test_author_cannot_see_or_reply_to_another_authors_ticket(self):
        ticket_id = self.create_ticket().data["id"]
        self.assertEqual(self.rohit.get(f"/api/me/tickets/{ticket_id}/").status_code, 404)
        res = self.rohit.post(f"/api/me/tickets/{ticket_id}/messages/", {"body": "hello"}, format="json")
        self.assertEqual(res.status_code, 404)

    def test_author_cannot_raise_ticket_on_someone_elses_book(self):
        res = self.create_ticket(client=self.rohit, book_id="BK001")
        self.assertEqual(res.status_code, 400)
        self.assertIn("book_id", res.data["error"]["details"])

    def test_validation_errors_are_structured(self):
        res = self.priya.post("/api/me/tickets/", {"subject": "Hi"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["error"]["code"], "invalid")
        self.assertIn("description", res.data["error"]["details"])

    # --- triage ---

    def test_ticket_is_created_and_triaged_by_rules_when_ai_is_down(self):
        res = self.create_ticket()
        self.assertEqual(res.status_code, 201)
        ticket = Ticket.objects.get(pk=res.data["id"])
        self.assertEqual(ticket.ai_status, Ticket.AIStatus.FAILED)
        self.assertEqual(ticket.category, "royalty_payments")
        self.assertEqual(ticket.priority, "critical")

    @mock.patch("apps.tickets.services.triage_ticket")
    def test_ai_triage_sets_category_and_priority(self, triage):
        triage.return_value = TriageResult(category="isbn_metadata", priority="high", reasoning="ISBN mismatch")
        ticket = Ticket.objects.get(pk=self.create_ticket(subject="Wrong ISBN on Amazon").data["id"])
        self.assertEqual((ticket.category, ticket.priority, ticket.ai_status), ("isbn_metadata", "high", "done"))

    def test_admin_override_is_kept_when_ai_reruns(self):
        ticket_id = self.create_ticket().data["id"]
        self.admin.patch(f"/api/admin/tickets/{ticket_id}/", {"priority": "low"}, format="json")
        self.admin.post(f"/api/admin/tickets/{ticket_id}/retriage/")
        ticket = Ticket.objects.get(pk=ticket_id)
        self.assertEqual(ticket.priority, "low")
        self.assertTrue(ticket.priority_overridden)
        self.assertEqual(ticket.ai_priority, "critical")

    # --- admin workflow ---

    def test_queue_puts_unresolved_urgent_tickets_first(self):
        low = self.create_ticket(subject="Update my author bio", description="Can I update my author bio please?")
        critical = self.create_ticket()
        ids = [t["id"] for t in self.admin.get("/api/admin/tickets/").data["results"]]
        self.assertLess(ids.index(critical.data["id"]), ids.index(low.data["id"]))

    def test_response_is_visible_to_author_but_internal_note_is_not(self):
        ticket_id = self.create_ticket().data["id"]
        self.admin.post(f"/api/admin/tickets/{ticket_id}/notes/", {"body": "Check bank details"}, format="json")
        self.admin.post(
            f"/api/admin/tickets/{ticket_id}/responses/", {"body": "We're looking into it."}, format="json"
        )
        author_view = self.priya.get(f"/api/me/tickets/{ticket_id}/").data
        self.assertEqual(author_view["messages"][0]["body"], "We're looking into it.")
        self.assertEqual(author_view["status"], "in_progress")
        self.assertNotIn("internal_notes", author_view)
        self.assertNotIn("Check bank details", str(author_view))

    def test_polling_returns_only_changed_tickets(self):
        self.create_ticket()
        # The client remembers the newest updated_at it has seen and asks only for newer changes.
        last_seen = max(t["updated_at"] for t in self.priya.get("/api/me/tickets/").data["results"])
        self.create_ticket(subject="Second question", description="Another question about my book listing.")
        res = self.priya.get("/api/me/tickets/", {"updated_since": last_seen})
        self.assertEqual([t["subject"] for t in res.data["results"]], ["Second question"])

    # --- drafts ---

    def test_draft_falls_back_gracefully_when_ai_unavailable(self):
        ticket_id = self.create_ticket().data["id"]
        res = self.admin.get(f"/api/admin/tickets/{ticket_id}/draft/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["ai_available"])

    @mock.patch("apps.tickets.services.draft_reply", return_value="Dear Priya, ...")
    def test_draft_is_cached_until_conversation_changes(self, draft):
        ticket_id = self.create_ticket().data["id"]
        self.admin.get(f"/api/admin/tickets/{ticket_id}/draft/")
        self.admin.get(f"/api/admin/tickets/{ticket_id}/draft/")
        self.assertEqual(draft.call_count, 1)

        self.priya.post(f"/api/me/tickets/{ticket_id}/messages/", {"body": "Any update?"}, format="json")
        self.admin.get(f"/api/admin/tickets/{ticket_id}/draft/")
        self.assertEqual(draft.call_count, 2)

    @mock.patch("apps.tickets.services.draft_reply", return_value="ok")
    def test_draft_prompt_only_includes_the_relevant_policy(self, draft):
        ticket_id = self.create_ticket().data["id"]
        self.admin.get(f"/api/admin/tickets/{ticket_id}/draft/")
        kwargs = draft.call_args.kwargs
        self.assertEqual(kwargs["category"], "royalty_payments")
        self.assertIn("Whispers of the Ganges", kwargs["book_facts"])
        self.assertNotIn("Saffron Diaries", kwargs["book_facts"])  # other books aren't sent for book tickets


class FallbackClassifierTests(TestCase):
    def test_examples_from_the_brief(self):
        cases = [
            ("Royalty", "I haven't received any royalty for 6 months", "royalty_payments", "critical"),
            ("ISBN problem", "My book shows a different ISBN on Amazon", "isbn_metadata", "high"),
            ("Bad print", "Images are blurry and pages misaligned", "printing_quality", "high"),
            ("Listing", "My book is showing Currently Unavailable on Amazon", "distribution", "high"),
            ("Bio", "Can I update my author bio?", "general", "low"),
        ]
        for subject, body, category, priority in cases:
            result = fallback.classify(subject, body)
            self.assertEqual((result["category"], result["priority"]), (category, priority), body)


class RoyaltyScheduleTests(TestCase):
    def test_next_payout_date(self):
        self.assertEqual(next_payout_date(date(2026, 10, 16)), date(2026, 11, 14))  # Q3 window still open
        self.assertEqual(next_payout_date(date(2026, 11, 20)), date(2027, 2, 14))  # next: Q4 + 45 days
        self.assertEqual(next_payout_date(date(2026, 2, 1)), date(2026, 2, 14))  # Q4 of previous year
