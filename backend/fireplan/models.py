from django.db import models


class FireplanCredential(models.Model):
    login = models.CharField(max_length=255)
    encrypted_password = models.TextField()
    encrypted_cookies = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    session_checked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Fireplan credentials for {self.login}"
