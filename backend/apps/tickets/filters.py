import django_filters
from django.db.models import Q

from .models import Ticket


class AdminTicketFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=Ticket.Status.choices)
    category = django_filters.MultipleChoiceFilter(choices=Ticket.Category.choices)
    priority = django_filters.MultipleChoiceFilter(choices=Ticket.Priority.choices)
    created_after = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_before = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")
    assigned = django_filters.ChoiceFilter(
        choices=[("me", "Assigned to me"), ("unassigned", "Unassigned")], method="filter_assigned"
    )
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = Ticket
        fields = ["status", "category", "priority"]

    def filter_assigned(self, queryset, name, value):
        if value == "me":
            return queryset.filter(assigned_to=self.request.user)
        return queryset.filter(assigned_to__isnull=True)

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(subject__icontains=value) | Q(description__icontains=value) | Q(author__name__icontains=value)
        )
