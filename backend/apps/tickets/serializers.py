from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import User
from apps.books.serializers import BookSerializer

from .models import InternalNote, Ticket, TicketMessage


class MessageSerializer(serializers.ModelSerializer):
    sender_role = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketMessage
        fields = ["id", "body", "sender_role", "sender_name", "created_at"]

    def get_sender_role(self, msg) -> str:
        return "admin" if msg.sender and msg.sender.is_admin else "author"

    def get_sender_name(self, msg) -> str:
        if not msg.sender:
            return "Unknown"
        if msg.sender.is_admin:
            return "BookLeaf Support"  # authors see the team, not individual admin emails
        return msg.sender.author.name if hasattr(msg.sender, "author") else msg.sender.email


class NoteSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True, default=None)

    class Meta:
        model = InternalNote
        fields = ["id", "body", "author_email", "created_at"]
        read_only_fields = ["id", "author_email", "created_at"]


class BookRefSerializer(serializers.Serializer):
    id = serializers.CharField(source="book_code")
    title = serializers.CharField()
    status = serializers.CharField()


# ---------- Author-facing ----------


class AuthorTicketListSerializer(serializers.ModelSerializer):
    book = BookRefSerializer(allow_null=True)
    status_label = serializers.CharField(source="get_status_display")
    category_label = serializers.CharField(source="get_category_display")
    reply_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Ticket
        fields = [
            "id",
            "subject",
            "book",
            "status",
            "status_label",
            "category",
            "category_label",
            "reply_count",
            "created_at",
            "updated_at",
        ]


class AuthorTicketDetailSerializer(AuthorTicketListSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta(AuthorTicketListSerializer.Meta):
        fields = AuthorTicketListSerializer.Meta.fields + ["description", "attachment_name", "messages"]


class TicketCreateSerializer(serializers.ModelSerializer):
    # Book code like "BK001"; omit or null for "General / Account Level".
    book_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Ticket
        fields = ["book_id", "subject", "description", "attachment_name"]
        extra_kwargs = {
            "subject": {"min_length": 5, "max_length": 200},
            "description": {"min_length": 15, "max_length": 5000},
            "attachment_name": {"required": False},
        }

    def validate_book_id(self, value):
        if not value:
            return None
        author = self.context["request"].user.author
        book = author.books.filter(book_code=value).first()
        if not book:
            # Same message whether the book doesn't exist or belongs to someone else.
            raise serializers.ValidationError("Book not found in your account.")
        return book

    def create(self, validated_data):
        book = validated_data.pop("book_id", None)
        return Ticket.objects.create(author=self.context["request"].user.author, book=book, **validated_data)


class AuthorMessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(min_length=2, max_length=5000)


# ---------- Admin-facing ----------


class AdminTicketListSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.name")
    author_id = serializers.CharField(source="author.author_code")
    book = BookRefSerializer(allow_null=True)
    assigned_to = serializers.EmailField(source="assigned_to.email", default=None)
    reply_count = serializers.IntegerField(read_only=True)
    age_hours = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            "id",
            "subject",
            "author_name",
            "author_id",
            "book",
            "status",
            "category",
            "priority",
            "ai_status",
            "assigned_to",
            "reply_count",
            "age_hours",
            "created_at",
            "updated_at",
        ]

    def get_age_hours(self, ticket) -> int:
        return int((timezone.now() - ticket.created_at).total_seconds() // 3600)


class AdminTicketDetailSerializer(AdminTicketListSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    internal_notes = NoteSerializer(many=True, read_only=True)
    author_email = serializers.EmailField(source="author.user.email")
    book_details = serializers.SerializerMethodField()

    class Meta(AdminTicketListSerializer.Meta):
        fields = AdminTicketListSerializer.Meta.fields + [
            "description",
            "attachment_name",
            "author_email",
            "book_details",
            "ai_category",
            "ai_priority",
            "ai_reasoning",
            "category_overridden",
            "priority_overridden",
            "messages",
            "internal_notes",
        ]

    @extend_schema_field(BookSerializer(allow_null=True))
    def get_book_details(self, ticket):
        return BookSerializer(ticket.book).data if ticket.book else None


class AdminTicketUpdateSerializer(serializers.ModelSerializer):
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.ADMIN), allow_null=True, required=False
    )

    class Meta:
        model = Ticket
        fields = ["status", "category", "priority", "assigned_to"]

    def update(self, ticket, validated_data):
        # Changing the AI's label marks it as an admin override, so later AI runs won't replace it.
        if "category" in validated_data and validated_data["category"] != ticket.category:
            ticket.category_overridden = True
        if "priority" in validated_data and validated_data["priority"] != ticket.priority:
            ticket.priority_overridden = True
        return super().update(ticket, validated_data)


class AdminResponseCreateSerializer(serializers.Serializer):
    body = serializers.CharField(min_length=2, max_length=5000)
    used_ai_draft = serializers.BooleanField(default=False)
    # Optional status to set in the same action, e.g. reply and mark resolved.
    status = serializers.ChoiceField(choices=Ticket.Status.choices, required=False)


class AssignSerializer(serializers.ModelSerializer):
    assigned_to = serializers.EmailField(source="assigned_to.email")

    class Meta:
        model = Ticket
        fields = ["id", "assigned_to", "status"]


class RetriageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ["id", "category", "priority", "ai_status", "ai_reasoning"]


class DraftSerializer(serializers.Serializer):
    draft = serializers.CharField(allow_blank=True)
    ai_available = serializers.BooleanField()
    generated_at = serializers.DateTimeField(allow_null=True)
