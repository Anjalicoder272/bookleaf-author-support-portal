"""Load BookLeaf's sample dataset and create demo logins.

Usage:
    python manage.py seed_data           # idempotent: safe to run on every deploy
    python manage.py seed_data --reset   # wipe authors/books/tickets first

Every author gets the password in DEMO_AUTHOR_PASSWORD (default: author123).
One admin is created from DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD.
"""

import json
import os
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.books.models import Author, Book

DATA_FILE = Path(__file__).with_name("bookleaf_sample_data.json")

BOOK_FIELDS = [
    "title",
    "isbn",
    "genre",
    "publication_date",
    "status",
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


class Command(BaseCommand):
    help = "Seed authors, books and demo logins from bookleaf_sample_data.json"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing authors, books and tickets first")

    @transaction.atomic
    def handle(self, *args, **options):
        author_password = os.getenv("DEMO_AUTHOR_PASSWORD", "author123")
        admin_email = os.getenv("DEMO_ADMIN_EMAIL", "admin@bookleaf.com")
        admin_password = os.getenv("DEMO_ADMIN_PASSWORD", "admin123")

        if options["reset"]:
            User.objects.filter(role=User.Role.AUTHOR).delete()  # cascades to authors, books, tickets
            self.stdout.write("Removed existing authors, books and tickets.")

        data = json.loads(DATA_FILE.read_text())
        book_count = 0

        for row in data["authors"]:
            user, created = User.objects.get_or_create(
                email=row["email"].lower(), defaults={"role": User.Role.AUTHOR}
            )
            if created:
                user.set_password(author_password)
                user.save()

            author, _ = Author.objects.update_or_create(
                author_code=row["author_id"],
                defaults={
                    "user": user,
                    "name": row["name"],
                    "phone": row.get("phone") or "",
                    "city": row.get("city") or "",
                    "joined_date": row.get("joined_date"),
                },
            )

            for book in row["books"]:
                defaults = {field: book.get(field) for field in BOOK_FIELDS}
                # The dataset uses null for unknown text values; the DB stores blanks.
                for text_field in ("isbn", "genre", "print_partner"):
                    defaults[text_field] = defaults[text_field] or ""
                defaults["available_on"] = defaults["available_on"] or []
                Book.objects.update_or_create(book_code=book["book_id"], defaults={"author": author, **defaults})
                book_count += 1

        admin, created = User.objects.get_or_create(
            email=admin_email,
            defaults={"role": User.Role.ADMIN, "is_staff": True, "first_name": "BookLeaf", "last_name": "Support"},
        )
        if created:
            admin.set_password(admin_password)
            admin.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(data['authors'])} authors, {book_count} books and admin {admin_email}."
            )
        )
