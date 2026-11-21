from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    IssiViewSet,
    OrganizationViewSet,
    PagerScanLookupView,
    PagerTypeViewSet,
    PagerViewSet,
    RadioModelViewSet,
    RadioScanLookupView,
    RadioSubscriptionViewSet,
    RadioViewSet,
    RicCodeViewSet,
    TeiRangeViewSet,
)

router = DefaultRouter()
router.register("pagers", PagerViewSet, basename="pager")
router.register("radios", RadioViewSet, basename="radio")
router.register("issis", IssiViewSet, basename="issi")
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("radio-models", RadioModelViewSet, basename="radio-model")
router.register("tei-ranges", TeiRangeViewSet, basename="tei-range")
router.register("radio-subscriptions", RadioSubscriptionViewSet, basename="radio-subscription")
router.register("pager-types", PagerTypeViewSet, basename="pager-type")
router.register("ric-codes", RicCodeViewSet, basename="ric-code")

urlpatterns = [
    path("pagers/scanlookup/", PagerScanLookupView.as_view(), name="pager-scanlookup"),
    path("radios/scanlookup/", RadioScanLookupView.as_view(), name="radio-scanlookup"),
]
urlpatterns += router.urls
