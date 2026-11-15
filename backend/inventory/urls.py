from django.urls import path

from .views import (
    InventorySnapshotView,
    PagerVectorAssignmentView,
    RicCodeVectorAssignmentView,
)

urlpatterns = [
    path("inventory/", InventorySnapshotView.as_view(), name="inventory-snapshot"),
    path(
        "inventory/pagers/<int:pager_id>/vector/",
        PagerVectorAssignmentView.as_view(),
        name="inventory-pager-vector",
    ),
    path(
        "inventory/ric-codes/<int:code_id>/vector/",
        RicCodeVectorAssignmentView.as_view(),
        name="inventory-ric-vector",
    ),
]
