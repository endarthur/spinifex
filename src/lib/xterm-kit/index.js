/**
 * xterm-kit - Terminal UI Utilities for Spinifex
 *
 * A collection of utilities for building terminal-based UIs:
 * - Theming and colors
 * - Progress indicators (spinners, progress bars)
 * - Table formatting
 * - Virtual filesystem (IndexedDB/memory)
 * - Output formatting helpers
 */

// Themes
export {
  defaultTheme,
  spinifexTheme,
  setTheme,
  getTheme,
  resetTheme,
  createTheme
} from './themes.js';

// Output utilities
export {
  showError,
  showWarning,
  showSuccess,
  showInfo,
  showPrimary,
  formatSize,
  formatDate,
  wrapText,
  pad,
  truncate
} from './output.js';

// Progress indicators
export {
  Spinner,
  ProgressBar,
  StepProgress
} from './progress.js';

// Table formatting
export {
  Table,
  renderTable
} from './table.js';

// Virtual filesystem
export { VFSLite } from './vfs-lite.js';
