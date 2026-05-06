# Café Trazabilidad — La Palma y el Tucán

App web para registrar y consultar el flujo de trazabilidad de café cosecha 2026:
**CFF → AF → AS → MX_V → Inventario → OfferingList → Salidas Trilla**.

Reemplaza progresivamente la edición manual de Sheets por una interfaz tipo CraftLab, sin backend propio.

## Stack

- React 19 + Vite 6 + TypeScript 5.8 + Tailwind v4 (idéntico a `craftlab-lpet`)
- Auth: **Google OAuth** via Google Identity Services (sin Supabase Auth)
- Datos: **Sheets API directo** desde el navegador con el token OAuth del usuario
- Email John (creación de nanolote): webhook n8n
- Hosting: GitHub Pages
- PWA instalable (offline básico)

## Estado

| Pantalla | Estado |
|---|---|
| Login Google | ✅ implementado |
| Dashboard (KPIs + flujo) | ✅ implementado |
| Lista de baches | ✅ implementado |
| Nuevo bache (CFF Sec 1) | ✅ implementado |
| Análisis Físico (Sergio) | ⏸ pendiente |
| Análisis Sensorial (Ismelda) | ⏸ pendiente |
| Asignación nanolote (MX_V) | ⏸ pendiente |
| Inventario General | ⏸ pendiente |
| Ventas (OfferingList) | ⏸ pendiente |
| Seguimiento histórico | ⏸ pendiente |

## Setup local

```bash
npm install
cp .env.example .env
# Editar .env con tu VITE_GOOGLE_CLIENT_ID
npm run dev
```

## Configurar OAuth Google (una sola vez)

1. Ir a https://console.cloud.google.com/
2. Crear proyecto **lp-et-cafe-trazabilidad** (o usar uno existente de LP&ET)
3. APIs & Services → **Enable APIs**: habilitar **Google Sheets API** y **Drive API**
4. Credentials → **Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `cafe-trazabilidad-web`
   - **Authorized JavaScript origins:**
     - `http://localhost:5173` (dev)
     - `https://jbenavides-dotcom.github.io` (producción)
   - **Authorized redirect URIs:** dejar vacío (usamos implicit flow)
5. Copiar el **Client ID** generado
6. Pegar en `.env` como `VITE_GOOGLE_CLIENT_ID`
7. OAuth consent screen → **Test users**: agregar emails de Sergio, Ismelda, John, Felipe, Katherine

## Permisos requeridos en los Sheets

Cada usuario debe tener acceso al menos de **lectura** a:
- `2026 INVENTARIO Y ANALISIS GENERAL` (`1Mlkkg919m...`)
- `OfferingList-Proyectos` (`1BI2yvuvuWL37f7rvDayGHAzH_oZM9OKsmisnYtjF6bA`)
- `SEGUIMIENTO INVENTARIOS INTERNOS LP&T.xlsx` (`1yEFl6WkHBdsGNuJ36uqtyS9sF-uaD3DK`)

Y permiso de **edición** según su rol:
- **Sergio (Calidad):** edita CFF, AF
- **Ismelda (Catación):** edita AS
- **John (Combinación):** edita MX_V col A (verde), CFF S3
- **Comercial:** edita OfferingList

## Deploy a GitHub Pages

```bash
npm run build
# Copiar dist/ a gh-pages branch o usar gh-pages package
```

## Estructura

```
src/
├── lib/
│   ├── auth.ts          # Google OAuth (GIS)
│   ├── sheets.ts        # Cliente Sheets API
│   └── trazabilidad.ts  # Tipos del dominio + utils
├── components/
│   └── AppShell.tsx     # Header + nav + main
├── pages/
│   ├── Login.tsx        # Login Google
│   ├── Dashboard.tsx    # KPIs y flujo
│   ├── ListaBaches.tsx  # Tabla de baches con filtros
│   └── NuevoBache.tsx   # Form CFF Sección 1
├── App.tsx
├── main.tsx
└── index.css            # Paleta CraftLab
```

## Reglas operativas (importantes)

- **NO escribir en celdas con fórmula** — están protegidas (ver `memory/project_cafe-trazabilidad-flujo-refinado-6may.md`)
- En **MX_V**: solo escribir col B (Batch). Col A (verde) la llena el catador. Cols C-W son fórmulas.
- En **AF**: solo escribir col A. Cols C-D son fórmulas VLOOKUP.
- En **AS**: solo escribir col B. Cols C-D son fórmulas VLOOKUP.
- En **OfferingList**: las cols I, L, M son fórmulas (Disponibilidad, Kg Disp, Cajas).

## Sin dependencia de servidor propio

Todo corre en el navegador. El backend lo provee Google Sheets API.
n8n se usa **solo** para enviar email a John cuando se crea un nanolote.

---

🤖 Generado con asistencia de Claude · 2026-05-06
