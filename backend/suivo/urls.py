from django.urls import path

from .views import SuivoAssetListView, SuivoDeviceListView, SuivoSyncView

urlpatterns = [
    path("suivo/assets/", SuivoAssetListView.as_view(), name="suivo-assets"),
    path("suivo/devices/", SuivoDeviceListView.as_view(), name="suivo-devices"),
    path("suivo/sync/", SuivoSyncView.as_view(), name="suivo-sync"),
]
