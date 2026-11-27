import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { STORAGE_KEYS, defaultConfig } from '../utils/config/constants'
import { splitEntity, isOn, resolveService } from '../utils/ha'

// app-side (phone runtime) does not reliably bundle @zos/utils (rollup warns
// "could not be resolved"), so log through console.log like the official
// fetch-api sample does.
function sideLog() {
  try {
    console.log.apply(console, ['[ha-side]'].concat(Array.prototype.slice.call(arguments)))
  } catch (e) {
    // logging must never break the service
  }
}
const logger = { log: sideLog, error: sideLog, debug: sideLog }
sideLog('module load')

/* ------------------------------------------------------------------ */
/* settingsStorage helpers (phone-side persistent storage, zml wrapper) */
/* ------------------------------------------------------------------ */

function readJson(key, fallback) {
  try {
    const raw = settingsLib.getItem(key)
    if (raw === undefined || raw === null || raw === '') return fallback
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) {
    logger.log('readJson error', key, e)
    return fallback
  }
}

function writeJson(key, value) {
  settingsLib.setItem(key, JSON.stringify(value))
}

function getHaConfig() {
  const url = (settingsLib.getItem(STORAGE_KEYS.HA_URL) || '').replace(/\/+$/, '')
  const token = settingsLib.getItem(STORAGE_KEYS.HA_TOKEN) || ''
  if (!url || !token) return null
  return { url, token }
}

function setStatus(ok, message, extra) {
  const status = Object.assign(
    { ok: !!ok, message: message || '', ts: new Date().toISOString() },
    extra || {}
  )
  writeJson(STORAGE_KEYS.HA_STATUS, status)
  // tell an open watch page that something changed
  this.call({ method: 'status.changed', params: status })
}

/* -------------------------- HA REST client ------------------------ */

async function haFetch(ha, path, options) {
  const response = await fetch({
    url: `${ha.url}${path}`,
    method: (options && options.method) || 'GET',
    headers: {
      Authorization: `Bearer ${ha.token}`,
      'Content-Type': 'application/json',
    },
    body: options && options.body ? JSON.stringify(options.body) : undefined,
    timeout: 15000,
  })
  const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
  return body
}

async function haGetStates(ha) {
  return haFetch(ha, '/api/states')
}

/**
 * Entity -> area mapping via the Jinja template endpoint (Zepp OS has no
 * WebSocket, so the HA area/device registries are not directly reachable;
 * `area_id()` / `area_name()` template functions cover both for us).
 * Returns { [entity_id]: areaId, ... }; failed lookups map to ''.
 */
async function haFetchText(ha, path) {
  const response = await fetch({
    url: `${ha.url}${path}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${ha.token}` },
    timeout: 15000,
  })
  return typeof response.body === 'string' ? response.body : String(response.body)
}

/**
 * POST raw text body (used for /api/template). Some reverse proxies/WAFs block
 * GET /api/template?template=... (405) but pass POST with text/plain bodies.
 */
async function haPostText(ha, path, body) {
  return haPost(ha, path, body, 'text/plain')
}

async function haPost(ha, path, body, contentType) {
  const response = await fetch({
    url: `${ha.url}${path}`,
    method: 'POST',
    headers: { Authorization: `Bearer ${ha.token}`, 'Content-Type': contentType },
    body,
    timeout: 15000,
  })
  return typeof response.body === 'string' ? response.body : String(response.body)
}

/** Parse `entity|area` lines from a template response into map/mapped. */
function parseAreaLines(raw) {
  const map = {}
  let parsed = 0
  String(raw)
    .split('\n')
    .forEach((line) => {
      const i = line.indexOf('|')
      if (i <= 0) return
      const entity = line.slice(0, i).trim()
      if (!entity || /\s/.test(entity)) return
      let area = line.slice(i + 1).trim()
      if (!area || area === 'None') area = ''
      map[entity] = area
      parsed++
    })
  let mapped = 0
  Object.keys(map).forEach((k) => map[k] && mapped++)
  return { map, parsed, mapped }
}

/**
 * Entity -> area map with diagnostics. Strategies:
 * 1) POST /api/template + area_id() — the WAF-friendly form (GET may be blocked);
 * 2) GET /api/template?template= — older/simpler setups;
 * 3) legacy registry REST /api/config/entity_registry/list — when the template
 *    endpoint is unavailable (note: misses device-inherited areas).
 * Returns { map, source, mapped }; source is 'template' | 'template-get' | 'registry' | 'none'.
 */
async function haAreaMap(ha) {
  const template = '{% for s in states %}{{ s.entity_id }}|{{ area_id(s.entity_id) }}\n{% endfor %}'
  try {
    const raw = await haPostText(ha, '/api/template', template)
    const r = parseAreaLines(raw)
    if (r.parsed > 0) return { map: r.map, source: 'template', mapped: r.mapped }
    logger.log('area template(POST) produced nothing, raw head:', String(raw).slice(0, 120))
  } catch (e) {
    logger.log('area template(POST) failed', e)
  }
  // Some phone bridges/proxies mangle text/plain POST bodies (HA then answers 400).
  // HA also accepts the canonical JSON form {"template": "..."} — try that transport.
  try {
    const raw = await haPost(ha, '/api/template', JSON.stringify({ template }), 'application/json')
    const r = parseAreaLines(raw)
    if (r.parsed > 0) return { map: r.map, source: 'template-json', mapped: r.mapped }
    logger.log('area template(POST json) produced nothing, raw head:', String(raw).slice(0, 120))
  } catch (e) {
    logger.log('area template(POST json) failed', e)
  }
  try {
    const raw = await haFetchText(ha, '/api/template?template=' + encodeURIComponent(template))
    const r = parseAreaLines(raw)
    if (r.parsed > 0) return { map: r.map, source: 'template-get', mapped: r.mapped }
    logger.log('area template(GET) produced nothing, raw head:', String(raw).slice(0, 120))
  } catch (e) {
    logger.log('area template(GET) failed', e)
  }
  try {
    const raw = await haFetchText(ha, '/api/config/entity_registry/list')
    const data = JSON.parse(raw)
    const entries = (data && data.entities) || (Array.isArray(data) ? data : [])
    const map = {}
    let mapped = 0
    entries.forEach((en) => {
      if (!en || !en.entity_id) return
      const area = en.area_id || ''
      map[en.entity_id] = area
      if (area) mapped++
    })
    if (entries.length) return { map, source: 'registry', mapped }
  } catch (e) {
    logger.log('area registry fallback failed', e)
  }
  return { map: {}, source: 'none', mapped: 0 }
}

/* ------------------------- area diagnostics -------------------------- */
/* Remote debugging aid: probes every endpoint area discovery depends on and  */
/* stores a step-by-step report in settingsStorage (`ha_diag_result`), which  */
/* the Settings app renders. Triggered by writing `ha_diag` (Settings →       */
/* "Area diagnostics"). Lines stay short — zml/storage payloads are small.    */

async function probe(ha, path, method, body, contentType) {
  try {
    const headers = { Authorization: `Bearer ${ha.token}` }
    if (contentType) headers['Content-Type'] = contentType
    const response = await fetch({
      url: `${ha.url}${path}`,
      method,
      headers,
      body,
      timeout: 15000,
    })
    const code = response && (response.status || response.statusCode || response.code)
// Body may be auto-parsed by the phone bridge (objects for JSON responses) — stringify.
    const raw = response && (typeof response.body === 'string' ? response.body : JSON.stringify(response.body))
    return 'HTTP ' + code + ' (' + typeof response.body + ') | ' + String(raw || '').slice(0, 140).replace(/\n/g, '\\n')
  } catch (e) {
    return 'ERR ' + String((e && (e.errMsg || e.message)) || e).slice(0, 70)
  }
}

async function runAreaDiag() {
  const lines = []
  const push = (s) => {
    lines.push(s)
    logger.log('diag', s)
  }
  writeJson(STORAGE_KEYS.HA_DIAG_RESULT, lines) // progressive: UI shows steps as they land
  try {
    const ha = getHaConfig()
    push('DIAG ' + new Date().toISOString())
    if (!ha) {
      push('HA_NOT_CONFIGURED')
      writeJson(STORAGE_KEYS.HA_DIAG_RESULT, lines)
      return
    }
    push('url: ' + ha.url + ' token:' + ha.token.length + 'ch')
    const T_FULL = '{% for s in states %}{{ s.entity_id }}|{{ area_id(s.entity_id) }}\n{% endfor %}'
    push('1 GET /api/ -> ' + (await probe(ha, '/api/', 'GET')))
    push('2 POST tpl "1" -> ' + (await probe(ha, '/api/template', 'POST', '1', 'text/plain')))
    push('3 POST tpl FULL -> ' + (await probe(ha, '/api/template', 'POST', T_FULL, 'text/plain')))
    push('4 GET tpl -> ' + (await probe(ha, '/api/template?template=' + encodeURIComponent(T_FULL), 'GET')))
    push('5 GET registry -> ' + (await probe(ha, '/api/config/entity_registry/list', 'GET')))
    push('6 GET /api/areas -> ' + (await probe(ha, '/api/areas', 'GET')))
    const am = await haAreaMap(ha)
    push('7 haAreaMap -> ' + am.source + ' entries=' + Object.keys(am.map).length + ' mapped=' + am.mapped)
    // transport variants that may survive bridge/proxy body mangling:
    push('8 POST tpl json-str -> ' + (await probe(ha, '/api/template', 'POST', JSON.stringify('1'), 'application/json')))
    push('9 POST tpl json-obj -> ' + (await probe(ha, '/api/template', 'POST', JSON.stringify({ template: T_FULL }), 'application/json')))
    push('10 POST tpl no-CT -> ' + (await probe(ha, '/api/template', 'POST', '1')))
    push('11 POST tpl str-in-CT -> ' + (await probe(ha, '/api/template', 'POST', JSON.stringify('1'), 'text/plain')))
    push('12 GET tpl plain -> ' + (await probe(ha, '/api/template?template=1', 'GET')))
  } catch (e) {
    push('DIAG_CRASH ' + String((e && e.message) || e).slice(0, 70))
  }
  writeJson(STORAGE_KEYS.HA_DIAG_RESULT, lines)
}

/** Compact entity states list [{e, n, s, on}] for the given ids (or all actionable). */
async function haCompactStates(ha, wantedIds) {
  const states = await haGetStates(ha)
  const wanted = wantedIds && wantedIds.length ? {} : null
  if (wanted) wantedIds.forEach((id) => (wanted[id] = true))
  const out = []
  ;(states || []).forEach((s) => {
    if (wanted && !wanted[s.entity_id]) return
    const { domain } = splitEntity(s.entity_id)
    out.push({
      e: s.entity_id,
      n: (s.attributes && s.attributes.friendly_name) || s.entity_id,
      s: s.state,
      on: isOn(domain, s.state),
    })
  })
  return out
}

/* ------------------------- last-good state cache --------------------- */
/* The watch reads HA through the phone (Bluetooth), so a fetch can fail either  */
/* because HA is down or because the phone lost the watch link. On success we    */
/* store a compact snapshot; on failure we serve it with `cached:true` + age so   */
/* the UI still paints something (graceful degradation) instead of an error.      */

function readCache() {
  return readJson(STORAGE_KEYS.HA_CACHE, {})
}

function cacheHub(cache, states, areaNames) {
  cache.hub = { ts: Date.now(), states, areaNames }
  writeJson(STORAGE_KEYS.HA_CACHE, cache)
}

function cacheArea(cache, areaId, entities) {
  if (!cache.areas) cache.areas = {}
  cache.areas[areaId] = { ts: Date.now(), entities }
  writeJson(STORAGE_KEYS.HA_CACHE, cache)
}

/* --------------------------- discovery ---------------------------- */

/**
 * Probe HA, pull all entities with areas, cache to settingsStorage
 * (`ha_data`) which also re-renders the Settings App.
 */
async function discover(ctx) {
  const ha = getHaConfig()
  if (!ha) {
    setStatus.call(ctx, false, 'NOT_CONFIGURED')
    return
  }
  try {
    const info = await haFetch(ha, '/api/')
    if (!info || info.message !== 'API running.') {
      setStatus.call(ctx, false, 'API_NOT_RUNNING')
      return
    }
    const [states, areaRes] = await Promise.all([haGetStates(ha), haAreaMap(ha)])
    const areaMap = areaRes.map

    const areaNames = {}
    try {
      // friendly area names: prefer modern GET /api/areas, fall back to a
      // cheap template call for the unique ids only
      const ids = {}
      Object.keys(areaMap).forEach((id) => areaMap[id] && (ids[areaMap[id]] = true))
      const list = Object.keys(ids)
      if (list.length) {
        try {
          const rawAreas = await haFetchText(ha, '/api/areas')
          const arr = JSON.parse(rawAreas)
          if (Array.isArray(arr)) {
            arr.forEach((a) => {
              if (a && a.area_id && a.name && ids[a.area_id]) areaNames[a.area_id] = a.name
            })
          }
        } catch (e) {
          logger.log('/api/areas not available, using template', e)
        }
        const missing = list.filter((id) => !areaNames[id])
        if (missing.length) {
          const t = '{% for a in [' + missing.map((id) => JSON.stringify(id)).join(',') + '] %}{{ a }}|{{ area_name(a) }}\n{% endfor %}'
          let raw = ''
          try {
            raw = await haPostText(ha, '/api/template', t)
          } catch (e) {
            logger.log('area names template(POST) failed, trying GET', e)
            raw = await haFetchText(ha, '/api/template?template=' + encodeURIComponent(t))
          }
          String(raw)
            .split('\n')
            .forEach((line) => {
              const i = line.indexOf('|')
              if (i <= 0) return
              const id = line.slice(0, i)
              let name = line.slice(i + 1).trim()
              if (name && name !== 'None') areaNames[id] = name
            })
        }
      }
    } catch (e) {
      logger.log('area names lookup failed', e)
    }

    const areas = {}
    const entities = []
    let hidden = 0
    ;(states || []).forEach((s) => {
      // entities hidden in the HA UI (attributes.hidden_at) are noise for the watch lists
      const hiddenAt = s.attributes && s.attributes.hidden_at
      if (Array.isArray(hiddenAt) ? hiddenAt.length > 0 : !!hiddenAt) {
        hidden++
        return
      }
      const areaId = areaMap[s.entity_id] || ''
      if (areaId && !areas[areaId]) {
        areas[areaId] = { id: areaId, name: areaNames[areaId] || areaId }
      }
      entities.push({
        e: s.entity_id,
        n: (s.attributes && s.attributes.friendly_name) || s.entity_id,
        d: splitEntity(s.entity_id).domain,
        a: areaId,
      })
    })

    const areaList = Object.keys(areas).map((k) => areas[k])
    if (entities.some((e) => !e.a)) areaList.push({ id: '__none__', name: 'Unassigned' })
    areaList.sort((a, b) => (a.name > b.name ? 1 : -1))

    writeJson(STORAGE_KEYS.HA_DATA, {
      ts: new Date().toISOString(),
      version: info.version || '',
      areas: areaList,
      entities,
    })
    setStatus.call(ctx, true, 'OK', {
      version: info.version || '',
      areasCount: areaList.length,
      entitiesCount: entities.length,
      hiddenCount: hidden,
      areaSource: areaRes.source,
      areaMapped: areaRes.mapped,
      areaStateCount: areaList.filter((a) => a.id !== '__none__').length,
    })
  } catch (error) {
    logger.log('discover error', error)
    setStatus.call(ctx, false, String((error && error.message) || error))
  }
}

/* ------------------------- zml service wiring ---------------------- */

function reply(res, data) {
  res(null, data)
}

AppSideService(
  BaseSideService({
    onInit() {
      logger.log('HA side service init')
    },

    onRequest(req, res) {
      // never let a handler exception kill the service silently: reply an error instead
      try {
        this.handleRequest(req, res)
      } catch (error) {
        logger.log('handler crash', error)
        try {
          reply(res, { error: 'HANDLER_CRASH: ' + ((error && error.message) || error) })
        } catch (e) {
          logger.log('reply failed', e)
        }
      }
    },

    handleRequest(req, res) {
      const params = (req && req.params) || {}
      logger.log('onRequest', req && req.method)
      switch (req.method) {
        case 'TEST_CONNECTION': {
          const ha = getHaConfig()
          if (!ha) return reply(res, { connected: false, error: 'NOT_CONFIGURED' })
          haFetch(ha, '/api/')
            .then((info) => reply(res, { connected: info && info.message === 'API running.', version: (info && info.version) || '' }))
            .catch((error) => reply(res, { connected: false, error: String((error && error.message) || error) }))
          break
        }

        case 'GET_HUB': {
          // One round-trip payload for the watch home swiper: config meta +
          // live states of every entity referenced by a screen button. On a
          // live fetch we refresh the cache; on failure we serve the cache.
          const config = readJson(STORAGE_KEYS.HA_CONFIG, defaultConfig())
          const status = readJson(STORAGE_KEYS.HA_STATUS, null)
          const data = readJson(STORAGE_KEYS.HA_DATA, null)
          // older/partial statuses may miss the version — fall back to the one cached by discover()
          if (status && !status.version && data && data.version) status.version = data.version
          const cache = readCache()
          const areaNames = {}
          if (data && data.areas) data.areas.forEach((a) => (areaNames[a.id] = a.name))
          if (cache.hub && cache.hub.areaNames) {
            Object.keys(cache.hub.areaNames).forEach((k) => {
              if (!areaNames[k]) areaNames[k] = cache.hub.areaNames[k]
            })
          }
          const wanted = {}
          config.screens.forEach((scr) =>
            (scr.buttons || []).forEach((b) => b.entity && (wanted[b.entity] = true))
          )
          const ha = getHaConfig()
          const wantedList = Object.keys(wanted)
          if (!ha) {
            return reply(res, { config, status, areaNames, states: null, error: 'NOT_CONFIGURED' })
          }
          if (!wantedList.length) {
            return reply(res, { config, status, areaNames, states: [], error: null, cached: false })
          }
          haCompactStates(ha, wantedList)
            .then((states) => {
              cacheHub(cache, states, areaNames)
              reply(res, { config, status, areaNames, states, error: null, cached: false })
            })
            .catch((error) => {
              if (cache.hub && cache.hub.states) {
                reply(res, {
                  config,
                  status,
                  areaNames,
                  states: cache.hub.states,
                  error: null,
                  cached: true,
                  age: Date.now() - cache.hub.ts,
                })
              } else {
                reply(res, {
                  config,
                  status,
                  areaNames,
                  states: null,
                  error: String((error && error.message) || error),
                })
              }
            })
          break
        }

        case 'GET_AREA': {
          const config = readJson(STORAGE_KEYS.HA_CONFIG, defaultConfig())
          const data = readJson(STORAGE_KEYS.HA_DATA, null)
          const cache = readCache()
          const cachedArea = (cache.areas || {})[params.areaId] || null
          const areaCfg = (config.areas || {})[params.areaId]
          if (!areaCfg || !data || !data.entities) {
            if (cachedArea && cachedArea.entities) {
              return reply(res, {
                entities: cachedArea.entities,
                error: null,
                cached: true,
                age: Date.now() - cachedArea.ts,
              })
            }
            return reply(res, { entities: [], error: 'NOT_CONFIGURED' })
          }
          const wanted = Object.keys(areaCfg.entities || {}).filter((id) => areaCfg.entities[id])
          if (!wanted.length) return reply(res, { entities: [], error: null, cached: false })
          const nameById = {}
          data.entities.forEach((e) => (nameById[e.e] = e.n))
          const patchNames = (states) => {
            states.forEach((s) => {
              if (!s.n || s.n === s.e) s.n = nameById[s.e] || s.n
            })
            return states
          }
          const ha = getHaConfig()
          if (!ha) {
            if (cachedArea && cachedArea.entities) {
              return reply(res, {
                entities: cachedArea.entities,
                error: null,
                cached: true,
                age: Date.now() - cachedArea.ts,
              })
            }
            return reply(res, { entities: [], error: 'NOT_CONFIGURED' })
          }
          haCompactStates(ha, wanted)
            .then(patchNames)
            .then((states) => {
              cacheArea(cache, params.areaId, states)
              reply(res, { entities: states, error: null, cached: false })
            })
            .catch((error) => {
              if (cachedArea && cachedArea.entities) {
                reply(res, {
                  entities: cachedArea.entities,
                  error: null,
                  cached: true,
                  age: Date.now() - cachedArea.ts,
                })
              } else {
                reply(res, { entities: [], error: String((error && error.message) || error) })
              }
            })
          break
        }

        case 'CALL': {
          const ha = getHaConfig()
          if (!ha) return reply(res, { ok: false, error: 'NOT_CONFIGURED' })
          const entity = params.entity
          if (!entity) return reply(res, { ok: false, error: 'NO_ENTITY' })
          // resolve action against the current state, then fire the service
          haFetch(ha, `/api/states/${encodeURIComponent(entity)}`)
            .then((current) => {
              const state = current && current.state
              const svc = resolveService(entity, state, params.action || 'auto')
              if (!svc) throw new Error('NO_SERVICE_FOR_' + entity)
              return haFetch(ha, `/api/services/${svc[0]}/${svc[1]}`, {
                method: 'POST',
                body: { entity_id: entity },
              }).then(() => ({ ok: true, entity, action: svc[1] }))
            })
            .catch((error) => {
              logger.log('CALL error', entity, error)
              return { ok: false, error: String((error && error.message) || error) }
            })
            .then((result) => reply(res, result))
          break
        }

        default:
          reply(res, { error: 'UNKNOWN_METHOD' })
      }
    },

    onSettingsChange(evt) {
      try {
        // native change events differ in shape across firmware: plain key string
        // or an object like { key, value } / launchArgs — normalize defensively
        const key = typeof evt === 'string' ? evt : (evt && (evt.key || evt.settingsKey)) || ''
        logger.log('settingsChange', key, JSON.stringify(evt || ''))
        if (key === STORAGE_KEYS.HA_SYNC) {
          discover(this)
        } else if (key === STORAGE_KEYS.HA_DIAG) {
          runAreaDiag()
        } else if (key === STORAGE_KEYS.HA_CONFIG) {
          this.call({ method: 'config.changed', params: {} })
        }
      } catch (error) {
        logger.log('onSettingsChange crash', error)
      }
    },

    onRun() {},

    onDestroy() {
      logger.log('HA side service destroy')
    },
  })
)
