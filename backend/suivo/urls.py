from django.urls import path

from .views import SuivoSyncView

urlpatterns = [path("suivo/sync/", SuivoSyncView.as_view(), name="suivo-sync")]
