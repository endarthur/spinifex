# Spinifex Design Document

## Philosophy

### Ultrabasic
Spinifex is intentionally minimal. No build steps, no npm, no bundlers. Just vanilla JavaScript served via any static HTTP server. Dependencies are loaded via CDN.

This approach:
- Reduces complexity and maintenance burden
- Makes the codebase accessible to geoscientists who may not be web developers
- Allows running anywhere with `python -m http.server`
- Keeps the focus on GIS functionality, not tooling

### Terminal-First
The JavaScript REPL is the primary interface. The GUI exists to visualize state and provide discoverability, but power users work primarily through the terminal.

Key principles:
- **GUI teaches CLI** — Clicking UI elements echoes equivalent commands to terminal
- **Real JavaScript** — No custom DSL; users get loops, functions, variables for free
- **Layers are objects** — `geology.show().zoom().style({...})` is chainable and intuitive
- **State-driven** — Terminal commands update state, UI reacts automatically

### Local-First
Files stay on the user's machine. The File System Access API enables:
- Picking and saving to local folders
- Project persistence without a server
- No upload/download workflow for large files

## Architecture

### State Management (`src/core/state.js`)
Central state object holds:
- `layers` — Map of layerId → Layer instance
- `crs` — Current coordinate reference system
- `history` — Command history for terminal
- `layerCounter` / `zIndexCounter` — Auto-incrementing IDs

All mutations go through state; UI components subscribe to changes.

### Layer Class (`src/core/layer.js`)
The Layer class wraps:
- GeoJSON data
- OpenLayers vector layer and source
- Style options
- Metadata (source path, format)

Methods are chainable and return `this`:
```javascript
geology.show().zoom().style({ fill: '#ff0000' })
```

Layers auto-register to the global scope and `sp` namespace:
```javascript
// After loading, these are equivalent:
geology.zoom()
sp.geology.zoom()
```

### API Namespace (`src/core/api.js`)
The `sp` object collects all API functions:
- Data loading: `load`, `open`, `sample`
- Layer management: `layers`, `ls`, `clear`, `zoom`, `download`
- Spatial operations: `buffer`, `intersect`, `union`, `centroid`, `clip`, `dissolve`, `voronoi`
- Utilities: `help`, `json`, `legend`
- Subsystems: `map`, `state`, `turf`, `ol`, `ws`, `measure`

The API executor (`execute` function) handles:
- Evaluating user input as JavaScript
- Catching and displaying errors
- Formatting return values

### Styling System (`src/core/styling.js`)
Two style modes:
1. **Rules-based** — Discrete colors by filter expressions
2. **Graduated** — Continuous color ramp for numeric fields

Filter expressions use `r` as shorthand for properties:
```javascript
{ filter: "r.unit == 'BIF'", fill: "#e41a1c" }
{ filter: "r.age_ma > 2700", fill: "#377eb8" }
```

### Window System (`src/ui/windows.js`)
Uses WinBox for floating, resizable windows:
- Layers panel
- Terminal
- Layer Properties (tabs: Info, Fields, Style, Labels)
- Attribute Table
- Legend
- Settings
- Version History

Windows track their instances to prevent duplicates and enable focus management.

### Widget System (`src/core/widgets.js`)
Schema-driven UI generation for tool parameters and forms:
- **Widgets** — Individual UI elements (text, number, checkbox, select, color, slider, range)
- **Layout widgets** — Containers for grouping (row, column, formRow, spacer)
- **Schema format** — Array of parameter definitions with type, name, label, default, etc.

```javascript
// Example: Tool parameter schema
const params = [
  { type: 'number', name: 'distance', label: 'Buffer Distance', default: 100 },
  { type: 'select', name: 'units', options: ['m', 'km', 'mi'] },
  { type: 'checkbox', name: 'dissolve', label: 'Dissolve Results' }
];
const form = widgets.render(params, values, onChange);
```

Used by tool panel for auto-generating parameter forms from toolbox schemas.

### Versioning System (`src/core/versioning.js`)
Lightweight project versioning integrated with workspace:
- **v.save(message, full?)** — Create a version snapshot
- **v.list()** — Show all versions
- **v.restore(id)** — Restore to a specific version
- **v.diff(id1, id2)** — Compare two versions

Versions stored in `.versions/` folder within workspace:
- `manifest.json` — Version metadata (id, timestamp, message, layer count)
- Light snapshots — State only (layer configs, styles)
- Full snapshots — State + data files

### Format Loaders (`src/formats/`)
Each format has a dedicated loader:
- `geojson.js` — Native GeoJSON
- `csv.js` — CSV with coordinate columns (auto-detected)
- `xlsx.js` — Excel via SheetJS
- `shapefile.js` — Zipped shapefiles via shapefile.js
- `geotiff.js` — GeoTIFF rasters

Format detection in `index.js` routes by extension and content inspection.

## Key Design Decisions

### OpenLayers over Leaflet
OpenLayers provides:
- Better projection support (essential for GIS)
- More control over rendering
- Richer feature styling
- Better fit for "serious" GIS work

### JavaScript REPL over Custom DSL
Using real JavaScript means:
- Users get the full language (loops, functions, async)
- No parser to maintain
- Familiar to anyone who knows JS
- Can use any JS library

### Chainable Methods
Fluent interface makes common workflows concise:
```javascript
// Instead of:
geology.show()
geology.zoom()
geology.style({ fill: '#ff0000' })

// Write:
geology.show().zoom().style({ fill: '#ff0000' })
```

### Filter Expression Syntax
Using `r.field` as shorthand (where `r` = feature properties):
- Concise: `r.age_ma > 2700` vs `f.properties.age_ma > 2700`
- Consistent across styling rules and attribute table filter
- Real JavaScript, not a mini-language

### Virtual Scrolling for Attribute Table
Large datasets (10k+ features) would freeze the browser if all rows were rendered. Virtual scrolling renders only visible rows plus a small buffer, enabling smooth performance with any dataset size.

## The Igneous Suite

Spinifex is part of a broader ecosystem:

| Layer | Rock | App | Role |
|-------|------|-----|------|
| Terminal | Komatiite | Koma / xterm-kit | The ultrabasic substrate |
| Analysis | Spinifex | Spinifex | Web GIS, JS-powered |

Named after spinifex texture in komatiites — ultrabasic rock with needle-like crystals resembling spinifex grass. Ties conceptually to GRASS GIS lineage.

## Conventions

### CSS
- Use CSS variables for all colors (`var(--bg)`, `var(--accent)`, etc.)
- Theme switching changes variables on `:root`
- Component-scoped class names (`.attribute-table-*`, `.props-*`)

### JavaScript
- ES modules with explicit imports/exports
- Dynamic `import()` for lazy loading and avoiding circular dependencies
- Async/await for file operations
- JSDoc comments for public APIs

### Documentation
- `help.js` is the source of truth for API docs
- `docs/API.md` mirrors help.js for external reference
- Keep both in sync when adding/changing APIs
