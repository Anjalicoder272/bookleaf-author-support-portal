from django.urls import path

from .views import MyBooksView

urlpatterns = [
    path("me/books/", MyBooksView.as_view(), name="my-books"),
]
