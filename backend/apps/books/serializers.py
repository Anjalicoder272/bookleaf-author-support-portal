from rest_framework import serializers

from .models import Book


class BookSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="book_code", read_only=True)
    is_published = serializers.BooleanField(read_only=True)

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "isbn",
            "genre",
            "publication_date",
            "status",
            "is_published",
            "mrp",
            "author_royalty_per_copy",
            "total_copies_sold",
            "total_royalty_earned",
            "royalty_paid",
            "royalty_pending",
            "last_royalty_payout_date",
            "print_partner",
            "available_on",
        ]
