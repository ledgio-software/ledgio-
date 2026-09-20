from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter()


@router.get("/")
async def health():
    return {
        "status": "ok",
        "service": "ledgio-ai",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
