from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PagerScanLookupView, PagerTypeViewSet, PagerViewSet, RicCodeViewSet

router = DefaultRouter()
router.register("pagers", PagerViewSet, basename="pager")
router.register("pager-types", PagerTypeViewSet, basename="pager-type")
router.register("ric-codes", RicCodeViewSet, basename="ric-code")

urlpatterns = [path("pagers/scanlookup/", PagerScanLookupView.as_view(), name="pager-scanlookup")]
urlpatterns += router.urls
