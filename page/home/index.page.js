import { createWidget, widget, align, text_style, prop, deleteWidget, event } from '@zos/ui'
import { px } from '@zos/utils'
import { gettext } from 'i18n'
import { setScrollMode, SCROLL_MODE_SWIPER_HORIZONTAL } from '@zos/page'
import { push, replace } from '@zos/router'
import { log } from '@zos/utils'
import { BasePage } from '@zeppos/zml/base-page'
import { REFRESH_INTERVAL_MS } from '../../utils/config/constants'
import { ICON_FONT, iconChar } from '../../utils/icons'

const logger = log.getLogger('ha-home')
logger.log('module load')

/* Robust helpers: native widget calls can throw non-Error objects on some firmwares */
function errStr(error) {
  try {
    return String((error && error.message) || error) + ' | ' + JSON.stringify(error)
  } catch (e) {
    return String(error)
  }
}

function safeDestroy(w) {
  if (!w) return
  try {
    deleteWidget(w)
  } catch (e) {
    logger.log('safeDestroy failed: ' + errStr(e))
  }
}


const PAGE_W = 480
const PAGE_H = 480
const MARGIN = 24
const GAP = 12
const GRID_TOP = 72
const CELL_W = (PAGE_W - MARGIN * 2 - GAP) / 2
const CELL_H = 100

const COLOR_TEXT = 0xffffff
const COLOR_SUBTLE = 0x9e9e9e
const COLOR_AREA = 0x37474f

function hexColor(value, fallback) {
  const hex = (value || '').replace('#', '')
  const num = parseInt(hex, 16)
  if (!hex || hex.length !== 6 || isNaN(num)) {
    const fb = (fallback || '#546E7A').replace('#', '')
    return parseInt(fb, 16)
  }
  return num
}

function dim(color) {
  const r = ((color >> 16) & 0xff) * 0.65
  const g = ((color >> 8) & 0xff) * 0.65
  const b = (color & 0xff) * 0.65
  return ((r << 16) | (g << 8) | b) & 0xffffff
}

function radiusFor(shape, w, h) {
  if (shape === 'rect') return px(6)
  if (shape === 'round') return px(24)
  return px(Math.min(w, h) / 2)
}

Page(
  BasePage({
  state: {
    hub: null,
    buttonWidgets: [], // [{ widget, cfg, on }]
    built: false,
    refreshTimer: null,
  },

  onInit() {
    logger.log('home onInit')
  },

  build() {
    try {
      logger.log('build:start')
      this.state.loadingText = createWidget(widget.TEXT, {
        x: 0,
        y: px(220),
        w: px(PAGE_W),
        h: px(40),
        text: gettext('loading'),
        text_size: px(28),
        color: COLOR_TEXT,
        align_h: align.CENTER_H,
      })
      logger.log('build:loading-shown')
      this.refresh()
      this.startAutoRefresh()
    } catch (e) {
      // never leave a black screen: surface startup failures on the display
      logger.log('build failed', e && e.message)
      createWidget(widget.TEXT, {
        x: px(MARGIN),
        y: px(200),
        w: px(PAGE_W - MARGIN * 2),
        h: px(120),
        text: 'Startup error: ' + ((e && e.message) || e),
        text_size: px(22),
        color: 0xe57373,
        align_h: align.CENTER_H,
        text_style: text_style.WRAP,
      })
    }
  },

  /* Battery policy: refresh at most once per REFRESH_INTERVAL_MS while open;
     Zepp OS forbids background network, so this foreground timer is the only
     periodic refresh. Screen off / app hidden -> no timer cost anyway. */
  startAutoRefresh() {
    if (this.state.refreshTimer !== null) return
    this.state.refreshTimer = setInterval(() => {
      const hub = this.state.hub
      if (!hub) return
      const age = Date.now() - (this.state.lastRefreshAt || 0)
      if (age >= REFRESH_INTERVAL_MS) this.refresh()
    }, 60000)
  },

  stopAutoRefresh() {
    if (this.state.refreshTimer !== null) {
      clearInterval(this.state.refreshTimer)
      this.state.refreshTimer = null
    }
  },

  refresh() {
    this.state.lastRefreshAt = Date.now()
    return this.request({ method: 'GET_HUB' })
      .then((data) => {
        logger.log(
          'hub response',
          (data && data.error) || 'ok',
          'states=' + ((data && data.states && data.states.length) || 0)
        )
        this.state.hub = data
        if (this.state.built) this.paintLiveStates(data)
        else this.render()
      })
      .catch((error) => {
        logger.log('GET_HUB failed: ' + errStr(error))
        // a failed attempt still counts for the refresh gate: retry no sooner
        // than one interval later instead of hammering a dead HA
        this.state.lastRefreshAt = Date.now()
        if (this.state.loadingText) {
          safeDestroy(this.state.loadingText)
          this.state.loadingText = null
        }
        createWidget(widget.TEXT, {
          x: px(MARGIN),
          y: px(220),
          w: px(PAGE_W - MARGIN * 2),
          h: px(80),
          text: gettext('error_connection'),
          text_size: px(24),
          color: 0xe57373,
          align_h: align.CENTER_H,
          text_style: text_style.WRAP,
        })
      })
  },

  // After the swiper exists, a refresh only repaints button colors + status
  // text in place (re-rendering would tear down widgets mid-swipe).
  paintLiveStates(hub) {
    // setProperty on native widgets can throw on some firmwares; a repaint
    // failure must not be mistaken for a connection error
    try {
      const statesById = {}
      ;(hub.states || []).forEach((s) => (statesById[s.e] = s))
      this.state.buttonWidgets.forEach((ref) => {
        const st = statesById[ref.cfg.entity]
        const on = st ? !!st.on : ref.on
        if (on !== ref.on) {
          ref.on = on
          this.repaintButton(ref)
        }
      })
      this.updateStatusLine(hub)
    } catch (e) {
      logger.log('paintLiveStates failed: ' + errStr(e))
    }
  },

  /* ----------------------------- rendering ----------------------------- */

  render() {
    try {
      this.renderInner()
    } catch (error) {
      logger.log('render failed: ' + errStr(error))
      if (this.state.loadingText) {
        safeDestroy(this.state.loadingText)
        this.state.loadingText = null
      }
      createWidget(widget.TEXT, {
        x: px(MARGIN),
        y: px(200),
        w: px(PAGE_W - MARGIN * 2),
        h: px(120),
        text: 'Render error: ' + errStr(error),
        text_size: px(22),
        color: 0xe57373,
        align_h: align.CENTER_H,
        text_style: text_style.WRAP,
      })
    }
  },

  renderInner() {
    const hub = this.state.hub
    if (!hub) return
    logger.log('render:start d=' + typeof deleteWidget + ' c=' + typeof createWidget)
    this.state.built = true
    if (this.state.loadingText) {
      safeDestroy(this.state.loadingText)
      this.state.loadingText = null
    }
    logger.log('render:loading-removed')

    const config = hub.config || { screens: [] }
    const screens = (config.screens || []).filter((s) => s.enabled)
    const pageCount = 1 + screens.length

    try {
      setScrollMode({
        mode: SCROLL_MODE_SWIPER_HORIZONTAL,
        options: { width: px(PAGE_W), count: pageCount },
      })
    } catch (e) {
      logger.log('setScrollMode failed: ' + errStr(e))
    }
    logger.log('render:scrollmode')

    this.renderHubPage(hub)
    logger.log('render:hub')
    screens.forEach((screen, i) => this.renderScreenPage(screen, i + 1, hub))
    logger.log('render:screens')

    try {
      // Docs: select_src/unselect_src are REQUIRED params; total/cur_index do
      // not exist in the API (dots count comes from setScrollMode count).
      if (pageCount > 1) {
        createWidget(widget.PAGE_INDICATOR, {
          x: 0,
          y: px(PAGE_H - 26),
          w: px(PAGE_W),
          h: px(12),
          align_h: align.CENTER_H,
          h_space: 8,
          select_src: 'image/dot-on.png',
          unselect_src: 'image/dot-off.png',
          use_color: true,
          select_color: 0xffffff,
          unselect_color: 0x666666,
          element_height: px(12),
          element_radius: px(12),
        })
      }
    } catch (e) {
      logger.log('indicator failed: ' + errStr(e))
    }
    logger.log('render:done')
  },

  newPageContainer(pageIndex) {
    return createWidget(widget.VIEW_CONTAINER, {
      x: 0,
      y: 0,
      w: px(PAGE_W),
      h: px(PAGE_H),
      scroll_enable: 1,
      page: pageIndex,
    })
  },

  renderHubPage(hub) {
    const container = this.newPageContainer(0)
    logger.log('hub:container')
    const st = this.computeStatus(hub)

    container.createWidget(widget.TEXT, {
      x: 0,
      y: px(16),
      w: px(PAGE_W),
      h: px(44),
      text: gettext('home_title'),
      text_size: px(32),
      color: COLOR_TEXT,
      align_h: align.CENTER_H,
    })
    logger.log('hub:title')
    this.state.statusRef = container.createWidget(widget.TEXT, {
      x: px(MARGIN),
      y: px(64),
      w: px(PAGE_W - MARGIN * 2),
      h: px(32),
      text: st.text,
      text_size: px(20),
      color: st.color,
      align_h: align.CENTER_H,
      text_style: text_style.ELLIPSIS,
    })
    logger.log('hub:status')

    const enabledAreas = Object.keys((hub.config && hub.config.areas) || {}).filter(
      (id) => (hub.config.areas[id] || {}).enabled
    )
    if (!enabledAreas.length) {
      container.createWidget(widget.TEXT, {
        x: px(MARGIN),
        y: px(140),
        w: px(PAGE_W - MARGIN * 2),
        h: px(120),
        text: gettext('no_areas_hint'),
        text_size: px(22),
        color: COLOR_SUBTLE,
        align_h: align.CENTER_H,
        text_style: text_style.WRAP,
      })
      logger.log('hub:hint')
      return
    }

    let y = 120
    enabledAreas.forEach((areaId) => {
      const name =
        areaId === '__none__' ? gettext('area_none') : (hub.areaNames && hub.areaNames[areaId]) || areaId
      container.createWidget(widget.BUTTON, {
        x: px(MARGIN),
        y: px(y),
        w: px(PAGE_W - MARGIN * 2),
        h: px(88),
        radius: px(20),
        normal_color: COLOR_AREA,
        press_color: dim(COLOR_AREA),
        text: name,
        text_size: px(26),
        color: COLOR_TEXT,
        text_w: px(PAGE_W - MARGIN * 2 - 20),
        click_func: () => {
          push({
            url: 'page/area/index.page',
            params: { areaId: areaId, areaName: name },
          })
        },
      })
      y += 88 + GAP
    })
  },

  renderScreenPage(screen, pageIndex, hub) {
    logger.log('screen:start ' + pageIndex)
    const container = this.newPageContainer(pageIndex)
    container.createWidget(widget.TEXT, {
      x: 0,
      y: px(14),
      w: px(PAGE_W),
      h: px(44),
      text: screen.name || gettext('screen') + ' ' + (screen.id + 1),
      text_size: px(28),
      color: COLOR_TEXT,
      align_h: align.CENTER_H,
    })

    const statesById = {}
    ;(hub.states || []).forEach((s) => (statesById[s.e] = s))

    if (!(screen.buttons || []).length) {
      container.createWidget(widget.TEXT, {
        x: px(MARGIN),
        y: px(140),
        w: px(PAGE_W - MARGIN * 2),
        h: px(120),
        text: gettext('no_buttons_hint'),
        text_size: px(22),
        color: COLOR_SUBTLE,
        align_h: align.CENTER_H,
        text_style: 1,
      })
      return
    }

    screen.buttons.forEach((btn) => {
      const wide = btn.size === 'l'
      const col = wide ? 0 : btn.slot % 2
      const row = Math.floor(btn.slot / 2)
      const w = wide ? CELL_W * 2 + GAP : CELL_W
      const x = MARGIN + col * (CELL_W + GAP)
      const y = GRID_TOP + row * (CELL_H + GAP)
      const st = statesById[btn.entity]
      const ref = {
        cfg: btn,
        on: st ? !!st.on : false,
        widget: null,
        lastFire: 0,
      }
      // overlays may or may not pass touches through to the button depending on
      // the firmware build, so every tap target calls fireOnce and the guard
      // debounces duplicate deliveries of the same tap
      const fireOnce = () => {
        const now = Date.now()
        if (now - ref.lastFire < 500) return
        ref.lastFire = now
        this.fireButton(ref)
      }
      const icon = iconChar(btn.icon)
      const normal = hexColor(ref.on ? btn.colorOn : btn.colorOff, '#546E7A')
      ref.widget = container.createWidget(widget.BUTTON, {
        x: px(x),
        y: px(y),
        w: px(w),
        h: px(CELL_H),
        radius: radiusFor(btn.shape, w, CELL_H),
        normal_color: normal,
        press_color: dim(normal),
        text: icon ? '' : btn.label || (st && st.n) || btn.entity,
        text_size: px(24),
        color: COLOR_TEXT,
        text_w: px(w - 16),
        click_func: fireOnce,
      })
      if (icon) {
        const hasLabel = !!btn.label
        const iconText = container.createWidget(widget.TEXT, {
          x: px(x),
          y: px(y + (hasLabel ? 4 : 22)),
          w: px(w),
          h: px(hasLabel ? 52 : 56),
          text: icon,
          text_size: px(hasLabel ? 40 : 44),
          color: COLOR_TEXT,
          align_h: align.CENTER_H,
          font: ICON_FONT,
        })
        iconText.addEventListener(event.CLICK_DOWN, fireOnce)
        if (hasLabel) {
          const labelText = container.createWidget(widget.TEXT, {
            x: px(x + 4),
            y: px(y + 60),
            w: px(w - 8),
            h: px(32),
            text: btn.label,
            text_size: px(20),
            color: COLOR_TEXT,
            align_h: align.CENTER_H,
            text_style: text_style.ELLIPSIS,
          })
          labelText.addEventListener(event.CLICK_DOWN, fireOnce)
        }
      }
      this.state.buttonWidgets.push(ref)
    })
  },

  computeStatus(hub) {
    if (hub.cached) {
      const mins = Math.max(1, Math.round((hub.age || 0) / 60000))
      return {
        text: gettext('cached_label') + ' · ' + mins + ' ' + gettext('min_abbrev'),
        color: 0xffb74d,
      }
    }
    const status = hub.status
    if (status && status.ok) {
      return { text: gettext('connected') + ' v' + (status.version || '?'), color: 0x81c784 }
    }
    if (status && status.message) {
      return { text: gettext('error_connection') + ': ' + status.message, color: 0xe57373 }
    }
    return { text: gettext('not_configured'), color: 0xe57373 }
  },

  updateStatusLine(hub) {
    if (!this.state.statusRef) return
    const st = this.computeStatus(hub)
    this.state.statusRef.setProperty(prop.MORE, { text: st.text, color: st.color })
  },

  repaintButton(ref) {
    const btn = ref.cfg
    const normal = hexColor(ref.on ? btn.colorOn : btn.colorOff, '#546E7A')
    const wide = btn.size === 'l'
    const w = wide ? CELL_W * 2 + GAP : CELL_W
    ref.widget.setProperty(prop.MORE, {
      x: px(MARGIN + (wide ? 0 : btn.slot % 2) * (CELL_W + GAP)),
      y: px(GRID_TOP + Math.floor(btn.slot / 2) * (CELL_H + GAP)),
      w: px(w),
      h: px(CELL_H),
      radius: radiusFor(btn.shape, w, CELL_H),
      normal_color: normal,
      press_color: dim(normal),
    })
  },

  fireButton(ref) {
    this.request({
      method: 'CALL',
      params: { entity: ref.cfg.entity, action: ref.cfg.action || 'auto' },
    })
      .then((result) => {
        if (result && result.ok) {
          ref.on = !ref.on
          this.repaintButton(ref)
        } else {
          logger.log('CALL failed', ref.cfg.entity, result && result.error)
        }
      })
      .catch((error) => logger.log('CALL error', error))
  },

  onCall(data) {
    if (data && data.method === 'config.changed') {
      // config changed in the Zepp App -> rebuild the swiper from scratch
      replace({ url: 'page/home/index.page' })
    } else if (data && data.method === 'status.changed') {
      const hub = Object.assign({}, this.state.hub, { status: data.params })
      this.state.hub = hub
      this.updateStatusLine(hub)
    }
  },

  onPause() {
    this.stopAutoRefresh()
  },

  onResume() {
    // returning to the page: refresh now if the data has aged past the interval
    if (Date.now() - (this.state.lastRefreshAt || 0) >= REFRESH_INTERVAL_MS) this.refresh()
    this.startAutoRefresh()
  },

  onDestroy() {
    this.stopAutoRefresh()
    logger.log('home onDestroy')
  },
  })
)
