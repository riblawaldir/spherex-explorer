"""Service layer for catalog / observation access.

Sprint 1 uses labeled fixtures. P4 (IRSA) should replace the fixture
implementation behind the same interface — see catalog.py TODOs.
"""

from app.services.catalog import CatalogService, get_catalog_service

__all__ = ["CatalogService", "get_catalog_service"]
