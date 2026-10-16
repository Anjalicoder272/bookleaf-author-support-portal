from django.db import transaction
from django.db.models import Case, Count, IntegerField, Value, When
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin, IsAuthor

from . import serializers as s
from .filters import AdminTicketFilter
from .models import InternalNote, Ticket, TicketMessage
from .services import get_draft, run_triage, schedule_triage

UNRESOLVED = [Ticket.Status.OPEN, Ticket.Status.IN_PROGRESS]
UPDATED_SINCE_PARAM = OpenApiParameter(
    "updated_since", str, description="ISO 8601 timestamp; return only tickets changed after it (for polling)"
)


def with_updated_since(request, queryset):
    """Polling support: ?updated_since=<ISO timestamp> returns only tickets changed after it."""
    raw = request.query_params.get("updated_since")
    if not raw:
        return queryset
    since = parse_datetime(raw)
    if since is None:
        raise ValidationError({"updated_since": "Use an ISO 8601 timestamp."})
    return queryset.filter(updated_at__gt=since)


# ---------- Author endpoints ----------


@extend_schema(parameters=[UPDATED_SINCE_PARAM], methods=["GET"])
class AuthorTicketListCreateView(generics.ListCreateAPIView):
    """GET: the author's own tickets. POST: raise a new ticket (AI triage runs in the background)."""

    permission_classes = [IsAuthor]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # OpenAPI schema generation has no real user
            return Ticket.objects.none()
        qs = (
            Ticket.objects.filter(author=self.request.user.author)
            .select_related("book")
            .annotate(reply_count=Count("messages"))
            .order_by("-updated_at")
        )
        return with_updated_since(self.request, qs)

    def get_serializer_class(self):
        return s.TicketCreateSerializer if self.request.method == "POST" else s.AuthorTicketListSerializer

    @extend_schema(request=s.TicketCreateSerializer, responses={201: s.AuthorTicketDetailSerializer})
    def post(self, request, *args, **kwargs):
        serializer = s.TicketCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            ticket = serializer.save()
            schedule_triage(ticket)
        ticket = self.get_queryset().get(pk=ticket.pk)
        return Response(s.AuthorTicketDetailSerializer(ticket).data, status=status.HTTP_201_CREATED)


class AuthorTicketDetailView(generics.RetrieveAPIView):
    serializer_class = s.AuthorTicketDetailSerializer
    permission_classes = [IsAuthor]

    def get_queryset(self):
        # Scoped to the author: another author's ticket id returns 404, not 403, so ids can't be probed.
        if getattr(self, "swagger_fake_view", False):
            return Ticket.objects.none()
        return (
            Ticket.objects.filter(author=self.request.user.author)
            .select_related("book")
            .prefetch_related("messages__sender__author")
            .annotate(reply_count=Count("messages"))
        )


class AuthorTicketMessageView(APIView):
    """An author follow-up on their own ticket. Replying to a resolved ticket reopens it."""

    permission_classes = [IsAuthor]

    @extend_schema(request=s.AuthorMessageCreateSerializer, responses={201: s.MessageSerializer})
    def post(self, request, pk):
        ticket = get_object_or_404(Ticket, pk=pk, author=request.user.author)
        if ticket.status == Ticket.Status.CLOSED:
            raise ValidationError({"ticket": "This ticket is closed. Please raise a new ticket."})
        serializer = s.AuthorMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        msg = TicketMessage.objects.create(ticket=ticket, sender=request.user, body=serializer.validated_data["body"])
        if ticket.status == Ticket.Status.RESOLVED:
            ticket.status = Ticket.Status.OPEN
        ticket.save()  # bumps updated_at so pollers see the change
        return Response(s.MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


# ---------- Admin endpoints ----------


@extend_schema(parameters=[UPDATED_SINCE_PARAM])
class AdminTicketListView(generics.ListAPIView):
    """All tickets. Default order puts unresolved, most urgent, oldest tickets first."""

    serializer_class = s.AdminTicketListSerializer
    permission_classes = [IsAdmin]
    filterset_class = AdminTicketFilter
    ordering_fields = ["created_at", "updated_at", "priority_rank"]

    def get_queryset(self):
        qs = (
            Ticket.objects.select_related("author", "book", "assigned_to")
            .annotate(
                reply_count=Count("messages"),
                unresolved_rank=Case(When(status__in=UNRESOLVED, then=Value(0)), default=Value(1), output_field=IntegerField()),
                priority_rank=Case(
                    When(priority=Ticket.Priority.CRITICAL, then=Value(0)),
                    When(priority=Ticket.Priority.HIGH, then=Value(1)),
                    When(priority=Ticket.Priority.MEDIUM, then=Value(2)),
                    When(priority=Ticket.Priority.LOW, then=Value(3)),
                    default=Value(1),  # not yet triaged: keep it visible near the top
                    output_field=IntegerField(),
                ),
            )
            .order_by("unresolved_rank", "priority_rank", "created_at")
        )
        return with_updated_since(self.request, qs)


class AdminTicketDetailView(generics.RetrieveUpdateAPIView):
    """GET full ticket incl. internal notes and AI suggestions. PATCH status/category/priority/assignee."""

    permission_classes = [IsAdmin]
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        return (
            Ticket.objects.select_related("author__user", "book", "assigned_to")
            .prefetch_related("messages__sender__author", "internal_notes__author")
            .annotate(reply_count=Count("messages"))
        )

    def get_serializer_class(self):
        return s.AdminTicketUpdateSerializer if self.request.method == "PATCH" else s.AdminTicketDetailSerializer

    @extend_schema(request=s.AdminTicketUpdateSerializer, responses=s.AdminTicketDetailSerializer)
    def patch(self, request, *args, **kwargs):
        ticket = self.get_object()
        serializer = s.AdminTicketUpdateSerializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(s.AdminTicketDetailSerializer(self.get_queryset().get(pk=ticket.pk)).data)


class AdminAssignToMeView(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(request=None, responses=s.AssignSerializer)
    def post(self, request, pk):
        ticket = get_object_or_404(Ticket, pk=pk)
        ticket.assigned_to = request.user
        if ticket.status == Ticket.Status.OPEN:
            ticket.status = Ticket.Status.IN_PROGRESS
        ticket.save()
        return Response(s.AssignSerializer(ticket).data)


class AdminResponseView(APIView):
    """Send a reply that the author will see. Optionally set the status in the same step."""

    permission_classes = [IsAdmin]

    @extend_schema(request=s.AdminResponseCreateSerializer, responses={201: s.MessageSerializer})
    def post(self, request, pk):
        ticket = get_object_or_404(Ticket, pk=pk)
        serializer = s.AdminResponseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        msg = TicketMessage.objects.create(
            ticket=ticket, sender=request.user, body=data["body"], was_ai_drafted=data["used_ai_draft"]
        )
        ticket.status = data.get("status") or (
            Ticket.Status.IN_PROGRESS if ticket.status == Ticket.Status.OPEN else ticket.status
        )
        if ticket.assigned_to is None:
            ticket.assigned_to = request.user
        ticket.ai_draft = ""  # the draft has been used; the next one should reflect the new conversation
        ticket.save()
        return Response(s.MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class AdminNoteView(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(request=s.NoteSerializer, responses={201: s.NoteSerializer})
    def post(self, request, pk):
        ticket = get_object_or_404(Ticket, pk=pk)
        serializer = s.NoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = InternalNote.objects.create(ticket=ticket, author=request.user, body=serializer.validated_data["body"])
        return Response(s.NoteSerializer(note).data, status=status.HTTP_201_CREATED)


class AdminDraftView(APIView):
    """GET: the cached AI draft (generated on first open). POST: force a fresh draft.

    If the AI is unavailable, returns ai_available=false with 200 so the admin can still reply manually.
    """

    permission_classes = [IsAdmin]

    def _respond(self, ticket, regenerate):
        draft, ai_available = get_draft(ticket, regenerate=regenerate)
        ticket.refresh_from_db(fields=["ai_draft_generated_at"])
        return Response(
            s.DraftSerializer(
                {"draft": draft, "ai_available": ai_available, "generated_at": ticket.ai_draft_generated_at}
            ).data
        )

    @extend_schema(responses=s.DraftSerializer)
    def get(self, request, pk):
        return self._respond(get_object_or_404(Ticket.objects.select_related("author", "book"), pk=pk), False)

    @extend_schema(request=None, responses=s.DraftSerializer)
    def post(self, request, pk):
        return self._respond(get_object_or_404(Ticket.objects.select_related("author", "book"), pk=pk), True)


class AdminRetriageView(APIView):
    """Re-run AI classification, e.g. after an outage left a ticket with rule-based labels."""

    permission_classes = [IsAdmin]

    @extend_schema(request=None, responses=s.RetriageSerializer)
    def post(self, request, pk):
        ticket = get_object_or_404(Ticket, pk=pk)
        run_triage(ticket.pk)
        ticket.refresh_from_db()
        return Response(s.RetriageSerializer(ticket).data)
