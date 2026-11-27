/* Storage keys, defaults and shared constants for Zepp HA Companion. */

/**
 * settingsStorage keys (phone side, Zepp App persistent storage).
 * Both the Settings App (props.settingsStorage) and the Side Service
 * (settingsLib from @zeppos/zml/base-side) access the same store.
 */
export const STORAGE_KEYS = {
  /** Long-Lived Access Token (TextInput settingsKey, auto-persisted) */
  HA_TOKEN: 'ha_token',
  /** HA base URL, e.g. http://homeassistant.local:8123 (TextInput settingsKey) */
  HA_URL: 'ha_url',
  /** JSON: the whole watch-side config { rev, areas, screens } (written by Settings App) */
  HA_CONFIG: 'ha_config',
  /** JSON: { ok, message, ts, areasCount, entitiesCount } — last connection/sync status */
  HA_STATUS: 'ha_status',
  /** Trigger: Settings App sets a timestamp string to ask Side Service to (re)discover HA */
  HA_SYNC: 'ha_sync',
  /** JSON: { ts, areas: [{id, name}], entities: [{e, n, d, a}] } — discovery cache for Settings App */
  HA_DATA: 'ha_data',
  /** JSON: { hub: {ts, states, areaNames}, areas: {[areaId]: {ts, entities}} } — last good states for offline use */
  HA_CACHE: 'ha_cache',
  /** JSON: { view, areaId, screen, button } — Settings App navigation state */
  HA_UI: 'ha_ui',
  /** Trigger: Settings App sets a timestamp to ask Side Service to run the area diagnostics */
  HA_DIAG: 'ha_diag',
  /** JSON: string[] — step-by-step area discovery diagnostic report (Side Service -> Settings App) */
  HA_DIAG_RESULT: 'ha_diag_result',
}

/** Number of configurable widget screens in the watch app (besides the main one) */
export const SCREEN_COUNT = 6

/**
 * Battery policy: states are refreshed when a page opens, and at most once
 * per this interval while the app stays open. Zepp OS forbids background
 * network for third-party apps (App Service has no fetch), so this is the
 * most often data can ever be refreshed.
 */
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000

/**
 * Grid of button slots on one widget screen: 4 columns x 3 rows of quarter-width
 * cells (GEOM 2). Sizes occupy: xs = 1 cell, s = 2 cells (half row), l = full row.
 * Legacy configs (no config.geom) used a 2-column grid — the settings app remaps
 * their slots on first load and stamps config.geom = GEOM_VERSION.
 */
export const GRID_COLS = 4
export const GRID_ROWS = 3
export const SLOT_COUNT = GRID_COLS * GRID_ROWS
export const GEOM_VERSION = 2

/** Color palette shared by phone editor and watch renderer (hex strings) */
export const PALETTE = [
  { name: 'Red', value: '#E53935' },
  { name: 'Orange', value: '#FB8C00' },
  { name: 'Yellow', value: '#FDD835' },
  { name: 'Green', value: '#43A047' },
  { name: 'Cyan', value: '#00ACC1' },
  { name: 'Blue', value: '#1E88E5' },
  { name: 'Purple', value: '#5E35B1' },
  { name: 'Pink', value: '#D81B60' },
  { name: 'Brown', value: '#8D6E63' },
  { name: 'Slate', value: '#546E7A' },
]

export const SHAPES = [
  { name: 'Square', value: 'rect' },
  { name: 'Rounded', value: 'round' },
  { name: 'Circle', value: 'circle' },
]

export const SIZES = [
  { name: 'Small (1/4 width)', value: 'xs' },
  { name: 'Medium (1 cell)', value: 's' },
  { name: 'Large (full row)', value: 'l' },
]

export const ACTIONS = [
  { name: 'Auto (toggle / fire)', value: 'auto' },
  { name: 'Run (fire / trigger)', value: 'run' },
  { name: 'Turn on', value: 'on' },
  { name: 'Turn off', value: 'off' },
]

export const DEFAULT_BUTTON = {
  entity: '',
  label: '',
  action: 'auto',
  colorOn: '#43A047',
  colorOff: '#546E7A',
  shape: 'round',
  size: 's',
  slot: 0,
}

/** Fresh default configuration (used when settingsStorage `ha_config` is absent) */
export function defaultConfig() {
  const screens = []
  for (let i = 0; i < SCREEN_COUNT; i++) {
    screens.push({ id: i, name: 'Screen ' + (i + 1), enabled: i === 0, buttons: [] })
  }
  return { rev: 1, geom: GEOM_VERSION, areas: {}, screens }
}

/** HA base URL example, must be replaced with real user config */
export const HA_URL_EXAMPLE = 'http://homeassistant.local:8123'
