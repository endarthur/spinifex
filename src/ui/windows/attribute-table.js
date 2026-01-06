// Spinifex - Attribute Table Window
// Virtual-scrolling attribute table with filtering, sorting, and map integration

import { applyStyle } from '../../core/styling.js';
import { showContextMenu } from '../context-menu.js';
import { pasteToTerminal } from '../terminal.js';

// Window registry
const attributeTableWindows = new Map(); // layerId -> WinBox

// Virtual scrolling constants
const ROW_HEIGHT = 28; // pixels per row
const BUFFER_ROWS = 5; // extra rows above/below viewport

// Default dimensions
const defaults = {
  width: 700,
  height: 400
};

/**
 * Get the attribute table windows map (for external access)
 */
export function getAttributeTableWindows() {
  return attributeTableWindows;
}

/**
 * Open Attribute Table window for a layer
 * @param {Object} layer - The layer to show attribute table for
 * @param {Function} showTerminalFn - Function to show terminal window
 */
export function openAttributeTable(layer, showTerminalFn) {
  const layerId = layer.id || layer.name;

  // If already open, focus it
  if (attributeTableWindows.has(layerId)) {
    const win = attributeTableWindows.get(layerId);
    win.focus();
    return win;
  }

  // Create content
  const content = createAttributeTableContent(layer, showTerminalFn);

  // Calculate position (stagger multiple windows)
  const offset = attributeTableWindows.size * 30;

  const win = new WinBox({
    title: `${layer.name} - Attribute Table`,
    class: ['attribute-table-window'],
    x: 280 + offset,
    y: 80 + offset,
    width: defaults.width,
    height: defaults.height,
    minwidth: 400,
    minheight: 200,
    mount: content,
    onclose: () => {
      attributeTableWindows.delete(layerId);
      return false;
    }
  });

  attributeTableWindows.set(layerId, win);
  return win;
}

/**
 * Create attribute table content with virtual scrolling
 */
function createAttributeTableContent(layer, showTerminalFn) {
  const content = document.createElement('div');
  content.className = 'attribute-table-content';

  if (layer.type !== 'vector' || !layer.features || layer.features.length === 0) {
    content.innerHTML = '<div class="attribute-table-empty">No features in layer</div>';
    return content;
  }

  const fields = layer.fields || [];
  const features = layer.features;

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'attribute-table-toolbar';
  toolbar.innerHTML = `
    <div class="attribute-table-info">
      <span class="attribute-table-count">${features.length} features</span>
      <span class="attribute-table-filter-hint"></span>
    </div>
    <div class="attribute-table-actions">
      <input type="text" class="attribute-table-filter" placeholder="Filter... (prefix = for expression)" id="attr-filter-${layer.id}">
      <button class="attribute-table-btn" id="attr-bulk-edit-${layer.id}" disabled title="Bulk edit filtered rows">Bulk Edit</button>
      <button class="attribute-table-btn" id="attr-refresh-${layer.id}" title="Refresh layer styling">Refresh</button>
    </div>
  `;
  content.appendChild(toolbar);

  // Table container with header and virtual scroll body
  const tableContainer = document.createElement('div');
  tableContainer.className = 'attribute-table-container';

  // Fixed header table
  const headerTable = document.createElement('table');
  headerTable.className = 'attribute-table attribute-table-header';
  const thead = document.createElement('thead');
  let headerHtml = '<tr><th class="attr-col-id" data-sort="__fid">#</th>';
  fields.forEach(field => {
    headerHtml += `<th data-sort="${escapeHtml(field)}">${escapeHtml(field)}<span class="sort-icon"></span></th>`;
  });
  headerHtml += '</tr>';
  thead.innerHTML = headerHtml;
  headerTable.appendChild(thead);
  tableContainer.appendChild(headerTable);

  // Virtual scroll wrapper
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'attribute-table-scroll';
  scrollWrap.id = `attr-scroll-${layer.id}`;

  // Inner container that sets total height for scrollbar
  const scrollInner = document.createElement('div');
  scrollInner.className = 'attribute-table-scroll-inner';
  scrollInner.id = `attr-scroll-inner-${layer.id}`;

  // Body table (only visible rows)
  const bodyTable = document.createElement('table');
  bodyTable.className = 'attribute-table attribute-table-body';
  bodyTable.id = `attr-table-${layer.id}`;
  const tbody = document.createElement('tbody');
  tbody.id = `attr-tbody-${layer.id}`;
  bodyTable.appendChild(tbody);
  scrollInner.appendChild(bodyTable);
  scrollWrap.appendChild(scrollInner);
  tableContainer.appendChild(scrollWrap);
  content.appendChild(tableContainer);

  // Store state for sorting/filtering/virtual scroll
  content._tableState = {
    layer,
    fields,
    features: features.map((f, i) => ({ ...f, __fid: i })),
    filteredFeatures: null, // computed on filter/sort
    sortField: null,
    sortAsc: true,
    filterText: '',
    filterError: null,
    // Virtual scroll state
    scrollTop: 0,
    rowHeight: ROW_HEIGHT,
    selectedFid: null
  };

  // Initial filter/sort and render
  updateFilteredFeatures(content);
  renderVisibleRows(content);

  // Wire up events after DOM insertion
  setTimeout(() => wireAttributeTableEvents(content, layer, showTerminalFn), 0);

  return content;
}

/**
 * Apply filter and sort to get filtered features list
 */
function updateFilteredFeatures(content) {
  const state = content._tableState;
  let filtered = state.features;
  state.filterError = null;

  // Apply filter
  if (state.filterText) {
    if (state.filterText.startsWith('=')) {
      // Expression mode
      const expr = state.filterText.slice(1).trim();
      if (expr) {
        try {
          // Create filter function: r is the properties object
          const filterFn = new Function('r', `return ${expr}`);
          filtered = filtered.filter(f => {
            try {
              return filterFn(f.properties);
            } catch (e) {
              return false;
            }
          });
        } catch (e) {
          state.filterError = e.message;
        }
      }
    } else {
      // Simple text search
      const search = state.filterText.toLowerCase();
      filtered = filtered.filter(f => {
        return state.fields.some(field => {
          const val = f.properties[field];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(search);
        });
      });
    }
  }

  // Apply sort
  if (state.sortField) {
    filtered = [...filtered].sort((a, b) => {
      let aVal, bVal;
      if (state.sortField === '__fid') {
        aVal = a.__fid;
        bVal = b.__fid;
      } else {
        aVal = a.properties[state.sortField];
        bVal = b.properties[state.sortField];
      }

      // Handle nulls
      if (aVal === null || aVal === undefined) return state.sortAsc ? 1 : -1;
      if (bVal === null || bVal === undefined) return state.sortAsc ? -1 : 1;

      // Compare
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return state.sortAsc ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return state.sortAsc ? cmp : -cmp;
    });
  }

  state.filteredFeatures = filtered;

  // Update count and error display
  const countEl = content.querySelector('.attribute-table-count');
  const hintEl = content.querySelector('.attribute-table-filter-hint');

  if (countEl) {
    if (state.filterText) {
      countEl.textContent = `${filtered.length} / ${state.features.length} features`;
    } else {
      countEl.textContent = `${state.features.length} features`;
    }
  }

  if (hintEl) {
    if (state.filterError) {
      hintEl.textContent = `Error: ${state.filterError}`;
      hintEl.className = 'attribute-table-filter-hint error';
    } else if (state.filterText.startsWith('=')) {
      hintEl.textContent = '(expression mode)';
      hintEl.className = 'attribute-table-filter-hint expr';
    } else {
      hintEl.textContent = '';
      hintEl.className = 'attribute-table-filter-hint';
    }
  }

  // Enable/disable Bulk Edit button based on expression filter
  const bulkEditBtn = content.querySelector(`#attr-bulk-edit-${state.layer.id}`);
  if (bulkEditBtn) {
    const hasExprFilter = state.filterText.startsWith('=') && !state.filterError && filtered.length > 0;
    bulkEditBtn.disabled = !hasExprFilter;
    bulkEditBtn.title = hasExprFilter
      ? `Bulk edit ${filtered.length} filtered rows`
      : 'Use expression filter (=...) to enable bulk edit';
  }

  // Update scroll container height
  const scrollInner = content.querySelector(`#attr-scroll-inner-${state.layer.id}`);
  if (scrollInner) {
    scrollInner.style.height = `${filtered.length * state.rowHeight}px`;
  }
}

/**
 * Render only visible rows (virtual scrolling)
 */
function renderVisibleRows(content) {
  const state = content._tableState;
  const tbody = content.querySelector(`#attr-tbody-${state.layer.id}`);
  const scrollWrap = content.querySelector(`#attr-scroll-${state.layer.id}`);
  if (!tbody || !scrollWrap || !state.filteredFeatures) return;

  const scrollTop = state.scrollTop;
  const viewportHeight = scrollWrap.clientHeight;
  const totalRows = state.filteredFeatures.length;

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / state.rowHeight) - BUFFER_ROWS);
  const visibleCount = Math.ceil(viewportHeight / state.rowHeight) + BUFFER_ROWS * 2;
  const endIndex = Math.min(totalRows, startIndex + visibleCount);

  // Position the body table
  const bodyTable = content.querySelector(`#attr-table-${state.layer.id}`);
  if (bodyTable) {
    bodyTable.style.transform = `translateY(${startIndex * state.rowHeight}px)`;
  }

  // Build only visible rows
  let html = '';
  for (let i = startIndex; i < endIndex; i++) {
    const f = state.filteredFeatures[i];
    const fid = f.__fid;
    const selected = state.selectedFid === fid ? ' class="selected"' : '';
    html += `<tr data-fid="${fid}"${selected}>`;
    html += `<td class="attr-col-id">${fid}</td>`;
    state.fields.forEach(field => {
      const val = f.properties[field];
      const display = formatCellValue(val);
      html += `<td title="${escapeHtml(String(val ?? ''))}">${display}</td>`;
    });
    html += '</tr>';
  }

  tbody.innerHTML = html;
}

/**
 * Format cell value for display
 */
function formatCellValue(val) {
  if (val === null || val === undefined) return '<span class="attr-null">null</span>';
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return String(val);
    return val.toFixed(4);
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  const str = String(val);
  if (str.length > 50) return escapeHtml(str.substring(0, 47)) + '...';
  return escapeHtml(str);
}

/**
 * Escape HTML entities
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Wire up attribute table events
 */
function wireAttributeTableEvents(content, layer, showTerminalFn) {
  const tblState = content._tableState;

  // Filter input
  const filterInput = content.querySelector(`#attr-filter-${layer.id}`);
  if (filterInput) {
    let debounceTimer;
    filterInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        tblState.filterText = filterInput.value.trim();
        tblState.scrollTop = 0; // Reset scroll on filter change
        const scrollWrap = content.querySelector(`#attr-scroll-${layer.id}`);
        if (scrollWrap) scrollWrap.scrollTop = 0;
        updateFilteredFeatures(content);
        renderVisibleRows(content);
      }, 150);
    });
  }

  // Virtual scroll handler
  const scrollWrap = content.querySelector(`#attr-scroll-${layer.id}`);
  if (scrollWrap) {
    let scrollTicking = false;
    scrollWrap.addEventListener('scroll', () => {
      tblState.scrollTop = scrollWrap.scrollTop;
      if (!scrollTicking) {
        requestAnimationFrame(() => {
          renderVisibleRows(content);
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    });
  }

  // Column header click for sorting
  const thead = content.querySelector('thead');
  if (thead) {
    thead.addEventListener('click', (e) => {
      const th = e.target.closest('th');
      if (!th || !th.dataset.sort) return;

      const field = th.dataset.sort;

      // Toggle sort direction if same field
      if (tblState.sortField === field) {
        tblState.sortAsc = !tblState.sortAsc;
      } else {
        tblState.sortField = field;
        tblState.sortAsc = true;
      }

      // Update sort indicators
      thead.querySelectorAll('th').forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      th.classList.add(tblState.sortAsc ? 'sort-asc' : 'sort-desc');

      updateFilteredFeatures(content);
      renderVisibleRows(content);
    });
  }

  // Row click to highlight on map (use event delegation on scroll container)
  const tbody = content.querySelector(`#attr-tbody-${layer.id}`);
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;

      const fid = parseInt(tr.dataset.fid);
      const feature = layer.features[fid];
      if (!feature) return;

      // Toggle selection
      const wasSelected = tblState.selectedFid === fid;

      if (!wasSelected) {
        tblState.selectedFid = fid;
        // Update UI
        tbody.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
        highlightFeatureOnMap(layer, feature);
      } else {
        tblState.selectedFid = null;
        tr.classList.remove('selected');
        clearHighlight();
      }
    });

    // Double-click to zoom
    tbody.addEventListener('dblclick', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;

      const fid = parseInt(tr.dataset.fid);
      const feature = layer.features[fid];
      if (!feature) return;

      zoomToFeature(layer, feature);
    });

    // Right-click context menu on cells
    tbody.addEventListener('contextmenu', (e) => {
      const td = e.target.closest('td');
      const tr = e.target.closest('tr');
      if (!td || !tr) return;

      e.preventDefault();

      const fid = parseInt(tr.dataset.fid);
      const feature = layer.features[fid];
      if (!feature) return;

      // Get field name from column index
      const cellIndex = Array.from(tr.children).indexOf(td);
      const fieldName = cellIndex === 0 ? null : tblState.fields[cellIndex - 1]; // -1 for # column

      const items = [];

      if (fieldName) {
        const currentValue = feature.properties[fieldName];
        const valueStr = JSON.stringify(currentValue);

        items.push({
          label: 'Edit in terminal',
          action: () => {
            const code = `${layer.name}.features[${fid}].properties.${fieldName} = ${valueStr}`;
            pasteToTerminal(code, 0);
            if (showTerminalFn) showTerminalFn();
          }
        });

        items.push({
          label: 'Copy value',
          action: () => {
            navigator.clipboard.writeText(String(currentValue ?? ''));
          }
        });
      }

      items.push({
        label: 'Copy row as JSON',
        action: () => {
          navigator.clipboard.writeText(JSON.stringify(feature.properties, null, 2));
        }
      });

      if (items.length > 0) {
        showContextMenu(e.clientX, e.clientY, items);
      }
    });
  }

  // Bulk Edit button
  const bulkEditBtn = content.querySelector(`#attr-bulk-edit-${layer.id}`);
  if (bulkEditBtn) {
    bulkEditBtn.addEventListener('click', () => {
      if (bulkEditBtn.disabled) return;

      // Convert expression filter (uses r.) to forEach syntax (uses f.properties.)
      const expr = tblState.filterText.slice(1).trim(); // remove leading =
      const filterExpr = expr.replace(/\br\./g, 'f.properties.');

      // Single line to avoid terminal wrapping issues
      const code = `${layer.name}.features.filter(f => ${filterExpr}).forEach(f => { f.properties. =  })`;
      // Position cursor at "f.properties.|"
      const cursorPos = code.indexOf('f.properties. =') + 'f.properties.'.length;
      pasteToTerminal(code, cursorPos - code.length);

      // Focus terminal window
      if (showTerminalFn) showTerminalFn();
    });
  }

  // Refresh button
  const refreshBtn = content.querySelector(`#attr-refresh-${layer.id}`);
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (layer._styleOpts) {
        applyStyle(layer, layer._styleOpts);
      }
      // Re-render the table in case data changed
      updateFilteredFeatures(content);
      renderVisibleRows(content);
    });
  }
}

/**
 * Highlight a feature on the map
 */
function highlightFeatureOnMap(layer, feature) {
  // Get map and create/update highlight layer
  import('../map.js').then(({ getMap }) => {
    const map = getMap();
    if (!map) return;

    // Remove existing highlight
    clearHighlight();

    // Create highlight feature
    const format = new ol.format.GeoJSON();
    const olFeature = format.readFeature(feature, {
      featureProjection: map.getView().getProjection()
    });

    // Create highlight source and layer
    const highlightSource = new ol.source.Vector({
      features: [olFeature]
    });

    const highlightLayer = new ol.layer.Vector({
      source: highlightSource,
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: '#00ffff',
          width: 3
        }),
        fill: new ol.style.Fill({
          color: 'rgba(0, 255, 255, 0.2)'
        }),
        image: new ol.style.Circle({
          radius: 10,
          stroke: new ol.style.Stroke({
            color: '#00ffff',
            width: 3
          }),
          fill: new ol.style.Fill({
            color: 'rgba(0, 255, 255, 0.3)'
          })
        })
      }),
      zIndex: 9999
    });

    highlightLayer.set('__spinifex_highlight', true);
    map.addLayer(highlightLayer);
  });
}

/**
 * Clear highlight from map
 */
export function clearHighlight() {
  import('../map.js').then(({ getMap }) => {
    const map = getMap();
    if (!map) return;

    map.getLayers().forEach(layer => {
      if (layer.get('__spinifex_highlight')) {
        map.removeLayer(layer);
      }
    });
  });
}

/**
 * Zoom to a specific feature
 */
function zoomToFeature(layer, feature) {
  import('../map.js').then(({ getMap }) => {
    const map = getMap();
    if (!map) return;

    const format = new ol.format.GeoJSON();
    const olFeature = format.readFeature(feature, {
      featureProjection: map.getView().getProjection()
    });

    const extent = olFeature.getGeometry().getExtent();
    map.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 500,
      maxZoom: 18
    });

    // Also highlight
    highlightFeatureOnMap(layer, feature);
  });
}
