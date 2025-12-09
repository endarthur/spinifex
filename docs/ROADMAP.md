# Spinifex Roadmap

## Completed Features

### Core
- [x] OpenLayers map with dark basemap
- [x] xterm.js terminal with JavaScript REPL
- [x] Layer class with chainable methods
- [x] State-driven UI architecture
- [x] Click-to-inspect popup

### Data Loading
- [x] GeoJSON (drag-drop, file picker, `load()`)
- [x] CSV with coordinate columns (auto-detected)
- [x] XLSX/XLS spreadsheets
- [x] Shapefile (.zip format)
- [x] GeoTIFF raster support
- [x] Cloud-Optimized GeoTIFF (COG) via URL
- [x] Sample vector data (`load(sample)`)
- [x] Sample raster data (`sampleRaster()` — synthetic 4-band satellite)

### Layer Management
- [x] Show/hide toggle
- [x] Zoom to extent
- [x] Remove layers
- [x] Drag-drop reordering with z-index
- [x] Layer properties window (Info, Fields, Style, Labels tabs)

### Styling
- [x] Rules-based (discrete) styling
- [x] Graduated (continuous color ramp) styling
- [x] Field-based color mapping with multiple scales
- [x] Stroke/fill/opacity/width controls
- [x] Point radius styling
- [x] Labels with template expressions
- [x] Legend window

### Spatial Operations
- [x] `buffer(layer, distance)` — with "50m", "1km" syntax
- [x] `intersect(layer1, layer2)`
- [x] `union(layer1, layer2)`
- [x] `centroid(layer)`
- [x] `clip(layer, mask)`
- [x] `dissolve(layer, field)`
- [x] `voronoi(points)`

### Measurement
- [x] Interactive distance measurement
- [x] Interactive area measurement
- [x] Interactive bearing measurement
- [x] Quick calculation functions

### Attribute Table
- [x] Standalone window
- [x] Virtual scrolling (handles large datasets)
- [x] Column sorting
- [x] Text filter (simple search)
- [x] Expression filter (`=r.field > value`)
- [x] Row selection with map highlight
- [x] Double-click to zoom
- [x] Cell context menu (Edit in terminal, Copy)
- [x] Bulk Edit button
- [x] Refresh button
- [x] `layer.table()` method
- [x] `layer.refresh()` method

### Project Persistence
- [x] File System Access API for workspace folders
- [x] `project.json` manifest
- [x] `ws.new()`, `ws.connect()`, `ws.save()`, `ws.reconnect()`

### Raster Algebra
- [x] Band compositing (`raster.bands(4, 3, 2)`)
- [x] Color ramps & stretch (`raster.colorRamp()`, `raster.stretch()`)
- [x] WebGL expressions (`raster.expression('(b4-b3)/(b4+b3)')`)
- [x] Raster calculator (`calc(expr, inputs, opts)`) — creates new layers
- [x] Algebra shortcuts: `ndvi()`, `threshold()`, `ratio()`
- [x] Pixel value queries (`raster.getValue(lon, lat, band)`)
- [x] Expression parser with full operator support (+, -, *, /, comparisons, ternary)
- [x] GDAL WebAssembly (COG export, reproject)

### Testing
- [x] Playwright integration tests (470+ tests)
- [x] Tests run in real Chromium, no mocking
- [x] `npm test`, `npm run test:headed`, `npm run test:ui`

### Widget System
- [x] Schema-driven UI generation (`widgets.render()`)
- [x] Built-in widgets: text, number, checkbox, select, color, slider, range
- [x] Layout widgets: row, column, formRow, spacer
- [x] Tool panel integration (parameter forms from schemas)
- [x] Extensible widget registry

### Versioning / Snapshots
- [x] Version system API (`v.save()`, `v.list()`, `v.restore()`, `v.diff()`)
- [x] Full and light snapshots
- [x] Version History UI window
- [x] Workspace integration

### UI/UX
- [x] Dark theme (default)
- [x] Multiple theme options (light, industrial, amber, Catppuccin variants)
- [x] WinBox floating windows
- [x] Context menus
- [x] `help()` system with function-specific documentation

---

## Planned Features

### Near Term

#### Documentation
- [ ] User guide / tutorial
- [ ] API reference website
- [ ] Example gallery

#### Polish & Bug Fixes
- [ ] Better error messages in terminal
- [ ] Keyboard shortcuts documentation
- [ ] Undo/redo for terminal commands

### Medium Term

#### Raster Styling UI (In Progress)
- [x] Styling panel for rasters (layer properties Style tab)
- [x] Band selector (RGB composite)
- [x] Color ramp picker with preview
- [x] Stretch controls (min/max sliders)
- [ ] Migrate raster style panel to widget system
- [ ] Expression builder UI

#### Raster Creation & Interpolation
- [ ] Create raster from points
- [ ] IDW (Inverse Distance Weighting) — `idw(points, field, {cellSize, power})`
- [ ] RBF (Radial Basis Functions) — `rbf(points, field, {cellSize, kernel})`
- [ ] Terrain analysis: hillshade, slope, aspect

#### CRS Improvements
- [ ] Searchable EPSG codes
- [ ] CRS suggestions based on data location
- [ ] Layer CRS status indicators
- [ ] `sp.crs.guess(layer)` helper
- [ ] On-the-fly reprojection UI

#### Export
- [ ] Screenshot to PNG
- [ ] SVG export (map + scalebar + legend)
- [ ] Print layout (basic)
- [ ] Vector export formats (Shapefile, KML, GeoPackage via GDAL)

### Long Term

#### 3D Subsurface (Three.js)

Three.js chosen over Cesium/deck.gl for full subsurface geology support.

**Data Types:**
- [ ] Block models — 3D voxel grids with properties (grade, lithology)
  ```javascript
  // Format: { nx, ny, nz, origin: [x,y,z], size: [dx,dy,dz], values: {...} }
  ```
- [ ] Meshes — Triangulated surfaces (faults, ore shells, topo, contacts)
  ```javascript
  // Format: { vertices: [...], faces: [...], properties: {...} }
  ```
- [ ] Drillholes — Collar + survey + intervals with downhole rendering
  ```javascript
  // Format: { collar: {x,y,z,id}, surveys: [{depth,azi,dip}], intervals: [{from,to,...}] }
  ```
- [ ] 3D Points — Scatter plots, samples, sensors

**Visualization:**
- [ ] Voxel rendering, slicing, isosurfaces for block models
- [ ] Drillhole tubes with interval coloring
- [ ] Mesh rendering with transparency
- [ ] Section planes (slice through models)
- [ ] Linked 2D/3D views (selection sync between map and 3D)

**Note:** Kriging would require geostatistics libraries. Most classic code (GSLIB) is Fortran, poorly supported for WASM. May need JS implementations or approximations.

#### Scripts & Automation
- [ ] Load/run scripts from workspace `scripts/` folder
- [ ] `startup.js` auto-execution on project open
- [ ] CodeMirror editor panel
- [ ] Shift+Enter to run selection

#### Plugin System (spip)
- [ ] Plugin registry (GitHub-based)
- [ ] `spip.install('plugin-name')`
- [ ] Local plugins folder
- [ ] Plugin API for extending sp namespace

#### Advanced Editing
- [ ] Drawing tools (point, line, polygon)
- [ ] Vertex editing
- [ ] Snapping
- [ ] Undo/redo for edits
- [ ] Topology validation

#### Cross-Tab Communication
- [ ] BroadcastChannel API
- [ ] Spinifex as persistent "server" tab
- [ ] Integration with JupyterLite

---

## Ideas & Exploration

These are possibilities, not commitments:

- **SQL queries** — sql.js for querying features
- **Geostatistics** — Integration with wabisabi library
- **Temporal data** — Time slider for temporal datasets
- **Collaborative** — WebRTC for sharing sessions
- **Mobile** — Touch-friendly UI mode
- **Offline** — Service worker for offline use
- **QGIS styles** — Import/export .qml files
- **WMS/WFS** — Remote layer support

---

## Contributing

Priorities are flexible. If you want to work on something:
1. Check if there's existing work in progress
2. Start with a small, well-defined scope
3. Follow the coding conventions in CLAUDE.md
4. Keep the ultrabasic philosophy in mind
