from django.contrib import admin

from .models import Pager, PagerType, RicCode


@admin.register(PagerType)
class PagerTypeAdmin(admin.ModelAdmin):
    search_fields = ["name"]


@admin.register(Pager)
class PagerAdmin(admin.ModelAdmin):
    list_display = ["serial_number", "type", "updated_at"]
    list_filter = ["type"]
    search_fields = ["serial_number"]


@admin.register(RicCode)
class RicCodeAdmin(admin.ModelAdmin):
    list_display = ["alias", "ric_code", "adc_code"]
    search_fields = ["alias", "ric_code", "adc_code"]
