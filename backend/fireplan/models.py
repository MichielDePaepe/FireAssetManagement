from django.db import models


class FireplanCredential(models.Model):
    login = models.CharField(max_length=255)
    encrypted_password = models.TextField()
    encrypted_cookies = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    session_checked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Fireplan credentials for {self.login}"


class FireplanInventory(models.Model):
    class SyncStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        SYNCED = "synced", "Synced"
        FAILED = "failed", "Failed"

    uuid = models.CharField(max_length=80, unique=True)
    vehicle_alpha_code = models.CharField(max_length=80, blank=True, db_index=True)
    vehicle = models.ForeignKey(
        "citygis.Vehicle",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="fireplan_inventories",
    )
    vehicle_fireplan_id = models.PositiveBigIntegerField(null=True, blank=True)
    vector = models.ForeignKey(
        "citygis.Vector",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="fireplan_inventories",
    )
    inventory_type_name = models.CharField(max_length=160, blank=True)
    done_in_name = models.CharField(max_length=255, blank=True)
    done_by_full_name = models.CharField(max_length=255, blank=True)
    overseen_by_full_name = models.CharField(max_length=255, blank=True)
    source_created_at = models.DateTimeField(null=True, blank=True)
    source_closed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    source_updated_at = models.DateTimeField(null=True, blank=True)
    has_incident_reports = models.BooleanField(null=True, blank=True)
    is_complete_after_completion = models.BooleanField(null=True, blank=True)
    is_complete_before_completion = models.BooleanField(null=True, blank=True)
    is_quantity_count_excluded = models.BooleanField(null=True, blank=True)
    is_test_standard = models.BooleanField(null=True, blank=True)
    remaining_missing_followed_count = models.PositiveIntegerField(null=True, blank=True)
    radio_items = models.JSONField(default=list, blank=True)
    mapping_version = models.PositiveSmallIntegerField(default=0)
    sync_status = models.CharField(
        max_length=16, choices=SyncStatus.choices, default=SyncStatus.PENDING
    )
    last_attempted_at = models.DateTimeField(null=True, blank=True)
    last_successful_sync_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-source_closed_at", "uuid"]

    def __str__(self) -> str:
        return self.uuid


class FireplanRadioObservation(models.Model):
    inventory = models.ForeignKey(
        FireplanInventory, on_delete=models.CASCADE, related_name="radio_observations"
    )
    fireplan_item_id = models.CharField(max_length=120)
    item_type_id = models.PositiveIntegerField()
    serial_number = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["fireplan_item_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["inventory", "fireplan_item_id"],
                name="uniq_fireplan_inventory_item",
            )
        ]

    def __str__(self) -> str:
        return f"{self.inventory.uuid}: {self.fireplan_item_id}"
