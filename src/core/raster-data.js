// Spinifex - RasterData Internal Format
// Manages band data with consistent structure for manipulation

/**
 * Internal raster data structure
 * Provides consistent band management regardless of source format
 */
export class RasterData {
  /**
   * @param {Object} options
   * @param {number} options.width - Pixel width
   * @param {number} options.height - Pixel height
   * @param {number[]} options.extent - [minX, minY, maxX, maxY] in WGS84
   * @param {string} [options.crs='EPSG:4326'] - Coordinate reference system
   * @param {number} [options.noData=-9999] - Default nodata value
   */
  constructor(options = {}) {
    this.width = options.width || 0;
    this.height = options.height || 0;
    this.extent = options.extent || [0, 0, 1, 1];
    this.crs = options.crs || 'EPSG:4326';
    this.noData = options.noData ?? -9999;

    // Band storage - array of band objects
    this._bands = [];
  }

  // ─────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────

  /** Number of bands */
  get bandCount() {
    return this._bands.length;
  }

  /** Total pixels per band */
  get pixelCount() {
    return this.width * this.height;
  }

  /** Pixel width in CRS units */
  get pixelWidth() {
    return (this.extent[2] - this.extent[0]) / this.width;
  }

  /** Pixel height in CRS units */
  get pixelHeight() {
    return (this.extent[3] - this.extent[1]) / this.height;
  }

  /** Affine transform [originX, pixelWidth, 0, originY, 0, -pixelHeight] */
  get transform() {
    return [
      this.extent[0],
      this.pixelWidth,
      0,
      this.extent[3],
      0,
      -this.pixelHeight
    ];
  }

  /** Get all band names */
  get bandNames() {
    return this._bands.map(b => b.name);
  }

  // ─────────────────────────────────────────────────────────────
  // Band Access
  // ─────────────────────────────────────────────────────────────

  /**
   * Get band by index (1-based) or name
   * @param {number|string} indexOrName - 1-based index or band name
   * @returns {Object|null} Band object {data, name, noData, stats} or null
   */
  getBand(indexOrName) {
    if (typeof indexOrName === 'number') {
      const idx = indexOrName - 1; // Convert to 0-based
      return this._bands[idx] || null;
    }
    return this._bands.find(b => b.name === indexOrName) || null;
  }

  /**
   * Get band data array by index (1-based) or name
   * @param {number|string} indexOrName
   * @returns {TypedArray|null}
   */
  getBandData(indexOrName) {
    const band = this.getBand(indexOrName);
    return band ? band.data : null;
  }

  /**
   * Get 1-based index of a band by name
   * @param {string} name
   * @returns {number} 1-based index, or -1 if not found
   */
  getBandIndex(name) {
    const idx = this._bands.findIndex(b => b.name === name);
    return idx >= 0 ? idx + 1 : -1;
  }

  /**
   * Get all bands as array of data arrays (for backward compatibility)
   * @returns {TypedArray[]}
   */
  getAllBandData() {
    return this._bands.map(b => b.data);
  }

  // ─────────────────────────────────────────────────────────────
  // Band Manipulation
  // ─────────────────────────────────────────────────────────────

  /**
   * Add a new band
   * @param {TypedArray|number[]} data - Band data (row-major)
   * @param {string} [name] - Band name (auto-generated if not provided)
   * @param {Object} [options]
   * @param {number} [options.noData] - NoData value for this band
   * @param {Object} [options.stats] - Pre-computed {min, max}
   * @returns {number} 1-based index of the new band
   */
  addBand(data, name, options = {}) {
    // Validate data size
    const expectedSize = this.pixelCount;
    if (data.length !== expectedSize) {
      throw new Error(`Band data size (${data.length}) doesn't match raster dimensions (${expectedSize})`);
    }

    // Convert to Float32Array if needed
    const bandData = data instanceof Float32Array ? data : new Float32Array(data);

    // Generate name if not provided
    const bandName = name || `band${this._bands.length + 1}`;

    // Check for duplicate names
    if (this._bands.some(b => b.name === bandName)) {
      throw new Error(`Band with name '${bandName}' already exists`);
    }

    // Calculate stats if not provided
    const stats = options.stats || this._calculateStats(bandData, options.noData ?? this.noData);

    // Add band
    this._bands.push({
      data: bandData,
      name: bandName,
      noData: options.noData ?? this.noData,
      stats: stats
    });

    return this._bands.length; // Return 1-based index
  }

  /**
   * Remove a band by index (1-based) or name
   * @param {number|string} indexOrName
   * @returns {boolean} True if removed
   */
  removeBand(indexOrName) {
    let idx;
    if (typeof indexOrName === 'number') {
      idx = indexOrName - 1;
    } else {
      idx = this._bands.findIndex(b => b.name === indexOrName);
    }

    if (idx >= 0 && idx < this._bands.length) {
      this._bands.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Rename a band
   * @param {number|string} indexOrName - Current index or name
   * @param {string} newName - New name
   * @returns {boolean} True if renamed
   */
  renameBand(indexOrName, newName) {
    const band = this.getBand(indexOrName);
    if (!band) return false;

    // Check for duplicate names
    if (this._bands.some(b => b !== band && b.name === newName)) {
      throw new Error(`Band with name '${newName}' already exists`);
    }

    band.name = newName;
    return true;
  }

  /**
   * Update band data
   * @param {number|string} indexOrName
   * @param {TypedArray|number[]} data
   * @param {boolean} [recalcStats=true] - Recalculate statistics
   * @returns {boolean} True if updated
   */
  updateBandData(indexOrName, data, recalcStats = true) {
    const band = this.getBand(indexOrName);
    if (!band) return false;

    if (data.length !== this.pixelCount) {
      throw new Error(`Band data size (${data.length}) doesn't match raster dimensions (${this.pixelCount})`);
    }

    band.data = data instanceof Float32Array ? data : new Float32Array(data);

    if (recalcStats) {
      band.stats = this._calculateStats(band.data, band.noData);
    }

    return true;
  }

  /**
   * Update band statistics
   * @param {number|string} indexOrName
   * @returns {Object|null} Updated {min, max} or null
   */
  updateBandStats(indexOrName) {
    const band = this.getBand(indexOrName);
    if (!band) return null;

    band.stats = this._calculateStats(band.data, band.noData);
    return band.stats;
  }

  // ─────────────────────────────────────────────────────────────
  // Pixel Access
  // ─────────────────────────────────────────────────────────────

  /**
   * Get pixel index from x, y coordinates
   * @param {number} x - Column (0-based)
   * @param {number} y - Row (0-based)
   * @returns {number} Pixel index
   */
  pixelIndex(x, y) {
    return y * this.width + x;
  }

  /**
   * Get x, y coordinates from pixel index
   * @param {number} idx - Pixel index
   * @returns {[number, number]} [x, y]
   */
  pixelCoords(idx) {
    return [idx % this.width, Math.floor(idx / this.width)];
  }

  /**
   * Get geographic coordinates from pixel coordinates
   * @param {number} x - Column (can be fractional)
   * @param {number} y - Row (can be fractional)
   * @returns {[number, number]} [lon, lat]
   */
  pixelToGeo(x, y) {
    const lon = this.extent[0] + (x + 0.5) * this.pixelWidth;
    const lat = this.extent[3] - (y + 0.5) * this.pixelHeight;
    return [lon, lat];
  }

  /**
   * Get pixel coordinates from geographic coordinates
   * @param {number} lon
   * @param {number} lat
   * @returns {[number, number]} [x, y] (may be fractional)
   */
  geoToPixel(lon, lat) {
    const x = (lon - this.extent[0]) / this.pixelWidth - 0.5;
    const y = (this.extent[3] - lat) / this.pixelHeight - 0.5;
    return [x, y];
  }

  /**
   * Get value at geographic coordinates
   * @param {number} lon
   * @param {number} lat
   * @param {number|string} [band=1] - Band index or name
   * @returns {number|null} Value or null if out of bounds or nodata
   */
  getValue(lon, lat, band = 1) {
    const [x, y] = this.geoToPixel(lon, lat);
    const xi = Math.floor(x + 0.5);
    const yi = Math.floor(y + 0.5);

    if (xi < 0 || xi >= this.width || yi < 0 || yi >= this.height) {
      return null;
    }

    const bandObj = this.getBand(band);
    if (!bandObj) return null;

    const value = bandObj.data[this.pixelIndex(xi, yi)];
    return value === bandObj.noData ? null : value;
  }

  /**
   * Set value at geographic coordinates
   * @param {number} lon
   * @param {number} lat
   * @param {number} value
   * @param {number|string} [band=1]
   * @returns {boolean} True if set
   */
  setValue(lon, lat, value, band = 1) {
    const [x, y] = this.geoToPixel(lon, lat);
    const xi = Math.floor(x + 0.5);
    const yi = Math.floor(y + 0.5);

    if (xi < 0 || xi >= this.width || yi < 0 || yi >= this.height) {
      return false;
    }

    const bandObj = this.getBand(band);
    if (!bandObj) return false;

    bandObj.data[this.pixelIndex(xi, yi)] = value;
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────

  /**
   * Calculate statistics for a data array
   * @private
   */
  _calculateStats(data, noData) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (v !== noData && isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
        count++;
      }
    }

    return {
      min: count > 0 ? min : 0,
      max: count > 0 ? max : 0,
      mean: count > 0 ? sum / count : 0,
      validCount: count
    };
  }

  /**
   * Get statistics for all bands
   * @returns {Object} {band1: {min, max, mean}, band2: {...}, ...}
   */
  getAllStats() {
    const stats = {};
    for (let i = 0; i < this._bands.length; i++) {
      stats[`band${i + 1}`] = this._bands[i].stats;
    }
    return stats;
  }

  /**
   * Get global min/max across all bands
   * @returns {Object} {min, max}
   */
  getGlobalStats() {
    let min = Infinity;
    let max = -Infinity;

    for (const band of this._bands) {
      if (band.stats.min < min) min = band.stats.min;
      if (band.stats.max > max) max = band.stats.max;
    }

    return {
      min: this._bands.length > 0 ? min : 0,
      max: this._bands.length > 0 ? max : 0
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────

  /**
   * Export to plain object (for JSON serialization)
   * Note: Band data is not included (too large for JSON)
   * @returns {Object}
   */
  toJSON() {
    return {
      width: this.width,
      height: this.height,
      extent: this.extent,
      crs: this.crs,
      noData: this.noData,
      bands: this._bands.map(b => ({
        name: b.name,
        noData: b.noData,
        stats: b.stats
      }))
    };
  }

  /**
   * Clone this raster data (deep copy)
   * @returns {RasterData}
   */
  clone() {
    const cloned = new RasterData({
      width: this.width,
      height: this.height,
      extent: [...this.extent],
      crs: this.crs,
      noData: this.noData
    });

    for (const band of this._bands) {
      cloned.addBand(
        new Float32Array(band.data),
        band.name,
        { noData: band.noData, stats: { ...band.stats } }
      );
    }

    return cloned;
  }

  // ─────────────────────────────────────────────────────────────
  // Static Factory Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Create RasterData from existing band arrays (backward compatibility)
   * @param {TypedArray|TypedArray[]} data - Single band or array of bands
   * @param {Object} metadata - {width, height, extent, bandCount, bandStats, nodata}
   * @returns {RasterData}
   */
  static fromLegacyData(data, metadata) {
    const rasterData = new RasterData({
      width: metadata.width,
      height: metadata.height,
      extent: metadata.extent,
      noData: metadata.nodata ?? -9999
    });

    // Normalize to array of bands
    const bands = Array.isArray(data) && ArrayBuffer.isView(data[0])
      ? data
      : [data];

    // Add each band
    for (let i = 0; i < bands.length; i++) {
      const bandNum = i + 1;
      const stats = metadata.bandStats?.[`band${bandNum}`] || null;
      rasterData.addBand(bands[i], `band${bandNum}`, { stats });
    }

    return rasterData;
  }

  /**
   * Create empty raster with given dimensions
   * @param {number} width
   * @param {number} height
   * @param {number[]} extent - [minX, minY, maxX, maxY]
   * @param {number} [bandCount=1] - Number of bands to create
   * @param {number} [fillValue=0] - Initial value for all pixels
   * @returns {RasterData}
   */
  static createEmpty(width, height, extent, bandCount = 1, fillValue = 0) {
    const rasterData = new RasterData({ width, height, extent });

    for (let i = 0; i < bandCount; i++) {
      const data = new Float32Array(width * height);
      if (fillValue !== 0) data.fill(fillValue);
      rasterData.addBand(data, `band${i + 1}`);
    }

    return rasterData;
  }

  /**
   * Create raster matching another raster's geometry
   * @param {RasterData|RasterLayer} source - Source raster for dimensions/extent
   * @param {number} [bandCount=1]
   * @param {number} [fillValue=0]
   * @returns {RasterData}
   */
  static createLike(source, bandCount = 1, fillValue = 0) {
    const width = source.width;
    const height = source.height;
    const extent = source.extent || source._metadata?.extent;

    return RasterData.createEmpty(width, height, extent, bandCount, fillValue);
  }
}

export default RasterData;
