from django.urls import path

from .views import (
    FireplanCredentialsView,
    FireplanInventoryDetailView,
    FireplanInventoryListView,
    FireplanInventorySyncView,
    FireplanInventoryTargetedSyncView,
    FireplanPagerSyncView,
    FireplanRadioSyncView,
    FireplanTestLoginView,
)

urlpatterns = [
    path("fireplan/credentials/", FireplanCredentialsView.as_view(), name="fireplan-credentials"),
    path("fireplan/test-login/", FireplanTestLoginView.as_view(), name="fireplan-test-login"),
    path("fireplan/sync-pagers/", FireplanPagerSyncView.as_view(), name="fireplan-sync-pagers"),
    path("fireplan/sync-radios/", FireplanRadioSyncView.as_view(), name="fireplan-sync-radios"),
    path("fireplan/inventories/", FireplanInventoryListView.as_view(), name="fireplan-inventories"),
    path(
        "fireplan/inventories/<str:inventory_uuid>/",
        FireplanInventoryDetailView.as_view(),
        name="fireplan-inventory-detail",
    ),
    path(
        "fireplan/inventories/<str:inventory_uuid>/sync/",
        FireplanInventoryTargetedSyncView.as_view(),
        name="fireplan-sync-inventory",
    ),
    path(
        "fireplan/sync-inventories/",
        FireplanInventorySyncView.as_view(),
        name="fireplan-sync-inventories",
    ),
]
