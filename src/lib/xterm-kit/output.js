/**
 * xterm-kit: Terminal Output Utilities
 * Colored output and formatting helpers
 */

import { getTheme } from './themes.js';

/**
 * Display error message in terminal with consistent formatting
 */
export function showError(term, commandOrMessage, message = null, theme = null) {
  const currentTheme = theme || getTheme();

  if (message === null) {
    term.writeln(currentTheme.colors.error(commandOrMessage));
  } else {
    term.writeln(currentTheme.colors.error(`${commandOrMessage}: ${message}`));
  }
}

/**
 * Display warning message in terminal
 */
export function showWarning(term, message, theme = null) {
  const currentTheme = theme || getTheme();
  term.writeln(currentTheme.colors.warning(message));
}

/**
 * Display success message in terminal
 */
export function showSuccess(term, message, theme = null) {
  const currentTheme = theme || getTheme();
  term.writeln(currentTheme.colors.success(message));
}

/**
 * Display info message in terminal (gray/dimmed)
 */
export function showInfo(term, message, theme = null) {
  const currentTheme = theme || getTheme();
  term.writeln(currentTheme.colors.info(message));
}

/**
 * Display primary/highlighted message in terminal
 */
export function showPrimary(term, message, theme = null) {
  const currentTheme = theme || getTheme();
  term.writeln(currentTheme.colors.primary(message));
}

/**
 * Format file size for display
 */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

/**
 * Format date for display in terminal
 */
export function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (date.getFullYear() === now.getFullYear()) {
    const month = months[date.getMonth()];
    const day = date.getDate().toString().padStart(2, ' ');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month} ${day} ${hours}:${minutes}`;
  }

  const month = months[date.getMonth()];
  const day = date.getDate().toString().padStart(2, ' ');
  const year = date.getFullYear();
  return `${month} ${day}  ${year}`;
}

/**
 * Wrap text at specified width
 */
export function wrapText(text, width = 80) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Pad string to specified width
 */
export function pad(str, width, align = 'left') {
  const strLen = str.length;
  if (strLen >= width) return str;

  const padding = width - strLen;

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + str;
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    default:
      return str + ' '.repeat(padding);
  }
}

/**
 * Truncate string to specified width with ellipsis
 */
export function truncate(str, width, ellipsis = '...') {
  if (str.length <= width) return str;
  return str.slice(0, width - ellipsis.length) + ellipsis;
}
