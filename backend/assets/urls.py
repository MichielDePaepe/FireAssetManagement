from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    PagerScanLookupView,
    PagerTypeViewSet,
    PagerViewSet,
    RadioScanLookupView,
    RicCodeViewSet,
)

router = DefaultRouter()
router.register("pagers", PagerViewSet, basename="pager")
router.register("pager-types", PagerTypeViewSet, basename="pager-type")
router.register("ric-codes", RicCodeViewSet, basename="ric-code")

urlpatterns = [
    path("pagers/scanlookup/", PagerScanLookupView.as_view(), name="pager-scanlookup"),
    path("radios/scanlookup/", RadioScanLookupView.as_view(), name="radio-scanlookup"),
]
urlpatterns += router.urls
