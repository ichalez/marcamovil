# Fútbol Stream

Retransmisión de partidos de fútbol con marcador y gráficos en directo:

- **Web (esta fase):** los clubes gestionan equipos, patrocinadores y partidos, y un operador controla el
  marcador desde el móvil o la tablet. El overlay HTML se actualiza en tiempo real.
- **App móvil (fase 2):** Flutter (Android + iOS). Coge la cámara, superpone el overlay HTML y emite a YouTube por RTMP.

```
 ┌──────────────────┐   Firestore (tiempo real)   ┌───────────────────────────┐
 │ Panel operador   │ ─────────────────────────▶  │ live/{matchId}  (público) │
 │ /control/:id     │                             └─────────────┬─────────────┘
 └──────────────────┘                                           │
                                                                ▼
 ┌────────────────────────────────────────────┐    /overlay/:id (HTML transparente 1920×1080)
 │ Móvil emisor (fase 2)                      │ ◀──────────────┘
 │ cámara + WebView overlay → H.264 → RTMP ───┼──▶ YouTube Live
 └────────────────────────────────────────────┘
```

## Qué incluye

| Parte | Ruta | Descripción |
|---|---|---|
| Inicio de sesión | `/login` | Email/contraseña o Google |
| Clubes | `/` | Tus clubes, invitaciones pendientes, crear club |
| Partidos | `/c/:club/partidos` | Crear/editar partido, clave de emisión de YouTube, calidad |
| Equipos | `/c/:club/equipos` | Escudo, colores, abreviatura y plantilla (se puede pegar una lista) |
| Patrocinadores | `/c/:club/patrocinadores` | Logos que rotan en el overlay |
| Miembros | `/c/:club/miembros` | Invitar operadores por email, roles admin/operador |
| **Panel de control** | `/control/:matchId` | Goles, tarjetas, cambios, reloj, descuento, penaltis, escenas, rótulos, deshacer, vista previa |
| **Overlay** | `/overlay/:matchId` | Público y transparente. `?bg=green\|field\|dark` para probar con fondo |
| Demo | `/control/demo`, `/overlay/demo` | Funciona sin Firebase (sincroniza pestañas del mismo navegador) |

### Overlay
- Marcador arriba a la izquierda: escudos, abreviaturas, colores, tarjetas rojas, reloj, parte y descuento (+N).
- Rótulos animados de gol (normal, de penalti o en propia puerta), tarjetas (la segunda amarilla se detecta sola) y cambios.
- Rótulo inferior fijo y rótulos rápidos de texto.
- Logos de patrocinadores en rotación.
- Panel de la tanda de penaltis.
- Pantallas completas de previa, descanso y final, con los goleadores.
- El reloj se calcula en cada dispositivo a partir de `startedAt` (no hay escrituras cada segundo).
- Un rótulo nuevo se cronometra con el reloj local, así que un desfase horario entre dispositivos no lo oculta.

## Probarlo ya (sin Firebase)

```bash
cd web
npm install
npm run dev
```

Abre `http://localhost:5173/control/demo` y, en otra pestaña, `http://localhost:5173/overlay/demo?bg=field`.

## Desarrollo local con los emuladores de Firebase

Necesita Java 11 o superior. Se ejecuta todo en local, sin proyecto real:

```bash
cd rules-test && npm install && npx firebase emulators:start --config ../firebase.json --only auth,firestore,storage --project demo-futbol
```

En otra terminal:

```bash
cd web && npm run dev:emu
```

## Puesta en marcha con Firebase

Sigue [docs/SETUP.md](docs/SETUP.md): crear el proyecto, configurar `.env.local`, desplegar reglas y hosting,
probar en OBS y preparar el entorno de Flutter para la fase 2.

## Estructura

```
firebase.json, firestore.rules, storage.rules   Configuración y reglas de seguridad
web/                                             App web (React + TypeScript + Vite)
  src/types.ts                                   Modelo de datos (compartido con la app móvil)
  src/lib/actions.ts                             Acciones puras sobre el directo (gol, tarjeta, reloj…)
  src/lib/clock.ts                               Lógica del reloj y fases de fútbol 11
  src/lib/db.ts                                  Acceso a Firestore y Storage
  src/overlay/                                   Gráficos del overlay
  src/pages/                                     Pantallas
rules-test/                                      Pruebas de las reglas con el emulador de Firebase
mobile/                                          App Flutter (fase 2)
docs/                                            Guías
```

## Modelo de datos (Firestore)

| Documento | Quién lo lee | Contenido |
|---|---|---|
| `clubs/{clubId}` | Miembros e invitados | Nombre, `memberUids`, `roles`, `memberInfo`, `invitedEmails` |
| `clubs/{clubId}/teams/{id}` | Miembros | Equipo y plantilla |
| `clubs/{clubId}/sponsors/{id}` | Miembros | Patrocinador |
| `clubs/{clubId}/matches/{id}` | Miembros | Datos del partido y la **clave de emisión** (`stream`) |
| `live/{matchId}` | **Público** | Estado del directo que pinta el overlay. Nunca contiene secretos |

Cada acción del panel se aplica dentro de una transacción. Así, si dos operadores pulsan a la vez, no se pisan.

## Tests

```bash
cd web && npm test               # lógica de reloj y eventos
cd rules-test && npm install && npm test   # reglas de seguridad (necesita Java)
```

## Hoja de ruta

- [x] Fase 1: web, overlay, Firebase y multi-club
- [ ] Fase 2: app Flutter (cámara + overlay + RTMP, calidad configurable, bitrate adaptativo, reconexión)
- [ ] YouTube OAuth: crear la emisión desde la app (título, privacidad, miniatura)
- [ ] Extras: estadísticas, alineaciones en pantalla, repeticiones
