import { gettext } from 'i18n'
import {
  STORAGE_KEYS,
  defaultConfig,
  PALETTE,
  SHAPES,
  SIZES,
  ACTIONS,
  SLOT_COUNT,
  HA_URL_EXAMPLE,
} from '../utils/config/constants'

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
    out.push({ name: gettext('slot') + ' ' + (i + 1), value: String(i) })
  }
  return out
}

AppSettingsPage({
  state: {
    ui: { view: 'root' },
    edit: null,
  },

  /* ----------------------------- plumbing ----------------------------- */

  cfg() {
    return readJson(this.props, STORAGE_KEYS.HA_CONFIG, defaultConfig())
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
    return readJson(this.props, STORAGE_KEYS.HA_STATUS, null)
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
      [gettext('status_ok') + ' — v' + (st.version || '?') + ', ' + gettext('areas') + ': ' + st.areasCount + ', ' + gettext('entities') + ': ' + st.entitiesCount]
    )
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
    items.push(Text({ style: { color: '#aaa', fontSize: '11px', marginTop: '16px' } }, ['Zepp HA Companion v0.2.0']))
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
          { title: area.name, description: gettext('enabled_entities') + ': ' + enabledCount },
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

  areaView() {
    const ui = this.ui()
    const data = this.data()
    const config = this.cfg()
    const area = data && data.areas.filter((a) => a.id === ui.areaId)[0]
    const rows = [
      this.back({ view: 'main', areaId: null }),
      Text({ bold: true, style: { fontSize: '16px', padding: '8px 0' } }, [(area ? area.name : ui.areaId) + ' — ' + gettext('entities_grouped')]),
    ]
    if (!data) return View({ style: { padding: '12px 16px' } }, rows)

    if (!config.areas[ui.areaId]) config.areas[ui.areaId] = { enabled: true, entities: {} }
    const entities = {}
    data.entities
      .filter((e) => e.a === ui.areaId)
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
        rows.push(Section({ title: domainLabel(domain) }, items))
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
              Text({ style: { color: '#888', fontSize: '12px' } }, [b.entity + ' — ' + gettext('slot') + ' ' + b.slot]),
            ]),
            Button({
              label: gettext('edit'),
              onClick: () => this.nav({ view: 'button', screen: si, button: bi }),
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
          onClick: () => this.nav({ view: 'button', screen: si, button: -1 }),
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

  startEdit() {
    const ui = this.ui()
    const config = this.cfg()
    const existing = ui.button >= 0 ? config.screens[ui.screen].buttons[ui.button] : null
    this.state.edit = Object.assign(
      {
        entity: '',
        label: '',
        action: 'auto',
        colorOn: '#43A047',
        colorOff: '#546E7A',
        shape: 'round',
        size: 's',
        slot: 0,
      },
      existing || {}
    )
  },

  setEdit(patch) {
    Object.assign(this.state.edit, patch)
    this.nav({}) // storage write forces a rebuild
  },

  saveEdit() {
    const ui = this.ui()
    const edit = this.state.edit
    if (!edit || !edit.entity) return
    const c = this.cfg()
    const screen = c.screens[ui.screen]
    if (!screen.buttons) screen.buttons = []
    if (ui.button >= 0) screen.buttons[ui.button] = edit
    else screen.buttons.push(edit)
    this.saveConfig(c)
    this.state.edit = null
    this.nav({ view: 'screens', screen: null, button: null })
  },

  buttonView() {
    const ui = this.ui()
    const data = this.data()
    if (!this.state.edit) this.startEdit()
    const edit = this.state.edit
    const rows = [this.back({ view: 'screens', button: null })]

    const entityOptions = (data ? data.entities : []).map((e) => ({
      name: e.n + ' (' + (e.a ? 'area' : domainLabel(e.d)) + ')',
      value: e.e,
    }))
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
          Select({
            label: gettext('entity'),
            options: entityOptions,
            value: edit.entity,
            onChange: (v) => {
              const patch = { entity: v }
              if (!edit.label) {
                const found = (data ? data.entities : []).filter((e) => e.e === v)[0]
                if (found) patch.label = found.n
              }
              this.setEdit(patch)
            },
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
                      this.state.edit = null
                      this.nav({ view: 'screens', button: null })
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
    this.state.edit = null
    return this.rootView()
  },
})
