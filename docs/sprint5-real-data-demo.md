# Sprint 5: demo de datos reales IRSA

La demo usa dos recortes locales SPHEREx Level 2, sin subir archivos científicos al repositorio. `SPHEREX_REAL_DATA_DIR` activa el registro reproducible: el catálogo conserva una lista cerrada de nombres, tamaño y SHA-256 y verifica cada archivo al resolverlo. Los metadatos SIA2 originales se guardan con los identificadores conocidos. No hay consultas en vivo ni descargas automáticas. La autenticidad procede de la trazabilidad IRSA y el hash permite comprobar identidad respecto de los archivos registrados; no equivale a un CHECKSUM FITS oficial independiente.

| OBSID | Colección | Fecha UTC | Detector | Bytes | SHA-256 |
|---|---|---|---|---:|---|
| 2025W21_1B_0582_3 | spherex_dr1 | 2025-05-22T02:03:12.109 | D1 | 4000320 | dbcbf07925b641131638c87b8a5efb7cf0f3db839f61849df180cf206799167b |
| 2026W21_1A_0480_1 | spherex_qr3 | 2026-05-21T03:27:20.505 | D1 | 4000320 | 0c7812ba2ddc90faa09a6cd60013929408f3ae44bb1a449f96382e285f51663f |

Archivos externos: `dr1_2025W21_1B_0582_3_D1_cutout_0p1deg.fits` y `qr3_2026W21_1A_0480_1_D1_cutout_0p1deg_complete.fits`. El QR3 incompleto no está en la lista y no se utiliza. Productos originales de IRSA: [DR1](https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W21_1B/l2b-v27-2026-199/1/level2_2025W21_1B_0582_3D1_spx_l2b-v27-2026-199.fits) y [QR3](https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/level2/2026W21_1A/l2b-v27-2026-268/1/level2_2026W21_1A_0480_1D1_spx_l2b-v27-2026-268.fits). Las URL apuntan a imágenes completas, no a los recortes con los hashes de esta tabla.

Astropy leyó los siete HDU de ambos archivos sin advertencias de truncamiento: PRIMARY, IMAGE, FLAGS, VARIANCE, ZODI, EPSF y WCS-WAVE. IMAGE es 59×58 float32, con 3422/3422 píxeles finitos, BUNIT `MJy / sr` y WCS ICRS RA/DEC TAN-SIP; FINAST=0 y L2DQAFLG=Pass. FLAGS es int32, 59×58, con 16 y 17 valores distintos respectivamente. VARIANCE es float32, 59×58, finita y sin valores negativos, BUNIT `MJy2 / sr2`. La presencia de FLAGS o VARIANCE no demuestra calidad científica ni propagación de incertidumbre. [Suplemento oficial SPHEREx](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf) documenta los bits; no se aplica ninguna selección de bits en esta demo. WCS-WAVE es aproximado para visualización; las calibraciones CWAVE/CBAND y la respuesta local no se han aplicado. [Productos de datos IRSA](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/).

## Inicio

1. Instalar las dependencias de `backend/requirements-dev.txt` en un entorno virtual local y las del frontend con `npm ci`, siguiendo el README del proyecto.
2. Configurar `SPHEREX_REAL_DATA_DIR` en el directorio que contiene los dos archivos con los nombres exactos indicados. En PowerShell: `$env:SPHEREX_REAL_DATA_DIR = '<directorio-de-recortes>'`.
3. Desde `backend`, iniciar `python -m uvicorn app.main:app --reload`.
4. Desde `frontend`, iniciar `npm run dev` y abrir la dirección indicada por Vite. En Comparación, seleccionar «los dos recortes» en el panel de datos IRSA locales verificados y pulsar Comparar vía API.

`GET /api/real-data-demo` inspecciona los archivos verificados e informa extensiones y procedencia. Si falta un archivo o no coincide el hash, figura en `unavailable` y no se ofrece como verificado. Las rutas locales no se envían a la API. `/api/epochs`, `/api/preview`, `/api/compare`, `/api/comparability` y `/api/scientific-validation` usan la misma resolución del catálogo. La procedencia nueva `irsa_verified_local` significa recorte IRSA local verificado, mientras `cached_sample` mantiene el significado existente de fixture local del proyecto. Ninguna etiqueta afirma que se haya realizado una consulta IRSA en vivo.

El flujo HTTP local ejecutado con los dos archivos reales obtuvo 98.01285797779076 % de cobertura finita sobre la rejilla DR1, `/api/comparability`: `REQUIERE REVISIÓN` y `/api/scientific-validation`: `REVIEW_REQUIRED`. El endpoint heredado `/api/compare` devuelve `comparable` como resultado técnico según sus reglas; no representa una validación científica. No hay sustracción científica. Los intervalos generales D1 son 0.7455–1.1167 µm; el mismo detector y la superposición de intervalos no establecen equivalencia espectral local. Antes de conclusiones científicas son necesarios calibraciones, respuesta espectral, políticas de máscara y propagación de incertidumbre.

Pruebas de backend: `python -m pytest tests -q`: 217 aprobadas y 2 omitidas. El recorrido HTTP real se verificó con TestClient. Frontend: `pnpm run test`, 109 pruebas aprobadas; `pnpm run build`, compilación exitosa con advertencia de tamaño de bundle. Se usó pnpm incluido en el runtime e instalación local sin lockfile; conviene repetir con `npm ci` usando package-lock.json para verificar las versiones fijadas. La prueba de interfaz usa respuestas HTTP simuladas; el recorrido con FITS reales se verificó por HTTP con TestClient, no con un navegador real.
