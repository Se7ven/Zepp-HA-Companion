import { createWidget, widget, align, text_style, prop } from '@zos/ui'
import { px } from '@zos/utils'
import { gettext } from 'i18n'
import { log } from '@zos/utils'
import { BasePage } from '@zeppos/zml/base-page'
import { splitEntity, isActionable } from '../../utils/ha'

const logger = log.getLogger('ha-area')

const PAGE_W = 480
const MARGIN = 24
const GAP = 10
const ROW_H = 84
const HEADER_H = 48

const COLOR_TEXT = 0xffffff
const COLOR_SUBTLE = 0x9e9e9e
const COLOR_ON = 0x43a047
const COLOR_OFF = 0x37474f

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
    this.request({ method: 'GET_AREA', params: { areaId: this.state.areaId } })
      .then((data) => this.render(data))
      .catch((error) => {
        logger.log('GET_AREA failed', error)
        destroyWidget(this.state.loadingText)
        this.state.loadingText = null
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

  render(data) {
    if (this.state.loadingText) {
      destroyWidget(this.state.loadingText)
      this.state.loadingText = null
    }

    // Title
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

    const entities = (data && data.entities) || []
    if (!entities.length) {
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
      return
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
        y += HEADER_H
        groups[domain]
          .sort((a, b) => (a.n > b.n ? 1 : -1))
          .forEach((e) => {
            const actionable = isActionable(e.e)
            const ref = {
              widget: null,
              entity: e.e,
              name: e.n,
              state: e.s,
              on: !!e.on,
              actionable,
              y,
            }
            ref.widget = this.createRow(ref, y)
            this.state.rows.push(ref)
            y += ROW_H + GAP
          })
      })

    createWidget(widget.PAGE_SCROLLBAR, {})
  },

  createRow(ref, y) {
    const color = ref.actionable ? (ref.on ? COLOR_ON : COLOR_OFF) : 0x263238
    return createWidget(widget.BUTTON, {
      x: px(MARGIN),
      y: px(y),
      w: px(PAGE_W - MARGIN * 2),
      h: px(ROW_H),
      radius: px(18),
      normal_color: color,
      press_color: dim(color),
      text: ref.name + '  ·  ' + ref.state,
      text_size: px(22),
      color: COLOR_TEXT,
      text_w: px(PAGE_W - MARGIN * 2 - 24),
      click_func: ref.actionable ? () => this.fire(ref) : () => undefined,
    })
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
      text: ref.name + '  ·  ' + (ref.on ? gettext('state_on') : gettext('state_off')),
    })
  },

  fire(ref) {
    this.request({ method: 'CALL', params: { entity: ref.entity, action: 'auto' } })
      .then((result) => {
        if (result && result.ok) {
          ref.on = !ref.on
          this.repaintRow(ref)
        } else {
          logger.log('CALL failed', ref.entity, result && result.error)
        }
      })
      .catch((error) => logger.log('CALL error', error))
  },

  onDestroy() {
    logger.log('area onDestroy')
  },
})
