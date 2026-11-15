from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from tasks import auth_views, views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", views.health, name="health"),
    path("api/auth/csrf/", auth_views.csrf_token, name="csrf-token"),
    path("api/auth/login/", auth_views.login_view, name="login"),
    path("api/auth/logout/", auth_views.logout_view, name="logout"),
    path("api/auth/me/", auth_views.me_view, name="me"),
    path("api/", include("tasks.urls")),
    path("api/", include("assets.urls")),
    path("api/", include("inventory.urls")),
    path("api/", include("fireplan.urls")),
    path("api/", include("printers.urls")),
    path("api/", include("citygis.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
