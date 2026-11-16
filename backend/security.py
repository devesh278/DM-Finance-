import bcrypt
import hashlib
from typing import Optional

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    pw_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash, with fallback to legacy sha256."""
    try:
        pw_bytes = plain_password.encode('utf-8')
        if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
            return bcrypt.checkpw(pw_bytes, hashed_password.encode('utf-8'))
        # Fallback to sha256 for previously seeded demo hashes
        sha = hashlib.sha256(pw_bytes).hexdigest()
        return sha == hashed_password
    except Exception:
        return False
