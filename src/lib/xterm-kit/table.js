/**
 * xterm-kit: Table Formatter
 * Tabular data formatting for terminal output
 */

import { getTheme } from './themes.js';
import { pad, truncate } from './output.js';

/**
 * Table formatter for structured data display
 */
export class Table {
  constructor(options = {}) {
    this.columns = options.columns || [];
    this.align = options.align || new Array(this.columns.length).fill('left');
    this.widths = options.widths || null;
    this.showHeader = options.header ?? true;
    this.showBorders = options.borders ?? false;
    this.theme = options.theme || getTheme();

    this.rows = [];
  }

  addRow(row) {
    if (!Array.isArray(row)) {
      row = this.columns.map(col => row[col] || '');
    }

    this.rows.push(row.map(cell => String(cell)));
  }

  calculateWidths() {
    if (this.widths) return this.widths;

    const widths = this.columns.map(col => col.length);

    for (const row of this.rows) {
      row.forEach((cell, i) => {
        widths[i] = Math.max(widths[i], String(cell).length);
      });
    }

    return widths;
  }

  render(term) {
    const widths = this.calculateWidths();

    if (this.showHeader) {
      const headerRow = this.columns.map((col, i) => {
        const cell = pad(col, widths[i], this.align[i]);
        return this.theme.table.header(cell);
      }).join('  ');

      term.writeln(headerRow);

      if (this.showBorders) {
        const separator = widths.map(w => '-'.repeat(w)).join('--');
        term.writeln(this.theme.table.border + separator + '\x1b[0m');
      }
    }

    this.rows.forEach((row, rowIndex) => {
      const formattedRow = row.map((cell, i) => {
        return pad(cell, widths[i], this.align[i]);
      }).join('  ');

      term.writeln(formattedRow);

      if (this.showBorders && rowIndex < this.rows.length - 1) {
        const separator = widths.map(w => '─'.repeat(w)).join('──');
        term.writeln(this.theme.table.border + separator + '\x1b[0m');
      }
    });
  }

  toLines() {
    const widths = this.calculateWidths();
    const lines = [];

    if (this.showHeader) {
      const headerRow = this.columns.map((col, i) => {
        return pad(col, widths[i], this.align[i]);
      }).join('  ');

      lines.push(headerRow);

      if (this.showBorders) {
        const separator = widths.map(w => '-'.repeat(w)).join('--');
        lines.push(separator);
      }
    }

    this.rows.forEach((row, rowIndex) => {
      const formattedRow = row.map((cell, i) => {
        return pad(cell, widths[i], this.align[i]);
      }).join('  ');

      lines.push(formattedRow);

      if (this.showBorders && rowIndex < this.rows.length - 1) {
        const separator = widths.map(w => '─'.repeat(w)).join('──');
        lines.push(separator);
      }
    });

    return lines;
  }

  clear() {
    this.rows = [];
  }
}

/**
 * Quick table rendering helper
 */
export function renderTable(term, options) {
  const table = new Table(options);

  for (const row of options.rows) {
    table.addRow(row);
  }

  table.render(term);
}
