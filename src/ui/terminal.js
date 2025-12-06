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

// Expose globally for GUI onclick handlers
window.runInTerminal = runInTerminal;

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
      termPrompt();

    } else if (code === 8) {
      // Backspace - delete char before cursor
      if (cursorPos > 0) {
        commandBuffer = commandBuffer.slice(0, cursorPos - 1) + commandBuffer.slice(cursorPos);
        cursorPos--;
        redrawLine();
      }

    } else if (code === 46) {
      // Delete - delete char at cursor
      if (cursorPos < commandBuffer.length) {
        commandBuffer = commandBuffer.slice(0, cursorPos) + commandBuffer.slice(cursorPos + 1);
        redrawLine();
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
        }
      }).catch(() => {});

    } else if (code === 38) {
      // Up arrow - history
      if (state.historyIndex > 0) {
        state.historyIndex--;
        setLine(state.history[state.historyIndex]);
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

    } else if (key.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
      // Printable characters - insert at cursor position
      // Check key.length === 1 to catch all printable chars (period, comma, etc.)
      commandBuffer = commandBuffer.slice(0, cursorPos) + key + commandBuffer.slice(cursorPos);
      cursorPos++;
      redrawLine();
    }
  });

  return term;
}
