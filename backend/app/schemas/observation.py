from datetime import datetime

from pydantic import BaseModel, Field


class Observation(BaseModel):
    """JSON observation contract. Coordinates are in degrees."""

    id: str
    observed_at: datetime
    collection: str
    ra: float = Field(ge=0, lt=360)
    dec: float = Field(ge=-90, le=90)
    band: str
    preview_url: str | None
    source_url: str | None
