// Spinifex - Terminal Module
// xterm.js terminal initialization and REPL

import { state } from '../core/state.js';

// Terminal instance
export let term = null;

// Command buffer for input
let commandBuffer = '';
let cursorPos = 0;  // Position within commandBuffer

// Callback for command execution (set by api.js)
let executeCallback = null;

// Tab completion state
let completionCandidates = [];
let completionIndex = 0;
let completionPrefix = '';
let lastTabTime = 0;

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  dim: '\x1b[90m',
  reset: '\x1b[0m'
};

/**
 * Print text to terminal with optional color
 */
export function termPrint(text, color = null) {
  if (!term) return;
  if (color && colors[color]) {
    term.writeln(`${colors[color]}${text}${colors.reset}`);
  } else {
    term.writeln(text);
  }
}

/**
 * Show the prompt
 */
export function termPrompt() {
  if (!term) return;
  term.write('\r\n\x1b[34m>\x1b[0m ');
}

/**
 * Set the command execution callback
 */
export function setExecuteCallback(callback) {
  executeCallback = callback;
}

/**
 * Run code in terminal (shows the command, executes it, shows prompt)
 */
export function runInTerminal(code) {
  if (!term) return;
  term.writeln('');
  term.write(`\x1b[90m${code}\x1b[0m`);
  term.writeln('');
  if (executeCallback) {
    executeCallback(code);
  }
  termPrompt();
}

/**
 * Paste code into terminal input buffer (for user to edit before executing)
 * @param {string} code - Code to paste
 * @param {number} cursorOffset - Where to place cursor (from end, negative = before end)
 */
export function pasteToTerminal(code, cursorOffset = 0) {
  if (!term) return;

  // Update command buffer
  commandBuffer = code;
  cursorPos = Math.max(0, Math.min(code.length, code.length + cursorOffset));

  // Redraw the line
  term.write('\r\x1b[K\x1b[34m>\x1b[0m ' + commandBuffer);

  // Position cursor
  const moveBack = commandBuffer.length - cursorPos;
  if (moveBack > 0) {
    term.write(`\x1b[${moveBack}D`);
  }

  // Focus terminal
  term.focus();
}

// Expose globally for GUI onclick handlers
window.runInTerminal = runInTerminal;
window.pasteToTerminal = pasteToTerminal;

/**
 * Get completion candidates for the text before cursor
 */
function getCompletions(textBeforeCursor) {
  // Find the word/expression being typed
  // Match: identifier, or object.property chain
  const match = textBeforeCursor.match(/([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\.?$/);
  if (!match) return { prefix: '', candidates: [] };

  const expr = match[1];
  const parts = expr.split('.');
  const endsWithDot = textBeforeCursor.endsWith('.');

  let targetObj = null;
  let prefix = '';

  if (parts.length === 1 && !endsWithDot) {
    // Completing a global name: "geo" -> "geology"
    prefix = parts[0];
    targetObj = window;
  } else if (endsWithDot) {
    // Completing after a dot: "geology." -> show all methods
    prefix = '';
    try {
      targetObj = evalSafe(expr);
    } catch (e) {
      return { prefix: '', candidates: [] };
    }
  } else {
    // Completing property: "geology.sty" -> "geology.style"
    prefix = parts[parts.length - 1];
    const parentExpr = parts.slice(0, -1).join('.');
    try {
      targetObj = evalSafe(parentExpr);
    } catch (e) {
      return { prefix: '', candidates: [] };
    }
  }

  if (!targetObj) return { prefix, candidates: [] };

  // Get all properties (including inherited)
  const props = new Set();
  let obj = targetObj;

  // For window, only get relevant globals (not all browser APIs)
  if (obj === window) {
    // Add sp and ly namespaces
    props.add('sp');
    props.add('ly');
    // Add common globals
    ['sample', 'load', 'open', 'help', 'layers', 'ls', 'clear', 'json',
     'buffer', 'intersect', 'union', 'centroid', 'clip', 'dissolve', 'voronoi',
     'distance', 'area', 'bearing', 'measure', 'download', 'legend', 'ws', 'fs',
     'workspaces', 'turf', 'ol', 'proj4', 'chroma', 'basemap', 'basemaps',
     'BLEND_MODES'].forEach(g => {
      if (window[g] !== undefined) props.add(g);
    });
  } else if (obj === window.ly) {
    // For ly namespace, add all layer names
    for (const layer of state.layers.values()) {
      props.add(layer.name);
    }
  } else {
    // For objects, get own and prototype properties
    while (obj && obj !== Object.prototype) {
      Object.getOwnPropertyNames(obj).forEach(p => {
        // Skip private/internal properties
        if (!p.startsWith('_') && !p.startsWith('__')) {
          props.add(p);
        }
      });
      obj = Object.getPrototypeOf(obj);
    }
  }

  // Filter by prefix
  const candidates = [...props]
    .filter(p => p.startsWith(prefix) && p !== prefix)
    .sort();

  return { prefix, candidates };
}

/**
 * Safely evaluate an expression to get an object for completion
 */
function evalSafe(expr) {
  // Only allow simple property access, no function calls
  if (/[(){}[\];]/.test(expr)) return null;
  try {
    return eval(expr);
  } catch (e) {
    return null;
  }
}

/**
 * Find the longest common prefix among strings
 */
function findCommonPrefix(strings) {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];

  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === '') return '';
    }
  }
  return prefix;
}

// ============================================
// Path completion for file system commands
// ============================================

// Functions that accept path arguments
const PATH_FUNCTIONS = [
  'ls', 'cat', 'mkdir', 'rm', 'cp', 'mv',
  'fs.ls', 'fs.cat', 'fs.mkdir', 'fs.rm', 'fs.cp', 'fs.mv',
  'fs.read', 'fs.write', 'fs.exists', 'fs.listDir',
  'ws.ls', 'ws.cat', 'ws.mkdir', 'ws.rm', 'ws.cp', 'ws.mv',
  'ws.readFile', 'ws.writeFile', 'ws.exists', 'ws.listDir'
];

/**
 * Check if cursor is inside a string argument to a path function
 * Returns { func, quote, pathStart, pathSoFar } or null
 */
function detectPathContext(textBeforeCursor) {
  // Match patterns like: ls(" or fs.cat(' or ws.readFile("path/to
  for (const func of PATH_FUNCTIONS) {
    // Build regex for this function: funcName\s*\(\s*["']
    const escaped = func.replace('.', '\\.');
    const regex = new RegExp(`${escaped}\\s*\\(\\s*(["'])([^"']*)$`);
    const match = textBeforeCursor.match(regex);
    if (match) {
      return {
        func,
        quote: match[1],
        pathStart: textBeforeCursor.length - match[2].length,
        pathSoFar: match[2]
      };
    }
  }
  return null;
}

/**
 * Get path completions from workspace directory
 */
async function getPathCompletions(pathSoFar) {
  try {
    // Dynamic import to avoid circular dependency
    const { getDirectoryHandle } = await import('../core/workspace.js');
    const dirHandle = getDirectoryHandle();
    if (!dirHandle) return [];

    // Split path into directory and file prefix
    const lastSlash = pathSoFar.lastIndexOf('/');
    let dirPath = '';
    let filePrefix = pathSoFar;

    if (lastSlash >= 0) {
      dirPath = pathSoFar.slice(0, lastSlash);
      filePrefix = pathSoFar.slice(lastSlash + 1);
    }

    // Navigate to the directory
    let handle = dirHandle;
    if (dirPath) {
      const parts = dirPath.split('/').filter(p => p);
      for (const part of parts) {
        try {
          handle = await handle.getDirectoryHandle(part);
        } catch (e) {
          return []; // Path doesn't exist
        }
      }
    }

    // List entries in the directory
    const entries = [];
    for await (const entry of handle.values()) {
      if (entry.name.startsWith(filePrefix)) {
        const suffix = entry.kind === 'directory' ? '/' : '';
        const completion = (dirPath ? dirPath + '/' : '') + entry.name + suffix;
        entries.push(completion);
      }
    }

    return entries.sort();
  } catch (e) {
    return [];
  }
}

// Path completion state
let pathCompletionPending = false;

/**
 * Initialize the xterm.js terminal
 */
export function initTerminal() {
  term = new Terminal({
    fontSize: 13,
    fontFamily: "'IBM Plex Mono', 'Consolas', monospace",
    theme: {
      background: '#000000',
      foreground: '#e0e0e0',
      cursor: '#4a9eff',
      cursorAccent: '#000000',
      selectionBackground: '#4a9eff44'
    },
    cursorBlink: true,
    allowProposedApi: true
  });

  const container = document.getElementById('terminal-container');
  term.open(container);

  // Load and apply fit addon to auto-size terminal to container
  if (window.FitAddon) {
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    // Debounced fit function
    let fitTimeout = null;
    const debouncedFit = () => {
      if (fitTimeout) clearTimeout(fitTimeout);
      fitTimeout = setTimeout(() => {
        try {
          fitAddon.fit();
        } catch (e) {
          // Ignore fit errors during transitions
        }
      }, 20);
    };

    // Initial fit with retries
    debouncedFit();
    setTimeout(debouncedFit, 100);
    setTimeout(debouncedFit, 300);

    // Use ResizeObserver for reliable resize detection
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        debouncedFit();
      });
      resizeObserver.observe(container);
      term._resizeObserver = resizeObserver;
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', debouncedFit);

    // Store for later use
    term._fitAddon = fitAddon;
    term._debouncedFit = debouncedFit;
  }

  // Welcome message
  termPrint('');
  termPrint('  ╲╱╲    SPINIFEX', 'blue');
  termPrint('   ╲╱╲   ultrabasic web gis', 'dim');
  termPrint('  ╲╱╲╱╲  ');
  termPrint('');
  termPrint('JavaScript REPL. Try: load(sample) or help()', 'dim');
  termPrint('Layers: ly.name or ly["name"]. Tab to autocomplete.', 'dim');
  termPrompt();

  // Helper: redraw the current line with cursor at correct position
  const redrawLine = () => {
    // Move to start of line, clear it, write prompt + buffer, position cursor
    term.write('\r\x1b[K\x1b[34m>\x1b[0m ' + commandBuffer);
    // Move cursor back to correct position
    const moveBack = commandBuffer.length - cursorPos;
    if (moveBack > 0) {
      term.write(`\x1b[${moveBack}D`);
    }
  };

  // Helper: set buffer and cursor, then redraw
  const setLine = (newBuffer) => {
    commandBuffer = newBuffer;
    cursorPos = newBuffer.length;
    redrawLine();
  };

  // Handle keyboard input
  term.onKey(({ key, domEvent }) => {
    const code = domEvent.keyCode;

    if (code === 13) {
      // Enter
      term.writeln('');
      if (commandBuffer.trim()) {
        state.history.push(commandBuffer);
        state.historyIndex = state.history.length;
        if (executeCallback) {
          executeCallback(commandBuffer.trim());
        }
      }
      commandBuffer = '';
      cursorPos = 0;
      completionCandidates = [];
      termPrompt();

    } else if (code === 8) {
      // Backspace - delete char before cursor
      if (cursorPos > 0) {
        commandBuffer = commandBuffer.slice(0, cursorPos - 1) + commandBuffer.slice(cursorPos);
        cursorPos--;
        redrawLine();
        completionCandidates = [];
      }

    } else if (code === 46) {
      // Delete - delete char at cursor
      if (cursorPos < commandBuffer.length) {
        commandBuffer = commandBuffer.slice(0, cursorPos) + commandBuffer.slice(cursorPos + 1);
        redrawLine();
        completionCandidates = [];
      }

    } else if (code === 37) {
      // Left arrow - move cursor left
      if (cursorPos > 0) {
        cursorPos--;
        term.write('\x1b[D');
      }

    } else if (code === 39) {
      // Right arrow - move cursor right
      if (cursorPos < commandBuffer.length) {
        cursorPos++;
        term.write('\x1b[C');
      }

    } else if (code === 36) {
      // Home - move to start
      if (cursorPos > 0) {
        term.write(`\x1b[${cursorPos}D`);
        cursorPos = 0;
      }

    } else if (code === 35) {
      // End - move to end
      if (cursorPos < commandBuffer.length) {
        term.write(`\x1b[${commandBuffer.length - cursorPos}C`);
        cursorPos = commandBuffer.length;
      }

    } else if (domEvent.ctrlKey && code === 67) {
      // Ctrl+C - cancel or copy
      const selection = term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      } else {
        commandBuffer = '';
        cursorPos = 0;
        completionCandidates = [];
        term.writeln('^C');
        termPrompt();
      }

    } else if (domEvent.ctrlKey && code === 86) {
      // Ctrl+V - paste
      navigator.clipboard.readText().then(text => {
        if (text) {
          // Only take first line, strip control chars
          const clean = text.split('\n')[0].replace(/[\x00-\x1f]/g, '');
          // Insert at cursor position
          commandBuffer = commandBuffer.slice(0, cursorPos) + clean + commandBuffer.slice(cursorPos);
          cursorPos += clean.length;
          redrawLine();
          completionCandidates = [];
        }
      }).catch(() => {});

    } else if (code === 38) {
      // Up arrow - history
      if (state.historyIndex > 0) {
        state.historyIndex--;
        setLine(state.history[state.historyIndex]);
        completionCandidates = [];
      }

    } else if (code === 40) {
      // Down arrow - history
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        setLine(state.history[state.historyIndex]);
      } else {
        state.historyIndex = state.history.length;
        setLine('');
      }
      completionCandidates = [];

    } else if (code === 9) {
      // Tab - autocomplete
      domEvent.preventDefault();

      const textBeforeCursor = commandBuffer.slice(0, cursorPos);
      const now = Date.now();

      // Check if this is a consecutive Tab press (within 500ms)
      const isConsecutiveTab = (now - lastTabTime) < 500 &&
        completionCandidates.length > 0;
      lastTabTime = now;

      // Check for path context (inside fs function string argument)
      const pathContext = detectPathContext(textBeforeCursor);

      if (isConsecutiveTab && !pathContext) {
        // Cycle through candidates (for regular completion)
        completionIndex = (completionIndex + 1) % completionCandidates.length;
        const completion = completionCandidates[completionIndex];

        // Replace prefix with current candidate
        const beforePrefix = commandBuffer.slice(0, cursorPos - completionPrefix.length);
        const afterCursor = commandBuffer.slice(cursorPos);
        commandBuffer = beforePrefix + completion + afterCursor;
        cursorPos = beforePrefix.length + completion.length;
        redrawLine();
      } else if (pathContext) {
        // Path completion - async
        if (pathCompletionPending) return; // Prevent duplicate requests
        pathCompletionPending = true;

        getPathCompletions(pathContext.pathSoFar).then(candidates => {
          pathCompletionPending = false;

          if (candidates.length === 0) {
            // No path completions, try regular completion
            return;
          }

          // For path completion, we need to track the full path as prefix
          const pathPrefix = pathContext.pathSoFar;
          completionCandidates = candidates;
          completionPrefix = pathPrefix;
          completionIndex = 0;

          if (candidates.length === 1) {
            // Single match - complete it
            const completion = candidates[0];
            const beforePath = commandBuffer.slice(0, pathContext.pathStart);
            const afterCursor = commandBuffer.slice(cursorPos);
            commandBuffer = beforePath + completion + afterCursor;
            cursorPos = beforePath.length + completion.length;
            redrawLine();
            completionCandidates = [];
          } else {
            // Multiple matches - complete common prefix
            const commonPrefix = findCommonPrefix(candidates);
            if (commonPrefix.length > pathPrefix.length) {
              const beforePath = commandBuffer.slice(0, pathContext.pathStart);
              const afterCursor = commandBuffer.slice(cursorPos);
              commandBuffer = beforePath + commonPrefix + afterCursor;
              cursorPos = beforePath.length + commonPrefix.length;
              completionPrefix = commonPrefix;
              redrawLine();
            }

            // Show candidates below prompt
            term.writeln('');
            const maxShow = 12;
            // Show just filenames for display (not full paths)
            const displayCandidates = candidates.map(c => {
              const lastSlash = c.lastIndexOf('/');
              return lastSlash >= 0 ? c.slice(lastSlash + 1) : c;
            });
            const shown = displayCandidates.slice(0, maxShow);
            termPrint(shown.join('  '), 'dim');
            if (candidates.length > maxShow) {
              termPrint(`  ... and ${candidates.length - maxShow} more`, 'dim');
            }
            termPrompt();
            term.write(commandBuffer);
            // Reposition cursor
            const moveBack = commandBuffer.length - cursorPos;
            if (moveBack > 0) {
              term.write(`\x1b[${moveBack}D`);
            }
          }
        });
      } else {
        // Regular completion - get new completions
        const { prefix, candidates } = getCompletions(textBeforeCursor);

        if (candidates.length === 0) {
          // No completions - beep or do nothing
          completionCandidates = [];
          return;
        }

        completionCandidates = candidates;
        completionPrefix = prefix;
        completionIndex = 0;

        if (candidates.length === 1) {
          // Single match - complete it
          const completion = candidates[0];
          const beforePrefix = commandBuffer.slice(0, cursorPos - prefix.length);
          const afterCursor = commandBuffer.slice(cursorPos);
          commandBuffer = beforePrefix + completion + afterCursor;
          cursorPos = beforePrefix.length + completion.length;
          redrawLine();
          completionCandidates = []; // Reset for next tab
        } else {
          // Multiple matches - complete common prefix and show candidates
          const commonPrefix = findCommonPrefix(candidates);
          if (commonPrefix.length > prefix.length) {
            // Complete to common prefix
            const beforePrefix = commandBuffer.slice(0, cursorPos - prefix.length);
            const afterCursor = commandBuffer.slice(cursorPos);
            commandBuffer = beforePrefix + commonPrefix + afterCursor;
            cursorPos = beforePrefix.length + commonPrefix.length;
            completionPrefix = commonPrefix;
            redrawLine();
          }

          // Show candidates below prompt
          term.writeln('');
          const maxShow = 12;
          const shown = candidates.slice(0, maxShow);
          termPrint(shown.join('  '), 'dim');
          if (candidates.length > maxShow) {
            termPrint(`  ... and ${candidates.length - maxShow} more`, 'dim');
          }
          termPrompt();
          term.write(commandBuffer);
          // Reposition cursor
          const moveBack = commandBuffer.length - cursorPos;
          if (moveBack > 0) {
            term.write(`\x1b[${moveBack}D`);
          }
        }
      }

    } else if (key.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
      // Printable characters - insert at cursor position
      // Check key.length === 1 to catch all printable chars (period, comma, etc.)
      commandBuffer = commandBuffer.slice(0, cursorPos) + key + commandBuffer.slice(cursorPos);
      cursorPos++;
      redrawLine();
      // Reset completion state on any other input
      completionCandidates = [];
    }
  });

  return term;
}
