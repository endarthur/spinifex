# CLAUDE.md - Spinifex

## Project Overview

**Spinifex** is an ultrabasic web-based GIS (Geographic Information System) built with vanilla JavaScript. It runs entirely in the browser with no build step required.

### Philosophy
- **Ultrabasic** — Minimal dependencies, no npm, no bundler, just ES modules via CDN
- **Terminal-first** — JavaScript REPL is the primary API; GUI reacts to state
- **Files stay local** — Uses File System Access API, nothing uploaded to servers
- Named after spinifex texture in komatiites (ultrabasic/ultramafic rock)

## Quick Start

```bash
# Serve locally (any static server works)
python -m http.server 8000
# Open http://localhost:8000
```

## Project Structure

```
spinifex/
├── index.html              # Main entry point
├── styles/
│   └── spinifex.css        # All styling (themes, components, windows)
├── src/
│   ├── main.js             # App initialization
│   ├── core/
│   │   ├── api.js          # Main API namespace (sp.*), command executor
│   │   ├── layer.js        # Layer class with chainable methods
│   │   ├── state.js        # Global state management
│   │   ├── commands.js     # Spatial operations (buffer, union, etc.)
│   │   ├── styling.js      # Layer styling & color scales
│   │   ├── help.js         # Built-in API documentation (SOURCE OF TRUTH)
│   │   ├── workspace.js    # Project persistence via File System API
│   │   ├── sample-data.js  # Built-in sample vector datasets
│   │   └── sample-raster.js # Synthetic 4-band satellite imagery generator
│   ├── ui/
│   │   ├── map.js          # OpenLayers map initialization
│   │   ├── terminal.js     # xterm.js terminal & REPL
│   │   ├── windows.js      # WinBox windowing system
│   │   ├── layers-panel.js # Layer list UI
│   │   ├── context-menu.js # Right-click menus & modals
│   │   ├── drag-drop.js    # File drag-drop handling
│   │   └── measure.js      # Measurement tools
│   ├── formats/
│   │   ├── index.js        # Format detection & routing
│   │   ├── geojson.js      # GeoJSON loader
│   │   ├── csv.js          # CSV with coordinates
│   │   ├── xlsx.js         # Excel spreadsheet
│   │   ├── shapefile.js    # Shapefile (.zip)
│   │   └── geotiff.js      # GeoTIFF raster
│   ├── raster/
│   │   ├── algebra.js      # Raster calculator, expression parser, band math
│   │   └── gdal.js         # GDAL.js integration (COG export, reproject)
│   └── lib/
│       └── xterm-kit/      # Terminal utilities
├── tests/                  # Playwright integration tests
│   ├── app.test.js         # App loading, namespaces, help
│   ├── vectors.test.js     # Vector loading, spatial ops, layer management
│   └── rasters.test.js     # Raster generation, algebra, expressions
├── docs/
│   ├── DESIGN.md           # Architecture & design decisions
│   ├── ROADMAP.md          # Planned features & future ideas
│   └── API.md              # API reference (mirrors help.js)
└── test_data/              # Sample geospatial files for testing
```

## Key Technologies (all via CDN)

| Library | Purpose |
|---------|---------|
| OpenLayers 7 | Web mapping, vector/raster display |
| xterm.js 5.3 | Terminal emulator for REPL |
| Turf.js 7 | Spatial analysis operations |
| proj4.js 2.9 | Coordinate projections |
| chroma.js 2.4 | Color scales for styling |
| WinBox 0.2.82 | Floating window manager |
| GeoTIFF.js | Raster file parsing |

## Coding Conventions

### General
- **Vanilla JS only** — No TypeScript, no JSX, no framework
- **ES modules** — Use `import`/`export`, loaded via `<script type="module">`
- **No build step** — Code runs directly in browser
- **CSS variables** — Use `var(--name)` for theming

### Patterns
- **Layer class is chainable** — Methods return `this` for chaining: `layer.show().zoom().style({...})`
- **Layers auto-register to API** — When created, layers become `sp.layerName` and global `layerName`
- **State-driven UI** — Terminal commands update state, UI reacts
- **Dynamic imports** — Use `import()` for lazy loading between modules to avoid circular deps

### Style expressions
- Filter expressions use `r` as shorthand for feature properties: `r.field > value`
- Same syntax in styling rules and attribute table filter

## Common Tasks

### Adding a new spatial operation
1. Add function in `src/core/commands.js`
2. Export from commands.js
3. Add to `sp` namespace in `src/core/api.js`
4. Add documentation in `src/core/help.js`
5. Update `docs/API.md` to match

### Adding a new Layer method
1. Add method to Layer class in `src/core/layer.js`
2. Add documentation in `src/core/help.js`
3. Update `docs/API.md` to match

### Adding a new file format
1. Create loader in `src/formats/newformat.js`
2. Add detection logic in `src/formats/index.js`
3. Update help.js file formats section

### Adding UI components
1. Use WinBox for new windows (see `src/ui/windows.js`)
2. Add styles in `styles/spinifex.css`
3. Use CSS variables for theme compatibility

## Documentation Sync

**help.js is the source of truth** for API documentation. When updating:
1. Update `src/core/help.js` first
2. Mirror changes to `docs/API.md`
3. Keep both in sync

## Testing

**Playwright integration tests** run in real Chromium - no mocking of WebGL, Canvas, or OpenLayers.

```bash
npm install              # First time only
npm test                 # Run all tests (headless)
npm run test:headed      # Run with visible browser
npm run test:ui          # Interactive UI mode
```

**Test coverage (33 tests):**
- `app.test.js` — App loading, sp namespace, help system, basemaps
- `vectors.test.js` — Sample data, where/save, spatial ops (buffer, centroid, dissolve), layer management
- `rasters.test.js` — sampleRaster generation, band compositing, color ramps, WebGL expressions, calc(), algebra shortcuts (ndvi, threshold, ratio), getValue

**Sample data for tests:**
- `load(sample)` — Built-in vector data (geology polygons, drillhole points)
- `sampleRaster()` — Generates synthetic 200×200 4-band satellite imagery (Blue, Green, Red, NIR)

**Manual testing:**
1. Run `npx serve -p 3000` or `python -m http.server 3000`
2. Open browser to localhost:3000
3. Run `load(sample)` or `sampleRaster()` to load test data

## File Formats Supported

- **Vector:** GeoJSON, CSV (with coords), XLSX/XLS, Shapefile (.zip)
- **Raster:** GeoTIFF (.tif, .tiff)

All loaded via drag-drop or `open()` file picker.
