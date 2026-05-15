# Composta Lirio

App de monitoreo y diagnóstico de compostaje de lirio acuático para la
comunidad de San Francisco Bojay (Hidalgo). Captura mediciones de
temperatura, pH y humedad, analiza fotos con IA, guarda historial
agrupado por **sitio → compostera → ciclo** y da diagnóstico integral
con un agente conversacional. Incluye además una **bitácora** libre
por sitio (incidencias, clima, fauna) con hasta 10 fotos por entrada.

## Stack

- **Next.js 14** (App Router) + React 18 + TypeScript.
- **Tailwind CSS** para estilos.
- **Neon Postgres** (serverless) como base de datos.
- **Vercel Blob** para almacenar fotos.
- **DeepSeek** para chat y diagnóstico textual.
- **OpenAI** (endpoint `/v1/responses`) para análisis de imagen.
- **Middleware** con PIN simple como acceso.

## Arquitectura

```
app/
  layout.tsx               Envuelve el árbol con <Providers> (SitioProvider)
  providers.tsx            Monta el contexto global de sitio
  page.tsx                 Captura de medición + chat + diagnóstico
  bitacora/page.tsx        Cuaderno de campo por sitio (fecha, hora, observaciones, fotos)
  historial/page.tsx       Listado, edición y CSV (filtros sitio/compostera/ciclo)
  consultas/page.tsx       Historial de preguntas
  configuracion/           Composteras, sitios, ciclos, formulaciones
    page.tsx               Panel del sitio activo: crear/borrar/editar composteras
    sitios/                CRUD de sitios
    composteras/[id]/      Detalle y formulaciones (legacy) de una compostera
    composteras/[id]/ciclos/  Listado e inicio de ciclos de la compostera
    ciclos/[id]/           Detalle y cierre/descarte de un ciclo
  login/                   Pantalla de PIN
  api/
    mediciones/            CRUD (+ export CSV, filtros ciclo/compostera/sitio)
    composteras/           Bulk upsert del panel
    composteras/[id]/      DELETE (si no hay historia) y PATCH estado
    composteras/[id]/ciclos  Ciclos de una compostera
    ciclos/[id]/           Detalle, edición, cerrar, descartar
    ciclos/[id]/mediciones  Listado y export CSV por ciclo
    sitios/                CRUD de sitios
    sitios/[id]/composteras  Listar (opcional ?counts=1) y crear compostera
    formulaciones/         CRUD de formulaciones
    consultas/             Log de preguntas
    analizar/              Análisis de foto (IA de visión)
    chat/                  Conversación con el agente
    diagnostico/           Diagnóstico histórico (por ciclo o compostera)
    bitacoras/             POST de bitácora por sitio (fotos en columna JSONB)
    upload/                Subida de foto al Blob
    auth/                  Login/logout (PIN)

lib/
  db.ts                    Acceso a Neon (SQL, ensureSchemaV2 + legacy ensureTable)
  ciclos.ts                Helper central resolverCiclo (coherencia ciclo↔compostera)
  sitio-context.tsx        SitioProvider/useSitio — selector de sitio compartido,
                           persistido en localStorage (composta.sitio_id)
  analisis.ts              Tipos, parse y reglas del análisis visual
  analizar.ts              Cliente: fetch a /api/analizar
  openai-vision.ts         Helper fino de la API de visión de OpenAI
  estado.ts                Reglas de estado (good/warning/danger)
  humedad.ts               Niveles y etiquetas DRY/WET
  fechas.ts                hoyISO, diasDesde
  foto.ts                  compressImage, uploadFoto (cliente)
  types.ts                 Tipos compartidos de dominio (Sitio, Ciclo, Medicion…)
  validaciones.ts          Validación de body (medicion, ciclo, sitio, compostera)
  prompt.ts                Prompt de chat/diagnóstico
  diagnostico.ts           buildResumenHistoricoPorCiclo (v2) + legacy por compostera
  patrones.ts              Reglas/patrones del diagnóstico

components/
  ui/icons.tsx             SVGs compartidos
  ui/FotoModal.tsx         Modal de foto con Escape + scroll lock
  ui/AnalisisBadge.tsx     Badge verde/amarillo/rojo del análisis

hooks/
  usePhotoUpload.ts        Selección, preview y subida de foto (1 archivo)
  useMultiPhotoUpload.ts   Selección y subida en serie de hasta N fotos (bitácora)
  useImageAnalysis.ts      Estado del análisis IA
  useFotoModal.ts          Estado del modal de foto
  useComposteras.ts        Fetch de composteras (opcionalmente filtrado por sitio)
  useSitios.ts             Fetch de sitios activos
  useCiclos.ts             Fetch de ciclos de una compostera + ciclo activo

scripts/
  migrations/              SQL idempotente aplicado manualmente a Neon
                           + plan de Fase 3 (endurecimiento BD, retiro legacy)

middleware.ts              Gate por PIN con cookie access_pin
```

## Endpoints principales

### Mediciones y export

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/mediciones` | Crear medición (infiere `ciclo_id` desde el ciclo activo de la compostera si no se pasa) |
| `GET`  | `/api/mediciones?ciclo_id=N` / `?compostera=N` / `?sitio_id=N` | Listar últimas 100 (prioridad ciclo > compostera > sitio) |
| `PUT`  | `/api/mediciones` | Actualizar medición (body incluye `id`; `ciclo_id` opcional para reasignar) |
| `DELETE` | `/api/mediciones?id=N` | Borrar medición (y su foto en Blob) |
| `GET`  | `/api/mediciones/export` | CSV (acepta los mismos filtros que GET) |

### Jerarquía

| Método | Ruta | Descripción |
|---|---|---|
| `GET/POST` | `/api/sitios` | Listar / crear sitios |
| `GET/PUT/DELETE` | `/api/sitios/[id]` | Detalle / actualizar / desactivar (soft) |
| `GET` | `/api/sitios/[id]/composteras` | Composteras de un sitio (opcional `?counts=1` con ciclos/mediciones) |
| `POST` | `/api/sitios/[id]/composteras` | Crear una compostera dentro del sitio |
| `GET/POST` | `/api/composteras` | Bulk upsert del panel |
| `PATCH` | `/api/composteras/[id]` | Cambiar `estado` (activa\|inactiva\|retirada) |
| `DELETE` | `/api/composteras/[id]` | Borrar compostera (409 si ya tiene ciclos; solo se puede retirar) |
| `GET/POST` | `/api/composteras/[id]/ciclos` | Listar historial / crear ciclo (409 si ya hay uno activo) |
| `GET/PUT/POST` | `/api/ciclos/[id]` | Detalle / editar / `?action=cerrar\|descartar` |
| `GET` | `/api/ciclos/[id]/mediciones` | Mediciones del ciclo |
| `GET` | `/api/ciclos/[id]/mediciones/export` | CSV de mediciones del ciclo |
| `GET/DELETE` | `/api/consultas` | Log de preguntas |

### IA, foto y auth

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/analizar` | FormData con `imagen` — análisis visual |
| `POST` | `/api/chat` | Mensajes del agente (DeepSeek). Acepta `ciclo_id` o `compostera`; historial acotado al ciclo activo |
| `POST` | `/api/diagnostico` | Diagnóstico histórico. Acepta `ciclo_id` o `compostera`; prefiere ciclo |
| `POST` | `/api/upload` | FormData con `foto` — sube a Vercel Blob |
| `POST` | `/api/auth` / `/api/auth/logout` | Login / logout con PIN |

### Bitácora

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/bitacoras` | Crear entrada de bitácora (`sitio_id`, `fecha`, `hora`, `observaciones`, `fotos[]`). Hasta 10 fotos por entrada, guardadas como JSONB de URLs de Blob |

## Variables de entorno

Ver `.env.example`. Todas son requeridas en producción excepto `ACCESS_PIN`
(si no está definida, la app queda abierta — solo para desarrollo local).

## Correr local

```bash
npm install
cp .env.example .env.local       # completa los valores reales
npm run dev                      # http://localhost:3000
```

Si solo vas a tocar UI y no tienes Neon a mano, puedes dejar `DATABASE_URL`
vacío: los endpoints fallarán con 500 pero el render cliente seguirá vivo.

## Flujo principal

1. Usuario entra → middleware valida cookie `access_pin`.
2. Elige sitio en el selector global (`SitioProvider` en `app/providers.tsx`);
   la selección se persiste en `localStorage` y se comparte entre captura,
   historial y configuración.
3. En `app/page.tsx` captura temp/pH/humedad, opcionalmente foto.
4. "Analizar imagen" → `/api/analizar` corre visión IA, guarda en
   `analisis_cache` por hash SHA-256 del buffer (reuso entre fotos idénticas).
5. "Guardar medición" → sube foto a Blob, escribe en `mediciones`.
6. Puede pedir diagnóstico al agente (`/api/chat` con tipo `diagnostico`)
   o diagnóstico histórico por compostera (`/api/diagnostico`).
7. En `app/historial/page.tsx` se listan, editan o borran registros.

## Criterio de estado

- `lib/estado.ts > getStatus`: versión por **fase del proceso** (mesofílica
  hasta día 7, termofílica hasta día 30, maduración después), usada en
  captura.
- `lib/estado.ts > getEstadoSimple`: versión sin fase, se conserva porque
  es la que se guarda al editar en historial. No se unificó para no cambiar
  el estado visible de los registros existentes.

## Modelo de datos

Jerarquía canónica:

```
sitios (1)
  └── composteras (N por sitio)
        └── ciclos (N por compostera, 1 activo a la vez)
              └── mediciones (N por ciclo)
```

- `sitios` — lugar físico (San Francisco Bojay es el seed).
- `composteras` — contenedor físico con `sitio_id`, `tipo`, `capacidad_kg`,
  `estado` (`activa | inactiva | retirada`). Se crean y borran por sitio
  desde `/configuracion` (panel del sitio activo). Solo se permite borrar
  composteras sin historia de ciclos; las que ya corrieron se retiran.
- `ciclos` — corrida de compostaje (`estado = activo | cerrado | descartado`).
  Un índice único parcial (`uq_ciclos_un_activo_por_compostera`) garantiza
  que haya un solo ciclo activo por compostera. `formulacion_id` del ciclo
  es la fuente de verdad de la receta usada en esa corrida.
- `mediciones` — lectura puntual. `ciclo_id` se resuelve al crear la
  medición: el endpoint `POST /api/mediciones` usa el ciclo activo de la
  compostera si el cliente no manda uno explícito.
- `bitacoras` — cuaderno de campo libre **por sitio**, fuera de la
  jerarquía de composteras/ciclos. Cada entrada tiene `sitio_id` (FK
  con `ON DELETE RESTRICT`), `fecha`, `hora`, `observaciones` (texto
  libre, máx. 2000 chars) y `fotos` como columna `JSONB` con el array
  de URLs de Vercel Blob (máx. 10 por entrada). Índice
  `(sitio_id, fecha DESC, hora DESC)` para listados futuros.

### Resolución centralizada del ciclo

`lib/ciclos.ts > resolverCiclo(compostera?, ciclo_id?)` es el único lugar
que decide qué ciclo aplica para una operación. Códigos de error:

| Código | HTTP | Cuándo |
|---|---|---|
| `MISSING` | 400 | No viene `ciclo_id` ni `compostera` |
| `NOT_FOUND` | 404 | `ciclo_id` no existe |
| `MISMATCH` | 400 | `ciclo_id` existe pero pertenece a otra compostera |
| `NO_ACTIVE_CYCLE` | 400 | Solo viene `compostera` y no tiene ciclo activo |

`/api/mediciones`, `/api/diagnostico` y `/api/chat` lo consumen. Cada
uno puede personalizar el mensaje inspeccionando `err.code` sin
reimplementar la lógica.

### Migración y legacy

El esquema v2 se aplica en dos vías:
- **Producción**: `scripts/migrations/2026-04-18-v2-sitios-ciclos.sql`
  (idempotente, ejecutado una vez contra Neon con `psql`).
- **Fresh/dev**: `ensureSchemaV2()` en `lib/db.ts` crea/ALTER-ea en
  primera llamada (mismo patrón que el viejo `ensureTable`).

Queda como deuda técnica para una fase posterior. El código cargado con
esta deuda está marcado con comentarios `LEGACY COMPAT` (grep sobre
`lib/db.ts`, `lib/validaciones.ts`, `lib/diagnostico.ts`):

- `mediciones.compostera` sigue `NOT NULL` y lo usan `getMediciones`,
  `getMedicionesExport`, `insertConsulta` y el backfill de
  `ensureSchemaV2`. No se elimina hasta verificar que no hay flujo que
  dependa de él.
- `mediciones.ciclo_id` es `NULL`-able a nivel de BD. Hoy en Neon no hay
  ninguna medición con `ciclo_id IS NULL`; el endpoint bloquea inserts
  sin ciclo. Promoción a `NOT NULL` es trabajo futuro.
- `compostera_formulaciones` se conserva como histórico legacy. La UI
  solo lo muestra como referencia; las formulaciones "vivas" viven en
  `ciclos.formulacion_id`.

El plan detallado para atacar esta deuda (endurecer integridad a nivel
BD y retirar `mediciones.compostera` en sub-fases reversibles) vive en
`scripts/migrations/2026-04-18-fase-3-plan.md`. Aún no se ejecuta.
