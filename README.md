# HQ Dashboard — Command Center

Tu centro de comando personal para Voccel, Prussia y MH Arquitectura.

## Qué incluye

- **Dashboard** — métricas globales, dailies del día, tareas en progreso, leads recientes
- **Voccel / Prussia / MH** — plan de lanzamiento, misiones (dailies + semanales + generales), notas, redes sociales
- **Modo Focus** — Pomodoro con XP por sesión, log del día
- **Weekly Review** — cierre semanal con historial
- **Kanban** — tablero de proyectos arrastrable con 4 columnas
- **Calendario de contenido** — vista semanal por cuenta y red social, con ideas precargadas
- **Pipeline** — gestión de leads por etapa
- **Cobros** — registro de cobros pendientes y cobrados
- **Simulador de ingresos** — proyección mensual con sliders
- **Logros** — 8 achievements con condiciones reales
- **Historial XP** — log completo de XP ganado

## Sistema de gamificación

- Misiones diarias y semanales se resetean automáticamente
- Misiones generales se desbloquean en cadena (completar una habilita la siguiente)
- XP irrevocable — una vez completada una misión no se puede deshacer
- Logros que se desbloquean solos cuando cumplís las condiciones

## Cómo subir a GitHub Pages

1. Creá un repositorio en GitHub (puede ser privado o público)
2. Subí el archivo `index.html`
3. Ir a **Settings → Pages → Source → main branch → / (root)**
4. GitHub te da una URL tipo `https://tuusuario.github.io/hq-dashboard`
5. Guardá esa URL — ahí van a vivir tus datos

## Importante sobre los datos

Los datos se guardan en **localStorage** del navegador donde abrís el dashboard.
Esto significa:
- ✅ Persisten entre sesiones en el mismo navegador
- ✅ Sin servidor, sin base de datos, sin costo
- ⚠️ Si cambiás de navegador o limpiás caché, los datos no están
- ⚠️ No se sincronizan entre dispositivos

**Recomendación:** usá siempre el mismo navegador en tu notebook para acceder.

## Cómo correrlo localmente (sin GitHub)

Simplemente abrí el archivo `index.html` en tu navegador.
Los datos se guardan igual en localStorage.

---

Construido con vanilla HTML/CSS/JS — sin frameworks, sin dependencias, sin build step.
