// Spinifex - Help System
// Built-in documentation for the API

import { termPrint } from '../ui/terminal.js';

const docs = {
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

  buffer: `buffer(layer, distance, opts?)
  Create buffer around features.
  Distance can be number (km) or string: "50m", "1km"

  Example:
    buffer(geology, "500m")
    buffer(drillholes, 2)  // 2 km`,

  where: `layer.where(predicate)
  Filter features using a function.
  Returns { count, features, save(name) }

  Examples:
    geology.where(f => f.properties.age_ma > 2700)
    drillholes.where(f => f.properties.fe_pct > 60).save("high_grade")`,

  style: `layer.style(options?)
  Set layer style or open style editor.

  Called without arguments: opens Style panel
    geology.style()  // Opens properties window at Style tab

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
    geology.style()  // Open style editor
    geology.style({ type: "rules", rules: [
      { filter: "r.unit == 'BIF'", fill: "#e41a1c" },
      { filter: "", fill: "#888888" }
    ]})
    samples.style({
      type: "graduated",
      field: "grade",
      scale: "viridis",
      transform: "log"
    })`,

  properties: `layer.properties(tab?)
  Open layer properties window.

  Tabs: "info", "fields", "style", "labels"

  Examples:
    geology.properties()          // Opens Info tab
    geology.properties("style")   // Opens Style tab
    geology.properties("fields")  // Opens Fields tab`,

  stats: `layer.stats(field)
  Get statistics for a numeric field.
  Returns: { min, max, mean, median, sum, count }

  Example:
    drillholes.stats("fe_pct")`,

  zIndex: `layer.zIndex(value?)
  Get or set layer render order. Higher = on top.
  Layers can also be reordered by dragging in the panel.

  Methods:
    layer.zIndex()          Get current z-index
    layer.zIndex(10)        Set z-index to 10
    layer.bringToFront()    Move to top of stack
    layer.sendToBack()      Move to bottom of stack

  Examples:
    geology.zIndex(5)
    drillholes.bringToFront()`,

  intersect: `intersect(layer1, layer2, opts?)
  Find intersection of two layers.

  Example:
    intersect(geology, buffer_zone)`,

  union: `union(layer1, layer2, opts?)
  Combine two layers into one.

  Example:
    union(zone_a, zone_b)`,

  centroid: `centroid(layer, opts?)
  Get centroid points from polygons.

  Example:
    centroid(geology)`,

  clip: `clip(layer, mask, opts?)
  Clip layer features to mask boundary.

  Example:
    clip(drillholes, study_area)`,

  dissolve: `dissolve(layer, field, opts?)
  Merge features by attribute value.

  Example:
    dissolve(geology, "unit")`,

  voronoi: `voronoi(points, opts?)
  Create Voronoi polygons from points.

  Example:
    voronoi(drillholes)`,

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
    distance(drillholes.features[0], drillholes.features[1])`,

  area: `area(polygon)
  Calculate area of polygon(s).
  Returns: { sqMeters, hectares, sqKilometers, formatted }

  Example:
    area(geology)
    area(geology.features[0])`,

  bearing: `bearing(point1, point2)
  Calculate bearing from point1 to point2.
  Returns: { degrees, formatted }

  Example:
    bearing([118.5, -21.2], [118.6, -21.3])`,

  workspace: `ws (or sp.workspace) - Project persistence

  One folder = one project. The folder you pick IS the project.

  ws.new()            Clear & start fresh project in new folder
  ws.connect()        Open existing project folder
  ws.save()           Save layers & view to project folder
  ws.reconnect()      Reconnect to last used folder
  ws.export()         Download project as .spinifex file

  Project folder structure:
    project.json      Project manifest (view, layer refs)
    vectors/          Vector data (GeoJSON, CSV, Shapefile, etc.)
    rasters/          Raster data (GeoTIFF)
    data/             Non-spatial data (lookup tables, configs)
    scripts/          Custom JS scripts
    startup.js        Optional auto-run script on project open

  Files are stored in their original format - no conversion needed.`,

  raster: `Raster Layers (GeoTIFF)

  Drop a .tif/.tiff file onto the map to load.

  Raster layer methods:
    raster.show()           Show layer
    raster.hide()           Hide layer
    raster.zoom()           Zoom to extent
    raster.opacity(0.5)     Set opacity (0-1)
    raster.remove()         Remove from map

  Raster properties:
    raster.width            Width in pixels
    raster.height           Height in pixels
    raster.bands            Number of bands
    raster.extent           Bounding box [minX, minY, maxX, maxY]`,

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
  Labels in the Style panel appear in the legend.`
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
    termPrint('');
    termPrint('Layer Methods', 'yellow');
    termPrint('  layer.show()              Show layer');
    termPrint('  layer.hide()              Hide layer');
    termPrint('  layer.zoom()              Zoom to extent');
    termPrint('  layer.remove()            Remove layer');
    termPrint('  layer.style()             Open style editor');
    termPrint('  layer.style({...})        Set style via code');
    termPrint('  layer.properties()        Open properties window');
    termPrint('  layer.where(fn)           Filter features');
    termPrint('  layer.stats("field")      Field statistics');
    termPrint('  layer.zIndex(n)           Set render order');
    termPrint('  layer.bringToFront()      Move to top');
    termPrint('  layer.sendToBack()        Move to bottom');
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
