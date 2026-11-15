from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Pager, PagerType, RicCode
from .serializers import PagerSerializer, PagerTypeSerializer, RicCodeSerializer


class PagerViewSet(viewsets.ModelViewSet):
    queryset = Pager.objects.select_related("type").all()
    serializer_class = PagerSerializer
    permission_classes = [IsAuthenticated]


class PagerTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PagerType.objects.all()
    serializer_class = PagerTypeSerializer
    permission_classes = [IsAuthenticated]


class RicCodeViewSet(viewsets.ModelViewSet):
    queryset = RicCode.objects.all()
    serializer_class = RicCodeSerializer
    permission_classes = [IsAuthenticated]
