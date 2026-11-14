"""Legacy stub constants (Sprint 0). Prefer CatalogService + data/metadata/.

Kept for preview 501 provenance labels and any callers still importing
STUB_PROVENANCE. Target lists now live in ``data/metadata/targets.json``.
"""

STUB_PROVENANCE = "stub"

# Backward-compatible alias — prefer get_catalog_service().list_targets().
STUB_TARGETS: list[dict] = []
