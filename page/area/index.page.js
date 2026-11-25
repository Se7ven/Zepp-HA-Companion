import { createWidget, widget, align, text_style, prop, destroyWidget, event } from '@zos/ui'
import { px } from '@zos/utils'
import { gettext } from 'i18n'
import { log } from '@zos/utils'
import { BasePage } from '@zeppos/zml/base-page'
import { splitEntity, isActionable } from '../../utils/ha'
import { REFRESH_INTERVAL_MS } from '../../utils/config/constants'
import { ICON_FONT, iconChar, DOMAIN_ICON } from '../../utils/icons'

const logger = log.getLogger('ha-area')
logger.log('module load')

const PAGE_W = 480
const MARGIN = 24
const GAP = 10
const ROW_H = 84
const HEADER_H = 48

const COLOR_TEXT = 0xffffff
const COLOR_SUBTLE = 0x9e9e9e
const COLOR_ON = 0x43a047
const COLOR_OFF = 0x37474f
const COLOR_CACHED = 0xffb74d

function dim(color) {
  const r = ((color >> 16) & 0xff) * 0.65
  const g = ((color >> 8) & 0xff) * 0.65
  const b = (color & 0xff) * 0.65
  return ((r << 16) | (g << 8) | b) & 0xffffff
}

function domainLabel(domain) {
  const label = gettext('domain_' + domain)
  return label.indexOf('domain_') === 0 ? domain : label
}

BasePage({
  state: {
    areaId: '',
    areaName: '',
    rows: [], // [{ widget, entity, on, action }]
    widgets: [], // everything rendered, so a refresh can tear it down
    built: false,
    refreshTimer: null,
    lastRefreshAt: 0,
  },

  onInit(params) {
    let p = params
    if (typeof p === 'string') {
      try {
        p = JSON.parse(p)
      } catch (e) {
        p = {}
      }
    }
    p = p || {}
    this.state.areaId = p.areaId || ''
    this.state.areaName = p.areaName || this.state.areaId
  },

  build() {
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
    this.load()
    this.startAutoRefresh()
  },

  /* Same battery policy as the home page: refresh on open, then at most
     once per REFRESH_INTERVAL_MS while the page stays open. */
  startAutoRefresh() {
    if (this.state.refreshTimer !== null) return
    this.state.refreshTimer = setInterval(() => {
      if (Date.now() - (this.state.lastRefreshAt || 0) >= REFRESH_INTERVAL_MS) this.load()
    }, 60000)
  },

  stopAutoRefresh() {
    if (this.state.refreshTimer !== null) {
      clearInterval(this.state.refreshTimer)
      this.state.refreshTimer = null
    }
  },

  load() {
    this.state.lastRefreshAt = Date.now()
    return this.request({ method: 'GET_AREA', params: { areaId: this.state.areaId } })
      .then((data) => this.render(data))
      .catch((error) => {
        logger.log('GET_AREA failed', error)
        this.state.lastRefreshAt = Date.now() // retry no sooner than one interval later
        if (this.state.loadingText) {
          destroyWidget(this.state.loadingText)
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

  destroyRendered() {
    this.state.widgets.forEach((w) => destroyWidget(w))
    this.state.widgets = []
    this.state.rows = []
  },

  add(widgetRef) {
    this.state.widgets.push(widgetRef)
    return widgetRef
  },

  render(data) {
    if (this.state.loadingText) {
      destroyWidget(this.state.loadingText)
      this.state.loadingText = null
    }
    if (this.state.built) this.destroyRendered()
    this.state.built = true

    // Title
    this.add(
      createWidget(widget.TEXT, {
        x: px(MARGIN),
        y: px(10),
        w: px(PAGE_W - MARGIN * 2),
        h: px(48),
        text: this.state.areaName,
        text_size: px(30),
        color: COLOR_TEXT,
        align_h: align.CENTER_H,
      })
    )

    const entities = (data && data.entities) || []
    if (!entities.length) {
      this.add(
        createWidget(widget.TEXT, {
          x: px(MARGIN),
          y: px(120),
          w: px(PAGE_W - MARGIN * 2),
          h: px(120),
          text: data && data.error ? gettext('error_connection') : gettext('no_entities'),
          text_size: px(22),
          color: COLOR_SUBTLE,
          align_h: align.CENTER_H,
          text_style: text_style.WRAP,
        })
      )
      return
    }

    // "cached" note when HA was unreachable and we serve the last-good snapshot
    if (data.cached) {
      const mins = Math.max(1, Math.round((data.age || 0) / 60000))
      this.add(
        createWidget(widget.TEXT, {
          x: px(MARGIN),
          y: px(54),
          w: px(PAGE_W - MARGIN * 2),
          h: px(26),
          text: gettext('cached_label') + ' · ' + mins + ' ' + gettext('min_abbrev'),
          text_size: px(18),
          color: COLOR_CACHED,
          align_h: align.CENTER_H,
        })
      )
    }

    const groups = {}
    entities.forEach((e) => {
      const domain = splitEntity(e.e).domain
      if (!groups[domain]) groups[domain] = []
      groups[domain].push(e)
    })

    let y = 72
    Object.keys(groups)
      .sort()
      .forEach((domain) => {
        this.add(
          createWidget(widget.TEXT, {
            x: px(MARGIN),
            y: px(y),
            w: px(PAGE_W - MARGIN * 2),
            h: px(HEADER_H),
            text: domainLabel(domain),
            text_size: px(24),
            color: 0x80cbc4,
            align_v: align.BOTTOM,
          })
        )
        y += HEADER_H
        groups[domain]
          .sort((a, b) => (a.n > b.n ? 1 : -1))
          .forEach((e) => {
            const actionable = isActionable(e.e)
            const ref = {
              widget: null,
              iconW: null,
              textW: null,
              domain,
              entity: e.e,
              name: e.n,
              state: e.s,
              on: !!e.on,
              actionable,
              lastFire: 0,
              y,
            }
            this.createRow(ref, y)
            this.state.rows.push(ref)
            y += ROW_H + GAP
          })
      })

    this.add(createWidget(widget.PAGE_SCROLLBAR, {}))
  },

  // Row = borderless BUTTON + icon TEXT + label TEXT overlays. Buttons cannot
  // offset their built-in text, and the icon font has no latin glyphs, so the
  // label lives in its own TEXT widget with a controlled x. Overlays forward
  // taps too; the guard debounces duplicates if touches reach both layers.
  createRow(ref, y) {
    const color = ref.actionable ? (ref.on ? COLOR_ON : COLOR_OFF) : 0x263238
    const fireOnce = () => {
      const now = Date.now()
      if (now - ref.lastFire < 500) return
      ref.lastFire = now
      if (ref.actionable) this.fire(ref)
    }
    ref.widget = this.add(
      createWidget(widget.BUTTON, {
        x: px(MARGIN),
        y: px(y),
        w: px(PAGE_W - MARGIN * 2),
        h: px(ROW_H),
        radius: px(18),
        normal_color: color,
        press_color: dim(color),
        text: '',
        click_func: fireOnce,
      })
    )
    const glyph = iconChar(DOMAIN_ICON[ref.domain] || DOMAIN_ICON.default)
    let textX = MARGIN + 16
    if (glyph) {
      ref.iconW = this.add(
        createWidget(widget.TEXT, {
          x: px(MARGIN + 6),
          y: px(y + (ROW_H - 48) / 2),
          w: px(52),
          h: px(48),
          text: glyph,
          text_size: px(34),
          color: ref.actionable ? COLOR_TEXT : COLOR_SUBTLE,
          align_h: align.CENTER_H,
          align_v: align.CENTER_V,
          font: ICON_FONT,
        })
      )
      ref.iconW.addEventListener(event.CLICK_DOWN, fireOnce)
      textX = MARGIN + 66
    }
    ref.textW = this.add(
      createWidget(widget.TEXT, {
        x: px(textX),
        y: px(y),
        w: px(PAGE_W - MARGIN * 2 - textX - 12),
        h: px(ROW_H),
        text: ref.name + '  ·  ' + ref.state,
        text_size: px(22),
        color: COLOR_TEXT,
        align_h: align.LEFT,
        align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS,
      })
    )
    ref.textW.addEventListener(event.CLICK_DOWN, fireOnce)
  },

  repaintRow(ref) {
    const color = ref.on ? COLOR_ON : COLOR_OFF
    ref.widget.setProperty(prop.MORE, {
      x: px(MARGIN),
      y: px(ref.y),
      w: px(PAGE_W - MARGIN * 2),
      h: px(ROW_H),
      radius: px(18),
      normal_color: color,
      press_color: dim(color),
    })
    if (ref.textW) {
      ref.textW.setProperty(prop.MORE, {
        text: ref.name + '  ·  ' + (ref.state || (ref.on ? gettext('state_on') : gettext('state_off'))),
      })
    }
  },

  fire(ref) {
    this.request({ method: 'CALL', params: { entity: ref.entity, action: 'auto' } })
      .then((result) => {
        if (result && result.ok) {
          ref.on = !ref.on
          ref.state = ref.on ? 'on' : 'off'
          this.repaintRow(ref)
        } else {
          logger.log('CALL failed', ref.entity, result && result.error)
        }
      })
      .catch((error) => logger.log('CALL error', error))
  },

  onPause() {
    this.stopAutoRefresh()
  },

  onResume() {
    if (Date.now() - (this.state.lastRefreshAt || 0) >= REFRESH_INTERVAL_MS) this.load()
    this.startAutoRefresh()
  },

  onDestroy() {
    this.stopAutoRefresh()
    logger.log('area onDestroy')
  },
})
