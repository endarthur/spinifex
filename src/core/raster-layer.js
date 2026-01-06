// Spinifex - Raster Layer Class
// Extends BaseLayer for raster (GeoTIFF, elevation, imagery) data

import { BaseLayer, BLEND_MODES } from './base-layer.js';
import { state } from './state.js';
import { getMap } from '../ui/map.js';
import { updateLayerPanel, updateStatusBar } from '../ui/layers-panel.js';
import { updateLegendContent } from '../ui/windows.js';
import { termPrint } from '../ui/terminal.js';
import { RasterData } from './raster-data.js';

// Rendering modes
export const RENDER_MODES = {
  SINGLEBAND: 'singleband',
  RGB: 'rgb',
  RGBA: 'rgba',
  GRAYSCALE: 'grayscale'
};

// Color ramps for single-band visualization
export const COLOR_RAMPS = {
  terrain: {
    stops: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1],
    colors: [
      [0, 97, 71], [86, 148, 75], [194, 185, 119],
      [179, 140, 90], [139, 90, 53], [200, 200, 200], [255, 255, 255]
    ]
  },
  grayscale: {
    stops: [0, 1],
    colors: [[0, 0, 0], [255, 255, 255]]
  },
  viridis: {
    stops: [0, 0.25, 0.5, 0.75, 1],
    colors: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]]
  },
  plasma: {
    stops: [0, 0.25, 0.5, 0.75, 1],
    colors: [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]]
  },
  bluered: {
    stops: [0, 0.5, 1],
    colors: [[8, 29, 88], [255, 255, 255], [165, 0, 38]]
  },
  bathymetry: {
    stops: [0, 0.3, 0.5, 0.7, 1],
    colors: [[8, 29, 88], [37, 116, 169], [134, 182, 131], [205, 178, 121], [170, 118, 72]]
  },
  ndvi: {
    stops: [0, 0.2, 0.4, 0.6, 0.8, 1],
    colors: [[165, 0, 38], [215, 48, 39], [254, 224, 144], [166, 217, 106], [26, 152, 80], [0, 104, 55]]
  },
  inferno: {
    stops: [0, 0.25, 0.5, 0.75, 1],
    colors: [[0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164]]
  },
  hot: {
    stops: [0, 0.33, 0.66, 1],
    colors: [[0, 0, 0], [230, 0, 0], [255, 210, 0], [255, 255, 255]]
  }
};

// CSS blend mode mapping
const CSS_BLEND_MAP = {
  'source-over': 'normal', 'multiply': 'multiply', 'screen': 'screen',
  'overlay': 'overlay', 'darken': 'darken', 'lighten': 'lighten',
  'color-dodge': 'color-dodge', 'color-burn': 'color-burn',
  'hard-light': 'hard-light', 'soft-light': 'soft-light',
  'difference': 'difference', 'exclusion': 'exclusion',
  'hue': 'hue', 'saturation': 'saturation', 'color': 'color', 'luminosity': 'luminosity'
};

/**
 * Raster Layer class for GeoTIFF and elevation data
 */
export class RasterLayer extends BaseLayer {
  constructor(id, name, olLayer, metadata, data, options = {}) {
    super(id, name, olLayer, options.zIndex || 0);

    this._metadata = metadata;
    this._data = data;
    this._colorRamp = options.colorRamp || 'terrain';
    this._mode = options.mode || RENDER_MODES.SINGLEBAND;
    this._bandStats = options.bandStats || {};
    this._bandMapping = [1, 2, 3];
    this._selectedBand = 1;
    this._bandStretch = {};
    this._customExpression = null;
    this._sourceFormat = 'geotiff';

    // New internal raster data structure (lazy initialized)
    this._rasterData = null;

    // Raster-specific namespace
    this.r = new RasterMethods(this);
  }

  /**
   * Get or initialize the RasterData structure
   * Converts legacy _data format to RasterData on first access
   * @returns {RasterData}
   */
  getRasterData() {
    if (!this._rasterData) {
      this._rasterData = RasterData.fromLegacyData(this._data, this._metadata);
    }
    return this._rasterData;
  }

  /**
   * Set RasterData directly (for newly created rasters)
   * Also updates legacy _data and _metadata for backward compatibility
   * @param {RasterData} rasterData
   */
  setRasterData(rasterData) {
    this._rasterData = rasterData;

    // Update legacy properties for backward compatibility
    this._data = rasterData.getAllBandData();
    this._metadata.width = rasterData.width;
    this._metadata.height = rasterData.height;
    this._metadata.extent = rasterData.extent;
    this._metadata.bandCount = rasterData.bandCount;
    this._metadata.bandStats = rasterData.getAllStats();
    const globalStats = rasterData.getGlobalStats();
    this._metadata.min = globalStats.min;
    this._metadata.max = globalStats.max;
    this._bandStats = rasterData.getAllStats();
  }

  // ─────────────────────────────────────────────────────────────
  // Type identifier
  // ─────────────────────────────────────────────────────────────

  get type() { return 'raster'; }

  // ─────────────────────────────────────────────────────────────
  // Raster-specific getters
  // ─────────────────────────────────────────────────────────────

  get width() { return this._metadata.width; }
  get height() { return this._metadata.height; }
  get bands() { return this._metadata.bandCount || 1; }
  get minValue() { return this._metadata.min; }
  get maxValue() { return this._metadata.max; }
  get extent() { return this._metadata.extent; }
  get nodata() { return this._metadata.nodata ?? -32768; }

  // Backward compatibility
  get isRaster() { return true; }
  get layerType() { return 'raster'; }

  // ─────────────────────────────────────────────────────────────
  // Override base methods
  // ─────────────────────────────────────────────────────────────

  _getExtent() {
    return ol.proj.transformExtent(this._metadata.extent, 'EPSG:4326', 'EPSG:3857');
  }

  /**
   * Override blend mode for WebGL layers
   * Uses CSS mix-blend-mode on the canvas element
   */
  blendMode(mode) {
    if (mode !== undefined) {
      if (!BLEND_MODES.includes(mode)) {
        termPrint(`Unknown blend mode: ${mode}`, 'red');
        termPrint(`Available: ${BLEND_MODES.join(', ')}`, 'dim');
        return this;
      }
      this._blendMode = mode;
      const cssBlend = CSS_BLEND_MAP[mode] || 'normal';

      const applyBlendMode = () => {
        const viewport = document.querySelector('.ol-viewport');
        if (viewport) {
          const canvasLayers = viewport.querySelectorAll('canvas.ol-layer');
          for (const canvas of canvasLayers) {
            const zIndex = parseInt(canvas.style.zIndex || '0');
            if (zIndex === this._zIndex || canvasLayers.length === 1) {
              canvas.style.mixBlendMode = cssBlend;
              return true;
            }
          }
          if (canvasLayers.length > 0) {
            canvasLayers[canvasLayers.length - 1].style.mixBlendMode = cssBlend;
            return true;
          }
        }
        return false;
      };

      if (!applyBlendMode()) {
        const listener = this._olLayer.on('postrender', () => {
          if (applyBlendMode()) {
            ol.Observable.unByKey(listener);
          }
        });
        this._olLayer.changed();
      }

      const map = getMap();
      map.once('rendercomplete', applyBlendMode);

      termPrint(`Blend mode: ${mode}`, 'green');
      return this;
    }
    return this._blendMode;
  }

  // ─────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────

  /**
   * Serialize raster layer to plain object for persistence
   * Note: Raster data is referenced via source path, not embedded
   * @returns {Object} Serialized layer data
   */
  serialize() {
    const base = super.serialize();

    const data = {
      ...base,
      // Raster-specific display settings
      colorRamp: this._colorRamp,
      mode: this._mode,
      selectedBand: this._selectedBand !== 1 ? this._selectedBand : undefined,
      bandMapping: this._bandMapping,
      bandStretch: Object.keys(this._bandStretch).length > 0 ? this._bandStretch : undefined,
      // Metadata for stretch/display
      nodata: this._metadata.nodata,
      min: this._metadata.min,
      max: this._metadata.max
    };

    // Clean up undefined values
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) delete data[key];
    });

    return data;
  }

  /**
   * Apply serialized settings to this layer
   * @param {Object} data - Serialized layer data
   */
  applySerializedState(data) {
    super.applySerializedState(data);

    if (data.colorRamp) {
      this._colorRamp = data.colorRamp;
    }
    if (data.mode) {
      this._mode = data.mode;
    }
    if (data.selectedBand) {
      this._selectedBand = data.selectedBand;
    }
    if (data.bandMapping && Array.isArray(data.bandMapping)) {
      this._bandMapping = data.bandMapping;
    }
    if (data.bandStretch) {
      this._bandStretch = data.bandStretch;
    }
    if (data.min !== undefined) {
      this._metadata.min = data.min;
    }
    if (data.max !== undefined) {
      this._metadata.max = data.max;
    }

    // Update the display
    this._updateStyle();

    return this;
  }

  /**
   * Internal: Update the layer style
   */
  _updateStyle() {
    const nodata = this._metadata.nodata ?? -32768;
    let style;

    if (this._mode === RENDER_MODES.RGB || this._mode === RENDER_MODES.RGBA) {
      style = {
        variables: { nodata },
        color: [
          'case',
          ['==', ['band', 1], ['var', 'nodata']],
          [0, 0, 0, 0],
          this._buildRGBExpression()
        ]
      };
    } else {
      const ramp = COLOR_RAMPS[this._colorRamp] || COLOR_RAMPS.grayscale;
      const min = this._metadata.min;
      const max = this._metadata.max;
      const range = max - min || 1;
      const bandNum = this._selectedBand || 1;

      const colorStops = [];
      for (let i = 0; i < ramp.stops.length; i++) {
        const value = min + ramp.stops[i] * range;
        const color = ramp.colors[i];
        colorStops.push(value);
        colorStops.push(['color', color[0], color[1], color[2], 1]);
      }

      const colorExpr = ['interpolate', ['linear'], ['band', bandNum], ...colorStops];

      style = {
        color: [
          'case',
          ['<', ['band', bandNum], nodata + 1],
          ['color', 0, 0, 0, 0],
          colorExpr
        ]
      };
    }

    this._olLayer.setStyle(style);
  }

  /**
   * Build RGB expression for multi-band display
   * Uses channel-keyed stretch: { r: {min,max}, g: {min,max}, b: {min,max} }
   */
  _buildRGBExpression() {
    const [rBand, gBand, bBand] = this._bandMapping;
    const stretch = this._bandStretch || {};

    const normalize = (band, channel) => {
      const stats = this._bandStats[`band${band}`] || { min: 0, max: 255 };
      // Get stretch from channel key (r, g, b), not band number
      const channelStretch = stretch[channel] || {};
      const min = channelStretch.min ?? stats.min;
      const max = channelStretch.max ?? stats.max;
      const range = max - min || 1;

      // Normalize to 0-255 range for color expression
      return ['clamp', ['*', 255, ['/', ['-', ['band', band], min], range]], 0, 255];
    };

    return [
      'color',
      normalize(rBand, 'r'),
      normalize(gBand, 'g'),
      normalize(bBand, 'b'),
      1  // Alpha channel (0-1 range)
    ];
  }

  toString() {
    const modeStr = this._mode === RENDER_MODES.SINGLEBAND ? this._colorRamp : this._mode;
    return `RasterLayer<${this._name}> (${this.width}x${this.height}, ${this.bands} band(s), ${modeStr})`;
  }
}

/**
 * Raster-specific methods namespace
 * Access via layer.r.methodName()
 */
class RasterMethods {
  constructor(layer) {
    this._layer = layer;
  }

  /**
   * Get or set render mode
   */
  mode(newMode) {
    if (newMode !== undefined) {
      if (!Object.values(RENDER_MODES).includes(newMode)) {
        termPrint(`Unknown mode: ${newMode}`, 'red');
        termPrint(`Available: ${Object.values(RENDER_MODES).join(', ')}`, 'dim');
        return this._layer;
      }
      this._layer._mode = newMode;
      this._layer._updateStyle();
      termPrint(`Render mode: ${newMode}`, 'green');
      return this._layer;
    }
    return this._layer._mode;
  }

  /**
   * Get or set color ramp
   */
  colorRamp(rampName) {
    if (rampName !== undefined) {
      if (!COLOR_RAMPS[rampName]) {
        termPrint(`Unknown color ramp: ${rampName}`, 'red');
        termPrint(`Available: ${Object.keys(COLOR_RAMPS).join(', ')}`, 'dim');
        return this._layer;
      }
      this._layer._colorRamp = rampName;
      if (this._layer._mode === RENDER_MODES.SINGLEBAND || this._layer._mode === RENDER_MODES.GRAYSCALE) {
        this._layer._mode = RENDER_MODES.SINGLEBAND;
        this._layer._updateStyle();
      }
      termPrint(`Color ramp: ${rampName}`, 'green');
      return this._layer;
    }
    return this._layer._colorRamp;
  }

  /**
   * Adjust value range for color mapping
   */
  stretch(newMin, newMax) {
    if (newMin !== undefined && newMax !== undefined) {
      this._layer._metadata.min = newMin;
      this._layer._metadata.max = newMax;
      this._layer._updateStyle();
      termPrint(`Stretch: ${newMin} - ${newMax}`, 'green');
      return this._layer;
    }
    return { min: this._layer._metadata.min, max: this._layer._metadata.max };
  }

  /**
   * Get or set RGB band mapping
   */
  bands(r, g, b) {
    if (r !== undefined && g !== undefined && b !== undefined) {
      const maxBand = this._layer._metadata.bandCount;
      if (r < 1 || r > maxBand || g < 1 || g > maxBand || b < 1 || b > maxBand) {
        termPrint(`Invalid band number. Raster has ${maxBand} band(s).`, 'red');
        return this._layer;
      }
      this._layer._bandMapping = [r, g, b];
      if (this._layer._mode !== RENDER_MODES.RGB && this._layer._mode !== RENDER_MODES.RGBA) {
        this._layer._mode = RENDER_MODES.RGB;
      }
      this._layer._updateStyle();
      termPrint(`RGB bands: ${r}, ${g}, ${b}`, 'green');
      return this._layer;
    }
    return this._layer._bandMapping;
  }

  /**
   * Get or set selected band for single-band mode
   */
  band(bandNum) {
    if (bandNum !== undefined) {
      const maxBand = this._layer._metadata.bandCount;
      if (bandNum < 1 || bandNum > maxBand) {
        termPrint(`Invalid band number. Raster has ${maxBand} band(s).`, 'red');
        return this._layer;
      }
      this._layer._selectedBand = bandNum;
      if (this._layer._mode !== RENDER_MODES.SINGLEBAND && this._layer._mode !== RENDER_MODES.GRAYSCALE) {
        this._layer._mode = RENDER_MODES.SINGLEBAND;
      }
      this._layer._updateStyle();
      termPrint(`Display band: ${bandNum}`, 'green');
      return this._layer;
    }
    return this._layer._selectedBand;
  }

  /**
   * Get value at a point (WGS84 coordinates)
   */
  getValue(lon, lat, band = 1) {
    const ext = this._layer._metadata.extent;
    if (lon < ext[0] || lon > ext[2] || lat < ext[1] || lat > ext[3]) {
      return null;
    }

    const x = Math.floor(((lon - ext[0]) / (ext[2] - ext[0])) * (this._layer._metadata.width - 1));
    const y = Math.floor(((ext[3] - lat) / (ext[3] - ext[1])) * (this._layer._metadata.height - 1));
    const idx = y * this._layer._metadata.width + x;

    const bands = Array.isArray(this._layer._data) && ArrayBuffer.isView(this._layer._data[0])
      ? this._layer._data
      : [this._layer._data];

    if (band < 1 || band > bands.length) return null;

    const value = bands[band - 1][idx];
    const nodata = this._layer._metadata.nodata ?? -32768;
    return value === nodata ? null : value;
  }

  /**
   * Alias for elevation data
   */
  getElevation(lon, lat) {
    return this.getValue(lon, lat, 1);
  }

  /**
   * Apply a WebGL expression for display-time calculation
   */
  expression(expr, options = {}) {
    if (expr === undefined || expr === null) {
      this._layer._customExpression = null;
      this._layer._updateStyle();
      termPrint('Cleared custom expression', 'dim');
      return this._layer;
    }

    try {
      import('../raster/algebra.js').then(({ parseExpression }) => {
        const olExpr = parseExpression(expr);
        const nodata = this._layer._metadata.nodata ?? -32768;
        const min = options.min ?? this._layer._metadata.min ?? -1;
        const max = options.max ?? this._layer._metadata.max ?? 1;
        const colorRamp = options.colorRamp || 'viridis';

        this._layer._customExpression = expr;

        const ramp = COLOR_RAMPS[colorRamp] || COLOR_RAMPS.viridis;
        const colorExpr = ['interpolate', ['linear'], olExpr];

        for (let i = 0; i < ramp.stops.length; i++) {
          const value = min + ramp.stops[i] * (max - min);
          const color = ramp.colors[i];
          colorExpr.push(value);
          colorExpr.push([color[0], color[1], color[2], 255]);
        }

        const style = {
          variables: { nodata },
          color: [
            'case',
            ['==', ['band', 1], ['var', 'nodata']],
            [0, 0, 0, 0],
            colorExpr
          ]
        };

        this._layer._olLayer.setStyle(style);
        termPrint(`Expression applied: ${expr}`, 'green');
      });
    } catch (e) {
      termPrint(`Expression error: ${e.message}`, 'red');
    }

    return this._layer;
  }

  /**
   * Get raster statistics
   */
  stats() {
    return {
      min: this._layer._metadata.min,
      max: this._layer._metadata.max,
      nodata: this._layer._metadata.nodata,
      bands: this._layer._metadata.bandCount,
      bandStats: this._layer._bandStats
    };
  }

  /**
   * Available color ramps
   */
  colorRamps() {
    return Object.keys(COLOR_RAMPS);
  }

  // ─────────────────────────────────────────────────────────────
  // Band Manipulation Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Get band data by index (1-based) or name
   * @param {number|string} indexOrName
   * @returns {Object|null} {data, name, noData, stats} or null
   */
  getBand(indexOrName) {
    const rd = this._layer.getRasterData();
    return rd.getBand(indexOrName);
  }

  /**
   * Get all band names
   * @returns {string[]}
   */
  bandNames() {
    const rd = this._layer.getRasterData();
    return rd.bandNames;
  }

  /**
   * Add a new band to the raster
   * @param {TypedArray|number[]|RasterLayer} source - Band data, array, or another raster
   * @param {string} [name] - Band name (auto-generated if not provided)
   * @param {Object} [options]
   * @param {number} [options.noData] - NoData value
   * @param {number} [options.band=1] - If source is RasterLayer, which band to copy
   * @returns {RasterLayer} This layer for chaining
   */
  addBand(source, name, options = {}) {
    const rd = this._layer.getRasterData();

    let data;
    if (source instanceof RasterLayer || (source && source.type === 'raster')) {
      // Source is another raster layer - extract band data
      const srcRd = source.getRasterData();
      const srcBand = options.band || 1;
      const srcBandObj = srcRd.getBand(srcBand);
      if (!srcBandObj) {
        termPrint(`Source raster doesn't have band ${srcBand}`, 'red');
        return this._layer;
      }

      // Verify dimensions match
      if (srcRd.width !== rd.width || srcRd.height !== rd.height) {
        termPrint(`Dimension mismatch: source is ${srcRd.width}x${srcRd.height}, target is ${rd.width}x${rd.height}`, 'red');
        return this._layer;
      }

      data = new Float32Array(srcBandObj.data);
      name = name || srcBandObj.name;
    } else {
      // Source is raw data array
      data = source;
    }

    try {
      const bandIndex = rd.addBand(data, name, options);
      // Update legacy structures
      this._layer.setRasterData(rd);
      termPrint(`Added band '${name || 'band' + bandIndex}' (${bandIndex} of ${rd.bandCount})`, 'green');
    } catch (e) {
      termPrint(`Failed to add band: ${e.message}`, 'red');
    }

    return this._layer;
  }

  /**
   * Remove a band by index (1-based) or name
   * @param {number|string} indexOrName
   * @returns {RasterLayer} This layer for chaining
   */
  removeBand(indexOrName) {
    const rd = this._layer.getRasterData();

    if (rd.bandCount <= 1) {
      termPrint('Cannot remove the only band', 'red');
      return this._layer;
    }

    const band = rd.getBand(indexOrName);
    if (!band) {
      termPrint(`Band '${indexOrName}' not found`, 'red');
      return this._layer;
    }

    const bandName = band.name;
    if (rd.removeBand(indexOrName)) {
      // Update legacy structures
      this._layer.setRasterData(rd);

      // Adjust band mappings if needed
      if (this._layer._bandMapping) {
        const removedIdx = typeof indexOrName === 'number' ? indexOrName : rd.getBandIndex(indexOrName);
        this._layer._bandMapping = this._layer._bandMapping.map(b =>
          b > removedIdx ? b - 1 : b
        );
      }

      termPrint(`Removed band '${bandName}'`, 'green');
      this._layer._updateStyle();
    }

    return this._layer;
  }

  /**
   * Rename a band
   * @param {number|string} indexOrName - Current index or name
   * @param {string} newName - New name
   * @returns {RasterLayer} This layer for chaining
   */
  renameBand(indexOrName, newName) {
    const rd = this._layer.getRasterData();

    try {
      const band = rd.getBand(indexOrName);
      const oldName = band?.name;

      if (rd.renameBand(indexOrName, newName)) {
        termPrint(`Renamed band '${oldName}' to '${newName}'`, 'green');
      } else {
        termPrint(`Band '${indexOrName}' not found`, 'red');
      }
    } catch (e) {
      termPrint(`Failed to rename band: ${e.message}`, 'red');
    }

    return this._layer;
  }

  /**
   * Get the internal RasterData object
   * @returns {RasterData}
   */
  data() {
    return this._layer.getRasterData();
  }
}

// Re-export RasterData for external use
export { RasterData };
