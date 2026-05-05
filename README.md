# SYS_DASHBOARD V4.2

Dashboard personal de trabajo con estética **High-Tech Low-Life** (Cyber-Brutalism). Pensado para uso diario en desktop y mobile.

```
┌─────────────────────────────────────────────┐
│  TERMINAL  COMMAND  CHRONOS  TOOLS  THEMES  │
└─────────────────────────────────────────────┘
```

## Features

- **Terminal** — feed de noticias de arquitectura/diseño industrial, clima local, relojes, métricas
- **Command** — quick links a tus apps (GitHub, Claude, Gmail, etc.) + buscador multi-engine
- **Chronos** — 5 ciudades con clima + hora real (tu ubicación + 4 fijas) + mapa mundi
- **Tools** — visualizador de audio del sistema, scratchpad persistente, alarmas, pomodoro, telemetría
- **Themes** — 4 protocolos visuales: Cyber Yellow / Toxic Green / Cobalt Blue / Blood Red
- **Mobile-ready** — drawer sidebar, touch targets, mic capture, PWA instalable
- **Settings** — operator name, scan lines, densidad, reset

## Setup

```bash
# 1. Clonar e instalar
git clone https://github.com/TU_USUARIO/sys-dashboard.git
cd sys-dashboard
npm install

# 2. Configurar variables
cp .env.example .env
# Editá .env y pegá tu API key de OpenWeather

# 3. Correr
npm run dev
```

Abrí http://localhost:5173

### Probar en el celular (red local)

`npm run dev` ya expone el server en tu red local. Buscá en consola la URL "Network" (algo como `http://192.168.x.x:5173`) y abrila desde el celu.

## API Keys necesarias

### OpenWeatherMap (clima)

1. Andá a https://openweathermap.org/api → "Sign Up"
2. Confirmá el email
3. Dashboard → API keys → copiá la default
4. Pegala en `.env` → `VITE_OPENWEATHER_API_KEY=...`

> ⚠️ La key tarda **~10 minutos** en activarse después de crearla.

> 🔒 **Restricción de seguridad recomendada**: en el dashboard de OpenWeather no hay restricción por dominio para el free tier, pero sí podés monitorear el uso. Las keys del free tier tienen límites bajos así que no es crítico si se filtra.

Sin la key el dashboard funciona igual con **datos mock**.

## Deploy en GitHub Pages

### Opción A — Automática (recomendada)

1. Pusheá el repo a GitHub
2. **Repo → Settings → Pages** → Source: **GitHub Actions**
3. **Repo → Settings → Secrets and variables → Actions** → agregá:
   - `VITE_OPENWEATHER_API_KEY` = tu key
   - `VITE_OPERATOR_NAME` = tu nombre (opcional)
4. Cualquier push a `main` lo deploya automático
5. URL final: `https://TU_USUARIO.github.io/sys-dashboard/`

### Opción B — Manual

```bash
npm install -g gh-pages
VITE_BASE_URL=/sys-dashboard/ npm run build
npx gh-pages -d dist
```

## Estructura

```
sys-dashboard/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .github/workflows/deploy.yml
├── public/
│   ├── favicon.svg
│   ├── manifest.webmanifest
│   └── sw.js
└── src/
    ├── main.js
    ├── styles/
    │   ├── base.css         # reset + tokens + scrollbar
    │   ├── layout.css       # grid, sidebar, topbar, responsive
    │   ├── components.css   # paneles, cards, botones
    │   └── themes.css       # 4 paletas + scan lines
    ├── config/
    │   ├── cities.js        # ciudades del world clock
    │   ├── links.js         # quick links
    │   └── news-sources.js  # feeds RSS
    └── modules/
        ├── nav.js           # navegación + atajos teclado + drawer mobile
        ├── geolocation.js   # ubicación del usuario
        ├── clocks.js        # mini relojes + chronos detallado
        ├── weather.js       # OpenWeather + cache
        ├── news.js          # RSS feed parser
        ├── search.js        # multi-engine
        ├── notes.js         # scratchpad localStorage
        ├── themes.js        # theme switcher
        ├── visualizer.js    # audio canvas (sys/mic)
        ├── world-map.js     # SVG mapa con markers
        ├── metrics.js       # CPU/MEM/etc fake telemetry
        ├── daemon-log.js    # logger global
        ├── settings.js      # panel de configuración
        ├── alarms.js        # alarmas con Notification API
        └── pomodoro.js      # timer 25/5
```

## Uso

### Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl + 1..5` | Cambiar de vista |
| `/` | Focus en buscador |
| `Esc` | Cerrar modales / drawer |

### Visualizador de audio

**Desktop:** Tools → `CAPTURE_SYS_AUDIO` → al compartir pantalla **TILDÁ "Compartir audio del sistema"**.

**Mobile:** Solo está disponible el modo `MIC` (los browsers móviles no soportan captura de audio del sistema).

### PWA / Instalar como app

- **Android (Chrome):** menú ⋮ → "Agregar a pantalla principal"
- **iOS (Safari):** botón compartir → "Añadir a pantalla de inicio"
- **Desktop (Chrome/Edge):** ícono de instalar en la barra de URL

## Privacidad

Todo corre **client-side**. Tus datos personales:
- **Notas, alarmas, settings** → `localStorage` (solo tu navegador)
- **Ubicación** → solo se usa para clima/hora local, nunca se envía a ningún backend propio (sí va a OpenWeather como lat/lon)
- **Audio** → procesado en RAM con Web Audio API, nunca sale del navegador

## Tech

- **Vite** + Vanilla JS modular (sin framework)
- **Web APIs**: Geolocation, Audio, Notification, MediaDevices, localStorage
- **Sin backend** — 100% estático, ideal para GitHub Pages

## License

MIT — uso personal, hacé lo que quieras.
