from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import comparability, epochs, preview, search, targets

app = FastAPI(
    title="SPHEREx Explorer",
    version="0.1.0-sprint1",
    description=(
        "Sprint 1 API: validated search/epochs over labeled fixtures "
        "(stub / cached_sample). Contract also in repo-root openapi.yaml. "
        "Live IRSA is owned by P4 (feat/spherex-data)."
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
app.include_router(comparability.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
