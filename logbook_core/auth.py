from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import sqlite3
from dataclasses import dataclass

from .tenancy import DEFAULT_USER_ID, normalize_user_id

PASSWORD_MIN_LENGTH = 8
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 32


@dataclass(frozen=True)
class AuthResult:
    ok: bool
    user_id: int | None = None
    error: str | None = None


def normalize_email(value: object) -> str:
    return str(value or "").strip().lower()


def email_is_valid(email: str) -> bool:
    email = normalize_email(email)
    return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email))


def password_is_valid(password: str) -> bool:
    return len(str(password or "")) >= PASSWORD_MIN_LENGTH


def hash_password(password: str) -> str:
    password = str(password or "")
    if not password_is_valid(password):
        raise ValueError(f"Password must contain at least {PASSWORD_MIN_LENGTH} characters.")
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )
    return "$".join(
        [
            "scrypt",
            f"n={_SCRYPT_N},r={_SCRYPT_R},p={_SCRYPT_P}",
            base64.urlsafe_b64encode(salt).decode("ascii"),
            base64.urlsafe_b64encode(digest).decode("ascii"),
        ]
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, params, salt_b64, digest_b64 = str(encoded or "").split("$", 3)
        if algorithm != "scrypt":
            return False
        parsed = {}
        for item in params.split(","):
            key, value = item.split("=", 1)
            parsed[key] = int(value)
        salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
        expected = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
        actual = hashlib.scrypt(
            str(password or "").encode("utf-8"),
            salt=salt,
            n=parsed["n"],
            r=parsed["r"],
            p=parsed["p"],
            dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, KeyError, TypeError):
        return False


def ensure_auth_schema(con: sqlite3.Connection) -> None:
    """Create authentication storage without changing ownership of existing data."""
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS user_credentials (
            user_id INTEGER PRIMARY KEY,
            password_hash TEXT NOT NULL,
            created_at TEXT,
            updated_at TEXT,
            last_login_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    # NULL/blank e-mails are allowed for the legacy profile until it is claimed,
    # but real account e-mails must be unique case-insensitively.
    con.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_ci
        ON users(LOWER(TRIM(email)))
        WHERE email IS NOT NULL AND TRIM(email) <> ''
        """
    )
    con.execute(
        "CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)"
    )


def user_has_credentials(con: sqlite3.Connection, user_id: int = DEFAULT_USER_ID) -> bool:
    row = con.execute(
        "SELECT 1 FROM user_credentials WHERE user_id = ?",
        (normalize_user_id(user_id),),
    ).fetchone()
    return bool(row)


def legacy_profile_needs_activation(con: sqlite3.Connection) -> bool:
    return not user_has_credentials(con, DEFAULT_USER_ID)


def get_user_by_email(con: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    clean = normalize_email(email)
    if not clean:
        return None
    return con.execute(
        "SELECT * FROM users WHERE active = 1 AND LOWER(TRIM(email)) = ? LIMIT 1",
        (clean,),
    ).fetchone()


def authenticate_user(con: sqlite3.Connection, email: str, password: str) -> AuthResult:
    user = get_user_by_email(con, email)
    if not user:
        return AuthResult(False, error="Neplatný e-mail nebo heslo.")
    cred = con.execute(
        "SELECT password_hash FROM user_credentials WHERE user_id = ?",
        (int(user["id"]),),
    ).fetchone()
    if not cred or not verify_password(password, str(cred[0] or "")):
        return AuthResult(False, error="Neplatný e-mail nebo heslo.")
    con.execute(
        "UPDATE user_credentials SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        (int(user["id"]),),
    )
    return AuthResult(True, user_id=int(user["id"]))


def activate_legacy_profile(
    con: sqlite3.Connection,
    *,
    email: str,
    display_name: str,
    password: str,
) -> AuthResult:
    """Claim user ID 1. Existing flights and related data remain untouched."""
    if user_has_credentials(con, DEFAULT_USER_ID):
        return AuthResult(False, error="Stávající profil už byl aktivován.")
    clean_email = normalize_email(email)
    clean_name = str(display_name or "").strip()
    if not clean_name:
        return AuthResult(False, error="Vyplňte jméno profilu.")
    if not email_is_valid(clean_email):
        return AuthResult(False, error="Zadejte platný e-mail.")
    if not password_is_valid(password):
        return AuthResult(False, error=f"Heslo musí mít alespoň {PASSWORD_MIN_LENGTH} znaků.")
    try:
        password_hash = hash_password(password)
        con.execute(
            """
            UPDATE users
            SET email = ?, display_name = ?, active = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (clean_email, clean_name, DEFAULT_USER_ID),
        )
        con.execute(
            """
            INSERT INTO user_credentials (user_id, password_hash, created_at, updated_at, last_login_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (DEFAULT_USER_ID, password_hash),
        )
        return AuthResult(True, user_id=DEFAULT_USER_ID)
    except sqlite3.IntegrityError:
        return AuthResult(False, error="Tento e-mail už používá jiný účet.")


def _new_slug(email: str) -> str:
    local = normalize_email(email).split("@", 1)[0]
    base = re.sub(r"[^a-z0-9]+", "-", local.lower()).strip("-") or "pilot"
    return f"{base}-{secrets.token_hex(3)}"


def register_user(
    con: sqlite3.Connection,
    *,
    email: str,
    display_name: str,
    password: str,
) -> AuthResult:
    clean_email = normalize_email(email)
    clean_name = str(display_name or "").strip()
    if not clean_name:
        return AuthResult(False, error="Vyplňte jméno profilu.")
    if not email_is_valid(clean_email):
        return AuthResult(False, error="Zadejte platný e-mail.")
    if not password_is_valid(password):
        return AuthResult(False, error=f"Heslo musí mít alespoň {PASSWORD_MIN_LENGTH} znaků.")
    if get_user_by_email(con, clean_email):
        return AuthResult(False, error="Účet s tímto e-mailem už existuje.")
    try:
        cur = con.execute(
            """
            INSERT INTO users (email, display_name, slug, active, created_at, updated_at)
            VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (clean_email, clean_name, _new_slug(clean_email)),
        )
        user_id = int(cur.lastrowid)
        con.execute(
            """
            INSERT INTO user_settings
                (user_id, timezone, currency, default_role, created_at, updated_at)
            VALUES (?, 'Europe/Prague', 'CZK', 'PIC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (user_id,),
        )
        con.execute(
            """
            INSERT INTO user_credentials (user_id, password_hash, created_at, updated_at, last_login_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (user_id, hash_password(password)),
        )
        return AuthResult(True, user_id=user_id)
    except sqlite3.IntegrityError:
        return AuthResult(False, error="Účet s tímto e-mailem už existuje.")


def change_password(
    con: sqlite3.Connection,
    *,
    user_id: int,
    current_password: str,
    new_password: str,
) -> AuthResult:
    uid = normalize_user_id(user_id)
    row = con.execute(
        "SELECT password_hash FROM user_credentials WHERE user_id = ?",
        (uid,),
    ).fetchone()
    if not row or not verify_password(current_password, str(row[0] or "")):
        return AuthResult(False, error="Současné heslo není správné.")
    if not password_is_valid(new_password):
        return AuthResult(False, error=f"Nové heslo musí mít alespoň {PASSWORD_MIN_LENGTH} znaků.")
    con.execute(
        """
        UPDATE user_credentials
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
        """,
        (hash_password(new_password), uid),
    )
    return AuthResult(True, user_id=uid)
