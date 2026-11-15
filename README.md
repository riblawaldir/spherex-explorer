# SPHEREx Explorer

Base inicial del proyecto para NASA Space Apps Challenge: React + TypeScript y FastAPI. Todavía no incluye consultas científicas ni datos reales.

## Desarrollo local

Frontend (Node.js 22 o superior):

```sh
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` and `/health` to `http://127.0.0.1:8000` by default. If the API listens elsewhere (for example port 8001), set `VITE_API_PROXY` before `npm run dev`:

```sh
# PowerShell
$env:VITE_API_PROXY = 'http://127.0.0.1:8001'
npm run dev
```

Backend (Python 3.12 recomendado):

```sh
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
python -m pytest
```

La API ofrece `GET /health` y documentación en `/docs`. CORS permite los orígenes locales de Vite en el puerto 5173.

## Contrato de observación

Los tipos se encuentran en `frontend/src/types/observation.ts` y `backend/app/schemas/observation.py`. `observed_at` es una fecha ISO 8601; `ra` y `dec` son grados. Las dos URL pueden ser `null`. No se incluyen muestras científicas.

## Ramas

- `feat/temporal-viewer`: visor y comparación temporal.
- `feat/frontend-ui`: interfaz, búsqueda y paneles.
- `feat/backend-api`: API REST.
- `feat/spherex-data`: consultas IRSA/SPHEREx.
- `feat/image-processing`: procesamiento FITS.

Trabajen en ramas propias y propongan cambios a `main` mediante pull requests. No suban credenciales ni archivos FITS grandes.
