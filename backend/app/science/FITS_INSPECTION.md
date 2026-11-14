# Inspección de FITS para procesamiento de imágenes

El inspector solo lee el archivo original. Devuelve información por HDU en orden NumPy (filas, columnas), BUNIT y metadatos presentes. Calcula píxeles finitos por bloques; `wcs_status="celestial"` solo indica que Astropy identificó ejes celestes, no que la transformación esté validada.

Para un recorte real proporcionado por el integrante 4, ejecuta desde `backend` con las dependencias instaladas:

```python
from pathlib import Path
from app.science.fits_inspection import inspect_fits, select_image_hdu
from app.science.image_alignment import validate_fits_wcs
from app.science.image_processing import fits_to_png

source = Path('/ruta/al/recorte.fits')  # archivo real existente
info = inspect_fits(source)
for hdu in info.hdus:
    print(hdu)
index = select_image_hdu(info)  # solo un IMAGE 2D numérico, no selecciona FLAGS/VARIANCE
print(validate_fits_wcs(source, hdu=index))
preview = fits_to_png(source, hdu=index)
Path('/ruta/de/salida/vista.png').write_bytes(preview.png)
```

Si IMAGE no existe, es ambiguo o no es una matriz 2D válida, el selector da un error. La persona responsable debe identificar la extensión científica adecuada a partir de la documentación del producto antes de pasar explícitamente su índice a las funciones; no se asume que PRIMARY, FLAGS, VARIANCE o WCS-WAVE contengan intensidades. El PNG es únicamente visual y no debe usarse para mediciones científicas. No se garantiza compatibilidad con productos reales hasta probar uno y revisar unidades, máscaras, calibración, WCS y procedencia.
