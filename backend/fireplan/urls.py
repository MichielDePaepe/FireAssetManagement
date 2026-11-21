from django.urls import path

from .views import (
    FireplanCredentialsView,
    FireplanInventoryListView,
    FireplanInventorySyncView,
    FireplanPagerSyncView,
    FireplanTestLoginView,
)

urlpatterns = [
    path("fireplan/credentials/", FireplanCredentialsView.as_view(), name="fireplan-credentials"),
    path("fireplan/test-login/", FireplanTestLoginView.as_view(), name="fireplan-test-login"),
    path("fireplan/sync-pagers/", FireplanPagerSyncView.as_view(), name="fireplan-sync-pagers"),
    path("fireplan/inventories/", FireplanInventoryListView.as_view(), name="fireplan-inventories"),
    path(
        "fireplan/sync-inventories/",
        FireplanInventorySyncView.as_view(),
        name="fireplan-sync-inventories",
    ),
]
