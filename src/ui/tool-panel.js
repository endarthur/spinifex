// Spinifex - Tool Panel UI
// Interactive panel for browsing and executing tools

import { toolbox } from '../core/toolbox.js';
import { widgets } from '../core/widgets.js';
import { events } from '../core/events.js';
import { termPrint } from './terminal.js';

let currentPanel = null;
let currentView = 'list'; // 'list' | 'tool'
let currentTool = null;
let currentValues = {};

/**
 * Create the tool panel styles
 */
function injectStyles() {
  if (document.getElementById('sp-tool-panel-styles')) return;

  const style = document.createElement('style');
  style.id = 'sp-tool-panel-styles';
  style.textContent = `
    .sp-tool-panel {
      font-family: var(--sp-font, system-ui, sans-serif);
      font-size: 13px;
      color: var(--sp-text, #e0e0e0);
      background: var(--sp-bg, #1e1e1e);
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sp-tool-panel-header {
      padding: 8px 12px;
      border-bottom: 1px solid var(--sp-border, #333);
      flex-shrink: 0;
    }

    .sp-tool-panel-search {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 4px;
      background: var(--sp-input-bg, #2a2a2a);
      color: var(--sp-text, #e0e0e0);
      font-size: 13px;
    }

    .sp-tool-panel-search:focus {
      outline: none;
      border-color: var(--sp-accent, #4a9eff);
    }

    .sp-tool-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .sp-tool-category {
      padding: 6px 8px;
      font-weight: 600;
      color: var(--sp-text-dim, #888);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .sp-tool-category:hover {
      color: var(--sp-text, #e0e0e0);
    }

    .sp-tool-category .count {
      font-weight: normal;
      opacity: 0.6;
    }

    .sp-tool-item {
      padding: 8px 12px;
      margin: 2px 0;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .sp-tool-item:hover {
      background: var(--sp-hover, #333);
    }

    .sp-tool-item.hidden {
      display: none;
    }

    .sp-tool-item-name {
      font-weight: 500;
    }

    .sp-tool-item-desc {
      font-size: 11px;
      color: var(--sp-text-dim, #888);
      margin-top: 2px;
    }

    /* Tool Detail View */
    .sp-tool-detail {
      padding: 12px;
    }

    .sp-tool-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .sp-back-btn {
      background: none;
      border: none;
      color: var(--sp-text-dim, #888);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 16px;
    }

    .sp-back-btn:hover {
      background: var(--sp-hover, #333);
      color: var(--sp-text, #e0e0e0);
    }

    .sp-tool-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
    }

    .sp-tool-desc {
      color: var(--sp-text-dim, #888);
      font-size: 12px;
      margin-bottom: 16px;
      line-height: 1.4;
    }

    /* Widget Styling */
    .sp-widget {
      margin-bottom: 12px;
    }

    .sp-widget label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 4px;
      color: var(--sp-text, #e0e0e0);
    }

    .sp-widget .required-mark {
      color: var(--sp-error, #ff6b6b);
    }

    .sp-widget input,
    .sp-widget select {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid var(--sp-border, #444);
      border-radius: 4px;
      background: var(--sp-input-bg, #2a2a2a);
      color: var(--sp-text, #e0e0e0);
      font-size: 13px;
      box-sizing: border-box;
    }

    .sp-widget input:focus,
    .sp-widget select:focus {
      outline: none;
      border-color: var(--sp-accent, #4a9eff);
    }

    .sp-widget-desc {
      font-size: 11px;
      color: var(--sp-text-dim, #666);
      margin-top: 4px;
    }

    .sp-checkbox-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sp-checkbox-wrapper input {
      width: auto;
    }

    /* Buttons */
    .sp-run-btn {
      width: 100%;
      padding: 10px 16px;
      background: var(--sp-accent, #4a9eff);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      margin-top: 16px;
      transition: background 0.15s;
    }

    .sp-run-btn:hover {
      background: var(--sp-accent-hover, #3a8eef);
    }

    .sp-run-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Messages */
    .sp-error {
      padding: 8px 12px;
      background: var(--sp-error-bg, #3a2020);
      border: 1px solid var(--sp-error, #ff6b6b);
      border-radius: 4px;
      color: var(--sp-error, #ff6b6b);
      font-size: 12px;
      margin-top: 12px;
    }

    .sp-success {
      padding: 8px 12px;
      background: var(--sp-success-bg, #1a3a1a);
      border: 1px solid var(--sp-success, #4caf50);
      border-radius: 4px;
      color: var(--sp-success, #4caf50);
      font-size: 12px;
      margin-top: 12px;
    }

    .sp-tool-history {
      border-top: 1px solid var(--sp-border, #333);
      padding-top: 12px;
      margin-top: 12px;
    }

    .sp-tool-history-title {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--sp-text-dim, #888);
      margin-bottom: 8px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Render the tool list view
 */
function renderToolList(container, searchQuery = '') {
  container.innerHTML = '';

  // Group tools by category
  const tools = toolbox.list();
  const categories = {};

  for (const tool of tools) {
    const cat = tool.category || 'Uncategorized';
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(tool);
  }

  // Filter by search query
  const query = searchQuery.toLowerCase();

  for (const [category, categoryTools] of Object.entries(categories).sort()) {
    const matchingTools = categoryTools.filter(tool => {
      if (!query) return true;
      return (
        tool.name?.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query) ||
        tool.id?.toLowerCase().includes(query) ||
        tool.tags?.some(t => t.toLowerCase().includes(query))
      );
    });

    if (matchingTools.length === 0) continue;

    // Category header
    const catEl = document.createElement('div');
    catEl.className = 'sp-tool-category';
    catEl.dataset.category = category;
    catEl.innerHTML = `
      <span>${category}</span>
      <span class="count">(${matchingTools.length})</span>
    `;
    container.appendChild(catEl);

    // Tools in category
    for (const tool of matchingTools) {
      const toolEl = document.createElement('div');
      toolEl.className = 'sp-tool-item';
      toolEl.dataset.toolId = tool.id;
      toolEl.dataset.category = category;
      toolEl.innerHTML = `
        <div class="sp-tool-item-name">${tool.name}</div>
        ${tool.description ? `<div class="sp-tool-item-desc">${tool.description}</div>` : ''}
      `;
      toolEl.addEventListener('click', () => showToolDetail(tool));
      container.appendChild(toolEl);
    }
  }

  if (container.children.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No tools found</div>';
  }
}

/**
 * Show tool detail/form view
 */
function showToolDetail(tool) {
  currentView = 'tool';
  currentTool = tool;
  currentValues = {};

  // Apply defaults
  for (const param of (tool.parameters || [])) {
    if (param.default !== undefined) {
      currentValues[param.name] = param.default;
    }
  }

  const body = currentPanel.body.querySelector('.sp-tool-panel-body');
  body.innerHTML = '';

  const detail = document.createElement('div');
  detail.className = 'sp-tool-detail';

  // Header with back button
  const header = document.createElement('div');
  header.className = 'sp-tool-header';
  header.innerHTML = `
    <button class="sp-back-btn" data-action="back">&larr;</button>
    <h3 class="sp-tool-title">${tool.name}</h3>
  `;
  header.querySelector('.sp-back-btn').addEventListener('click', showToolList);
  detail.appendChild(header);

  // Description
  if (tool.description) {
    const desc = document.createElement('div');
    desc.className = 'sp-tool-desc description';
    desc.textContent = tool.description;
    detail.appendChild(desc);
  }

  // Parameter form
  const form = document.createElement('div');
  form.className = 'sp-tool-form';

  for (const param of (tool.parameters || [])) {
    const widgetEl = widgets.render(param, currentValues[param.name], (newValue) => {
      currentValues[param.name] = newValue;
    });
    form.appendChild(widgetEl);
  }

  detail.appendChild(form);

  // Run button
  const runBtn = document.createElement('button');
  runBtn.className = 'sp-run-btn';
  runBtn.textContent = 'Run';
  runBtn.type = 'submit';
  runBtn.addEventListener('click', () => executeTool(tool, detail));
  detail.appendChild(runBtn);

  // Message area
  const messageArea = document.createElement('div');
  messageArea.className = 'sp-message-area';
  detail.appendChild(messageArea);

  body.appendChild(detail);
}

/**
 * Show tool list (back from detail)
 */
function showToolList() {
  currentView = 'list';
  currentTool = null;

  const body = currentPanel.body.querySelector('.sp-tool-panel-body');
  const searchInput = currentPanel.body.querySelector('.sp-tool-panel-search');
  renderToolList(body, searchInput?.value || '');
}

/**
 * Execute the current tool
 */
async function executeTool(tool, container) {
  const messageArea = container.querySelector('.sp-message-area');
  messageArea.innerHTML = '';

  const runBtn = container.querySelector('.sp-run-btn');
  runBtn.disabled = true;
  runBtn.textContent = 'Running...';

  try {
    const result = await toolbox.run(tool.id, currentValues);

    // Success message
    const success = document.createElement('div');
    success.className = 'sp-success success';
    success.textContent = 'Complete! Tool executed successfully.';
    messageArea.appendChild(success);

    termPrint(`Tool "${tool.name}" completed`, 'green');

  } catch (error) {
    // Error message
    const errorEl = document.createElement('div');
    errorEl.className = 'sp-error error';
    errorEl.textContent = error.message;
    messageArea.appendChild(errorEl);

    termPrint(`Tool "${tool.name}" failed: ${error.message}`, 'red');
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = 'Run';
  }
}

/**
 * Open the tool panel
 * @returns {WinBox} The panel window
 */
export function openToolPanel() {
  injectStyles();

  // Close existing panel
  if (currentPanel) {
    try {
      currentPanel.close();
    } catch (e) {
      // Panel already closed
    }
  }

  // Create panel content
  const content = document.createElement('div');
  content.className = 'sp-tool-panel';

  // Header with search
  const header = document.createElement('div');
  header.className = 'sp-tool-panel-header';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'sp-tool-panel-search';
  searchInput.placeholder = 'Search tools...';
  searchInput.addEventListener('input', (e) => {
    if (currentView === 'list') {
      const body = content.querySelector('.sp-tool-panel-body');
      renderToolList(body, e.target.value);
    }
  });
  header.appendChild(searchInput);
  content.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'sp-tool-panel-body';
  content.appendChild(body);

  // Initial render
  renderToolList(body);

  // Create WinBox
  currentPanel = new WinBox({
    title: 'Tools',
    width: '320px',
    height: '500px',
    x: 'right',
    y: 'center',
    class: ['no-full', 'no-max'],
    mount: content,
    onclose: () => {
      currentPanel = null;
      currentView = 'list';
      currentTool = null;
    },
  });

  return currentPanel;
}

/**
 * Get current panel state
 */
export function getToolPanelState() {
  return {
    isOpen: currentPanel !== null,
    view: currentView,
    currentTool: currentTool?.id || null,
  };
}

/**
 * Open tool panel and navigate directly to a tool by ID
 * @param {string} toolId - The tool ID to show
 * @returns {WinBox} The panel window
 */
export function openToolWithId(toolId) {
  const tool = toolbox.get(toolId);
  if (!tool) {
    termPrint(`Tool not found: ${toolId}`, 'red');
    return null;
  }

  // Open panel if needed
  if (!currentPanel) {
    openToolPanel();
  }

  // Show the tool detail
  showToolDetail(tool);

  return currentPanel;
}

// Expose globally
if (typeof window !== 'undefined') {
  window.openToolPanel = openToolPanel;
}
