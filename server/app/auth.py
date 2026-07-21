import os
import secrets

from fastapi import Header, HTTPException, status


def require_api_key(x_api_key: str = Header(default="")) -> None:
    expected = os.getenv("API_KEY", "")
    if not expected or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")
