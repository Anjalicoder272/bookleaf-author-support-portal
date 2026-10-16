from django.contrib import admin

from .models import Author, Book


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    list_display = ["author_code", "name", "city"]
    search_fields = ["name", "author_code"]


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ["book_code", "title", "author", "status", "royalty_pending"]
    list_filter = ["status"]
    search_fields = ["title", "isbn"]
