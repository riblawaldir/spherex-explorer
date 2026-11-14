from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import epochs, preview, search, targets

app = FastAPI(
    title="SPHEREx Explorer",
    version="0.0.0-sprint0",
    description=(
        "Sprint 0 API: /health + hollow /api stubs. "
        "Contract also documented in repo-root openapi.yaml."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(targets.router)
app.include_router(search.router)
app.include_router(epochs.router)
app.include_router(preview.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
