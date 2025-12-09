# Next Phase: 3D Subsurface & Interpolation

Planning document for the next major features in Spinifex.

## Overview

Two major additions:
1. **3D visualization** for subsurface geology (Three.js)
2. **Raster creation** via point interpolation (IDW, RBF)

Plus polish work on raster styling UI.

---

## 1. Raster Styling UI

Currently all raster methods work but are terminal-only. Need a proper UI panel.

### Components
- **Band selector** — Dropdowns for R, G, B band mapping
- **Mode toggle** — RGB composite vs single-band
- **Color ramp picker** — Visual swatches with preview
- **Stretch controls** — Min/max sliders with histogram
- **Expression input** — Text field for band math with Apply button

### Implementation
- Add `createRasterStylePanel()` in `windows.js`
- Detect raster layers in `createStylePanel()` and branch
- Wire up to existing `raster.bands()`, `colorRamp()`, `stretch()`, `expression()`

---

## 2. Interpolation

Create rasters from point data. Essential for geology (assay samples → grade surfaces).

### API Design

```javascript
// Inverse Distance Weighting
idw(ly.samples, 'grade', {
  cellSize: 50,      // meters
  power: 2,          // distance exponent (default 2)
  extent: [minX, minY, maxX, maxY],  // optional, defaults to layer extent
  noData: -9999
})

// Radial Basis Functions
rbf(ly.samples, 'grade', {
  cellSize: 50,
  kernel: 'gaussian',  // gaussian, multiquadric, inverse, linear, thin_plate
  epsilon: 1.0,        // kernel parameter
  smooth: 0.0          // smoothing factor
})
```

### Implementation Notes
- Pure JavaScript implementation (no WASM dependencies)
- Return raster layer same as `calc()` does
- IDW is straightforward: weighted average by 1/d^p
- RBF requires solving linear system — use simple Gaussian elimination or find lightweight library
- Consider Web Workers for large datasets

### Future: Kriging
- Would need variogram fitting, covariance matrices
- Classic implementations (GSLIB) are Fortran → poor WASM support
- Options:
  - Pure JS implementation (complex but doable)
  - Simple kriging only (skip universal/indicator variants)
  - Use RBF as "good enough" approximation for many cases

---

## 3. 3D Subsurface (Three.js)

### Why Three.js over Cesium/deck.gl
- Full control over camera (can look up from underground)
- Not tied to globe/map paradigm
- Better for cross-sections, slicing, subsurface navigation
- Can build exactly what geology needs

### Data Types

#### Block Models (Voxel Grids)
Regular 3D grids with properties at each cell.

```javascript
// Format
{
  type: 'BlockModel',
  name: 'grade_model',
  nx: 50, ny: 50, nz: 20,           // grid dimensions
  origin: [500000, 7500000, -200],  // corner (x, y, z)
  size: [10, 10, 5],                // cell size (dx, dy, dz)
  rotation: 0,                       // optional rotation in degrees
  properties: {
    grade: Float32Array,             // nx * ny * nz values
    rocktype: Uint8Array,
    density: Float32Array
  }
}
```

**Visualization options:**
- Voxel rendering (show all cells as cubes)
- Slicing (X, Y, Z planes through model)
- Isosurfaces (grade > threshold as mesh)
- Filtered view (only show rocktype == 3)

#### Meshes (Surfaces)
Triangulated surfaces for geology.

```javascript
{
  type: 'Mesh',
  name: 'fault_surface',
  vertices: Float32Array,  // x,y,z,x,y,z,...
  faces: Uint32Array,      // i,j,k,i,j,k,... (triangle indices)
  properties: {
    // Optional per-vertex or per-face properties
    displacement: Float32Array
  }
}
```

**Use cases:** Topography, faults, ore body shells, stratigraphic contacts, pit designs

#### Drillholes
Collar location + downhole survey + intervals.

```javascript
{
  type: 'Drillhole',
  id: 'DH001',
  collar: { x: 500100, y: 7500200, z: 450, azimuth: 270, dip: -60 },
  surveys: [
    { depth: 0, azimuth: 270, dip: -60 },
    { depth: 50, azimuth: 268, dip: -58 },
    { depth: 100, azimuth: 265, dip: -55 }
  ],
  intervals: [
    { from: 0, to: 15, lithology: 'OVB', grade: null },
    { from: 15, to: 45, lithology: 'BIF', grade: 62.5 },
    { from: 45, to: 100, lithology: 'SHALE', grade: 12.3 }
  ]
}
```

**Rendering:**
- 3D trace calculated from collar + surveys (minimum curvature)
- Tube geometry with radius
- Colored by lithology, grade, or other interval property
- Hover/click to show downhole data

#### 3D Points
Simple scatter plots in 3D space.

```javascript
{
  type: 'Points3D',
  name: 'blast_samples',
  coordinates: Float32Array,  // x,y,z,x,y,z,...
  properties: {
    grade: Float32Array,
    date: Array
  }
}
```

### UI Architecture

```
┌─────────────────────────────────────────────────┐
│  Map  │  3D  │                                  │  ← Tab bar (existing)
├───────┴──────┴──────────────────────────────────┤
│                                                 │
│         Three.js Canvas                         │
│         (when 3D tab active)                    │
│                                                 │
├─────────────────────────────────────────────────┤
│  3D Layers panel (similar to 2D)               │
│  - Block models                                 │
│  - Meshes                                       │
│  - Drillholes                                   │
│  - Points                                       │
├─────────────────────────────────────────────────┤
│  Section/Slice controls                         │
│  [ X: ----●---- ]  [ Y: ----●---- ]            │
└─────────────────────────────────────────────────┘
```

### Linked Views
- Clicking drillhole in 3D highlights in 2D map (and vice versa)
- Block model extent shows as polygon in 2D
- Section line in 2D corresponds to slice plane in 3D

### File Formats (Future)
- **Block models:** CSV with IJK or XYZ, Datamine, Vulcan, Surpac formats
- **Meshes:** OBJ, PLY, STL, DXF (3D)
- **Drillholes:** CSV (collar, survey, assay tables), acQuire export

---

## Implementation Order

Suggested sequence:

1. **Raster styling UI** — Quick win, improves existing features
2. **IDW interpolation** — Straightforward algorithm, immediately useful
3. **RBF interpolation** — More complex but better results
4. **Three.js scaffold** — Basic scene, camera, controls
5. **3D Points** — Simplest 3D data type
6. **Drillhole rendering** — High value for geology users
7. **Mesh rendering** — Surfaces
8. **Block models** — Most complex, needs slicing UI

---

## Dependencies

### Current (CDN)
- Three.js — 3D rendering
- (maybe) three-orbitcontrols or similar for camera

### Pure JS (no new deps)
- IDW, RBF implementations
- Drillhole trace calculation (minimum curvature)

---

## Open Questions

1. **Coordinate systems in 3D** — Keep everything in project CRS? How to handle Z units (meters vs feet)?

2. **Performance** — Large block models (millions of cells). Options:
   - WebGL instancing for voxels
   - Level-of-detail for distant views
   - Only render visible slice

3. **Data loading** — Build importers or rely on users converting to JSON?

4. **Linked selection** — How tightly coupled should 2D and 3D be?
