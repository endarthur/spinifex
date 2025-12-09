// Spinifex - Tool Registry (Toolbox)
// Schema-driven tool system for processing and interactive tools

import { events } from './events.js';
import { termPrint } from '../ui/terminal.js';
import { getMap } from '../ui/map.js';
import { state } from './state.js';

/**
 * Tool registry storage
 */
const tools = new Map();
const history = [];
const MAX_HISTORY = 100;

/**
 * Validate tool parameters
 * @param {Object} tool - Tool definition
 * @param {Object} params - Provided parameters
 * @returns {Object} Validated and defaulted parameters
 * @throws {Error} If validation fails
 */
function validateParams(tool, params) {
  const validated = { ...params };
  const errors = [];

  for (const param of (tool.parameters || [])) {
    const value = validated[param.name];
    const hasValue = value !== undefined && value !== null && value !== '';

    // Apply defaults
    if (!hasValue && param.default !== undefined) {
      validated[param.name] = param.default;
      continue;
    }

    // Required check
    if (param.required && !hasValue) {
      errors.push(`Parameter '${param.name}' is required`);
      continue;
    }

    if (!hasValue) continue;

    // Type-specific validation
    switch (param.type) {
      case 'number':
      case 'integer':
        if (typeof value !== 'number') {
          errors.push(`Parameter '${param.name}' must be a number`);
        } else {
          if (param.min !== undefined && value < param.min) {
            errors.push(`Parameter '${param.name}' must be >= ${param.min}`);
          }
          if (param.max !== undefined && value > param.max) {
            errors.push(`Parameter '${param.name}' must be <= ${param.max}`);
          }
          if (param.type === 'integer' && !Number.isInteger(value)) {
            errors.push(`Parameter '${param.name}' must be an integer`);
          }
        }
        break;

      case 'select':
        const validOptions = (param.options || []).map(o =>
          typeof o === 'object' ? o.value : o
        );
        if (!validOptions.includes(value)) {
          errors.push(`Parameter '${param.name}' must be one of: ${validOptions.join(', ')}`);
        }
        break;

      case 'string':
        if (param.pattern && !param.pattern.test(value)) {
          errors.push(`Parameter '${param.name}' does not match required pattern`);
        }
        break;
    }

    // Custom validation
    if (param.validate && typeof param.validate === 'function') {
      const error = param.validate(value, validated);
      if (error) {
        errors.push(error);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  return validated;
}

/**
 * The toolbox object - public API
 */
export const toolbox = {
  /**
   * Register a tool
   * @param {Object} tool - Tool definition
   */
  register(tool) {
    if (!tool.id) {
      throw new Error('Tool must have an id');
    }
    if (!tool.execute || typeof tool.execute !== 'function') {
      throw new Error('Tool must have an execute function');
    }
    if (tools.has(tool.id)) {
      throw new Error(`Tool '${tool.id}' is already registered`);
    }

    // Set defaults
    tool.name = tool.name || tool.id;
    tool.category = tool.category || 'Uncategorized';
    tool.parameters = tool.parameters || [];
    tool.tags = tool.tags || [];

    tools.set(tool.id, tool);
    return this;
  },

  /**
   * Get a tool by ID
   * @param {string} id - Tool ID
   * @returns {Object|undefined}
   */
  get(id) {
    return tools.get(id);
  },

  /**
   * List tools, optionally filtered by category
   * @param {string} [category] - Category to filter by
   * @returns {Array}
   */
  list(category) {
    const all = Array.from(tools.values());
    if (category) {
      return all.filter(t => t.category === category);
    }
    return all;
  },

  /**
   * Get list of categories
   * @returns {string[]}
   */
  categories() {
    const cats = new Set();
    for (const tool of tools.values()) {
      if (tool.category) cats.add(tool.category);
    }
    return Array.from(cats).sort();
  },

  /**
   * Search tools by name, description, or tags
   * @param {string} query - Search query
   * @returns {Array}
   */
  search(query) {
    const q = query.toLowerCase();
    return Array.from(tools.values()).filter(t => {
      if (t.name?.toLowerCase().includes(q)) return true;
      if (t.description?.toLowerCase().includes(q)) return true;
      if (t.tags?.some(tag => tag.toLowerCase().includes(q))) return true;
      if (t.id?.toLowerCase().includes(q)) return true;
      return false;
    });
  },

  /**
   * Run a tool
   * @param {string} id - Tool ID
   * @param {Object} params - Tool parameters
   * @returns {Promise<*>} Tool result
   */
  async run(id, params = {}) {
    const tool = tools.get(id);
    if (!tool) {
      throw new Error(`Tool '${id}' not found`);
    }

    // Validate parameters
    const validatedParams = validateParams(tool, params);

    // Build context
    const context = {
      map: getMap(),
      layers: state.layers,
      ly: null,  // Will be set dynamically
    };

    // Import ly dynamically to avoid circular dependency
    try {
      const api = await import('./api.js');
      context.ly = api.ly;
    } catch (e) {
      // Ignore if api not available
    }

    // Emit started event
    events.emit('tool:started', {
      toolId: id,
      toolName: tool.name,
      params: validatedParams,
      timestamp: Date.now(),
    });

    const startTime = Date.now();

    try {
      // Execute tool
      const result = await tool.execute(validatedParams, context);

      const elapsed = Date.now() - startTime;

      // Record in history
      history.push({
        toolId: id,
        toolName: tool.name,
        params: validatedParams,
        result,
        timestamp: startTime,
        duration: elapsed,
        success: true,
      });

      // Trim history if needed
      while (history.length > MAX_HISTORY) {
        history.shift();
      }

      // Emit completed event
      events.emit('tool:completed', {
        toolId: id,
        toolName: tool.name,
        params: validatedParams,
        result,
        duration: elapsed,
      });

      return result;

    } catch (error) {
      // Record failure in history
      history.push({
        toolId: id,
        toolName: tool.name,
        params: validatedParams,
        error: error.message,
        timestamp: startTime,
        duration: Date.now() - startTime,
        success: false,
      });

      // Emit failed event
      events.emit('tool:failed', {
        toolId: id,
        toolName: tool.name,
        params: validatedParams,
        error: error.message,
      });

      throw error;
    }
  },

  /**
   * Get execution history
   * @returns {Array}
   */
  history() {
    return [...history];
  },

  /**
   * Clear execution history
   */
  clearHistory() {
    history.length = 0;
  },

  /**
   * Get tool count
   * @returns {number}
   */
  get count() {
    return tools.size;
  },
};

// Expose globally
if (typeof window !== 'undefined') {
  window.toolbox = toolbox;
}
