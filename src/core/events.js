// Spinifex - Event Bus
// Simple pub/sub system for decoupling components

/**
 * Event bus for application-wide event handling
 *
 * Usage:
 *   events.on('layer:added', (layer) => console.log('Added:', layer.name));
 *   events.emit('layer:added', myLayer);
 *   events.off('layer:added', handler);
 *   events.once('map:ready', () => console.log('Map is ready!'));
 */

const handlers = new Map();

export const events = {
  /**
   * Subscribe to an event
   * @param {string} eventName - Event name (supports namespacing like 'layer:added')
   * @param {Function} handler - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(eventName, handler) {
    if (!handlers.has(eventName)) {
      handlers.set(eventName, new Set());
    }
    handlers.get(eventName).add(handler);

    // Return unsubscribe function
    return () => this.off(eventName, handler);
  },

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Event name
   * @param {Function} handler - Handler to remove
   */
  off(eventName, handler) {
    const eventHandlers = handlers.get(eventName);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      // Clean up empty sets
      if (eventHandlers.size === 0) {
        handlers.delete(eventName);
      }
    }
  },

  /**
   * Emit an event to all subscribers
   * @param {string} eventName - Event name
   * @param {...any} args - Arguments to pass to handlers
   */
  emit(eventName, ...args) {
    const eventHandlers = handlers.get(eventName);
    if (!eventHandlers) return;

    // Iterate over a copy to allow handlers to unsubscribe themselves
    const handlersCopy = [...eventHandlers];
    for (const handler of handlersCopy) {
      try {
        handler(...args);
      } catch (error) {
        // Log error but continue with other handlers
        console.error(`[Events] Error in handler for '${eventName}':`, error);
      }
    }
  },

  /**
   * Subscribe to an event once (auto-unsubscribes after first emit)
   * @param {string} eventName - Event name
   * @param {Function} handler - Callback function
   * @returns {Function} Unsubscribe function
   */
  once(eventName, handler) {
    const wrappedHandler = (...args) => {
      this.off(eventName, wrappedHandler);
      handler(...args);
    };

    this.on(eventName, wrappedHandler);

    // Return unsubscribe that removes the wrapped handler
    return () => this.off(eventName, wrappedHandler);
  },

  /**
   * Remove all handlers for an event
   * @param {string} eventName - Event name
   */
  clear(eventName) {
    handlers.delete(eventName);
  },

  /**
   * Remove all handlers for all events
   */
  clearAll() {
    handlers.clear();
  },

  /**
   * Get count of handlers for an event (useful for debugging)
   * @param {string} eventName - Event name
   * @returns {number} Number of handlers
   */
  listenerCount(eventName) {
    return handlers.get(eventName)?.size || 0;
  }
};

// Make available globally for console access
if (typeof window !== 'undefined') {
  window.events = events;
}
