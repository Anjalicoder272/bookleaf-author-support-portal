from django.urls import path

from . import views

urlpatterns = [
    # Author
    path("me/tickets/", views.AuthorTicketListCreateView.as_view(), name="my-tickets"),
    path("me/tickets/<int:pk>/", views.AuthorTicketDetailView.as_view(), name="my-ticket-detail"),
    path("me/tickets/<int:pk>/messages/", views.AuthorTicketMessageView.as_view(), name="my-ticket-messages"),
    # Admin
    path("admin/tickets/", views.AdminTicketListView.as_view(), name="admin-tickets"),
    path("admin/tickets/<int:pk>/", views.AdminTicketDetailView.as_view(), name="admin-ticket-detail"),
    path("admin/tickets/<int:pk>/assign/", views.AdminAssignToMeView.as_view(), name="admin-ticket-assign"),
    path("admin/tickets/<int:pk>/responses/", views.AdminResponseView.as_view(), name="admin-ticket-responses"),
    path("admin/tickets/<int:pk>/notes/", views.AdminNoteView.as_view(), name="admin-ticket-notes"),
    path("admin/tickets/<int:pk>/draft/", views.AdminDraftView.as_view(), name="admin-ticket-draft"),
    path("admin/tickets/<int:pk>/retriage/", views.AdminRetriageView.as_view(), name="admin-ticket-retriage"),
]
