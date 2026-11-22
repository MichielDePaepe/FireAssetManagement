from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    IssiViewSet,
    ManufacturerViewSet,
    OrganizationViewSet,
    PagerScanLookupView,
    PagerTypeViewSet,
    PagerViewSet,
    RadioModelViewSet,
    RadioScanLookupView,
    RadioSubscriptionViewSet,
    RadioSubscriptionImportView,
    RadioViewSet,
    RicCodeViewSet,
    TeiRangeViewSet,
)

router = DefaultRouter()
router.register("pagers", PagerViewSet, basename="pager")
router.register("radios", RadioViewSet, basename="radio")
router.register("issis", IssiViewSet, basename="issi")
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("manufacturers", ManufacturerViewSet, basename="manufacturer")
router.register("radio-models", RadioModelViewSet, basename="radio-model")
router.register("tei-ranges", TeiRangeViewSet, basename="tei-range")
router.register("radio-subscriptions", RadioSubscriptionViewSet, basename="radio-subscription")
router.register("pager-types", PagerTypeViewSet, basename="pager-type")
router.register("ric-codes", RicCodeViewSet, basename="ric-code")

urlpatterns = [
    path("pagers/scanlookup/", PagerScanLookupView.as_view(), name="pager-scanlookup"),
    path("radios/scanlookup/", RadioScanLookupView.as_view(), name="radio-scanlookup"),
    path("radio-subscriptions/import/", RadioSubscriptionImportView.as_view(), name="radio-subscription-import"),
]
urlpatterns += router.urls
