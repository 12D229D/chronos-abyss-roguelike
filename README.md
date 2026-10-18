# ⏳ Chronos Abyss - Roguelike Dungeon Crawler

Un videojuego roguelike por turnos en HTML5 Canvas y JavaScript ES6+ donde controlas a un Crononavegante en un abismo cuántico con la mecánica única de **Rebobinado Temporal**.

![Chronos Abyss Preview](https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1000&q=80)

---

## 🎮 Características Principales

- **Mecánica de Rebobinado Temporal:** Deshaz hasta 3 turnos pasados (o 5 con artefactos) a cambio de Energía Crono para rectificar errores o escapar de emboscadas mortales.
- **Generación Procedimental de Mazmorras:** Algoritmo BSP con salas, pasillos, fisuras temporales, cofres y altares sagrados.
- **Línea de Visión y Fog of War:** Raycasting dinámico a 360 grados que oculta enemigos y pasillos inexplorados.
- **Enemigos Temporales con IA:** Relojeros mecánicos, espectros de fase capaces de teleportarse, sombras del pasado veloces y anomalías explosivas.
- **Sinergias de Artefactos y Consumibles:** *Lente de Precognición*, *Manto de Fase*, *Reloj de Arena Cuántico*, *Hoja de Entropía* y *Botas de Taquiones*.
- **Audio Procedimental:** Efectos de sonido retro sintetizados en tiempo real mediante **Web Audio API** (sin assets de audio externos).
- **Diseño HSL & Glassmorphism:** Interfaz visual con temática abisal púrpura/cian, HUD interactivo y controles táctiles para dispositivos móviles.

---

## ⌨️ Controles de Juego

| Acción | Teclas de Teclado | Control Táctil (Móvil) |
|---|---|---|
| **Moverse / Atacar** | `W`, `A`, `S`, `D` o `Flechas Direccionales` | Botones ▲ ◀ ▼ ▶ del D-Pad |
| **Esperar Turno** | `Espacio` | Botón **PASAR** |
| **Rebobinado Temporal** | `R` | Botón **⏪ Rebobinar Tiempo** |
| **Usar Consumibles Rápidos** | `1`, `2`, `3` | Clic en los slots del HUD |
| **Alternar Sonido** | `M` | Botón 🔊 en el header |
| **Ayuda / Guía** | `H` | Botón ❓ en el header |

---

## 🏗️ Arquitectura Técnica

```text
chronos-abyss-roguelike/
├── index.html          # Maquetación semántica, viewport Canvas, HUD y modales
├── css/
│   └── style.css       # Sistema de diseño HSL, animaciones y glassmorphism
├── js/
│   ├── audio.js        # Sintetizador procedural con Web Audio API
│   ├── items.js        # Catálogo de consumibles, artefactos pasivos y sinergias
│   ├── enemies.js      # Definición de enemigos y patrones de IA por turnos
│   ├── player.js       # Entidad Jugador, estadísticas y pila de snapshots para Rebobinado
│   ├── map.js          # Generador de mazmorras BSP y cálculo de FOV (Fog of War)
│   └── app.js          # Bucle de juego Canvas, cámara suave y gestión de eventos
├── README.md           # Documentación y controles
└── plan.md             # Bitácora de desarrollo y hoja de ruta
```

---

## 🚀 Cómo Ejecutar el Proyecto

1. Clona o accede a la carpeta `chronos-abyss-roguelike/`.
2. Abre `index.html` en cualquier navegador web moderno (Chrome, Edge, Firefox, Safari).
3. ¡No requiere dependencias externas ni compilación!

---

## 📜 Licencia

Desarrollado bajo licencia MIT como parte de la suite monorrepo `Codex`.
