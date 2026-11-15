# Sprint 3: evaluación de imágenes comparables

`POST /api/comparability` evalúa dos productos conocidos por el catálogo que ya tienen FITS disponibles localmente. Es una ayuda para seleccionar candidatos, no una certificación científica ni una operación de sustracción. Las imágenes originales se leen sin modificarlas.

## Criterios y estados

- **Espacial:** se selecciona la extensión única `IMAGE`, se valida su WCS celeste y se reproyecta la segunda imagen sobre la rejilla de la primera. `geometric_coverage_percent` mide la huella geométrica; `finite_coverage_percent` cuenta los píxeles de la rejilla de referencia que tienen datos finitos en ambas imágenes y huella positiva. `coverage_percent` es un alias de la cobertura finita. El denominador es el total de píxeles de la primera imagen, así que invertir el orden puede cambiar el porcentaje. El código rechaza un par sin píxeles comunes válidos. La API no fija un porcentaje mínimo científico; la función Python permite configurar uno.
- **Temporal:** se usa `t_min_mjd` y se informa la diferencia absoluta en días. La diferencia entre tiempos se informa sin redondeo. `different_epoch` permanece desconocido mientras no exista una política científica explícita. El organizador forma pares candidatos de productos distintos dentro de los grupos correspondientes. Dos productos pueden compartir MJD, por lo que la diferencia temporal puede ser cero. Un par candidato no certifica comparabilidad científica ni épocas científicamente distintas.
- **Espectral:** los intervalos `em_min_m` y `em_max_m` del catálogo pueden descartar rangos sin solapamiento. El solapamiento de rangos generales y el detector común no prueban que la misma región del cielo se haya observado a la misma longitud de onda local. Se informa la presencia de `WCS-WAVE`, sin usarla para confirmar equivalencia científica. Esa tabla ofrece una representación aproximada para visualización; IRSA recomienda las capas de calibración `CWAVE` y `CBAND` para análisis científico. Es necesario incorporar esas capas y acordar cómo comparar la respuesta espectral local antes de poder confirmarla. [Documentación de productos de IRSA](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products/).
- **Colección:** se reutilizan las reglas del módulo de observaciones para DR1/QR3, sus variantes deep y las advertencias sobre QR1/QR2 o mezcla wide/deep. Una colección no reconocida queda sin confirmar. Las reglas indican compatibilidad de colección, no garantizan compatibilidad científica del par.
- **Calidad:** se informan píxeles comunes finitos, presencia de `FLAGS`, estadísticas y unidades de `VARIANCE`, y compatibilidad de unidades de imagen. No se aplica ninguna máscara de bits ni se propaga la varianza. Por ello `science_quality_evaluated` es `false`; la cobertura y los diagnósticos no garantizan calidad científica.

`NO COMPARABLE` indica que se incumplió un criterio implementado, por ejemplo ausencia de cobertura válida o intervalos espectrales sin solapamiento. `REQUIERE REVISIÓN` indica información o políticas pendientes. `COMPARABLE` está reservado para cuando todos los criterios estén verificados. **La implementación actual no puede producir `COMPARABLE`**, porque no confirma la equivalencia espectral local ni evalúa una política científica de FLAGS. Para habilitarlo se necesitan calibraciones apropiadas, criterios espectrales, una política de calidad y un umbral de cobertura aprobados por el equipo, junto con su implementación y validación.

## API

La petición admite únicamente dos identificadores, de 1 a 128 caracteres alfanuméricos, guion o guion bajo:

```http
POST /api/comparability
Content-Type: application/json

{"observation_1": "obs-1", "observation_2": "obs-2"}
```

Ejemplo ilustrativo de la estructura principal de una respuesta `200` (se omiten campos de metadatos y advertencias para abreviar):

```json
{
  "observations": [{"id": "obs-1"}, {"id": "obs-2"}],
  "status": "REQUIERE REVISIÓN",
  "spatial": {"wcs_valid": [true, true], "coverage_percent": 90.0, "geometric_coverage_percent": 95.0, "finite_coverage_percent": 90.0},
  "temporal": {"different_epoch": true, "delta_days": 365.0},
  "collection": {"compatible": true},
  "spectral": {"compatible": null, "reason": "Catalog intervals overlap, but local LVF wavelengths on the common sky are not established.", "wcs_wave_present": [true, true]},
  "quality": {"science_quality_evaluated": false},
  "warnings": ["No minimum spatial coverage threshold has been specified."]
}
```

Los valores del ejemplo son ilustrativos. La respuesta completa incluye otros metadatos y estadísticas de calidad, y no devuelve rutas locales ni URL de acceso. Un par sin cobertura válida responde `200` con `NO COMPARABLE` y una advertencia. La API responde `404` si el ID no está en el catálogo del proceso o falta su FITS, `409` si el ID tiene varios productos conocidos y `422` si la petición, el FITS o su WCS son inválidos. Los errores usan el formato `detail` de FastAPI. Un fallo en la evaluación posterior a la validación puede aparecer como advertencia de evaluación en la respuesta; no debe confundirse con evidencia científica.

## Catálogo y disponibilidad

El endpoint consulta el servicio de catálogo existente y resuelve el FITS mediante `resolve_preview_fits`, limitado a las ubicaciones internas permitidas. No recibe rutas del cliente ni descarga automáticamente. Las muestras del catálogo de fixtures se pueden resolver desde su archivo de metadatos; los registros IRSA se conservan en memoria cuando una consulta de épocas los descubre. Una consulta de búsqueda de objetivos por sí sola no garantiza que el registro se haya guardado para este endpoint.

La memoria es propia del proceso: se pierde al reiniciar y no se comparte entre trabajadores. Si IRSA contiene un ID que aún no se descubrió en ese proceso, la respuesta puede ser `404` aunque exista en IRSA. Cuando varios productos comparten un ID, se devuelve `409`: el contrato actual no permite elegir detector. Una extensión futura podría resolver la identidad de producto con colección y detector mediante el cliente IRSA existente y definir un almacenamiento compartido o una estrategia de consulta; no se implementa aquí.

El organizador conserva los nombres de respuesta existentes para compatibilidad: `comparable_pairs` contiene **candidatos**, no certificaciones científicas. Para evitar crecimiento cuadrático sin límite, devuelve como máximo 10.000 pares por defecto; el llamador Python puede configurar `max_pairs`. Las estadísticas `candidate_pairs_total` y `candidate_pairs_truncated` indican cuántos candidatos había y si la lista quedó truncada. Este límite es técnico y no establece un criterio temporal científico.

La identidad de producto se establece por colección y URL de acceso; si no existe URL, se utiliza colección, OBSID y detector cuando todos están disponibles. Los registros sin identidad suficiente se conservan por separado y generan advertencia. Los pares de productos distintos pueden compartir MJD; esto no certifica épocas científicamente distintas. Las estadísticas cuentan los pares candidatos antes del límite, no solo timestamps.

El descargador comprueba la estructura declarada de los HDU, sus límites dentro del archivo y los checksums FITS presentes, sin afirmar autenticidad ni corrección científica. El mapeo evita cargar imágenes normales completas: no verifica los valores de heaps de tablas variables ni descomprime completamente imágenes comprimidas. Un HDU final ausente por completo no puede detectarse sin conocer el contrato del producto. Fallos secundarios al cerrar la respuesta o eliminar el temporal se registran; si el sistema impide eliminarlo, el temporal puede permanecer para revisión.
