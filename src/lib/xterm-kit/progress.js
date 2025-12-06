/**
 * xterm-kit: Progress Indicators
 * Spinners and progress bars for long-running operations
 */

import { getTheme } from './themes.js';

/**
 * Spinner for indeterminate progress
 */
export class Spinner {
  constructor(term, options = {}) {
    this.term = term;
    this.theme = options.theme || getTheme();
    this.frames = options.frames || ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.interval = options.interval || 80;

    this.currentFrame = 0;
    this.timer = null;
    this.text = '';
    this.isSpinning = false;
  }

  start(text = '') {
    if (this.isSpinning) return;

    this.text = text;
    this.isSpinning = true;
    this.currentFrame = 0;

    // Hide cursor
    this.term.write('\x1b[?25l');

    this.render();

    this.timer = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      this.render();
    }, this.interval);
  }

  update(text) {
    this.text = text;
    if (this.isSpinning) {
      this.render();
    }
  }

  render() {
    const frame = this.frames[this.currentFrame];
    const spinnerColor = this.theme.progress?.spinner || '\x1b[36m';
    const reset = '\x1b[0m';

    this.term.write(`\r\x1b[K${spinnerColor}${frame}${reset} ${this.text}`);
  }

  stop(finalText = null, clearLine = false) {
    if (!this.isSpinning) return;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.isSpinning = false;

    // Show cursor
    this.term.write('\x1b[?25h');

    if (clearLine) {
      this.term.write('\r\x1b[K');
    } else if (finalText !== null) {
      this.term.write(`\r\x1b[K${finalText}\n`);
    } else {
      this.term.writeln('');
    }
  }

  succeed(text) {
    const successColor = this.theme.colors.success;
    this.stop(successColor('✓') + ` ${text}`);
  }

  fail(text) {
    const errorColor = this.theme.colors.error;
    this.stop(errorColor('✗') + ` ${text}`);
  }

  warn(text) {
    const warnColor = this.theme.colors.warning;
    this.stop(warnColor('⚠') + ` ${text}`);
  }
}

/**
 * Progress bar for determinate progress
 */
export class ProgressBar {
  constructor(term, options = {}) {
    this.term = term;
    this.theme = options.theme || getTheme();
    this.width = options.width || 40;
    this.complete = options.complete || '█';
    this.incomplete = options.incomplete || '░';
    this.showPercent = options.showPercent ?? true;

    this.current = 0;
    this.total = 100;
  }

  update(current, total = null, text = '') {
    if (total !== null) {
      this.total = total;
    }
    this.current = current;

    const percent = Math.min(100, Math.max(0, (current / this.total) * 100));
    const completeWidth = Math.floor((percent / 100) * this.width);
    const incompleteWidth = this.width - completeWidth;

    const barColor = this.theme.progress?.bar || '\x1b[32m';
    const bgColor = this.theme.progress?.background || '\x1b[90m';
    const reset = '\x1b[0m';

    const completeStr = this.complete.repeat(completeWidth);
    const incompleteStr = this.incomplete.repeat(incompleteWidth);

    let output = `\r\x1b[K[${barColor}${completeStr}${reset}${bgColor}${incompleteStr}${reset}]`;

    if (this.showPercent) {
      output += ` ${percent.toFixed(0).padStart(3)}%`;
    }

    if (text) {
      output += ` ${text}`;
    }

    this.term.write(output);
  }

  complete(text = 'Done!') {
    this.update(this.total, null, '');
    const successColor = this.theme.colors.success;
    this.term.writeln(` ${successColor(text)}`);
  }

  fail(text = 'Failed!') {
    const errorColor = this.theme.colors.error;
    this.term.writeln(`\r\x1b[K${errorColor(text)}`);
  }
}

/**
 * Multi-step progress tracker
 */
export class StepProgress {
  constructor(term, steps, options = {}) {
    this.term = term;
    this.theme = options.theme || getTheme();
    this.steps = steps;
    this.currentStep = 0;
    this.stepStates = new Array(steps.length).fill('pending');
  }

  start(stepIndex) {
    this.currentStep = stepIndex;
    this.stepStates[stepIndex] = 'active';
    this.render();
  }

  complete(stepIndex) {
    this.stepStates[stepIndex] = 'done';
    this.render();
  }

  error(stepIndex) {
    this.stepStates[stepIndex] = 'error';
    this.render();
  }

  render() {
    this.term.write('\x1b[2J\x1b[H');

    this.steps.forEach((step, i) => {
      const state = this.stepStates[i];
      let icon, color;

      switch (state) {
        case 'done':
          icon = '✓';
          color = this.theme.colors.success;
          break;
        case 'active':
          icon = '▶';
          color = this.theme.colors.primary;
          break;
        case 'error':
          icon = '✗';
          color = this.theme.colors.error;
          break;
        default:
          icon = '○';
          color = this.theme.colors.dim;
      }

      this.term.writeln(`${color(icon)} ${step}`);
    });
  }
}
