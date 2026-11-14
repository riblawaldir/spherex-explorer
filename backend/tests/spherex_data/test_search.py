"""
test_search.py — Pruebas del módulo de búsqueda de observaciones SPHEREx.

Incluye:
  - Pruebas unitarias con datos simulados (no requieren red).
  - Prueba de integración real con IRSA (marcada con pytest.mark.real).

Ejecutar solo pruebas unitarias (sin red):
    pytest tests/test_search.py -v -m "not real"

Ejecutar prueba con IRSA real (requiere internet):
    pytest tests/test_search.py -v -m real
"""

import pytest
from unittest.mock import MagicMock, patch
from astropy.table import Table
import numpy as np

from app.science.spherex_data.search import (
    validate_coordinates,
    CoordinateValidationError,
    normalize_sia2_row,
    search_observations,
    ObservationRecord,
    _mjd_to_iso,
    _derive_band_label,
)
from app.science.spherex_data.config import EXAMPLE_RA, EXAMPLE_DEC, EXAMPLE_RADIUS_DEG


# ---------------------------------------------------------------------------
# Tests de validación de coordenadas
# ---------------------------------------------------------------------------

class TestValidateCoordinates:
    def test_valid_coordinates(self):
        """Coordenadas válidas no deben lanzar excepción."""
        validate_coordinates(127.69, -39.17, 0.01)

    def test_valid_ra_boundaries(self):
        validate_coordinates(0.0, 0.0, 0.01)
        validate_coordinates(360.0, 0.0, 0.01)

    def test_valid_dec_boundaries(self):
        validate_coordinates(180.0, -90.0, 0.01)
        validate_coordinates(180.0, 90.0, 0.01)

    def test_invalid_ra_negative(self):
        with pytest.raises(CoordinateValidationError, match="RA"):
            validate_coordinates(-1.0, 0.0, 0.01)

    def test_invalid_ra_too_large(self):
        with pytest.raises(CoordinateValidationError, match="RA"):
            validate_coordinates(361.0, 0.0, 0.01)

    def test_invalid_dec_too_low(self):
        with pytest.raises(CoordinateValidationError, match="Dec"):
            validate_coordinates(0.0, -91.0, 0.01)

    def test_invalid_dec_too_high(self):
        with pytest.raises(CoordinateValidationError, match="Dec"):
            validate_coordinates(0.0, 91.0, 0.01)

    def test_invalid_radius_zero(self):
        with pytest.raises(CoordinateValidationError, match="radio"):
            validate_coordinates(0.0, 0.0, 0.0)

    def test_invalid_radius_too_large(self):
        with pytest.raises(CoordinateValidationError, match="radio"):
            validate_coordinates(0.0, 0.0, 10.0)

    def test_type_error_string_ra(self):
        with pytest.raises(TypeError):
            validate_coordinates("127.0", 0.0, 0.01)

    def test_type_error_none_dec(self):
        with pytest.raises(TypeError):
            validate_coordinates(0.0, None, 0.01)


# ---------------------------------------------------------------------------
# Tests de funciones auxiliares
# ---------------------------------------------------------------------------

class TestHelpers:
    def test_mjd_to_iso_known_value(self):
        """MJD 51544.5 corresponde a 2000-01-02T00:00:00Z (J2000 + 1 día)."""
        result = _mjd_to_iso(51544.5)
        assert result is not None
        assert result.startswith("2000-01-")
        assert result.endswith("Z")

    def test_mjd_to_iso_none(self):
        assert _mjd_to_iso(None) is None

    def test_derive_band_label(self):
        label = _derive_band_label(0.75e-6, 1.1e-6)
        assert "0.750" in label
        assert "1.100" in label
        assert "µm" in label

    def test_derive_band_label_none(self):
        assert _derive_band_label(None, 1.0e-6) is None
        assert _derive_band_label(0.75e-6, None) is None


# ---------------------------------------------------------------------------
# Tests de normalización de filas SIA2
# ---------------------------------------------------------------------------

class TestNormalizeSIA2Row:
    def _make_row(self, **kwargs):
        """Crea una fila de Table mock con los valores dados."""
        defaults = {
            "obs_id": "SPX-DR1-TEST-001",
            "obs_collection": "spherex_dr1",
            "access_url": "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/test.fits",
            "s_ra": 127.69444,
            "s_dec": -39.17760,
            "t_min": 60000.0,
            "t_max": 60000.1,
            "em_min": 0.75e-6,
            "em_max": 1.1e-6,
            "instrument_name": "SPHEREx",
            "facility_name": "SPHEREx",
        }
        defaults.update(kwargs)
        table = Table(rows=[defaults])
        return table[0], list(table.colnames)

    def test_basic_normalization(self):
        row, cols = self._make_row()
        rec = normalize_sia2_row(row, cols)
        assert isinstance(rec, ObservationRecord)
        assert rec.obs_id == "SPX-DR1-TEST-001"
        assert rec.collection == "spherex_dr1"
        assert rec.ra == pytest.approx(127.69444)
        assert rec.dec == pytest.approx(-39.17760)

    def test_observed_at_derived_from_mjd(self):
        row, cols = self._make_row(t_min=60000.0)
        rec = normalize_sia2_row(row, cols)
        assert rec.observed_at is not None
        assert "Z" in rec.observed_at

    def test_band_label_derived(self):
        row, cols = self._make_row(em_min=0.75e-6, em_max=1.1e-6)
        rec = normalize_sia2_row(row, cols)
        assert rec.band_label is not None
        assert "µm" in rec.band_label

    def test_to_dict_has_required_keys(self):
        row, cols = self._make_row()
        rec = normalize_sia2_row(row, cols)
        d = rec.to_dict()
        for key in ("id", "collection", "access_url", "ra", "dec", "observed_at"):
            assert key in d, f"Falta clave '{key}' en to_dict()"

    def test_missing_identity_is_rejected_instead_of_fabricated(self):
        row, cols = self._make_row(obs_id=None, obs_collection=None)
        with pytest.raises(ValueError, match="obs_id"):
            normalize_sia2_row(row, cols)

    def test_non_finite_measurements_are_omitted(self):
        row, cols = self._make_row(t_min=float("nan"), em_min=float("inf"))
        rec = normalize_sia2_row(row, cols)
        assert rec.t_min_mjd is None
        assert rec.observed_at is None
        assert rec.em_min_m is None


# ---------------------------------------------------------------------------
# Tests de search_observations con mock
# ---------------------------------------------------------------------------

class TestSearchObservationsMocked:
    def _make_mock_table(self):
        """Tabla SIA2 simulada con estructura real."""
        return Table({
            "obs_id": ["SPX-DR1-TEST-001", "SPX-QR3-TEST-002"],
            "obs_collection": ["spherex_dr1", "spherex_qr3"],
            "access_url": [
                "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/file1.fits",
                "https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/file2.fits",
            ],
            "s_ra": [127.69444, 127.69500],
            "s_dec": [-39.17760, -39.17800],
            "t_min": [60000.0, 60180.0],
            "t_max": [60000.1, 60180.1],
            "em_min": [0.75e-6, 1.1e-6],
            "em_max": [1.1e-6, 1.65e-6],
            "instrument_name": ["SPHEREx", "SPHEREx"],
            "facility_name": ["SPHEREx", "SPHEREx"],
        })

    @patch("app.science.spherex_data.search.IRSAClient")
    def test_returns_dict_structure(self, MockClient):
        mock_instance = MagicMock()
        mock_instance.query_sia.return_value = self._make_mock_table()
        mock_instance.collections = ["spherex_dr1", "spherex_qr3"]
        MockClient.return_value = mock_instance

        result = search_observations(127.69, -39.17, 0.01)

        MockClient.assert_called_once()
        mock_instance.query_sia.assert_called_once_with(
            127.69, -39.17, 0.01, ["spherex_dr1", "spherex_qr3"]
        )
        assert "region" in result
        assert "count" in result
        assert "observations" in result
        assert result["count"] == 2

    @patch("app.science.spherex_data.search.IRSAClient")
    def test_empty_result(self, MockClient):
        mock_instance = MagicMock()
        mock_instance.query_sia.return_value = Table()
        mock_instance.collections = ["spherex_dr1"]
        MockClient.return_value = mock_instance

        result = search_observations(127.69, -39.17, 0.01)

        assert result["count"] == 0
        assert result["observations"] == []
        assert "warning" in result

    def test_invalid_coords_raises_before_network(self):
        """La validación debe ocurrir antes de cualquier consulta HTTP."""
        with pytest.raises(CoordinateValidationError):
            search_observations(-999.0, 0.0, 0.01)

    @patch("app.science.spherex_data.search.IRSAClient")
    def test_region_preserved_in_result(self, MockClient):
        mock_instance = MagicMock()
        mock_instance.query_sia.return_value = Table()
        mock_instance.collections = ["spherex_dr1"]
        MockClient.return_value = mock_instance

        result = search_observations(45.0, 30.0, 0.05)
        assert result["region"]["ra"] == 45.0
        assert result["region"]["dec"] == 30.0
        assert result["region"]["radius_deg"] == 0.05


# ---------------------------------------------------------------------------
# Test de integración REAL con IRSA (requiere internet)
# ---------------------------------------------------------------------------

@pytest.mark.real
class TestSearchObservationsReal:
    """
    Prueba con coordenadas reales documentadas por IRSA.
    RA=127.69444, Dec=-39.17760, radio=0.01°

    Esta prueba requiere conexión a internet y puede tardar 30-120 segundos.
    """

    def test_real_query_irsa(self):
        """Consulta real al servicio SIA2 de IRSA con coordenadas oficiales."""
        result = search_observations(
            ra=EXAMPLE_RA,
            dec=EXAMPLE_DEC,
            radius_deg=EXAMPLE_RADIUS_DEG,
        )

        # La respuesta siempre debe tener la estructura correcta
        assert "region" in result
        assert "count" in result
        assert "observations" in result
        assert isinstance(result["observations"], list)

        print(f"\n✓ IRSA devolvió {result['count']} observaciones")

        if result["count"] > 0:
            # Verificar que los campos básicos están presentes
            obs = result["observations"][0]
            assert "id" in obs
            assert "collection" in obs
            assert "access_url" in obs
            print(f"  Primera observación: {obs['id']} | {obs['collection']}")
            if obs.get("observed_at"):
                print(f"  Fecha: {obs['observed_at']}")
            if obs.get("band_label"):
                print(f"  Banda: {obs['band_label']}")
        else:
            # Si no hay datos en esta región, el test sigue siendo válido
            print("  (Sin observaciones en esta región — región puede no estar cubierta aún)")
            assert "warning" in result

