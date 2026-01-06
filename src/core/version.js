// Spinifex - Version Information
// Helps debugging in the wild when users report issues

export const VERSION = '0.1.0';
export const BUILD_DATE = '2025-01-06';

/**
 * Get version info object
 */
export function getVersionInfo() {
  return {
    version: VERSION,
    buildDate: BUILD_DATE,
    name: 'Spinifex',
    description: 'Ultrabasic web GIS'
  };
}

/**
 * Print version info to console
 */
export function printVersion() {
  console.log(`Spinifex v${VERSION} (${BUILD_DATE})`);
  return `v${VERSION}`;
}
