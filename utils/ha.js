/*
 * Home Assistant domain/action model shared by Side Service and watch pages.
 *
 * HA exposes per-domain services; the app resolves a logical action
 * ('auto' | 'on' | 'off' | 'run') into a concrete `domain/service` call,
 * and decides whether an entity is "on" from its state string.
 */

/** Per-domain service names. `toggle` optional; fallback is homeassistant.turn_on/off. */
export const SERVICE_MAP = {
  light: { on: ['light', 'turn_on'], off: ['light', 'turn_off'], toggle: ['light', 'toggle'] },
  switch: { on: ['switch', 'turn_on'], off: ['switch', 'turn_off'], toggle: ['switch', 'toggle'] },
  input_boolean: {
    on: ['input_boolean', 'turn_on'],
    off: ['input_boolean', 'turn_off'],
    toggle: ['input_boolean', 'toggle'],
  },
  fan: { on: ['fan', 'turn_on'], off: ['fan', 'turn_off'], toggle: ['fan', 'toggle'] },
  humidifier: { on: ['humidifier', 'turn_on'], off: ['humidifier', 'turn_off'] },
  media_player: {
    on: ['media_player', 'turn_on'],
    off: ['media_player', 'turn_off'],
    toggle: ['media_player', 'media_play_pause'],
  },
  remote: { on: ['remote', 'turn_on'], off: ['remote', 'turn_off'], toggle: ['remote', 'toggle'] },
  climate: { on: ['climate', 'turn_on'], off: ['climate', 'turn_off'] },
  vacuum: { on: ['vacuum', 'start'], off: ['vacuum', 'turn_off'] },
  scene: { on: ['scene', 'turn_on'], run: ['scene', 'turn_on'] },
  script: { on: ['script', 'turn_on'], run: ['script', 'turn_on'], toggle: ['script', 'toggle'] },
  automation: {
    on: ['automation', 'turn_on'],
    off: ['automation', 'turn_off'],
    run: ['automation', 'trigger'],
  },
  group: { on: ['homeassistant', 'turn_on'], off: ['homeassistant', 'turn_off'] },
  cover: { on: ['cover', 'open_cover'], off: ['cover', 'close_cover'] },
  lock: { on: ['lock', 'lock'], off: ['lock', 'unlock'] },
}

const GENERIC = { on: ['homeassistant', 'turn_on'], off: ['homeassistant', 'turn_off'] }

/** Domains the user can act upon (everything else is display-only). */
export const ACTIONABLE_DOMAINS = Object.keys(SERVICE_MAP)

/** State strings that mean "on" per domain (default: `on`). */
const ON_STATES = {
  cover: ['open', 'opening'],
  lock: ['locked'],
  vacuum: ['cleaning', 'docked', 'returning', 'paused'],
}

/** Split `light.kitchen` into { domain, id } */
export function splitEntity(entityId) {
  const i = entityId.indexOf('.')
  return { domain: i > 0 ? entityId.slice(0, i) : entityId, id: entityId }
}

/** Resolve logical action ('auto'|'on'|'off'|'run') for current state -> [domain, service] or null */
export function resolveService(entityId, state, action) {
  const { domain } = splitEntity(entityId)
  const map = SERVICE_MAP[domain] || GENERIC
  if (action === 'run' && (map.run || map.on)) return map.run || map.on
  if (action === 'on' && map.on) return map.on
  if (action === 'off' && map.off) return map.off
  // auto: toggle if the domain has one; otherwise switch by current state.
  // For scene/automation (no off) `isOn` is false, so auto fires/turns them on.
  if (map.toggle) return map.toggle
  if (isOn(domain, state)) return map.off || null
  return map.on || null
}

/** Whether the entity state means "on" (drives colors on the watch). */
export function isOn(domain, state) {
  if (!state) return false
  const on = ON_STATES[domain] || ['on']
  return on.indexOf(state) >= 0
}

/** Whether tapping the entity should do something at all. */
export function isActionable(entityId) {
  return ACTIONABLE_DOMAINS.indexOf(splitEntity(entityId).domain) >= 0
}
