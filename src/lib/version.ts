/**
 * Version metadata — Phase 4 (P4.3.4)
 *
 * Single source of truth for build version. Import from here rather than
 * reading process.env directly so tests can inspect and override the value.
 */

/** Build version from package.json. Falls back to "unknown" if not set. */
export const VERSION = process.env.npm_package_version ?? 'unknown'
