from rest_framework import serializers


class StartTaskSerializer(serializers.Serializer):
    duration_seconds = serializers.IntegerField(min_value=5, max_value=60, default=30)


class TaskSummarySerializer(serializers.Serializer):
    task_id = serializers.CharField()
    task_name = serializers.CharField(allow_null=True)
    status = serializers.CharField()
    progress = serializers.JSONField(allow_null=True)
    result = serializers.JSONField(allow_null=True)
    error = serializers.CharField(allow_null=True)
    updated_at = serializers.DateTimeField(allow_null=True)
