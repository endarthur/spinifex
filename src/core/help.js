// Spinifex - Help System
// Built-in documentation for the API

import { termPrint } from '../ui/terminal.js';

const docs = {
  ly: `ly - Layer namespace
  All layers are accessible via the ly object.
  Use dot notation for simple names, brackets for others.

  Access patterns:
    ly.geology                Simple names
    ly["stamen-terrain"]      Names with hyphens
    ly["My Layer"]            Names with spaces

  Examples:
    ly.geology.zoom()
    ly["dark"].hide()
    ly["stamen-terrain"].blendMode("multiply")

  Tab completion works: type ly. then Tab`,

  open: `open()
  Open file picker to load geospatial data.
  Supports: GeoJSON, CSV, XLSX, Shapefile (.zip), GeoTIFF

  Example:
    open()   // Opens system file picker

  Alternative: drag & drop files onto the map`,

  load: `load(data, name?)
  Load GeoJSON or sample data.

  Examples:
    load(sample)
    load(myGeojson, "parcels")`,

  rename: `rename(layer, newName) or layer.rename(newName)
  Rename a layer.

  Examples:
    ly.geology.rename("rocks")
    ly["old name"].rename("new name")
    rename(ly.geology, "rocks")  // Also works

  Or use context menu: right-click layer > Rename`,

  buffer: `buffer(layer, distance, opts?)
  Create buffer around features.
  Distance can be number (km) or string: "50m", "1km"

  Example:
    buffer(ly.geology, "500m")
    buffer(ly.drillholes, 2)  // 2 km`,

  where: `layer.where(predicate)
  Filter features using a function.
  Returns { count, features, save(name) }

  Examples:
    ly.geology.where(f => f.properties.age_ma > 2700)
    ly.drillholes.where(f => f.properties.fe_pct > 60).save("high_grade")`,

  style: `layer.style(options?)
  Set layer style or open style editor.

  Called without arguments: opens Style panel
    ly.geology.style()  // Opens properties window at Style tab

  Style Types:
    type: "rules"       Discrete colors by filter rules (default)
    type: "graduated"   Continuous color ramp

  Common Options:
    stroke      Stroke color (hex)
    width       Stroke width (px)
    opacity     Fill opacity (0-1)
    radius      Point radius (px)
    default     Fallback color

  Rules Style (type: "rules"):
    rules       Array of { filter, fill }
                First matching filter wins
                Filter uses r.field or r["field"] syntax

    Example rules:
      { filter: "r.unit == 'BIF'", fill: "#e41a1c" }
      { filter: "r['Au (ppm)'] > 1", fill: "#ffd700" }
      { filter: "", fill: "#888888" }  // Default (no filter)

  Graduated Style (type: "graduated"):
    field       Numeric field for color ramp
    expression  Custom JS expression returning 0-1 (uses r.field)
    transform   Value transformation: linear, log, sqrt, square
    scale       Color scale: viridis, plasma, blues, reds, spectral
    min, max    Value range (auto-calculated if omitted)

  Label options:
    labelField         Field name or template expression
                       Simple: "unit"
                       Template: "\${r.unit} (\${r.age_ma} Ma)"
    labelColor         Text color (default: white)
    labelOutline       Outline color (default: black)
    labelOutlineWidth  Outline width (default: 3)
    labelSize          Font size (default: 12)

  Examples:
    ly.geology.style()  // Open style editor
    ly.geology.style({ type: "rules", rules: [
      { filter: "r.unit == 'BIF'", fill: "#e41a1c" },
      { filter: "", fill: "#888888" }
    ]})
    ly.samples.style({
      type: "graduated",
      field: "grade",
      scale: "viridis",
      transform: "log"
    })`,

  properties: `layer.properties(tab?)
  Open layer properties window.

  Tabs: "info", "fields", "style", "labels"

  Examples:
    ly.geology.properties()          // Opens Info tab
    ly.geology.properties("style")   // Opens Style tab
    ly.geology.properties("fields")  // Opens Fields tab`,

  table: `layer.table()
  Open attribute table window for the layer.

  Features:
    - Virtual scrolling (handles large datasets)
    - Click column headers to sort
    - Filter box for text search
    - Expression filter: prefix with = for JS expressions
      Example: =r.age_ma > 2700
    - Click row to highlight on map
    - Double-click row to zoom to feature
    - Right-click cell for context menu (Edit in terminal, Copy)
    - Bulk Edit button (when using expression filter)
    - Refresh button to re-apply styles after edits

  Examples:
    ly.geology.table()
    ly.drillholes.table()`,

  refresh: `layer.refresh()
  Refresh layer display by re-applying current styling.
  Useful after programmatically editing feature properties.

  Examples:
    // After editing features
    ly.geology.features[0].properties.unit = "BIF"
    ly.geology.refresh()

    // Or in a bulk edit
    ly.geology.features.forEach(f => {
      if (f.properties.age_ma > 2700) f.properties.era = "Archean"
    })
    ly.geology.refresh()`,

  stats: `layer.stats(field)
  Get statistics for a numeric field.
  Returns: { min, max, mean, median, sum, count }

  Example:
    ly.drillholes.stats("fe_pct")`,

  zIndex: `layer.zIndex(value?)
  Get or set layer render order. Higher = on top.
  Layers can also be reordered by dragging in the panel.

  Methods:
    layer.zIndex()          Get current z-index
    layer.zIndex(10)        Set z-index to 10
    layer.bringToFront()    Move to top of stack
    layer.sendToBack()      Move to bottom of stack

  Examples:
    ly.geology.zIndex(5)
    ly.drillholes.bringToFront()`,

  blendMode: `layer.blendMode(mode?)
  Get or set layer blend mode (compositing).
  Uses Canvas 2D globalCompositeOperation.

  Available modes:
    source-over   Normal (default)
    multiply      Darken by multiplying colors
    screen        Lighten by inverting multiply
    overlay       Multiply/screen based on base
    darken        Keep darker of two colors
    lighten       Keep lighter of two colors
    color-dodge   Brighten to reflect blend
    color-burn    Darken to reflect blend
    hard-light    Multiply or screen based on blend
    soft-light    Softer version of hard-light
    difference    Subtract colors
    exclusion     Like difference but lower contrast
    hue           Use hue of blend color
    saturation    Use saturation of blend color
    color         Use hue and saturation of blend
    luminosity    Use luminosity of blend color

  Examples:
    ly.geology.blendMode("multiply")
    ly.satellite.blendMode("soft-light")
    ly.dark.blendMode()  // Returns current mode`,

  intersect: `intersect(layer1, layer2, opts?)
  Find intersection of two layers.

  Example:
    intersect(ly.geology, ly.buffer_zone)`,

  union: `union(layer1, layer2, opts?)
  Combine two layers into one.

  Example:
    union(ly.zone_a, ly.zone_b)`,

  centroid: `centroid(layer, opts?)
  Get centroid points from polygons.

  Example:
    centroid(ly.geology)`,

  clip: `clip(layer, mask, opts?)
  Clip layer features to mask boundary.

  Example:
    clip(ly.drillholes, ly.study_area)`,

  dissolve: `dissolve(layer, field, opts?)
  Merge features by attribute value.

  Example:
    dissolve(ly.geology, "unit")`,

  voronoi: `voronoi(points, opts?)
  Create Voronoi polygons from points.

  Example:
    voronoi(ly.drillholes)`,

  measure: `measure.distance() / measure.area() / measure.bearing()
  Interactive measurement tools.

  Examples:
    measure.distance()  // Click points, double-click to finish
    measure.area()      // Click 3+ points for polygon
    measure.bearing()   // Click two points for bearing
    measure.stop()      // Cancel measurement`,

  distance: `distance(point1, point2)
  Calculate distance between two points.
  Returns: { meters, kilometers, formatted }

  Example:
    distance([118.5, -21.2], [118.6, -21.3])
    distance(ly.drillholes.features[0], ly.drillholes.features[1])`,

  area: `area(polygon)
  Calculate area of polygon(s).
  Returns: { sqMeters, hectares, sqKilometers, formatted }

  Example:
    area(ly.geology)
    area(ly.geology.features[0])`,

  bearing: `bearing(point1, point2)
  Calculate bearing from point1 to point2.
  Returns: { degrees, formatted }

  Example:
    bearing([118.5, -21.2], [118.6, -21.3])`,

  workspace: `ws (or sp.workspace) - Project persistence

  One folder = one project. The folder you pick IS the project.

  ws.new()            Clear & start fresh project in new folder
  ws.connect()        Open existing project folder
  ws.connectTo(name)  Connect to workspace by name (from history)
  ws.save()           Save layers & view to project folder
  ws.reconnect()      Reconnect to last used folder
  ws.recent()         Open Recent Workspaces window
  ws.export()         Download project as .spinifex file

  Or use: workspaces()  Open Recent Workspaces window

  Recent Workspaces window:
    - Shows last 10 workspaces you've connected to
    - Double-click to connect (usually instant, may prompt for permission)
    - Remove from history with × button
    - "Connect New..." button to pick a new folder

  Project folder structure:
    project.json      Project manifest (view, layer refs)
    vectors/          Vector data (GeoJSON, CSV, Shapefile, etc.)
    rasters/          Raster data (GeoTIFF)
    data/             Non-spatial data (lookup tables, configs)
    scripts/          Custom JS scripts
    startup.js        Optional auto-run script on project open

  Files are stored in their original format - no conversion needed.`,

  raster: `Raster Layers (GeoTIFF, SRTM)

  All rasters use WebGL rendering (GPU-accelerated).
  Drop a .tif/.tiff file onto the map to load.

  Raster layer methods:
    raster.show()           Show layer
    raster.hide()           Hide layer
    raster.zoom()           Zoom to extent
    raster.opacity(0.5)     Set opacity (0-1)
    raster.rename("name")   Rename layer
    raster.remove()         Remove from map

  Styling methods:
    raster.mode("mode")      Set render mode
    raster.colorRamp("name") Set color ramp (single-band)
    raster.stretch(min, max) Adjust value range
    raster.bands(r, g, b)    Set RGB band mapping
    raster.expression(expr)  Apply WebGL expression

  Expressions (GPU-accelerated):
    raster.expression("(b4 - b3) / (b4 + b3)")  // NDVI
    raster.expression("b1 > 100 ? 1 : 0")      // Threshold
    raster.expression(null)                     // Clear expression

  See help("algebra") for full expression syntax.

  Render modes:
    "singleband"   Single band with color ramp
    "rgb"          RGB composite (3+ bands)
    "grayscale"    Single band black-to-white

  Color ramps (for singleband mode):
    "terrain"      Green-tan-brown-white (elevation)
    "grayscale"    Black to white
    "viridis"      Purple-blue-green-yellow
    "plasma"       Purple-red-orange-yellow
    "inferno"      Black-purple-red-yellow
    "spectral"     Rainbow (diverging)
    "bluered"      Blue-white-red (diverging)
    "bathymetry"   Deep blue to brown
    "ndvi"         Red-yellow-green (vegetation)

  Data access:
    raster.getValue(lon, lat)      Get value at point
    raster.getValue(lon, lat, 2)   Get band 2 value
    raster.getElevation(lon, lat)  Alias for band 1

  Raster properties:
    raster.width            Width in pixels
    raster.height           Height in pixels
    raster.bands            Number of bands
    raster.extent           Bounding box [minX, minY, maxX, maxY]
    raster.minValue         Minimum value
    raster.maxValue         Maximum value

  Examples:
    ly.dem.colorRamp("viridis")
    ly.dem.stretch(0, 500)
    ly.satellite.mode("rgb")
    ly.landsat.bands(4, 3, 2)    // NIR false-color
    ly.landsat.bands(5, 4, 3)    // SWIR composite
    elev = ly.dem.getElevation(151.2, -33.9)`,

  srtm: `srtm(target?, name?)
  Download SRTM elevation data from AWS Terrain Tiles.
  Data: 30m resolution, coverage -60° to 60° latitude.
  Source: NASA SRTM via AWS (public, no auth required)

  Usage:
    srtm()                            Current map extent
    srtm([south, west, north, east])  Bounding box
    srtm(ly.myLayer)                  Layer extent
    srtm([-33.5, 150, -33, 151])      Sydney area

  Returns a standard WebGL raster layer with terrain color ramp.
  See help("raster") for all raster methods.

  Quick examples:
    dem = srtm([-33.9, 151.1, -33.8, 151.3])
    dem.colorRamp("viridis")
    dem.stretch(0, 500)  // Emphasize 0-500m range
    elev = dem.getElevation(151.2, -33.9)

  Note: Large areas require multiple tiles (~3MB each).`,

  sampleRaster: `sampleRaster(options?)
  Generate synthetic multi-band satellite imagery for testing.
  Creates a 200x200 pixel, 4-band raster simulating real satellite data.

  Bands:
    1 = Blue
    2 = Green
    3 = Red
    4 = NIR (Near-Infrared)

  Features simulated:
    - Vegetation (high NIR, low Red - for NDVI testing)
    - Water bodies (low NIR, moderate Blue)
    - Bare ground (brownish, moderate reflectance)
    - Urban areas (high reflectance, low NIR)

  Options:
    width     Raster width (default 200)
    height    Raster height (default 200)
    name      Layer name (default "sample_satellite")
    extent    [west, south, east, north] in WGS84

  Examples:
    sat = sampleRaster()
    sat.bands(4, 3, 2)                    // NIR false-color
    sat.expression("(b4 - b3) / (b4 + b3)")  // NDVI display
    ndvi(sat)                              // Calculate NDVI

  Use this for testing raster algebra without downloading real data.`,

  cog: `cog(url, name?, options?)
  Load a Cloud Optimized GeoTIFF (COG) from a URL.
  Uses HTTP range requests for efficient streaming.

  Usage:
    cog("https://example.com/raster.tif")
    cog("https://example.com/raster.tif", "mydem")
    cog(url, "name", { colorRamp: "viridis" })

  COG features:
    - Streams data using range requests (no full download)
    - Automatically uses overviews for large rasters
    - Returns a standard WebGL raster layer

  Options:
    colorRamp   Initial color ramp for single-band
    mode        Render mode: "singleband", "rgb", "grayscale"

  Example with public COG:
    cog("https://opentopography.s3.sdsc.edu/dem/SRTM90/n00e100_dem.tif")

  See help("raster") for all raster layer methods.`,

  calc: `calc(expression, inputs, options?)
  Full raster calculator - creates new datasets from expressions.
  Uses JavaScript for pixel-by-pixel calculation.

  Expressions:
    "a"                     Single input
    "a + b"                 Add two rasters
    "a.b4 - a.b3"           Band math (b1, b2, etc)
    "(a.b4 - a.b3) / (a.b4 + a.b3)"   Normalized difference
    "a > 100 ? 1 : 0"       Threshold/classify
    "sqrt(a)"               Math functions

  Functions:
    abs, floor, ceil, round, sin, cos, tan, sqrt, pow, exp,
    log, log10, min, max, clamp, asin, acos, atan

  Examples:
    // NDVI from multi-band raster
    calc("(a.b4 - a.b3) / (a.b4 + a.b3)", {a: landsat}, {
      name: "ndvi",
      colorRamp: "ndvi",
      min: -1, max: 1
    })

    // Difference between two DEMs
    calc("a - b", {a: dem2020, b: dem2010}, {name: "elevation_change"})

    // Classify elevation
    calc("a > 500 ? 1 : 0", {a: dem}, {name: "highlands"})

  See also: ndvi(), ndwi(), difference(), ratio(), threshold()`,

  algebra: `Raster Algebra - Expression-based raster calculations

  Two approaches available:

  1. WebGL Expressions (display-time, GPU)
     raster.expression("(b4 - b3) / (b4 + b3)")
     - Fast GPU rendering
     - No new data created
     - For visualization only
     - Updates instantly

  2. Raster Calculator (creates new dataset)
     calc("(a.b4 - a.b3) / (a.b4 + a.b3)", {a: landsat})
     - Creates new layer with computed values
     - Can combine multiple rasters
     - Saves to workspace as COG

  Shortcuts:
    ndvi(layer, nirBand?, redBand?)     NDVI (default bands 4, 3)
    ndwi(layer, greenBand?, nirBand?)   NDWI (default bands 2, 4)
    difference(layer1, layer2)          Raster difference
    ratio(layer, band1, band2)          Band ratio
    threshold(layer, value)             Binary threshold

  Expression syntax:
    b1, b2, b3...         Band references
    a, b, c...            Input rasters (for calc)
    a.b4                  Band 4 of input 'a'
    + - * / ^ %           Arithmetic
    > < >= <= == !=       Comparison
    condition ? a : b     Ternary/conditional
    sqrt() abs() etc      Functions

  Examples:
    ly.landsat.expression("(b4 - b3) / (b4 + b3)", {min: -1, max: 1, colorRamp: "ndvi"})
    ndvi(ly.landsat)
    ndvi(ly.landsat, 5, 4)  // Custom bands
    difference(ly.dem2020, ly.dem2010)
    threshold(ly.dem, 1000)  // Areas above 1000m`,

  gdal: `gdal - GDAL WebAssembly Operations
  Full GDAL compiled to WebAssembly for browser-side processing.
  First use downloads ~10MB WASM bundle (cached after).

  COG Export:
    gdal.toCOG(layer)                 Create COG blob
    gdal.toCOG(layer, {compress: "JPEG", quality: 85})
    gdal.downloadCOG(layer)           Download as COG
    gdal.downloadCOG(layer, "dem.cog.tif")

  GeoTIFF Export:
    gdal.toGeoTiff(layer)             Create GeoTIFF blob
    gdal.toGeoTiff(layer, {compress: "LZW", tiled: true})

  Reprojection:
    gdal.reproject(layer, "EPSG:32755")
    gdal.reproject(layer, "EPSG:32755", {resampling: "cubic"})

  Info:
    gdal.info(file)                   Get GDAL metadata
    gdal.load()                       Pre-load GDAL (optional)

  COG Options:
    compress    "DEFLATE" (default), "LZW", "JPEG", "WEBP", "NONE"
    blockSize   512 (default), 256, 1024
    overviews   true (default) or false
    resampling  "AVERAGE" (default), "NEAREST", "BILINEAR", "CUBIC"
    quality     1-100 (for JPEG/WEBP)

  Examples:
    dem = srtm([-33.9, 151.1, -33.8, 151.3])
    gdal.downloadCOG(dem)
    gdal.downloadCOG(dem, "sydney.cog.tif", {compress: "LZW"})

    // Reproject to UTM
    dem_utm = gdal.reproject(dem, "EPSG:32756")`,

  json: `json(object, indent?)
  Print full JSON of an object without truncation.
  Useful for inspecting GeoJSON or complex objects.

  Examples:
    json(sample.geology)
    json(sample.geology.features[0])
    json(geology.features[0].properties)
    json(sample, 0)  // No indentation (compact)`,

  legend: `legend()
  Open the Legend window.
  Shows styled layers with their colors and labels.

  For Rules-based styles: shows color swatches with labels
  For Graduated styles: shows color ramp with min/max values

  The legend automatically updates when styles change.
  Labels in the Style panel appear in the legend.`,

  fs: `fs - File System Commands

  Shell-like commands for workspace file management.
  Requires workspace connection (ws.connect() first).

  Commands (available as fs.*, ws.*, or globals):
    ls(path?)           List directory contents
    cat(path)           Print file contents
    mkdir(path)         Create directory
    cp(src, dest)       Copy file
    mv(src, dest)       Move/rename file
    rm(path)            Remove file or directory
    pwd()               Print workspace name

  Tab completion works for paths inside these functions.

  Examples:
    ls()                    // List workspace root
    ls("vectors")           // List vectors folder
    cat("project.json")     // View project config
    mkdir("output")         // Create output folder
    cp("data/a.json", "data/b.json")
    rm("temp/scratch.json")

  Also available as fs.ls(), ws.ls(), etc.`,

  versioning: `v (or sp.versioning) - Lightweight git-like versioning

  Save snapshots of your project state and restore them later.
  All versions stored in .versions/ folder in workspace.

  Core Commands:
    v.save("message")           Create version (lightweight)
    v.save("msg", {full:true})  Create full snapshot
    v.snapshot("message")       Alias for full snapshot
    v.list()                    List all versions
    v.show(id)                  Show version details
    v.restore(id)               Restore to version
    v.remove(id)                Delete a version
    v.diff(id1, id2)            Compare two versions

  Two Storage Modes:
    Lightweight (default):
      - Vector data compressed inline
      - Rasters stored as references to source files
      - Fast, minimal disk space
      - Requires original source files

    Full Snapshot (full: true):
      - All data stored in version folder
      - Rasters exported as COG
      - Self-contained, portable
      - Larger disk footprint

  Examples:
    v.save("Initial load")
    v.save("After buffer analysis")
    v.list()
    v.show(2)
    v.restore(1)
    v.diff(1, 2)
    v.save("Pre-export archive", {full: true})

  Storage Structure:
    .versions/
    ├── manifest.json
    ├── v001/
    │   ├── version.json
    │   ├── geology.geojson.gz
    │   └── ...
    └── v002/
        └── ...

  Legend:
    ● Full snapshot (self-contained)
    ○ Lightweight (references)

  Requires workspace connection (ws.connect() first).`,

  basemap: `basemap(name, attribution?)
  Add a basemap layer. Multiple basemaps can be stacked.

  Built-in basemaps (free with attribution):
    CartoDB:        "dark", "light", "voyager"
    OpenStreetMap:  "osm", "topo"
    Stamen/Stadia:  "stamen-toner", "stamen-toner-lite",
                    "stamen-terrain", "stamen-watercolor"
    ESRI:           "satellite", "esri-topo", "esri-street"

  Custom basemap (any XYZ tile URL):
    basemap("https://tiles.example.com/{z}/{x}/{y}.png", "© Attribution")

  Examples:
    basemap("dark")              // Add dark basemap
    basemap("satellite")         // Add satellite (under dark)
    basemap("stamen-watercolor") // Add watercolor

  Basemap layer methods:
    dark.opacity(0.5)     Set opacity (0-1)
    dark.hide()           Hide basemap
    dark.show()           Show basemap
    dark.rename("name")   Rename basemap
    dark.remove()         Remove basemap

  basemap("none") / basemaps.clear() - Remove all basemaps

  Basemaps appear in the Layers panel with opacity sliders.

  Licensing note:
    Built-in basemaps are free for most uses with attribution.
    ESRI basemaps are widely used but technically require an
    ArcGIS account for commercial use.

    For custom URLs, ensure you comply with the provider's
    terms of service. Some providers (Google, Bing, Mapbox)
    require API keys and have commercial use restrictions.

  Also available from Layer > Basemap menu.`,

  // Spatial Queries
  within: `within(layer, boundary, opts?)
  Find features within a boundary polygon.

  Examples:
    within(points, boundary)
    within(points, boundary, { save: "inside" })`,

  contains: `contains(layer, points, opts?)
  Find features that contain other features.

  Examples:
    contains(polygons, point)
    contains(polygons, points)`,

  selectByLocation: `selectByLocation(layer, selector, opts?)
  Select features that intersect another layer.

  Examples:
    selectByLocation(layer, selector)
    selectByLocation(geology, buffer_zone, { save: "selected" })`,

  disjoint: `disjoint(layer, other, opts?)
  Find features that don't intersect another layer.

  Example:
    disjoint(layer, other)`,

  nearest: `nearest(layer, point, opts?)
  Find the nearest feature to a point.
  Returns feature with _nearestDist and _nearestProps properties.

  Examples:
    nearest(layer, [lon, lat])
    nearest(drillholes, [118.5, -21.2], { save: "closest" })`,

  // Geoprocessing
  simplify: `simplify(layer, tolerance, opts?)
  Simplify geometries using Douglas-Peucker algorithm.

  Examples:
    simplify(layer, 0.01)
    simplify(layer, 0.001, { save: "simplified" })`,

  convexHull: `convexHull(layer, opts?)
  Create convex hull polygon around features.

  Examples:
    convexHull(points)
    convexHull(points, { combine: false })  // Hull for each feature`,

  envelope: `envelope(layer, opts?)
  Create bounding box polygons.

  Examples:
    envelope(layer)
    envelope(layer, { each: true })  // Bbox for each feature`,

  difference: `difference(layer, subtract, opts?)
  Subtract one geometry from another.

  Example:
    difference(layer, subtract)`,

  calcArea: `calcArea(layer, opts?)
  Calculate area for polygon features.
  Adds _area_m2, _area_ha, _area_km2 properties.

  Examples:
    calcArea(polygons)
    calcArea(polygons, { save: "with_areas" })`,

  calcLength: `calcLength(layer, opts?)
  Calculate length for line features.
  Adds _length_m, _length_km properties.

  Example:
    calcLength(lines)`,

  pointsAlongLine: `pointsAlongLine(layer, distance, opts?)
  Generate points along line features.

  Examples:
    pointsAlongLine(lines, 100)        // Point every 100 meters
    pointsAlongLine(lines, 1000, { save: "sample_points" })`,

  // Export
  downloadShapefile: `downloadShapefile(layer, filename?)
  Download vector layer as zipped Shapefile.
  Uses pure JS (shpwrite) with GDAL fallback.

  Examples:
    downloadShapefile(layer)           // layer_name.shp.zip
    downloadShapefile(layer, "export") // export.shp.zip`,

  exportShapefile: `exportShapefile(geojson, name?)
  Convert GeoJSON to Shapefile blob.

  Example:
    const blob = await exportShapefile(geojson, "name")`,

  downloadKml: `downloadKml(layer, filename?)
  Download vector layer as KML (Google Earth format).

  Examples:
    downloadKml(layer)
    downloadKml(layer, "export")`,

  exportKml: `exportKml(geojson, name?)
  Convert GeoJSON to KML blob.

  Example:
    const blob = exportKml(geojson, "name")`,

  geojsonToKml: `geojsonToKml(geojson, name?)
  Convert GeoJSON to KML string.

  Example:
    const kmlString = geojsonToKml(geojson, "DocumentName")

  Supports: Point, LineString, Polygon, Multi* geometries
  Preserves properties as KML ExtendedData`,

  // ─────────────────────────────────────────────────────────────────────────
  // Color Ramps
  // ─────────────────────────────────────────────────────────────────────────

  ramps: `sp.ramps - Custom Color Ramp Functions
  Create, manage, and use color ramps for visualization.

  Functions:
    sp.ramps.add(name, colors)       Add custom ramp
    sp.ramps.remove(name)            Remove custom ramp
    sp.ramps.get(name)               Get ramp by name
    sp.ramps.list()                  List all ramps
    sp.ramps.create(colors, stops?)  Create ramp object
    sp.ramps.reverse(name)           Create reversed ramp
    sp.ramps.interpolate(ramp, t)    Get color at position (0-1)
    sp.ramps.palette(name, n)        Generate n RGB colors
    sp.ramps.paletteHex(name, n)     Generate n hex colors

  Built-in ramps:
    terrain, viridis, plasma, inferno, magma, grayscale,
    bluered, bathymetry, ndvi, hot, cool, spectral

  Examples:
    // Create custom ramp
    addColorRamp("myRamp", ["#ff0000", "#ffffff", "#0000ff"])

    // With custom stop positions
    addColorRamp("asymmetric", ["#ff0000", "#fff", "#00f"], [0, 0.3, 1])

    // Reverse existing ramp
    sp.ramps.reverse("viridis")  // Creates viridis_r

    // Get palette for legends
    sp.ramps.paletteHex("plasma", 5)  // 5 hex colors`,

  addColorRamp: `addColorRamp(name, colors, stops?)
  Add a custom color ramp.

  Parameters:
    name     Unique name (alphanumeric + underscore)
    colors   Array of colors (hex, rgb, or named)
    stops    Optional array of positions (0-1)

  Colors can be:
    "#ff0000"           Hex (6-digit)
    "#f00"              Hex (3-digit)
    "rgb(255, 0, 0)"    RGB string
    "red"               Named color
    [255, 0, 0]         RGB array

  Examples:
    addColorRamp("fire", ["#000", "#f00", "#ff0", "#fff"])
    addColorRamp("custom", ["blue", "white", "red"], [0, 0.5, 1])
    addColorRamp("geo", [[139,90,43], [34,139,34], [255,255,255]])`,

  createRamp: `createRamp(colors, stops?)
  Create a color ramp object (without registering it).

  Parameters:
    colors   Array of 2+ colors
    stops    Optional positions (0-1), defaults to even spacing

  Returns: { stops: [...], colors: [[r,g,b], ...] }

  Examples:
    const ramp = createRamp(["#000", "#fff"])
    // { stops: [0, 1], colors: [[0,0,0], [255,255,255]] }

    const ramp = createRamp(["#f00", "#fff", "#00f"], [0, 0.3, 1])
    // Asymmetric stops`,

  listColorRamps: `listColorRamps(customOnly?)
  List available color ramp names.

  Parameters:
    customOnly   If true, only return user-created ramps

  Examples:
    listColorRamps()       // All ramps
    listColorRamps(true)   // Only custom ramps`,

  colorScales: `sp.ramps.scales - Color Scale Generators
  Create common scientific color scales.

  sp.ramps.scales.sequential(hue, light?)
    Single-hue gradient from white to color.
    hue: Base color (hex or named)
    light: If true (default), white to color; if false, color to white

  sp.ramps.scales.diverging(low, high, mid?)
    Two-hue gradient with neutral center.
    low: Color for low values
    high: Color for high values
    mid: Center color (default white)

  sp.ramps.scales.categorical(n?)
    Maximally distinct colors for categories.
    n: Number of colors (default 8)

  Examples:
    sp.ramps.scales.sequential("#0066cc")
    sp.ramps.scales.diverging("#ff0000", "#0000ff")
    sp.ramps.scales.categorical(6)`
};

export function help(fn) {
  if (fn === undefined) {
    termPrint('');
    termPrint('='.repeat(42), 'blue');
    termPrint('         SPINIFEX API', 'blue');
    termPrint('='.repeat(42), 'blue');
    termPrint('');
    termPrint('Loading & Management', 'yellow');
    termPrint('  open()                    Open file picker');
    termPrint('  load(sample)              Load sample data');
    termPrint('  load(geojson, "name")     Load GeoJSON');
    termPrint('  layers() / ls()           List all layers');
    termPrint('  clear()                   Remove all layers');
    termPrint('  rename(layer, "name")     Rename a layer');
    termPrint('  basemap("dark")           Add basemap');
    termPrint('');
    termPrint('Layer Access (ly namespace)', 'yellow');
    termPrint('  ly.geology                Simple names');
    termPrint('  ly["stamen-terrain"]      Hyphenated names');
    termPrint('  ly["My Layer"]            Names with spaces');
    termPrint('  help("ly")                More info');
    termPrint('');
    termPrint('Layer Methods', 'yellow');
    termPrint('  layer.show()              Show layer');
    termPrint('  layer.hide()              Hide layer');
    termPrint('  layer.zoom()              Zoom to extent');
    termPrint('  layer.remove()            Remove layer');
    termPrint('  layer.rename("name")      Rename layer');
    termPrint('  layer.style()             Open style editor');
    termPrint('  layer.style({...})        Set style via code');
    termPrint('  layer.properties()        Open properties window');
    termPrint('  layer.table()             Open attribute table');
    termPrint('  layer.refresh()           Re-apply styling');
    termPrint('  layer.where(fn)           Filter features');
    termPrint('  layer.stats("field")      Field statistics');
    termPrint('  layer.zIndex(n)           Set render order');
    termPrint('  layer.bringToFront()      Move to top');
    termPrint('  layer.sendToBack()        Move to bottom');
    termPrint('  layer.blendMode(mode)     Set blend mode');
    termPrint('');
    termPrint('Layer Properties', 'yellow');
    termPrint('  layer.count               Feature count');
    termPrint('  layer.fields              Field names');
    termPrint('  layer.features            GeoJSON features');
    termPrint('  layer.extent              Bounding box');
    termPrint('  layer.geomType            Geometry type');
    termPrint('');
    termPrint('Spatial Operations', 'yellow');
    termPrint('  buffer(layer, "50m")      Buffer features');
    termPrint('  intersect(a, b)           Intersect layers');
    termPrint('  union(a, b)               Union layers');
    termPrint('  centroid(layer)           Get centroids');
    termPrint('  clip(layer, mask)         Clip to boundary');
    termPrint('  dissolve(layer, field)    Merge by attribute');
    termPrint('  voronoi(points)           Voronoi polygons');
    termPrint('');
    termPrint('Data Sources', 'yellow');
    termPrint('  srtm()                    Download SRTM elevation');
    termPrint('  srtm([s,w,n,e])           SRTM for bounding box');
    termPrint('  cog(url)                  Load COG from URL');
    termPrint('  sampleRaster()            Generate test satellite data');
    termPrint('');
    termPrint('GDAL Operations', 'yellow');
    termPrint('  gdal.downloadCOG(layer)   Export as COG');
    termPrint('  gdal.toGeoTiff(layer)     Export as GeoTIFF');
    termPrint('  gdal.reproject(layer,crs) Reproject raster');
    termPrint('');
    termPrint('Raster Algebra', 'yellow');
    termPrint('  raster.expression(expr)   WebGL expression (GPU)');
    termPrint('  calc(expr, inputs)        Raster calculator');
    termPrint('  ndvi(layer)               NDVI shortcut');
    termPrint('  ndwi(layer)               NDWI shortcut');
    termPrint('  difference(a, b)          Raster difference');
    termPrint('  ratio(layer, b1, b2)      Band ratio');
    termPrint('  threshold(layer, val)     Binary threshold');
    termPrint('  help("algebra")           Full algebra docs');
    termPrint('');
    termPrint('Measurement', 'yellow');
    termPrint('  measure.distance()        Interactive distance');
    termPrint('  measure.area()            Interactive area');
    termPrint('  measure.bearing()         Interactive bearing');
    termPrint('  distance(p1, p2)          Quick distance calc');
    termPrint('  area(polygon)             Quick area calc');
    termPrint('');
    termPrint('Workspace (ws = sp.workspace)', 'yellow');
    termPrint('  ws.new()                  New project in folder');
    termPrint('  ws.connect()              Open existing project');
    termPrint('  ws.save()                 Save to project folder');
    termPrint('  ws.recent() / workspaces()  Recent Workspaces window');
    termPrint('');
    termPrint('File System (fs or ws)', 'yellow');
    termPrint('  ls(path?)                 List directory');
    termPrint('  cat(path)                 Print file contents');
    termPrint('  mkdir(path)               Create directory');
    termPrint('  cp(src, dest)             Copy file');
    termPrint('  mv(src, dest)             Move/rename file');
    termPrint('  rm(path)                  Remove file/directory');
    termPrint('');
    termPrint('Versioning (v = sp.versioning)', 'yellow');
    termPrint('  v.save("message")         Save version snapshot');
    termPrint('  v.list()                  List all versions');
    termPrint('  v.show(id)                Show version details');
    termPrint('  v.restore(id)             Restore to version');
    termPrint('  v.diff(id1, id2)          Compare two versions');
    termPrint('  help("versioning")        Full versioning docs');
    termPrint('');
    termPrint('Export & Inspect', 'yellow');
    termPrint('  download(layer, "file")   Download GeoJSON');
    termPrint('  json(object)              Print full JSON (no truncation)');
    termPrint('');
    termPrint('File Formats (drag & drop)', 'yellow');
    termPrint('  .geojson, .json           GeoJSON vector');
    termPrint('  .csv, .tsv                CSV with coordinates');
    termPrint('  .xlsx, .xls               Excel spreadsheet');
    termPrint('  .zip (shapefile)          Zipped shapefile');
    termPrint('  .tif, .tiff               GeoTIFF raster');
    termPrint('');
    termPrint('Terminal Shortcuts', 'yellow');
    termPrint('  Tab                       Autocomplete');
    termPrint('  Tab Tab                   Cycle through matches');
    termPrint('  Up/Down                   Command history');
    termPrint('  Ctrl+C                    Cancel / Copy selection');
    termPrint('  Ctrl+V                    Paste');
    termPrint('');
    termPrint('Click features on map to inspect.', 'dim');
    termPrint('');
    return;
  }

  const name = typeof fn === 'function' ? fn.name : String(fn);
  if (docs[name]) {
    termPrint('');
    termPrint(docs[name], 'cyan');
    termPrint('');
  } else {
    termPrint(`No help for: ${name}`, 'yellow');
  }
}
