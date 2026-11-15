# Sample FITS (synthetic stubs)

Files matching `stub-*.fits` are **tiny synthetic images** for wiring
`GET /api/preview/{obs_id}` to P5 `fits_to_png` / `inspect_fits`.

| File | Role |
|------|------|
| `stub-wise0855-001.fits` | Primary 2-D image (epoch 1) |
| `stub-wise0855-002.fits` | MEF: empty PRIMARY + `IMAGE` HDU (epoch 2; blink pair) |

They are **not** SPHEREx / IRSA science products. Do not cite them as NASA data.

Optional live cutouts from P4 (`download_cutout` / `download_observation`) may be
placed at `data/raw/{obs_id}.fits`; CatalogService will resolve them for
`preview_url` / `/api/preview` when the file exists. No auto-download in the
request path by default (IRSA flaky offline).
