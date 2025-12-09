# Spinifex API Reference

> **Note:** This document mirrors `src/core/help.js`. When updating the API, update both files to keep them in sync.

## Quick Reference

### Loading & Management
| Command | Description |
|---------|-------------|
| `open()` | Open file picker |
| `load(sample)` | Load sample data |
| `load(geojson, "name")` | Load GeoJSON |
| `layers()` / `ls()` | List all layers |
| `clear()` | Remove all layers |
| `basemap("dark")` | Change basemap |

### Layer Methods
| Method | Description |
|--------|-------------|
| `layer.show()` | Show layer |
| `layer.hide()` | Hide layer |
| `layer.zoom()` | Zoom to extent |
| `layer.remove()` | Remove layer |
| `layer.style()` | Open style editor |
| `layer.style({...})` | Set style via code |
| `layer.properties()` | Open properties window |
| `layer.table()` | Open attribute table |
| `layer.refresh()` | Re-apply styling |
| `layer.where(fn)` | Filter features |
| `layer.stats("field")` | Field statistics |
| `layer.zIndex(n)` | Set render order |
| `layer.bringToFront()` | Move to top |
| `layer.sendToBack()` | Move to bottom |

### Layer Properties
| Property | Description |
|----------|-------------|
| `layer.count` | Feature count |
| `layer.fields` | Field names |
| `layer.features` | GeoJSON features |
| `layer.extent` | Bounding box |
| `layer.geomType` | Geometry type |

### Raster Layer Methods
| Method | Description |
|--------|-------------|
| `raster.bands(r,g,b)` | Set RGB band mapping |
| `raster.bands()` | Get current mapping |
| `raster.mode('singleband')` | Single-band mode |
| `raster.colorRamp('viridis')` | Set color ramp |
| `raster.stretch(min, max)` | Set value stretch |
| `raster.expression(expr)` | WebGL band math |
| `raster.getValue(lon,lat,band)` | Query pixel value |

### Spatial Operations
| Function | Description |
|----------|-------------|
| `buffer(layer, "50m")` | Buffer features |
| `intersect(a, b)` | Intersect layers |
| `union(a, b)` | Union layers |
| `centroid(layer)` | Get centroids |
| `clip(layer, mask)` | Clip to boundary |
| `dissolve(layer, field)` | Merge by attribute |
| `voronoi(points)` | Voronoi polygons |

### Spatial Queries
| Function | Description |
|----------|-------------|
| `within(layer, boundary)` | Features within boundary |
| `contains(layer, points)` | Features containing points |
| `selectByLocation(layer, selector)` | Select intersecting features |
| `disjoint(layer, other)` | Features not intersecting |
| `nearest(layer, point)` | Find nearest feature |

### Geoprocessing
| Function | Description |
|----------|-------------|
| `simplify(layer, tolerance)` | Simplify geometries |
| `convexHull(layer)` | Convex hull of features |
| `envelope(layer)` | Bounding box polygon |
| `difference(layer, subtract)` | Subtract geometries |
| `calcArea(layer)` | Calculate areas |
| `calcLength(layer)` | Calculate lengths |
| `pointsAlongLine(layer, dist)` | Points along lines |

### Measurement
| Function | Description |
|----------|-------------|
| `measure.distance()` | Interactive distance |
| `measure.area()` | Interactive area |
| `measure.bearing()` | Interactive bearing |
| `distance(p1, p2)` | Quick distance calc |
| `area(polygon)` | Quick area calc |
| `bearing(p1, p2)` | Quick bearing calc |

### Workspace
| Command | Description |
|---------|-------------|
| `ws.new()` | New project in folder |
| `ws.connect()` | Open existing project |
| `ws.save()` | Save to project folder |
| `ws.reconnect()` | Reconnect to last folder |

### Raster Operations
| Function | Description |
|----------|-------------|
| `sampleRaster()` | Generate test satellite imagery |
| `cog(url)` | Load Cloud-Optimized GeoTIFF |
| `calc(expr, inputs, opts)` | Raster calculator |
| `ndvi(raster)` | NDVI index |
| `threshold(raster, val)` | Binary threshold |
| `ratio(raster, b1, b2)` | Band ratio |

### Utilities
| Function | Description |
|----------|-------------|
| `download(layer, "file")` | Download GeoJSON |
| `json(object)` | Print full JSON |
| `legend()` | Open legend window |
| `help()` | Show this help |
| `help(fn)` | Help for specific function |

### Export
| Function | Description |
|----------|-------------|
| `downloadShapefile(layer, "name")` | Download as Shapefile (zip) |
| `exportShapefile(geojson, "name")` | GeoJSON to Shapefile blob |
| `downloadKml(layer, "name")` | Download as KML |
| `exportKml(geojson, "name")` | GeoJSON to KML blob |
| `geojsonToKml(geojson, "name")` | GeoJSON to KML string |

---

## Detailed Documentation

### open()

Open file picker to load geospatial data.

**Supports:** GeoJSON, CSV, XLSX, Shapefile (.zip), GeoTIFF

```javascript
open()   // Opens system file picker
```

**Alternative:** Drag & drop files onto the map.

---

### basemap()

Change the basemap layer.

**Built-in basemaps:**

| Group | Name | Description |
|-------|------|-------------|
| CartoDB | `"dark"` | Dark Matter (default) |
| | `"light"` | Positron |
| | `"voyager"` | Voyager |
| OpenStreetMap | `"osm"` | OpenStreetMap |
| | `"topo"` | OpenTopoMap |
| Stamen | `"stamen-toner"` | Toner |
| | `"stamen-toner-lite"` | Toner Lite |
| | `"stamen-terrain"` | Terrain |
| | `"stamen-watercolor"` | Watercolor |
| ESRI | `"satellite"` | World Imagery |
| | `"esri-topo"` | World Topo |
| | `"esri-street"` | World Street |
| | `"none"` | No basemap |

```javascript
basemap("dark")
basemap("stamen-watercolor")
basemap("none")
```

**Custom basemap (any XYZ tile URL):**
```javascript
basemap("https://tiles.example.com/{z}/{x}/{y}.png", "© Attribution")
```

Also available from **Layer > Basemap** menu.

---

### load()

Load GeoJSON or sample data.

```javascript
load(sample)              // Load built-in sample data
load(myGeojson, "parcels") // Load GeoJSON with name
```

---

### layer.where()

Filter features using a function. Returns `{ count, features, save(name) }`.

```javascript
geology.where(f => f.properties.age_ma > 2700)
drillholes.where(f => f.properties.fe_pct > 60).save("high_grade")
```

---

### layer.style()

Set layer style or open style editor.

**Called without arguments:** Opens Style panel
```javascript
geology.style()  // Opens properties window at Style tab
```

**Style Types:**
- `type: "rules"` — Discrete colors by filter rules (default)
- `type: "graduated"` — Continuous color ramp

**Common Options:**
| Option | Description |
|--------|-------------|
| `stroke` | Stroke color (hex) |
| `width` | Stroke width (px) |
| `opacity` | Fill opacity (0-1) |
| `radius` | Point radius (px) |
| `default` | Fallback color |

**Rules Style (`type: "rules"`):**

```javascript
geology.style({
  type: "rules",
  rules: [
    { filter: "r.unit == 'BIF'", fill: "#e41a1c" },
    { filter: "r['Au (ppm)'] > 1", fill: "#ffd700" },
    { filter: "", fill: "#888888" }  // Default (no filter)
  ]
})
```

Filter expressions use `r` as shorthand for feature properties:
- `r.unit` — Access property named "unit"
- `r["Au (ppm)"]` — Access property with special characters

**Graduated Style (`type: "graduated"`):**

| Option | Description |
|--------|-------------|
| `field` | Numeric field for color ramp |
| `expression` | Custom JS expression returning 0-1 |
| `transform` | Value transformation: linear, log, sqrt, square |
| `scale` | Color scale: viridis, plasma, blues, reds, spectral |
| `min`, `max` | Value range (auto-calculated if omitted) |

```javascript
samples.style({
  type: "graduated",
  field: "grade",
  scale: "viridis",
  transform: "log"
})
```

**Label Options:**

| Option | Description |
|--------|-------------|
| `labelField` | Field name or template expression |
| `labelColor` | Text color (default: white) |
| `labelOutline` | Outline color (default: black) |
| `labelOutlineWidth` | Outline width (default: 3) |
| `labelSize` | Font size (default: 12) |

Template syntax: `"${r.unit} (${r.age_ma} Ma)"`

---

### layer.table()

Open attribute table window for the layer.

**Features:**
- Virtual scrolling (handles large datasets)
- Click column headers to sort
- Filter box for text search
- Expression filter: prefix with `=` for JS expressions (e.g., `=r.age_ma > 2700`)
- Click row to highlight on map
- Double-click row to zoom to feature
- Right-click cell for context menu (Edit in terminal, Copy)
- Bulk Edit button (enabled when using expression filter)
- Refresh button to re-apply styles after edits

```javascript
geology.table()     // Opens attribute table window
drillholes.table()
```

---

### layer.refresh()

Refresh layer display by re-applying current styling. Useful after programmatically editing feature properties.

```javascript
// After editing features
geology.features[0].properties.unit = "BIF"
geology.refresh()

// Or in a bulk edit
geology.features.forEach(f => {
  if (f.properties.age_ma > 2700) f.properties.era = "Archean"
})
geology.refresh()
```

---

### layer.properties()

Open layer properties window.

**Tabs:** `"info"`, `"fields"`, `"style"`, `"labels"`

```javascript
geology.properties()          // Opens Info tab
geology.properties("style")   // Opens Style tab
geology.properties("fields")  // Opens Fields tab
```

---

### layer.stats()

Get statistics for a numeric field. Returns `{ min, max, mean, median, sum, count }`.

```javascript
drillholes.stats("fe_pct")
```

---

### layer.zIndex()

Get or set layer render order. Higher = on top.

```javascript
layer.zIndex()          // Get current z-index
layer.zIndex(10)        // Set z-index to 10
layer.bringToFront()    // Move to top of stack
layer.sendToBack()      // Move to bottom of stack
```

---

### buffer()

Create buffer around features. Distance can be number (km) or string: "50m", "1km".

```javascript
buffer(geology, "500m")
buffer(drillholes, 2)  // 2 km
```

---

### intersect()

Find intersection of two layers.

```javascript
intersect(geology, buffer_zone)
```

---

### union()

Combine two layers into one.

```javascript
union(zone_a, zone_b)
```

---

### centroid()

Get centroid points from polygons.

```javascript
centroid(geology)
```

---

### clip()

Clip layer features to mask boundary.

```javascript
clip(drillholes, study_area)
```

---

### dissolve()

Merge features by attribute value.

```javascript
dissolve(geology, "unit")
```

---

### voronoi()

Create Voronoi polygons from points.

```javascript
voronoi(drillholes)
```

---

### Measurement

**Interactive tools:**
```javascript
measure.distance()  // Click points, double-click to finish
measure.area()      // Click 3+ points for polygon
measure.bearing()   // Click two points for bearing
measure.stop()      // Cancel measurement
```

**Quick calculations:**
```javascript
distance([118.5, -21.2], [118.6, -21.3])
// Returns: { meters, kilometers, formatted }

area(geology)
area(geology.features[0])
// Returns: { sqMeters, hectares, sqKilometers, formatted }

bearing([118.5, -21.2], [118.6, -21.3])
// Returns: { degrees, formatted }
```

---

### Workspace (ws)

One folder = one project. The folder you pick IS the project.

```javascript
ws.new()            // Clear & start fresh project in new folder
ws.connect()        // Open existing project folder
ws.connectTo(name)  // Connect to workspace by name (from history)
ws.save()           // Save layers & view to project folder
ws.reconnect()      // Reconnect to last used folder
ws.recent()         // Open Recent Workspaces window
ws.export()         // Download project as .spinifex file

workspaces()        // Also opens Recent Workspaces window
```

**Recent Workspaces window:**
- Shows last 10 workspaces you've connected to
- Double-click to connect (usually instant, may prompt for permission)
- Remove from history with × button
- "Connect New..." button to pick a new folder

**Project folder structure:**
```
project.json      # Project manifest (view, layer refs)
vectors/          # Vector data (GeoJSON, CSV, Shapefile, etc.)
rasters/          # Raster data (GeoTIFF)
data/             # Non-spatial data (lookup tables, configs)
scripts/          # Custom JS scripts
startup.js        # Optional auto-run script on project open
```

---

### File System Commands (fs)

Shell-like commands for workspace file management. Requires workspace connection.

Available as `fs.*`, `ws.*`, or as global functions (except `ls` which lists layers globally).

| Command | Description |
|---------|-------------|
| `fs.ls(path?)` | List directory contents |
| `fs.cat(path)` | Print file contents |
| `fs.mkdir(path)` | Create directory |
| `fs.cp(src, dest)` | Copy file |
| `fs.mv(src, dest)` | Move/rename file |
| `fs.rm(path)` | Remove file or directory |
| `pwd()` | Print workspace name |

**Tab completion** works for paths inside these functions.

```javascript
fs.ls()                         // List workspace root
fs.ls("vectors")                // List vectors folder
fs.cat("project.json")          // View project config
fs.mkdir("output")              // Create output folder
fs.cp("data/a.json", "data/b.json")
fs.rm("temp/scratch.json")
```

---

### json()

Print full JSON of an object without truncation. Useful for inspecting GeoJSON.

```javascript
json(sample.geology)
json(geology.features[0])
json(geology.features[0].properties)
json(sample, 0)  // No indentation (compact)
```

---

### legend()

Open the Legend window. Shows styled layers with their colors and labels.

- For Rules-based styles: shows color swatches with labels
- For Graduated styles: shows color ramp with min/max values

The legend automatically updates when styles change.

---

## File Formats

**Drag & drop or use `open()`:**

| Extension | Format |
|-----------|--------|
| `.geojson`, `.json` | GeoJSON vector |
| `.csv`, `.tsv` | CSV with coordinates |
| `.xlsx`, `.xls` | Excel spreadsheet |
| `.zip` (shapefile) | Zipped shapefile |
| `.tif`, `.tiff` | GeoTIFF raster |

---

## Raster Layers

Drop a `.tif`/`.tiff` file onto the map to load, or generate sample data:

```javascript
sampleRaster()                    // Generate 200×200 4-band satellite imagery
sampleRaster({ name: "sat" })     // With custom name
cog("https://example.com/file.tif")  // Load Cloud-Optimized GeoTIFF
```

**Basic Methods:**
```javascript
raster.show()           // Show layer
raster.hide()           // Hide layer
raster.zoom()           // Zoom to extent
raster.opacity(0.5)     // Set opacity (0-1)
raster.remove()         // Remove from map
```

**Properties:**
```javascript
raster.width            // Width in pixels
raster.height           // Height in pixels
raster.extent           // Bounding box [minX, minY, maxX, maxY]
raster.minValue         // Minimum pixel value
raster.maxValue         // Maximum pixel value
```

---

### Band Compositing

For multi-band rasters (satellite imagery):

```javascript
raster.bands()          // Get current RGB mapping, e.g., [3, 2, 1]
raster.bands(4, 3, 2)   // Set NIR false-color composite
raster.bands(3, 2, 1)   // Natural color (Red, Green, Blue)
```

---

### Color Ramps & Stretch

For single-band visualization (DEMs, indices):

```javascript
raster.mode('singleband')     // Switch to single-band mode
raster.colorRamp('terrain')   // Set color ramp
raster.colorRamp()            // Get current ramp name

raster.stretch(0, 1000)       // Set min/max stretch
raster.stretch()              // Get { min, max }
```

**Available ramps:** `viridis`, `plasma`, `terrain`, `ndvi`, `blues`, `reds`, `spectral`

---

### WebGL Expressions

Apply band math expressions rendered via WebGL (real-time):

```javascript
raster.expression('(b4 - b3) / (b4 + b3)', {
  min: -1,
  max: 1,
  colorRamp: 'ndvi'
})

raster.expression(null)  // Clear expression
```

**Band references:** `b1`, `b2`, `b3`, `b4` (1-indexed)

---

### Raster Calculator (calc)

Create new raster layers from expressions:

```javascript
// NDVI calculation
calc('(a.b4 - a.b3) / (a.b4 + a.b3)',
  { a: ly.sat },
  { name: 'ndvi', colorRamp: 'ndvi', min: -1, max: 1 }
)

// Simple arithmetic
calc('a * 2', { a: ly.dem }, { name: 'doubled' })

// Threshold/mask
calc('a.b4 > 2000 ? 1 : 0', { a: ly.sat }, { name: 'veg_mask' })
```

**Expression syntax:**
- `a`, `b`, `c` — Input rasters (from second argument)
- `a.b1`, `a.b4` — Specific band from raster
- Operators: `+`, `-`, `*`, `/`, `>`, `<`, `>=`, `<=`, `==`, `!=`, `&&`, `||`, `? :`

---

### Algebra Shortcuts

Convenience functions for common operations:

```javascript
ndvi(raster)              // NDVI with default bands (NIR=4, Red=3)
ndvi(raster, 4, 3)        // NDVI with custom bands
ndvi(raster, 4, 3, { name: 'my_ndvi' })

threshold(raster, 1000)   // Binary mask where value > threshold
ratio(raster, 4, 3)       // Simple band ratio (b4 / b3)
```

---

### getValue

Query pixel values at coordinates:

```javascript
raster.getValue(lon, lat, band)  // Returns value or null if out of bounds

// Example
const nir = ly.sat.getValue(118.5, -21.2, 4)
```

---

## Spatial Queries

### within()

Find features within a boundary polygon.

```javascript
within(points, boundary)           // Points inside boundary
within(points, boundary, { save: "inside" })  // Save result as new layer
```

---

### contains()

Find features that contain other features.

```javascript
contains(polygons, point)          // Polygons containing the point
contains(polygons, points)         // Polygons containing any points
```

---

### selectByLocation()

Select features that intersect another layer.

```javascript
selectByLocation(layer, selector)  // Features intersecting selector
selectByLocation(geology, buffer_zone, { save: "selected" })
```

---

### disjoint()

Find features that don't intersect another layer.

```javascript
disjoint(layer, other)             // Features not touching other
```

---

### nearest()

Find the nearest feature to a point.

```javascript
nearest(layer, [lon, lat])         // Returns feature with _nearestDist property
nearest(drillholes, [118.5, -21.2], { save: "closest" })
```

---

## Geoprocessing

### simplify()

Simplify geometries using Douglas-Peucker algorithm.

```javascript
simplify(layer, 0.01)              // Tolerance in degrees
simplify(layer, 0.001, { save: "simplified" })
```

---

### convexHull()

Create convex hull polygon around features.

```javascript
convexHull(points)                 // Single hull around all points
convexHull(points, { combine: false })  // Hull for each feature
```

---

### envelope()

Create bounding box polygons.

```javascript
envelope(layer)                    // Single bbox for all features
envelope(layer, { each: true })    // Bbox for each feature
```

---

### difference()

Subtract one geometry from another.

```javascript
difference(layer, subtract)        // Remove overlap from layer
```

---

### calcArea()

Calculate area for polygon features. Adds `_area_m2`, `_area_ha`, `_area_km2` properties.

```javascript
calcArea(polygons)                 // Returns layer with area properties
calcArea(polygons, { save: "with_areas" })
```

---

### calcLength()

Calculate length for line features. Adds `_length_m`, `_length_km` properties.

```javascript
calcLength(lines)                  // Returns layer with length properties
```

---

### pointsAlongLine()

Generate points along line features.

```javascript
pointsAlongLine(lines, 100)        // Point every 100 meters
pointsAlongLine(lines, 1000, { save: "sample_points" })
```

---

## Export Functions

### downloadShapefile()

Download a vector layer as a zipped Shapefile. Uses pure JavaScript (shpwrite library) with GDAL fallback for complex cases.

```javascript
downloadShapefile(layer)           // Downloads as layer_name.shp.zip
downloadShapefile(layer, "export") // Downloads as export.shp.zip
```

---

### exportShapefile()

Convert GeoJSON to Shapefile blob (useful for programmatic export).

```javascript
const blob = await exportShapefile(geojson, "name")
// blob is a Blob containing the zipped shapefile
```

---

### downloadKml()

Download a vector layer as KML (Google Earth format).

```javascript
downloadKml(layer)                 // Downloads as layer_name.kml
downloadKml(layer, "export")       // Downloads as export.kml
```

---

### exportKml()

Convert GeoJSON to KML blob.

```javascript
const blob = exportKml(geojson, "name")
// blob is a Blob with MIME type application/vnd.google-earth.kml+xml
```

---

### geojsonToKml()

Convert GeoJSON to KML string (useful for custom processing).

```javascript
const kmlString = geojsonToKml(geojson, "DocumentName")
// Returns valid KML XML string
```

**Supported geometry types:** Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection

**Features:**
- Preserves feature properties as KML ExtendedData
- Escapes XML special characters
- Includes coordinates with altitude (defaults to 0)
