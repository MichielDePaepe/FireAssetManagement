from django.db import models


class SuivoUnit(models.Model):
    external_id = models.CharField(max_length=500, unique=True)
    name = models.CharField(max_length=255)
    data = models.JSONField(default=dict)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    position_at = models.DateTimeField(null=True, blank=True)
    position = models.JSONField(null=True, blank=True)
    status_data = models.JSONField(default=dict, blank=True)
    source_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["name", "external_id"]


class SuivoDevice(models.Model):
    external_id = models.CharField(max_length=255, unique=True)
    imei = models.CharField(max_length=255, blank=True, db_index=True)
    device_type = models.CharField(max_length=120, blank=True)
    unit = models.ForeignKey(
        SuivoUnit, null=True, blank=True, on_delete=models.SET_NULL, related_name="devices"
    )
    data = models.JSONField(default=dict)
    source_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["device_type", "external_id"]


class SuivoSyncState(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    last_attempted_at = models.DateTimeField(null=True, blank=True)
    last_succeeded_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return "Suivo synchronization state"
