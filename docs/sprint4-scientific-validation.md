# Sprint 4: validación científica de pares

## Auditoría de Sprint 3

| Área | Existía | Falta | Evidencia disponible |
|---|---|---|---|
| Espacial | Validación WCS y reproyección en rejilla de referencia | Política de cobertura útil, resolución y huella cuando no hay píxeles finitos | WCS, huella muestreada y porcentajes |
| Espectral | Intervalos de catálogo y detección de WCS-WAVE | Calibración local y respuestas espectrales | Límites generales y presencia de tabla aproximada |
| Temporal | MJD y diferencia, que puede ser cero; candidatos de productos distintos dentro de los grupos correspondientes | Criterio contextual, control de consistencia temporal | Fechas del catálogo |
| Calidad | Conteos finitos y presencia de extensiones | Política de aceptación y diagnóstico científico | IMAGE, FLAGS y VARIANCE |
| Calibración | Identificación de colecciones | Evidencia de procesamiento y calibraciones aplicables | Etiqueta de colección |
| Incertidumbre | Inspección VARIANCE | Propagación y covarianza de remuestreo | Unidades y estadísticas de varianza |
| Máscaras | Diagnóstico opcional con bits explícitos | Política documentada y propagación conservadora | Presencia de FLAGS |

Se reutilizan `inspect_fits`, `select_image_hdu`, `validate_fits_wcs`, `align_fits_images` y `assess_aligned_quality` mediante la evaluación de Sprint 3. No se implementa sustracción. Las fracciones se calculan sobre la rejilla de la primera imagen y no representan automáticamente un área exacta de intersección sobre la esfera.

## Alcance

Sprint 3 selecciona candidatos técnicos; Sprint 4 reúne la evidencia disponible para revisión científica. `scientific_validation.py` transforma el resultado de Sprint 3 en ocho criterios explicados: espacial, espectral, temporal, colección, calidad, calibración, incertidumbre y máscaras. Cada uno informa observación, condición, evidencia, razón y límites.

Los ocho criterios son obligatorios para certificar este flujo: espacial, espectral, temporal, colección, calidad, calibración, incertidumbre y máscaras. El integrador exige nombres conocidos, únicos y campos estructurados completos. Un criterio inválido bien formado produce `INVALID`; `VALID` requiere exactamente los ocho criterios, todos válidos. Una lista vacía, criterios duplicados, desconocidos, mal formados o ausentes sin un rechazo válido producen `REVIEW_REQUIRED`. Actualmente el flujo real no puede emitir `VALID`: faltan calibración local, política de máscaras, propagación de incertidumbre, criterio temporal y cobertura para el objetivo. La prueba de agregación totalmente válida usa estados sintéticos para verificar la regla, no demuestra un par científicamente válido.

La ausencia de huella calculada se marca como revisión: puede deberse a píxeles no finitos, no necesariamente a ausencia de intersección geométrica. Dos rangos generales de catálogo numéricos, finitos, positivos y ordenados sin solapamiento se marcan inválidos. Ese `INVALID` descarta el par por falta de solapamiento entre los rangos generales del catálogo; no constituye una evaluación completa de las respuestas espectrales locales. El solapamiento de esos rangos tampoco confirma compatibilidad local. Una diferencia temporal por sí sola no demuestra adecuación al propósito. La calidad y la calibración nunca se infieren de la legibilidad FITS. La API de Sprint 3 sigue intacta.

## API

`POST /api/scientific-validation` recibe únicamente `{"observation_1":"id1","observation_2":"id2"}`. Utiliza la resolución, comprobaciones de entrada y errores de `POST /api/comparability`: `404` para ID o FITS no disponible, `409` para ID ambiguo y `422` para petición, FITS o WCS inválidos. No se aceptan rutas. Ejemplo esquemático de respuesta `200`:

```json
{"status":"REVIEW_REQUIRED", "observation_ids":["id1","id2"], "criteria":[{"name":"spectral","status":"REVIEW_REQUIRED","observed":null,"expected":"Compatible local spectral responses supported by calibration data.","evidence":"IRSA catalog ranges and FITS WCS-WAVE presence.","reason":"Local response is not established.","limitations":["CWAVE and CBAND not assessed."],"source":"IRSA SIA2 ObservationRecord em_min_m/em_max_m; FITS WCS-WAVE presence"}], "limitations":["Scientific validation requires a defined objective and corroborating calibration and quality evidence."]}
```

El ejemplo omite los otros siete criterios. El catálogo IRSA descubierto vive en la memoria del proceso y se pierde al reiniciar; ver `sprint3-comparability.md`.

## Fuentes oficiales

- [SPHEREx Data Products, IRSA](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/): WCS-WAVE aproxima longitud de onda central y ancho de banda; para ciencia recomienda las imágenes de calibración CWAVE y CBAND.
- [SPHEREx Spectral Calibrations, IRSA](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/spherex_spectral_calibrations.html): productos de respuesta espectral, mapas y parámetros derivados del laboratorio.
- [SPHEREx Explanatory Supplement, SSDC-DP-017](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf): estructura de imágenes, varianza y definiciones de bits de FLAGS. La presencia de una bandera no es por sí sola una política de rechazo.

## Pendiente

Vincular las calibraciones adecuadas a la versión y detector de cada producto, interpretar CWAVE/CBAND en el sistema de coordenadas del detector, comparar las respuestas locales con tolerancias aprobadas, establecer criterios temporales y espaciales por objetivo, evaluar resolución/PSF, aplicar máscaras documentadas y propagar incertidumbre. Faltan pruebas que demuestren un par real plenamente validado y una prueba de intersección geométrica independiente de píxeles finitos. No se presupone que la disponibilidad de archivos de calibración sea suficiente sin comprobar su asociación y contenido.

## Pruebas

Ejecutar `python -m pytest tests -q` desde `backend`. Las pruebas de la nueva capa usan datos sintéticos y no descargan datos de IRSA. Los resultados concretos de cada ejecución se registran en el informe de entrega.

Primera iteración: `python -m pytest tests -q` desde `backend`: **172 aprobadas, 2 omitidas**, con 6 advertencias. La selección focalizada de validación científica y regresión de Sprint 3 terminó con **24 aprobadas**. TestClient se ejecutó fuera del sandbox por la restricción de sockets locales de Windows.

La fuente de cada criterio identifica los campos del registro IRSA o las extensiones FITS y funciones de Sprint 3 que aportan los datos. El campo `evidence` describe qué se observó o utilizó; no acredita por sí mismo calibración científica. El porcentaje geométrico es una huella muestreada en la rejilla de referencia, disponible solo si la alineación con píxeles finitos pudo completarse; no es un área esférica exacta. Si no hay píxeles finitos comunes o falla la reproyección, no se puede inferir que las huellas geométricas no se solapen.

Segunda iteración: las pruebas focalizadas de Sprint 3 y 4 finalizaron con **27 aprobadas**; la suite completa finalizó con **175 aprobadas y 2 omitidas** (6 advertencias).

Revisión final de casos límite: Sprint 4 finalizó con **46 aprobadas**; la regresión focalizada de Sprint 3, con **19 aprobadas**; y la suite completa, con **213 aprobadas y 2 omitidas** (6 advertencias).
