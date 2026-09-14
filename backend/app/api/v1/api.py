from fastapi import APIRouter
from app.api.v1 import health, auth, titles, library, decision, sync, friends

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(titles.router, prefix="/titles", tags=["Titles"])
api_router.include_router(library.router, prefix="/library", tags=["Library"])
api_router.include_router(decision.router, prefix="/decision", tags=["Decision"])
api_router.include_router(friends.router, prefix="/friends", tags=["Friends"])
api_router.include_router(sync.router, tags=["Sync"])


