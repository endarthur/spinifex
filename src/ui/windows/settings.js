// Spinifex - Settings Window
// Application settings and theme configuration

import { persistentSettings } from '../../core/settings.js';
import { VERSION, BUILD_DATE } from '../../core/version.js';

// Window instance
let settingsWindow = null;

/**
 * Apply theme to document
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Get current theme
 */
export function getTheme() {
  return persistentSettings.get('ui.theme', 'dark');
}

/**
 * Open Settings window
 */
export function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  const content = createSettingsContent();

  settingsWindow = new WinBox({
    title: 'Settings',
    class: ['settings-window'],
    x: 'center',
    y: 'center',
    width: 340,
    height: 280,
    minwidth: 280,
    minheight: 200,
    mount: content,
    onclose: () => {
      settingsWindow = null;
      return false;
    }
  });
}

/**
 * Create settings window content
 */
function createSettingsContent() {
  const content = document.createElement('div');
  content.className = 'settings-content';

  const themes = [
    { value: 'dark', label: 'Dark (default)' },
    { value: 'light', label: 'Light' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'amber', label: 'Amber' },
    { value: 'koma', label: 'Koma' },
    { value: 'ctp-latte', label: 'Catppuccin Latte' },
    { value: 'ctp-frappe', label: 'Catppuccin Frappé' },
    { value: 'ctp-macchiato', label: 'Catppuccin Macchiato' },
    { value: 'ctp-mocha', label: 'Catppuccin Mocha' }
  ];

  const currentTheme = persistentSettings.get('ui.theme', 'dark');
  const themeOptions = themes.map(t =>
    `<option value="${t.value}" ${currentTheme === t.value ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  content.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title">Appearance</div>

      <div class="settings-row">
        <label class="settings-label">Theme</label>
        <select class="settings-select" id="setting-theme">
          ${themeOptions}
        </select>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">About</div>
      <div class="settings-about">
        <div><strong>Spinifex</strong> v${VERSION}</div>
        <div class="settings-about-dim">Ultrabasic web GIS</div>
        <div class="settings-about-dim">Build: ${BUILD_DATE}</div>
      </div>
    </div>
  `;

  // Wire up theme selector
  setTimeout(() => {
    const themeSelect = document.getElementById('setting-theme');
    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        applyTheme(themeSelect.value);
        persistentSettings.set('ui.theme', themeSelect.value);
      });
    }
  }, 0);

  return content;
}
