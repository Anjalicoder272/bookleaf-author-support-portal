from django.contrib import admin

from .models import InternalNote, Ticket, TicketMessage


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ["id", "subject", "author", "status", "category", "priority", "ai_status", "created_at"]
    list_filter = ["status", "category", "priority", "ai_status"]
    search_fields = ["subject", "description"]


admin.site.register(TicketMessage)
admin.site.register(InternalNote)
