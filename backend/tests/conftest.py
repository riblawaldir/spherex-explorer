"""
conftest.py — Configuración de pytest para el módulo spherex-data.
"""
import pytest


@pytest.fixture(autouse=True)
def _isolate_local_fits_manifest(monkeypatch):
    """Ambient allowlists must not change fixture tests."""
    monkeypatch.delenv("SPHEREX_P5_LOCAL_MANIFEST", raising=False)


def pytest_addoption(parser):
    parser.addoption(
        "--run-real",
        action="store_true",
        default=False,
        help="Ejecutar pruebas de integración reales con IRSA (requiere internet)",
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "real: Prueba de integración real con IRSA (requiere internet). "
        "Ejecutar con: pytest -m real --run-real",
    )


def pytest_collection_modifyitems(config, items):
    if not config.getoption("--run-real"):
        skip_real = pytest.mark.skip(reason="Usa --run-real para ejecutar pruebas reales con IRSA")
        for item in items:
            if "real" in item.keywords:
                item.add_marker(skip_real)

