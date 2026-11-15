from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


class FireplanEncryptionError(ValueError):
    pass


def _fernet() -> Fernet:
    key = settings.FIREPLAN_CREDENTIAL_KEY
    if not key:
        raise FireplanEncryptionError(
            "FIREPLAN_CREDENTIAL_KEY is not configured; Fireplan credentials cannot be stored."
        )
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeEncodeError) as error:
        raise FireplanEncryptionError(
            "FIREPLAN_CREDENTIAL_KEY must be a valid Fernet key."
        ) from error


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode("utf-8")).decode("ascii")


def decrypt_secret(encrypted_secret: str) -> str:
    try:
        return _fernet().decrypt(encrypted_secret.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError, UnicodeEncodeError) as error:
        raise FireplanEncryptionError(
            "Fireplan credentials cannot be decrypted. Check FIREPLAN_CREDENTIAL_KEY."
        ) from error
