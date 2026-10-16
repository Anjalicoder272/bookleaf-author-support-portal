from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.books.urls")),
    path("api/", include("apps.tickets.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
