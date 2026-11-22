from django.contrib import admin

from .models import Manufacturer, Pager, PagerType, RadioModel, RicCode, TeiRange


@admin.register(Manufacturer)
class ManufacturerAdmin(admin.ModelAdmin):
    search_fields = ["name"]


@admin.register(RadioModel)
class RadioModelAdmin(admin.ModelAdmin):
    list_display = ["name", "manufacturer"]
    list_filter = ["manufacturer"]
    search_fields = ["name", "manufacturer__name"]


@admin.register(TeiRange)
class TeiRangeAdmin(admin.ModelAdmin):
    list_display = ["model", "start_tei", "end_tei"]
    list_filter = ["model__manufacturer"]
    search_fields = ["model__name", "model__manufacturer__name", "start_tei", "end_tei"]


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
