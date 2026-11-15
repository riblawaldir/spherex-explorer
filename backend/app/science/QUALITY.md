# Diagnóstico de calidad de imágenes alineadas

`assess_aligned_quality()` reutiliza `align_fits_images()`. Informa cobertura geométrica (reproyección de una matriz de unos), cobertura con intensidades finitas y, solo cuando puede evaluarse, porcentaje de píxeles aceptados por FLAGS. Cada porcentaje usa todos los píxeles de la cuadrícula de referencia como denominador.

La evaluación de FLAGS requiere ambas extensiones `FLAGS`, una máscara explícita `reject_bits` y `flags_share_image_grid=True` tras confirmar que cada FLAGS está registrada en la misma cuadrícula que su IMAGE. Los bits no se deducen ni se afirman como definiciones de SPHEREx. Si falta cualquiera de esas condiciones, `science_quality_evaluated=False`, `quality_mask=None` y el porcentaje aceptado es desconocido, no 100%.

El destino se muestrea por vecino más próximo como máscara binaria, nunca como intensidad. Es una aproximación diagnóstica no conservadora: el píxel más cercano no representa necesariamente todos los píxeles que contribuyen a la interpolación bilineal de la imagen. No usar esta máscara como certificación de calidad para restas científicas.

Se registran unidades IMAGE, equivalencia dimensional si Astropy puede interpretarlas y metadatos VARIANCE (presencia, forma, unidad y conteos de valores finitos y no negativos). Equivalencia dimensional no equivale a igualdad de calibración ni convierte unidades. La varianza no se reproyecta ni se propaga; la interpolación introduce correlaciones y se requiere un modelo de incertidumbre específico. Sin prueba con datos reales, las extensiones y la semántica de SPHEREx aún deben verificarse con el integrante 4.
