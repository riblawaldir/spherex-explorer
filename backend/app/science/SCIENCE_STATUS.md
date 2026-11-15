# Estado científico de un par

`assess_pair` reutiliza la inspección, la alineación WCS y el diagnóstico de
calidad ya validados. No resta imágenes y no ajusta una ePSF.

El resultado separa:

- alineación geométrica y cobertura;
- compatibilidad dimensional de unidades;
- presencia de FLAGS y de VARIANCE, sin evaluar una máscara de bits;
- comparabilidad espectral, que queda en `not_certified`;
- ausencia de una resta validada;
- variabilidad no evaluada.

`photometric_equivalence` es siempre falso. La respuesta no incluye
`variable_detected`. La categoría solo sale del manifiesto del operador y
solo puede ser `A`, `B` o `not_classified`. Una cobertura alta no asciende
la categoría.

## FITS local

`SPHEREX_P5_LOCAL_MANIFEST` apunta a un JSON fuera del repositorio. Cada
observación necesita ruta absoluta, SHA-256 y procedencia `local_real_fits`.
Una ruta enviada por el navegador no se lee. Si el hash no coincide, el
archivo no se sirve. Un FITS local no se etiqueta `live`.
