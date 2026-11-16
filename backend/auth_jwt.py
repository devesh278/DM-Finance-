import hmac
import hashlib
import base64
import json
import time
from typing import Dict, Any, Optional

SECRET_KEY = "dalal-street-secret-key-change-in-production-long-secure-entropy"
ALGORITHM = "HS256"

class TokenExpiredError(Exception):
    pass

class TokenInvalidError(Exception):
    pass

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def _b64url_decode(data: str) -> bytes:
    padding = '=' * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def create_jwt(payload: Dict[str, Any], expires_in_seconds: int, secret: str = SECRET_KEY) -> str:
    header = {"alg": ALGORITHM, "typ": "JWT"}
    now = int(time.time())
    full_payload = {
        **payload,
        "iat": now,
        "exp": now + expires_in_seconds
    }
    
    header_b64 = _b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _b64url_encode(json.dumps(full_payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    
    signature = hmac.new(secret.encode('utf-8'), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def decode_jwt(token: str, secret: str = SECRET_KEY) -> Dict[str, Any]:
    try:
        parts = token.strip().split('.')
        if len(parts) != 3:
            raise TokenInvalidError("Malformed JWT structure")
        
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(secret.encode('utf-8'), signing_input, hashlib.sha256).digest()
        provided_sig = _b64url_decode(sig_b64)
        
        if not hmac.compare_digest(expected_sig, provided_sig):
            raise TokenInvalidError("Invalid signature")
        
        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        now = int(time.time())
        exp = payload.get("exp")
        if exp is not None and now > exp:
            raise TokenExpiredError("Token has expired")
        
        return payload
    except (TokenExpiredError, TokenInvalidError):
        raise
    except Exception as e:
        raise TokenInvalidError(f"Could not decode token: {str(e)}")

def create_access_token(user_id: int, email: str, name: str, role: str = "user", expires_in: int = 900) -> str:
    """Create short-lived access token (default 15 mins)."""
    return create_jwt({
        "sub": str(user_id),
        "email": email,
        "name": name,
        "role": role,
        "type": "access"
    }, expires_in_seconds=expires_in)

def create_refresh_token(user_id: int, expires_in: int = 604800) -> str:
    """Create long-lived refresh token (default 7 days)."""
    return create_jwt({
        "sub": str(user_id),
        "type": "refresh"
    }, expires_in_seconds=expires_in)
