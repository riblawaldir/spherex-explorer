# Alineación geométrica FITS

`align_fits_images()` reproyecta una HDU científica bidimensional de destino sobre la cuadrícula WCS de la HDU de referencia mediante `reproject_interp()` bilineal. Los dos selectores HDU son obligatorios; identifique las extensiones científicas con `inspect_fits()` antes de llamar a la función.

```python
from app.science.image_reprojection import align_fits_images
result = align_fits_images('referencia.fits', 'destino.fits',
                           reference_hdu='IMAGE', target_hdu='IMAGE')
print(result.shape, result.common_coverage_percent)
```

El porcentaje usa como denominador todos los píxeles de la imagen de referencia. La máscara exige cobertura positiva y valores finitos en ambas matrices. `footprint` procede de `reproject_interp`; no sustituye una máscara científica de calidad. Se devuelven las unidades originales, sin convertirlas ni compararlas. Los archivos de entrada no se modifican.

La interpolación no garantiza conservación del flujo integrado, no corrige errores astrométricos ni demuestra compatibilidad espectral, de PSF, calibración o unidades. No use el resultado para restas científicas sin validar esas condiciones, las máscaras y las incertidumbres. No se han validado recortes reales de SPHEREx.
