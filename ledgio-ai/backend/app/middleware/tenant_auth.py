import base64
import json
import os
from dataclasses import dataclass
from typing import Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer()


@dataclass
class TenantContext:
    tenant_id: str
    user_id: str
    tier: Literal["starter", "standard", "pro"]
    sector: str


def get_tenant_context(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TenantContext:
    """
    Decodes the JWT issued by the main Ledgio auth service.
    Extracts tenant_id, user_id, tier, and sector.
    TODO: verify JWT signature against LEDGIO_JWT_PUBLIC_KEY before production.
    """
    token = credentials.credentials
    try:
        parts = token.split(".")
        # Add padding for base64 decoding
        padded = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authorization token",
        )

    if not payload.get("tenantId") or not payload.get("userId"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return TenantContext(
        tenant_id=payload["tenantId"],
        user_id=payload["userId"],
        tier=payload.get("tier", "starter"),
        sector=payload.get("sector", "retail"),
    )
