# Composta Lirio

App de monitoreo y diagnóstico de compostaje de lirio acuático para la
comunidad de San Francisco Bojay (Hidalgo). Captura mediciones de
temperatura, pH y humedad, analiza fotos con IA, guarda historial por
compostera y da diagnóstico integral con un agente conversacional.

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
  page.tsx                 Captura de medición + chat + diagnóstico
  historial/page.tsx       Listado, edición y CSV
  consultas/page.tsx       Historial de preguntas
  configuracion/           Composteras y formulaciones
  login/                   Pantalla de PIN
  api/
    mediciones/            CRUD de mediciones (+ export CSV)
    composteras/           Lectura/escritura de composteras
    formulaciones/         CRUD de formulaciones
    consultas/             Log de preguntas
    analizar/              Análisis de foto (IA de visión)
    chat/                  Conversación con el agente
    diagnostico/           Diagnóstico histórico de compostera
    upload/                Subida de foto al Blob
    auth/                  Login/logout (PIN)

lib/
  db.ts                    Acceso a Neon (SQL)
  analisis.ts              Tipos, parse y reglas del análisis visual
  analizar.ts              Cliente: fetch a /api/analizar
  openai-vision.ts         Helper fino de la API de visión de OpenAI
  estado.ts                Reglas de estado (good/warning/danger)
  humedad.ts               Niveles y etiquetas DRY/WET
  fechas.ts                hoyISO, diasDesde
  foto.ts                  compressImage, uploadFoto (cliente)
  types.ts                 Tipos compartidos de dominio
  validaciones.ts          Validación de body de mediciones
  prompt.ts                Prompt de chat/diagnóstico
  diagnostico.ts           Lógica del diagnóstico histórico
  patrones.ts              Reglas/patrones del diagnóstico

components/
  ui/icons.tsx             SVGs compartidos
  ui/FotoModal.tsx         Modal de foto con Escape + scroll lock
  ui/AnalisisBadge.tsx     Badge verde/amarillo/rojo del análisis

hooks/
  usePhotoUpload.ts        Selección, preview y subida de foto
  useImageAnalysis.ts      Estado del análisis IA
  useFotoModal.ts          Estado del modal de foto
  useComposteras.ts        Fetch de composteras

middleware.ts              Gate por PIN con cookie access_pin
```

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/mediciones` | Crear medición |
| `GET`  | `/api/mediciones?compostera=N` | Listar últimas 100 |
| `PUT`  | `/api/mediciones` | Actualizar medición (body incluye `id`) |
| `DELETE` | `/api/mediciones?id=N` | Borrar medición (y su foto en Blob) |
| `GET`  | `/api/mediciones/export` | CSV para descarga |
| `GET/POST` | `/api/composteras` | Leer/guardar composteras |
| `POST` | `/api/analizar` | FormData con `imagen` — análisis visual |
| `POST` | `/api/chat` | Mensajes del agente (DeepSeek) |
| `POST` | `/api/diagnostico` | Diagnóstico histórico por compostera |
| `POST` | `/api/upload` | FormData con `foto` — sube a Vercel Blob |
| `POST` | `/api/auth` | Login con PIN |
| `POST` | `/api/auth/logout` | Logout |

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
2. En `app/page.tsx` captura temp/pH/humedad, opcionalmente foto.
3. "Analizar imagen" → `/api/analizar` corre visión IA, guarda en
   `analisis_cache` por hash SHA-256 del buffer (reuso entre fotos idénticas).
4. "Guardar medición" → sube foto a Blob, escribe en `mediciones`.
5. Puede pedir diagnóstico al agente (`/api/chat` con tipo `diagnostico`)
   o diagnóstico histórico por compostera (`/api/diagnostico`).
6. En `app/historial/page.tsx` se listan, editan o borran registros.

## Criterio de estado

- `lib/estado.ts > getStatus`: versión por **fase del proceso** (mesofílica
  hasta día 7, termofílica hasta día 30, maduración después), usada en
  captura.
- `lib/estado.ts > getEstadoSimple`: versión sin fase, se conserva porque
  es la que se guarda al editar en historial. No se unificó para no cambiar
  el estado visible de los registros existentes.
