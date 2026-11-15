from django.urls import path

from .views import FireplanCredentialsView, FireplanPagerSyncView, FireplanTestLoginView

urlpatterns = [
    path("fireplan/credentials/", FireplanCredentialsView.as_view(), name="fireplan-credentials"),
    path("fireplan/test-login/", FireplanTestLoginView.as_view(), name="fireplan-test-login"),
    path("fireplan/sync-pagers/", FireplanPagerSyncView.as_view(), name="fireplan-sync-pagers"),
]
