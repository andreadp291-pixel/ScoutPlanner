import hashlib
import secrets

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .config import SECRET_KEY

_magic_link_serializer = URLSafeTimedSerializer(SECRET_KEY, salt="magic-link")
_owner_session_serializer = URLSafeTimedSerializer(SECRET_KEY, salt="owner-session")


def create_magic_link_token(email: str) -> str:
    return _magic_link_serializer.dumps({"email": email})


def verify_magic_link_token(token: str, max_age: int) -> str | None:
    try:
        data = _magic_link_serializer.loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    return data["email"]


def create_owner_session_token(email: str) -> str:
    return _owner_session_serializer.dumps({"email": email})


def verify_owner_session_token(token: str, max_age: int) -> str | None:
    try:
        data = _owner_session_serializer.loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    return data["email"]


def generate_share_token() -> str:
    return secrets.token_urlsafe(32)


def hash_share_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()
