from django.conf import settings
from django.db import models


class Author(models.Model):
    """Author profile, linked one-to-one with a login account."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="author")
    author_code = models.CharField(max_length=20, unique=True)  # e.g. AUTH001 from the dataset
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30, blank=True)
    city = models.CharField(max_length=80, blank=True)
    joined_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.author_code})"


class Book(models.Model):
    author = models.ForeignKey(Author, on_delete=models.CASCADE, related_name="books")
    book_code = models.CharField(max_length=20, unique=True)  # e.g. BK001
    title = models.CharField(max_length=255)
    isbn = models.CharField(max_length=30, blank=True)
    genre = models.CharField(max_length=80, blank=True)
    # Books still in production have no publication date yet.
    publication_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=60)
    # MRP and per-copy royalty are unknown (null) until a book leaves production.
    mrp = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    author_royalty_per_copy = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_copies_sold = models.PositiveIntegerField(default=0)
    total_royalty_earned = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    royalty_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    royalty_pending = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    last_royalty_payout_date = models.DateField(null=True, blank=True)
    print_partner = models.CharField(max_length=60, blank=True)
    available_on = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-publication_date", "title"]

    @property
    def is_published(self):
        return self.status.lower().startswith("published")

    def __str__(self):
        return self.title
