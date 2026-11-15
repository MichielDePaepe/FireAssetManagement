from django.urls import path

from .views import (
    CityGISDataView,
    CityGISRefreshView,
    CityGISVectorStatusHistoryView,
    citygis_events,
)

urlpatterns = [
    path("citygis/", CityGISDataView.as_view(), name="citygis-data"),
    path(
        "citygis/vectors/<int:vector_id>/status-history/",
        CityGISVectorStatusHistoryView.as_view(),
        name="citygis-vector-status-history",
    ),
    path("citygis/refresh/", CityGISRefreshView.as_view(), name="citygis-refresh"),
    path("citygis/events/", citygis_events, name="citygis-events"),
]
