/* Home Assistant connection defaults and storage keys. */

export const STORAGE_KEYS = {
  /** JSON: { url: string, token: string } - provided by the Zepp App settings UI */
  HA_CONFIG: 'ha_config',
}

export const DEFAULTS = {
  /** HA base URL example, must be replaced with real user config */
  HA_URL: 'http://homeassistant.local:8123',
}
