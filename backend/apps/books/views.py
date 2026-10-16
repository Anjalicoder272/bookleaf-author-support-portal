from rest_framework.generics import ListAPIView

from apps.accounts.permissions import IsAuthor

from .models import Book
from .serializers import BookSerializer


class MyBooksView(ListAPIView):
    """The logged-in author's books. Authors can never see anyone else's."""

    serializer_class = BookSerializer
    permission_classes = [IsAuthor]
    pagination_class = None  # max ~a handful per author

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):  # OpenAPI schema generation has no real user
            return Book.objects.none()
        return self.request.user.author.books.all()
