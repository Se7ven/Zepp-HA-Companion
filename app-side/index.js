import { log } from '@zos/utils'
import { settingsStorage } from '@zos/settings'
import { BaseSideService } from '@zeppos/zml/base-side'

const logger = log.getLogger('ha-side')

/**
 * Read Home Assistant connection settings.
 *
 * Settings come from the companion app config (Zepp App -> App Settings,
 * see `setting/` module, not created yet) with a fallback to local storage.
 * Expected shape: { url: "http://homeassistant.local:8123", token: "..." }
 */
function getHaConfig() {
  try {
    const raw = settingsStorage.getItem('ha_config') || ''
    if (!raw) {
      return null
    }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const url = (parsed.url || '').replace(/\/+$/, '')
    const token = parsed.token || ''
    if (!url || !token) {
      return null
    }
    return { url, token }
  } catch (e) {
    logger.log('ha_config parse error', e)
    return null
  }
}

async function haRequest(config, path) {
  const response = await fetch({
    url: `${config.url}${path}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  })
  return typeof response.body === 'string' ? JSON.parse(response.body) : response.body
}

/**
 * GET /api/ - unauthenticated endpoint used as a connectivity probe.
 * Returns { connected, version } on success.
 */
async function testConnection(res) {
  const config = getHaConfig()
  if (!config) {
    res(null, { connected: false, error: 'NOT_CONFIGURED' })
    return
  }
  try {
    const data = await haRequest(config, '/api/')
    res(null, { connected: data.message === 'API running.', version: data.version || '' })
  } catch (error) {
    logger.log('testConnection error', error)
    res(null, { connected: false, error: String((error && error.message) || error) })
  }
}

/**
 * GET /api/states - all entity states.
 * Returns { connected, states } where states is a compact
 * [{ entity_id, state, friendly_name }] list.
 */
async function getStates(res) {
  const config = getHaConfig()
  if (!config) {
    res(null, { connected: false, error: 'NOT_CONFIGURED' })
    return
  }
  try {
    const states = await haRequest(config, '/api/states')
    res(null, {
      connected: true,
      states: (states || []).map((s) => ({
        entity_id: s.entity_id,
        state: s.state,
        friendly_name: (s.attributes && s.attributes.friendly_name) || s.entity_id,
      })),
    })
  } catch (error) {
    logger.log('getStates error', error)
    res(null, { connected: false, error: String((error && error.message) || error) })
  }
}

AppSideService(
  BaseSideService({
    onInit() {
      logger.log('HA side service init')
    },

    onRequest(req, res) {
      logger.log('onRequest', req && req.method)
      switch (req.method) {
        case 'TEST_CONNECTION':
          testConnection(res)
          break
        case 'GET_STATES':
          getStates(res)
          break
        default:
          res(null, { error: 'UNKNOWN_METHOD' })
      }
    },

    onDestroy() {
      logger.log('HA side service destroy')
    },
  })
)
