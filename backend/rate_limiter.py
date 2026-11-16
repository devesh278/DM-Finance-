import time
from collections import defaultdict
from fastapi import Request, HTTPException
from typing import Dict, List

class IPRateLimiter:
    """In-memory sliding-window rate limiter per client IP."""
    def __init__(self, requests_per_minute: int = 60):
        self.rpm = requests_per_minute
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        client = request.client
        return client.host if client else "127.0.0.1"

    def check(self, request: Request):
        ip = self.get_client_ip(request)
        now = time.time()
        window_start = now - 60.0
        
        # Prune older timestamps
        self.requests[ip] = [t for t in self.requests[ip] if t > window_start]
        
        if len(self.requests[ip]) >= self.rpm:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded for public market endpoints (60 req/min). Please slow down.",
                headers={"Retry-After": "60"}
            )
        
        self.requests[ip].append(now)

# Global instance for public endpoints
public_rate_limiter = IPRateLimiter(requests_per_minute=60)
