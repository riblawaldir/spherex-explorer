# Preparación de la demostración

Base congelada de main: `a62c898b70de0b8ce9cc34665dfbec866364b105`.
El PR 32 ya incorpora el contraste visual, el visor FITS y la capa WCS;
los PR 21, 33 y 34 aportan la vista 3D y mensajes científicos. No se aplicaron
los commits divergentes de predeploy: incluyen versiones anteriores de módulos
que main ya actualizó. Predeploy quedó limpio y su trabajo sigue en su rama.

El servicio de Render queda fijado a `deploy/jurados-20261115`, plan `free`
y sin auto-deploy: un push a `main` no lo actualiza.

Render se construye desde la raíz del repositorio porque el backend necesita
`data/metadata` y las muestras sintéticas de `data/samples`. `SPHEREX_USE_IRSA=0`
deshabilita las consultas IRSA en vivo. Los FITS reales locales no están en el
despliegue: los datos de ejemplo deben mantenerse identificados como sintéticos.

Cuando exista una URL HTTPS real de Render, ejecutar desde la raíz:
`$env:RENDER_BACKEND_ORIGIN='https://DOMINIO-REAL'; node scripts/configure-vercel.cjs`.
Revisar y publicar `frontend/vercel.json` en esta rama; no contiene secretos.
El proxy de Vite es solo para desarrollo. En Vercel usar raíz `frontend`,
`npm ci`, `npm run build` y salida `dist`.
