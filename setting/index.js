import { gettext } from 'i18n'
import {
  STORAGE_KEYS,
  defaultConfig,
  PALETTE,
  SHAPES,
  SIZES,
  ACTIONS,
  SLOT_COUNT,
  GRID_COLS,
  GEOM_VERSION,
  HA_URL_EXAMPLE,
} from '../utils/config/constants'
import { ICON_CHOICES } from '../utils/icons'

/*
 * Settings App (phone side, runs inside the Zepp App).
 * Fully dynamic: navigation lives in settingsStorage (`ha_ui`), so every
 * interaction re-renders `build` (the Settings App is reactive to storage).
 * Entity discovery data (`ha_data`) is produced by the Side Service on `ha_sync`.
 */

function readJson(props, key, fallback) {
  try {
    const raw = props.settingsStorage.getItem(key)
    if (raw === undefined || raw === null || raw === '') return fallback
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) {
    return fallback
  }
}

function domainLabel(domain) {
  const label = gettext('domain_' + domain)
  return label.indexOf('domain_') === 0 ? domain : label
}

function slotOptions() {
  const out = []
  for (let i = 0; i < SLOT_COUNT; i++) {
    const row = Math.floor(i / GRID_COLS) + 1
    const col = (i % GRID_COLS) + 1
    out.push({ name: 'R' + row + 'C' + col, value: String(i) })
  }
  return out
}

function iconOptions() {
  const out = [{ name: gettext('icon_none'), value: '' }]
  ICON_CHOICES.forEach((n) => out.push({ name: n, value: n }))
  return out
}

AppSettingsPage({
  state: {},

  /* ----------------------------- plumbing ----------------------------- */

  cfg() {
    const config = readJson(this.props, STORAGE_KEYS.HA_CONFIG, defaultConfig())
    if (!config.geom) {
      // migration to the GEOM 2 quarter-grid: remap legacy 2-column slots
      // (2 -> 4 columns keeps every existing button at its old physical position)
      ;(config.screens || []).forEach((s) => {
        ;(s.buttons || []).forEach((b) => {
          b.slot = Math.floor(b.slot / 2) * 4 + (b.slot % 2) * 2
        })
      })
      config.geom = GEOM_VERSION
      this.props.settingsStorage.setItem(STORAGE_KEYS.HA_CONFIG, JSON.stringify(config))
    }
    return config
  },

  saveConfig(config) {
    config.rev = (config.rev || 0) + 1
    this.props.settingsStorage.setItem(STORAGE_KEYS.HA_CONFIG, JSON.stringify(config))
  },

  ui() {
    return readJson(this.props, STORAGE_KEYS.HA_UI, { view: 'root' })
  },

  nav(patch) {
    const next = Object.assign({}, this.ui(), patch)
    next._r = Date.now() // force a storage change even when the payload is identical
    this.props.settingsStorage.setItem(STORAGE_KEYS.HA_UI, JSON.stringify(next))
  },

  data() {
    return readJson(this.props, STORAGE_KEYS.HA_DATA, null)
  },

  status() {
    const st = readJson(this.props, STORAGE_KEYS.HA_STATUS, null)
    if (st && !st.version) {
      const data = readJson(this.props, STORAGE_KEYS.HA_DATA, null)
      if (data && data.version) st.version = data.version
    }
    return st
  },

  /* --------------------------- shared pieces -------------------------- */

  back(patch) {
    const target = patch || { view: 'root', areaId: null, screen: null, button: null }
    return View(
      { style: { padding: '8px 0' } },
      [
        Button({
          label: gettext('back'),
          onClick: () => this.nav(target),
        }),
      ]
    )
  },

  statusBlock() {
    const st = this.status()
    if (!st) return Text({ style: { color: '#888', fontSize: '13px' } }, [gettext('not_connected')])
    if (!st.ok) {
      return Text({ style: { color: '#D81B60', fontSize: '13px' } }, [gettext('status_error') + ': ' + st.message])
    }
    return Text(
      { style: { color: '#43A047', fontSize: '13px' } },
      [
        gettext('status_ok') +
          (st.version ? ' — v' + st.version : '') +
          ', ' + gettext('areas') + ': ' + st.areasCount +
          ((st.areaStateCount || 0) === 0
            ? ' (' + gettext('areas_debug') + ': ' + (st.areaSource || '?') + '/' + (st.areaMapped != null ? st.areaMapped : '?') + ')'
            : '') +
          ', ' + gettext('entities') + ': ' + st.entitiesCount +
          (st.hiddenCount ? ' (' + gettext('hidden_entities') + ': ' + st.hiddenCount + ')' : ''),
      ]
    )
  },

  /* ----------------------------- diagnostics --------------------------- */

  diagView() {
    const lines = readJson(this.props, STORAGE_KEYS.HA_DIAG_RESULT, [])
    const rows = [this.back({ view: 'root' })]
    if (lines && lines.length) {
      lines.forEach((l) => rows.push(Text({ style: { color: '#333', fontSize: '11px', padding: '1px 0', 'word-break': 'break-all' } }, [String(l)])))
    } else {
      rows.push(Text({ style: { color: '#888', fontSize: '13px' } }, [gettext('diag_wait')]))
    }
    rows.push(
      View({ style: { 'padding-top': '10px' } }, [
        Button({
          label: gettext('diag_run'),
          onClick: () => this.props.settingsStorage.setItem(STORAGE_KEYS.HA_DIAG, String(Date.now())),
        }),
      ])
    )
    return View({ style: { padding: '12px 16px' } }, rows)
  },

  /* ------------------------------ root view ---------------------------- */

  rootView() {
    const data = this.data()
    const items = [
      Section(
        { title: gettext('connection'), description: gettext('connection_desc') },
        [
          TextInput({
            label: gettext('ha_url'),
            settingsKey: STORAGE_KEYS.HA_URL,
            placeholder: HA_URL_EXAMPLE,
          }),
          TextInput({
            label: gettext('ha_token'),
            settingsKey: STORAGE_KEYS.HA_TOKEN,
            placeholder: 'xxxxxxxxxxxxxxxxxxxx',
            multiline: true,
            rows: 3,
          }),
          Button({
            label: gettext('sync'),
            color: 'primary',
            onClick: () => this.props.settingsStorage.setItem(STORAGE_KEYS.HA_SYNC, String(Date.now())),
          }),
          Button({
            label: gettext('diag_areas'),
            onClick: () => {
              this.props.settingsStorage.setItem(STORAGE_KEYS.HA_DIAG_RESULT, '')
              this.props.settingsStorage.setItem(STORAGE_KEYS.HA_DIAG, String(Date.now()))
              this.nav({ view: 'diag' })
            },
          }),
          this.statusBlock(),
        ]
      ),
    ]

    if (data) {
      items.push(
        Section(
          { title: gettext('main_screen'), description: gettext('main_screen_desc') },
          [
            Text({}, [gettext('areas') + ': ' + data.areas.length + ', ' + gettext('entities') + ': ' + data.entities.length]),
            Button({
              label: gettext('configure'),
              onClick: () => this.nav({ view: 'main' }),
            }),
          ]
        ),
        Section(
          { title: gettext('widget_screens'), description: gettext('widget_screens_desc') },
          [
            Button({
              label: gettext('configure'),
              onClick: () => this.nav({ view: 'screens' }),
            }),
          ]
        )
      )
    } else {
      items.push(Text({ style: { color: '#888', fontSize: '13px' } }, [gettext('sync_hint')]))
    }
    items.push(Text({ style: { color: '#aaa', fontSize: '11px', marginTop: '16px' } }, ['Zepp HA Companion v0.4.0']))
    return View({ style: { padding: '12px 16px' } }, items)
  },

  /* --------------------------- main screen areas ----------------------- */

  mainView() {
    const data = this.data()
    const config = this.cfg()
    const rows = [this.back()]
    if (!data || !data.areas.length) {
      rows.push(Text({ style: { color: '#888' } }, [gettext('no_areas')]))
      return View({ style: { padding: '12px 16px' } }, rows)
    }
    data.areas.forEach((area) => {
      const areaCfg = config.areas[area.id] || { enabled: false, entities: {} }
      const enabledCount = Object.keys(areaCfg.entities || {}).filter((id) => areaCfg.entities[id]).length
      rows.push(
        Section(
          { title: area.id === '__none__' ? gettext('area_none') : area.name, description: gettext('enabled_entities') + ': ' + enabledCount },
          [
            Toggle({
              label: gettext('show_on_watch'),
              value: !!areaCfg.enabled,
              onChange: (v) => {
                const c = this.cfg()
                if (!c.areas[area.id]) c.areas[area.id] = { enabled: false, entities: {} }
                c.areas[area.id].enabled = v
                this.saveConfig(c)
              },
            }),
            Button({
              label: gettext('entities'),
              onClick: () => this.nav({ view: 'area', areaId: area.id }),
            }),
          ]
        )
      )
    })
    return View({ style: { padding: '12px 16px' } }, rows)
  },

  /* ------------------------ area entity selection ---------------------- */

  ePickerView() {
    const rows = [this.back({ view: 'button', domain: null })]
    const data = this.data()
    if (!data || !data.entities || !data.entities.length) {
      rows.push(Text({ style: { color: '#888', fontSize: '13px' } }, [gettext('diag_wait')]))
      return View({ style: { padding: '12px 16px' } }, rows)
    }
    const counts = {}
    data.entities.forEach((e) => {
      counts[e.d] = (counts[e.d] || 0) + 1
    })
    const domains = Object.keys(counts).sort((a, b) => (domainLabel(a) > domainLabel(b) ? 1 : -1))
    rows.push(
      Section(
        { title: gettext('by_type') },
        domains.map((d) =>
          Button({
            label: domainLabel(d) + ' — ' + counts[d],
            onClick: () => this.nav({ view: 'elist', domain: d }),
          })
        )
      )
    )
    return View({ style: { padding: '12px 16px' } }, rows)
  },

  eListView() {
    const ui = this.ui()
    const rows = [this.back({ view: 'epicker' })]
    const data = this.data()
    const entities = data && ui.domain ? data.entities.filter((e) => e.d === ui.domain) : []
    rows.push(
      Section(
        { title: domainLabel(ui.domain) + ': ' + entities.length },
        entities.map((e) =>
          Button({
            label: e.n,
            onClick: () => {
              const patch = { entity: e.e }
              const cur = this.editVal()
              if (!cur.label) patch.label = e.n
              this.setEdit(patch)
              this.nav({ view: 'button', domain: null })
            },
          })
        )
      )
    )
    return View({ style: { padding: '12px 16px' } }, rows)
  },

  areaView() {
    const ui = this.ui()
    const data = this.data()
    const config = this.cfg()
    const area = data && data.areas.filter((a) => a.id === ui.areaId)[0]
    const rows = [
      this.back({ view: 'main', areaId: null }),
      Text({ bold: true, style: { fontSize: '16px', padding: '8px 0' } }, [(area ? (area.id === '__none__' ? gettext('area_none') : area.name) : ui.areaId) + ' — ' + gettext('entities_grouped')]),
    ]
    if (!data) return View({ style: { padding: '12px 16px' } }, rows)

    if (!config.areas[ui.areaId]) config.areas[ui.areaId] = { enabled: true, entities: {} }
    const entities = {}
    data.entities
      .filter((e) => (e.a || '__none__') === ui.areaId)
      .forEach((e) => {
        if (!entities[e.d]) entities[e.d] = []
        entities[e.d].push(e)
      })
    Object.keys(entities)
      .sort()
      .forEach((domain) => {
        const items = []
        entities[domain]
          .sort((a, b) => (a.n > b.n ? 1 : -1))
          .forEach((e) => {
            items.push(
              Toggle({
                label: e.n,
                value: !!(config.areas[ui.areaId].entities[e.e]),
                onChange: (v) => {
                  const c = this.cfg()
                  if (!c.areas[ui.areaId]) c.areas[ui.areaId] = { enabled: true, entities: {} }
                  if (v) c.areas[ui.areaId].entities[e.e] = true
                  else delete c.areas[ui.areaId].entities[e.e]
                  this.saveConfig(c)
                },
              })
            )
          })
        rows.push(Section({ title: domainLabel(domain) + ': ' + entities[domain].length }, items))
      })
    if (rows.length <= 2) rows.push(Text({ style: { color: '#888' } }, [gettext('no_entities')]))
    return View({ style: { padding: '12px 16px' } }, rows)
  },

  /* --------------------------- widget screens -------------------------- */

  screensView() {
    const config = this.cfg()
    const rows = [this.back()]
    config.screens.forEach((screen, si) => {
      const buttons = (screen.buttons || []).map((b, bi) =>
        View(
          { style: { display: 'flex', flexDirection: 'row', borderBottom: '1px solid #eee', padding: '6px 0' } },
          [
            View({ style: { flex: 1 } }, [
              Text({ bold: true }, [b.label || b.entity || gettext('unnamed_button')]),
              Text({ style: { color: '#888', fontSize: '12px' } }, [b.entity + ' — R' + (Math.floor(b.slot / GRID_COLS) + 1) + 'C' + ((b.slot % GRID_COLS) + 1)]),
            ]),
            Button({
              label: gettext('edit'),
              onClick: () => this.nav({ view: 'button', screen: si, button: bi, edit: null }),
            }),
            Button({
              label: gettext('delete'),
              color: 'secondary',
              onClick: () => {
                const c = this.cfg()
                c.screens[si].buttons.splice(bi, 1)
                this.saveConfig(c)
              },
            }),
          ]
        )
      )
      buttons.push(
        Button({
          label: gettext('add_button'),
          color: 'primary',
          onClick: () => this.nav({ view: 'button', screen: si, button: -1, edit: null }),
        })
      )
      rows.push(
        Section(
          { title: screen.name },
          [
            Toggle({
              label: gettext('enabled'),
              value: !!screen.enabled,
              onChange: (v) => {
                const c = this.cfg()
                c.screens[si].enabled = v
                this.saveConfig(c)
              },
            }),
            TextInput({
              label: gettext('screen_name'),
              value: screen.name,
              onChange: (v) => {
                const c = this.cfg()
                c.screens[si].name = v
                this.saveConfig(c)
              },
            }),
            View({}, buttons),
          ]
        )
      )
    })
    return View({ style: { padding: '12px 16px' } }, rows)
  },

  /* --------------------------- button editor --------------------------- */

  // The Settings App re-renders on every settingsStorage change and the JS
  // state is NOT guaranteed to survive a rebuild — so the in-progress button
  // draft lives in the ha_ui storage key, not in memory.
  editVal() {
    const ui = this.ui()
    if (ui.edit) return ui.edit
    const config = this.cfg()
    const screen = ui.screen != null ? config.screens[ui.screen] : null
    const existing = screen && ui.button >= 0 ? (screen.buttons || [])[ui.button] : null
    return Object.assign(
      {
        entity: '',
        label: '',
        action: 'auto',
        colorOn: '#43A047',
        colorOff: '#546E7A',
        shape: 'round',
        size: 's',
        slot: 0,
        icon: '',
      },
      existing || {}
    )
  },

  setEdit(patch) {
    const edit = Object.assign({}, this.editVal(), patch)
    this.nav({ edit }) // storage write keeps the draft across rebuilds
  },

  saveEdit() {
    const ui = this.ui()
    const edit = this.editVal()
    if (!edit.entity) return
    const c = this.cfg()
    const screen = c.screens[ui.screen]
    if (!screen.buttons) screen.buttons = []
    if (ui.button >= 0) screen.buttons[ui.button] = edit
    else screen.buttons.push(edit)
    this.saveConfig(c)
    this.nav({ view: 'screens', screen: null, button: null, edit: null })
  },

  buttonView() {
    const ui = this.ui()
    const data = this.data()
    const edit = this.editVal()
    const rows = [this.back({ view: 'screens', button: null, edit: null })]

    const entityName = edit.entity
      ? (data ? data.entities : []).filter((e) => e.e === edit.entity)[0]
      : null
    const toggleColors = [
      Select({
        label: gettext('color_on'),
        options: PALETTE.map((p) => ({ name: p.name, value: p.value })),
        value: edit.colorOn,
        onChange: (v) => this.setEdit({ colorOn: v }),
      }),
      Select({
        label: gettext('color_off'),
        options: PALETTE.map((p) => ({ name: p.name, value: p.value })),
        value: edit.colorOff,
        onChange: (v) => this.setEdit({ colorOff: v }),
      }),
    ]

    rows.push(
      Section(
        { title: gettext('button_settings') },
        [
          Button({
            label: gettext('entity') + ': ' + (entityName ? entityName.n : gettext('pick_entity')),
            onClick: () => this.nav({ view: 'epicker' }),
          }),
          TextInput({
            label: gettext('button_text'),
            value: edit.label,
            onChange: (v) => this.setEdit({ label: v }),
          }),
          Select({
            label: gettext('action'),
            options: ACTIONS,
            value: edit.action,
            onChange: (v) => this.setEdit({ action: v }),
          }),
          Select({
            label: gettext('shape'),
            options: SHAPES,
            value: edit.shape,
            onChange: (v) => this.setEdit({ shape: v }),
          }),
          Select({
            label: gettext('size'),
            options: SIZES,
            value: edit.size,
            onChange: (v) => this.setEdit({ size: v }),
          }),
          Select({
            label: gettext('slot'),
            options: slotOptions(),
            value: String(edit.slot),
            onChange: (v) => this.setEdit({ slot: parseInt(v, 10) }),
          }),
          Select({
            label: gettext('icon'),
            options: iconOptions(),
            value: edit.icon || '',
            onChange: (v) => this.setEdit({ icon: v }),
          }),
        ].concat(toggleColors)
      ),
      View(
        { style: { display: 'flex', flexDirection: 'row', padding: '8px 0' } },
        [
          View({ style: { flex: 1, paddingRight: '6px' } }, [
            Button({
              label: gettext('save'),
              color: 'primary',
              onClick: () => this.saveEdit(),
            }),
          ]),
          ui.button >= 0
            ? View(
                { style: { flex: 1, paddingLeft: '6px' } },
                [
                  Button({
                    label: gettext('delete'),
                    color: 'secondary',
                    onClick: () => {
                      const c = this.cfg()
                      c.screens[ui.screen].buttons.splice(ui.button, 1)
                      this.saveConfig(c)
                      this.nav({ view: 'screens', button: null, edit: null })
                    },
                  }),
                ]
              )
            : null,
        ]
      )
    )
    return View({ style: { padding: '12px 16px' } }, rows)
  },

  /* ------------------------------- build ------------------------------- */

  build(props) {
    this.props = props
    const view = this.ui().view
    if (view === 'main') return this.mainView()
    if (view === 'area') return this.areaView()
    if (view === 'screens') return this.screensView()
    if (view === 'button') return this.buttonView()
    if (view === 'epicker') return this.ePickerView()
    if (view === 'elist') return this.eListView()
    if (view === 'diag') return this.diagView()
    return this.rootView()
  },
})
