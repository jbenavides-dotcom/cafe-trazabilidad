# Integración sensores Tuya → Supabase

Esta carpeta contiene los dos workflows n8n que conectan el monitor multiparámetro Tuya con la app. Los workflows están **sanitizados**: las credenciales reales viven solo en la instancia de n8n Cloud, no en este repo público.

## Arquitectura

```
Sensor Tuya 9-en-1 (Wi-Fi finca)
    │
    └─► Tuya Cloud (openapi.tuyaus.com)
            │
            ├─► tuya-fermentacion-proxy.json  (webhook LIVE on-demand)
            │      └─► frontends que necesitan valor del momento
            │
            └─► tuya-supabase-cron-4h.json    (cron cada 4 horas)
                   └─► tabla public.sensor_readings en Supabase
                          └─► /pedidos-craftlab + /orders/:type/:id
```

## Variables que captura el sensor (9 nativas)

| Variable | Unidad | Código Tuya | Escala | Columna BD |
|---|---|---|---|---|
| pH | — | `ph_current` | /100 | `ph` |
| Temperatura | °C | `temp_current` | /10 | `temp_c` |
| ORP | mV | `orp_current` | /1 | `orp_mv` |
| Densidad (SG) | — | `pro_current` | /1000 | `sg` |
| TDS | ppm | `tds_current` | /1 | `tds_ppm` |
| EC | µS/cm | `ec_current` | /1 | `ec_us_cm` |
| Salinidad | ppm | `salinity_current` | /1 | `salinity_ppm` |
| CF | — | `cf_current` | /100 | `cf` |
| Humedad relativa | % | `rh_current` | /1 | `rh_pct` |

Adicionalmente se calcula Brix como aproximación desde SG: `(SG − 1) × 1000 / 4`, columna `brix` por compatibilidad con vistas anteriores.

## Setup para reproducirlo

### 1. Cuenta Tuya Cloud

1. Crear cuenta en `iot.tuya.com`.
2. Crear un *Cloud Project* (tipo *Industry* o *Smart Home*).
3. **Devices → Link Device by App Account** y vincular la cuenta Smart Life donde está dado de alta el dispositivo.
4. Habilitar la API "Industry Project Device API" en el proyecto.
5. Copiar `Access ID` y `Access Secret` (van como `__TUYA_ACCESS_ID__` y `__TUYA_ACCESS_SECRET__` en los workflows).
6. Anotar el `Device ID` del monitor desde la consola Tuya (va como `__TUYA_DEVICE_ID__`).

### 2. Supabase

Aplicar este SQL en el SQL Editor (asume que `tanks` y `sensor_readings` ya existen del schema base; si no, ver `supabase/migrations/`):

```sql
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS orp_mv       numeric,
  ADD COLUMN IF NOT EXISTS sg           numeric,
  ADD COLUMN IF NOT EXISTS tds_ppm      numeric,
  ADD COLUMN IF NOT EXISTS ec_us_cm     numeric,
  ADD COLUMN IF NOT EXISTS salinity_ppm numeric,
  ADD COLUMN IF NOT EXISTS cf           numeric,
  ADD COLUMN IF NOT EXISTS rh_pct       numeric;
```

Crear un registro en `tanks` para el sensor y anotar su `id` (va como `__TANK_UUID__` en el workflow cron).

### 3. n8n Cloud

1. Importar `tuya-fermentacion-proxy.json` y `tuya-supabase-cron-4h.json` desde la UI de n8n (`+ → Import workflow → From file`).
2. Abrir el Code node de cada uno y reemplazar los placeholders:
   - `__TUYA_ACCESS_ID__`
   - `__TUYA_ACCESS_SECRET__`
   - `__TUYA_DEVICE_ID__`
   - (solo cron) `__SUPABASE_URL__`, `__SUPABASE_SERVICE_OR_ANON_KEY__`, `__TANK_UUID__`
3. Activar ambos workflows.

## Cómo consumir los datos desde otro sistema

### Opción 1 — REST Supabase (histórico)

```http
GET https://<PROJECT>.supabase.co/rest/v1/sensor_readings
    ?tank_id=eq.<TANK_UUID>
    &order=recorded_at.desc
    &limit=1
Headers:
  apikey: <ANON_KEY>
  Authorization: Bearer <ANON_KEY>
```

Devuelve JSON con los 9 valores de la última fila escrita por el cron.

### Opción 2 — Webhook LIVE (on-demand, sin auth)

```http
GET https://<TU-N8N>.app.n8n.cloud/webhook/tuya-fermentacion
```

Devuelve `{ ok, device_id, fetched_at, readings: {...9 valores...} }` consultando el Tuya Cloud en el momento. Útil cuando hace falta el dato más fresco que el cron de 4h.

### Opción 3 — Supabase Realtime

Suscribirse al canal de la tabla `sensor_readings` vía supabase-js o WebSocket directo. Recibe push automático cada vez que el cron inserta una fila nueva.

## Ajustes comunes

| Necesito… | Cambiar… |
|---|---|
| Capturar cada 1h en vez de 4h | Schedule Trigger del cron: `hoursInterval = 1` |
| Calibrar pH | Constante `PH_OFFSET` en el Code node del cron |
| Agregar otro sensor (otro tanque) | Duplicar el cron, cambiar `DEVICE_ID` y `TANK_ID` |
| Generar alertas fuera de rango | Workflow nuevo: Supabase Realtime → IF → Telegram/Email |

## Notas de seguridad

- Las credenciales Tuya (`ACCESS_ID` + `ACCESS_SECRET`) **nunca** deben salir de n8n. Frontend y repos públicos jamás las tocan.
- El webhook `tuya-fermentacion` es de lectura sin auth — está bien para datos técnicos del tanque (no son confidenciales), pero si se agregan datos de pedido/cliente, agregar token en el path.
- El INSERT a Supabase usa el `anon key` con RLS abierta en modo team (`for select using (true)`); si la BD pasa a producción con datos sensibles, ajustar policies.

## Frontends que ya consumen estos datos

- `cafe-trazabilidad` → `src/lib/pedidos-craftlab.ts` función `cargarReadings(tankId, limit)`.
- `cafe-trazabilidad` → `src/pages/PedidosCraftLab.tsx` (panel operario, 9 cards + sparklines + tabla).
- `craftlab-lpet` → `src/pages/OrderDetail.tsx` componente `TankCard` (vista del partner).
- `dashboard-fermentacion` → consume el webhook LIVE directo en el frontend.
