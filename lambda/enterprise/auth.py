"""
JWT Authentication module for Cognito tokens
既存のaccounts Lambda認証をベースにしたモジュール
"""

import os
from functools import lru_cache
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt
from jose.utils import base64url_decode

# Environment variables
COGNITO_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
COGNITO_USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "")

# JWKs URL
JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"

# Security scheme
security = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def get_jwks() -> dict:
    """Fetch and cache JWKS from Cognito"""
    if not COGNITO_USER_POOL_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cognito User Pool ID not configured",
        )

    try:
        response = httpx.get(JWKS_URL, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch JWKS: {str(e)}",
        ) from e


def get_public_key(token: str, jwks: dict) -> Optional[dict]:
    """Get the public key for the given token from JWKS"""
    try:
        headers = jwt.get_unverified_headers(token)
        kid = headers.get("kid")

        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return key
    except Exception:
        pass
    return None


def verify_token(token: str) -> dict:
    """Verify JWT token and return claims"""
    jwks = get_jwks()
    public_key = get_public_key(token, jwks)

    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: key not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Construct the public key
        rsa_key = jwk.construct(public_key)

        # Verify and decode the token
        message, encoded_signature = token.rsplit(".", 1)
        decoded_signature = base64url_decode(encoded_signature.encode("utf-8"))

        if not rsa_key.verify(message.encode("utf-8"), decoded_signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token signature verification failed",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Decode claims
        claims = jwt.get_unverified_claims(token)

        # Verify expiration
        import time

        if claims.get("exp", 0) < time.time():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify issuer
        expected_issuer = (
            f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
        )
        if claims.get("iss") != expected_issuer:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify token use (accept both id and access tokens)
        token_use = claims.get("token_use")
        if token_use not in ["id", "access"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Verify client_id/audience based on token type
        if COGNITO_CLIENT_ID:
            if token_use == "access":
                if claims.get("client_id") != COGNITO_CLIENT_ID:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid client ID",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            elif token_use == "id":
                if claims.get("aud") != COGNITO_CLIENT_ID:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid audience",
                        headers={"WWW-Authenticate": "Bearer"},
                    )

        return claims

    except HTTPException:
        raise
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """Dependency to get current authenticated user from JWT token"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    claims = verify_token(token)

    return {
        "sub": claims.get("sub"),
        "username": claims.get("username"),
        "email": claims.get("email"),
        "cognito_groups": claims.get("cognito:groups", []),
        "access_token": token,
    }
