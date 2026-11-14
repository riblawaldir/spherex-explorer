"""Inspect FITS HDUs without modifying them or treating previews as science data.

Finite-pixel counts are computed a block of rows at a time, so image HDUs are
not loaded simultaneously. WCS status describes header parsing only; use
validate_fits_wcs on the chosen HDU for transformation validation.
"""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS


@dataclass(frozen=True)
class HDUInspection:
    index: int
    name: str
    hdu_type: str
    shape: tuple[int, ...]
    dtype: str | None
    is_numeric_2d_image: bool
    valid_percent: float | None
    bunit: str | None
    wcs_status: str
    wcs_axis_types: tuple[str, ...]
    metadata: dict[str, str | int | float | bool]


@dataclass(frozen=True)
class FITSInspection:
    hdus: tuple[HDUInspection, ...]


def inspect_fits(path: str | Path, *, rows_per_block: int = 128) -> FITSInspection:
    """Inspect HDUs and their headers; count finite pixels in each 2-D image.

    Shapes use NumPy order (rows, columns). WCS status is 'absent',
    'celestial', 'non-celestial', or 'invalid'; a celestial status does not
    prove that pixel/world transformations work. Errors reading the FITS file
    propagate. This function never writes to the input file.
    """
    if isinstance(rows_per_block, bool) or not isinstance(rows_per_block, int) or rows_per_block < 1:
        raise ValueError('rows_per_block must be a positive integer')
    result = []
    with fits.open(path, mode='readonly', memmap=False, lazy_load_hdus=True) as hdus:
        for index, hdu in enumerate(hdus):
            header = hdu.header
            naxis = int(header.get('NAXIS', 0))
            shape = tuple(int(header.get(f'NAXIS{axis}', 0)) for axis in range(naxis, 0, -1))
            is_image = isinstance(hdu, (fits.PrimaryHDU, fits.ImageHDU, fits.CompImageHDU))
            numeric_2d = is_image and len(shape) == 2 and all(size > 0 for size in shape)
            dtype = None
            percent = None
            if numeric_2d:
                valid = total = 0
                for row in range(0, shape[0], rows_per_block):
                    block = np.asarray(hdu.section[row:min(row + rows_per_block, shape[0]), :])
                    if not np.issubdtype(block.dtype, np.number) or np.iscomplexobj(block):
                        numeric_2d = False
                        break
                    dtype = str(block.dtype)
                    valid += int(np.isfinite(block).sum())
                    total += block.size
                if numeric_2d and total:
                    percent = 100.0 * valid / total
            elif is_image and header.get('BITPIX') is not None:
                # FITS storage type for non-2D HDUs; scaled 2-D dtype above is actual data type.
                dtype = {8: 'uint8', 16: 'int16', 32: 'int32', 64: 'int64',
                         -32: 'float32', -64: 'float64'}.get(header['BITPIX'])
            axis_types = tuple(str(header.get(f'CTYPE{i}', '')) for i in range(1, naxis + 1))
            wcs_status = 'absent'
            if any(axis_types):
                try:
                    wcs = WCS(header, fobj=hdus)
                    wcs_status = 'celestial' if wcs.has_celestial else 'non-celestial'
                except Exception:
                    wcs_status = 'invalid'
            metadata = {key: header[key] for key in
                        ('OBJECT', 'TELESCOP', 'INSTRUME', 'DATE-OBS', 'MJD-OBS',
                         'MJD-BEG', 'MJD-END', 'FILTER', 'EXPTIME') if key in header}
            result.append(HDUInspection(
                index=index, name=hdu.name, hdu_type=type(hdu).__name__, shape=shape,
                dtype=dtype, is_numeric_2d_image=numeric_2d, valid_percent=percent,
                bunit=str(header['BUNIT']) if 'BUNIT' in header else None,
                wcs_status=wcs_status, wcs_axis_types=axis_types, metadata=metadata,
            ))
    return FITSInspection(tuple(result))


def select_image_hdu(inspection: FITSInspection) -> int:
    """Select the unique, nonempty numeric 2-D HDU named IMAGE.

    No fallback to PRIMARY, FLAGS, VARIANCE or WCS-WAVE is made. Duplicate
    IMAGE names are ambiguous; require callers to resolve them explicitly.
    """
    candidates = [hdu for hdu in inspection.hdus if hdu.name.upper() == 'IMAGE']
    if not candidates:
        raise ValueError('No IMAGE extension found')
    if len(candidates) != 1:
        raise ValueError('Ambiguous IMAGE extensions; select an HDU explicitly')
    hdu = candidates[0]
    if not hdu.is_numeric_2d_image:
        raise ValueError('IMAGE extension must contain a nonempty numeric 2-D image')
    if hdu.valid_percent == 0:
        raise ValueError('IMAGE extension contains no finite pixels')
    return hdu.index
