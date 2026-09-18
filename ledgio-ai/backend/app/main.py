from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.routes.chat import router as chat_router
from app.routes.health import router as health_router

load_dotenv()

app = FastAPI(
    title="Ledgio AI",
    description="Claude-powered financial assistant for Ledgio accounting platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(chat_router, prefix="/api/ai", tags=["ai"])
