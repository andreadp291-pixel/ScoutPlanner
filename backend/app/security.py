import hashlib
import secrets
import string

from argon2 import PasswordHasher
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .config import SECRET_KEY

_magic_link_serializer = URLSafeTimedSerializer(SECRET_KEY, salt="magic-link")
_owner_session_serializer = URLSafeTimedSerializer(SECRET_KEY, salt="owner-session")
_member_session_serializer = URLSafeTimedSerializer(SECRET_KEY, salt="member-session")

ph = PasswordHasher()


def create_magic_link_token(email: str) -> str:
    return _magic_link_serializer.dumps({"email": email})


def verify_magic_link_token(token: str, max_age: int) -> str | None:
    try:
        data = _magic_link_serializer.loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    return data["email"]


def create_owner_session_token(email: str, token_version: int = 0) -> str:
    return _owner_session_serializer.dumps({"email": email, "tv": token_version})


def verify_owner_session_token(token: str, max_age: int) -> dict | None:
    try:
        data = _owner_session_serializer.loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    # Sessioni emesse prima dell'introduzione della password non hanno "tv": trattale come versione 0.
    data.setdefault("tv", 0)
    return data


def create_member_session_token(member_id: int, token_version: int) -> str:
    return _member_session_serializer.dumps({"mid": member_id, "tv": token_version})


def verify_member_session_token(token: str, max_age: int) -> dict | None:
    try:
        return _member_session_serializer.loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None


def generate_share_token() -> str:
    return secrets.token_urlsafe(32)


def hash_share_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


_TEMP_PASSWORD_ALPHABET = string.ascii_letters + string.digits


def generate_temp_password(length: int = 12) -> str:
    return "".join(secrets.choice(_TEMP_PASSWORD_ALPHABET) for _ in range(length))
