from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

 feat/spherex-data
from app.routers import comparability, epochs, preview, search, targets
from app.routers import compare, epochs, preview, search, targets
 main

app = FastAPI(
    title="SPHEREx Explorer",
    version="0.4.0-sprint4",
    description=(
        "Sprint 4 API: search/epochs/preview over labeled fixtures "
        "(stub / cached_sample) plus /api/compare for obs_id pairs. "
        "Contract also in repo-root openapi.yaml. "
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
 feat/spherex-data
app.include_router(comparability.router)
app.include_router(compare.router)
 main


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
