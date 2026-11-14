"""Shared query-parameter validation for sky coordinates.

FastAPI/Pydantic emit 422 with clear ``loc`` / ``msg`` when these fail.
Defaults must be set with ``=`` on the parameter, not inside ``Query()``.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Query

# RA in degrees: [0, 360). Dec: [-90, 90]. Radius in arcseconds, positive.
RaQuery = Annotated[
    float,
    Query(ge=0.0, lt=360.0, description="Right ascension in degrees [0, 360)"),
]
DecQuery = Annotated[
    float,
    Query(ge=-90.0, le=90.0, description="Declination in degrees [-90, 90]"),
]
OptionalRaQuery = Annotated[
    float | None,
    Query(ge=0.0, lt=360.0, description="Right ascension in degrees [0, 360)"),
]
OptionalDecQuery = Annotated[
    float | None,
    Query(ge=-90.0, le=90.0, description="Declination in degrees [-90, 90]"),
]
OptionalRadiusArcsecQuery = Annotated[
    float | None,
    Query(
        gt=0.0,
        le=3600.0,
        description="Search radius in arcseconds (0, 3600]",
    ),
]
