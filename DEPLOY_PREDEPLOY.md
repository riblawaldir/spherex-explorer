# Preparación de predeploy — SPHEREx Explorer

La rama es local y experimental. No se han creado servicios ni desplegado a Internet. Partió de `11e420a614526a2ed5465823fc9cb8b5aee68267`; los cuatro commits P5 fueron incorporados con resolución de conflictos y pruebas locales. Revisar el SHA final y CI después de publicar una rama autorizada.

## Backend Render

El archivo `render.yaml` propone Python 3.12, instalación desde `backend/requirements.txt`, arranque con `uvicorn app.main:app --host 0.0.0.0 --port $PORT` y `/health`. Consultar y ajustar límites y disponibilidad de la cuenta antes de crear el servicio. `SPHEREX_USE_IRSA=0` mantiene el modo sin consultas remotas; no afirmar que los datos de prueba son consultas IRSA vivas.

No configurar en la nube el manifiesto que apunta a Downloads de Windows. Para FITS reales se necesitan copias autorizadas en almacenamiento accesible, límites de tamaño y verificación de procedencia; hasta entonces usar únicamente fixtures etiquetados. No aceptar rutas arbitrarias ni incluir secretos en la configuración versionada.

## Frontend Vercel

Crear el proyecto con raíz `frontend`, instalar con `npm ci`, compilar con `npm run build` y servir `dist`. Una vez conocido el origen HTTPS de Render, desde la raíz del repositorio ejecutar:

```powershell
$env:RENDER_BACKEND_ORIGIN='https://ORIGEN-REAL-DE-RENDER'
node scripts/configure-vercel.cjs
```

El generador requiere una URL HTTPS real, sin credenciales ni ruta, y crea `frontend/vercel.json` con rewrites de `/api`, `/health` y fallback de SPA, sin sobrescribir un archivo existente. El archivo generado está ignorado por Git: revisar su destino e incorporarlo al despliegue mediante el flujo autorizado antes de publicar. El proxy `VITE_API_PROXY` se aplica solo al servidor de desarrollo Vite, no a Vercel.

Con rewrites del mismo origen no se requiere abrir CORS a todos los orígenes. Para acceso directo entre dominios, configurar en FastAPI el origen exacto de Vercel y probarlo; el CORS actual está limitado a localhost.

## Comprobaciones previas

1. Resolver revisión e integración de los commits P5 y validar la versión final en CI; no tratar esta rama aislada como main.
2. Después de crear el backend, comprobar `/health`, `/api/epochs`, `/api/compare`, respuestas de error y previews mediante el dominio Vercel. Comprobar recarga de `/comparacion`.
3. Probar fallo o lentitud de IRSA y de Aladin, estado vacío y etiquetas de procedencia. La demo puede funcionar con fixtures identificados; la disponibilidad real de IRSA no está certificada.
4. Comprobar límites de alojamiento, licencias, arranque en frío, logs sin información privada y URLs públicas antes de aprobar el despliegue.
5. La alineación geométrica no implica equivalencia fotométrica ni detección de variabilidad; mantener la categoría B y advertencias donde corresponda.
