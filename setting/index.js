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
  GRID_ROWS,
  GEOM_VERSION,
  HA_URL_EXAMPLE,
} from '../utils/config/constants'
import { ICON_CHOICES } from '../utils/icons'

/*
 * Module-level mirror of the last-written `ha_ui`. The framework's props
 * snapshot (props.settingsStorage.getItem) is STALE until the next re-render,
 * so a second nav() within one event handler would merge over the pre-write
 * snapshot and silently drop keys written moments ago (e.g. the editor draft
 * written by setEdit, clobbered by the navigation that follows). uiCache keeps
 * the truth in memory — the module persists across view rebuilds.
 */
let uiCache = null

// Editor draft defaults; the in-progress button draft lives in ha_config
// under '__draft' (NOT in ha_ui): the settings framework reliably delivers
// config writes back to the next render (the button list itself renders from
// cfg()), while ha_ui nav payload (edit/screen/button) was observed to NOT
// arrive on the phone — the editor kept opening with empty fields.
const EDITOR_DEFAULTS = {
  entity: '',
  label: '',
  action: 'auto',
  colorOn: '#43A047',
  colorOff: '#546E7A',
  shape: 'round',
  size: 's',
  slot: 0,
  icon: '',
}

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

function fieldOptions(field) {
  if (field === 'action') return ACTIONS
  if (field === 'shape') return SHAPES
  if (field === 'size') return SIZES
  if (field === 'slot') return slotOptions()
  if (field === 'icon') return iconOptions()
  return PALETTE.map((p) => ({ name: p.name + '  ' + p.value, value: p.value }))
}

// Human-readable current value of an editor field (shown in its Button row).
function fieldCurrent(edit, field) {
  if (field === 'slot') {
    const v = Number(edit.slot) || 0
    return 'R' + (Math.floor(v / GRID_COLS) + 1) + 'C' + (v % GRID_COLS + 1)
  }
  const hit = fieldOptions(field).filter((o) => o.value === edit[field])[0]
  return hit ? hit.name : edit[field] || '—'
}

// first free grid area for a NEW button: buttons occupy a row-anchored span
// (xs=1 col, s=2 cols, l=full row); never stack a new button on an existing one
function firstFreeSlot(buttons) {
  const spanOf = (b) => (b.size === 'l' ? GRID_COLS : b.size === 'xs' ? 1 : 2)
  const taken = new Array(GRID_COLS * GRID_ROWS).fill(false)
  buttons.forEach((b) => {
    const s = Number(b.slot) || 0
    const span = Math.min(spanOf(b), GRID_COLS - (s % GRID_COLS))
    for (let i = s; i < s + span; i++) taken[i] = true
  })
  for (let i = 0; i < taken.length; i++) {
    const span = 2 // the new-button default size is 's'
    if (i % GRID_COLS + span > GRID_COLS) continue
    let free = true
    for (let k = i; k < i + span; k++) if (taken[k]) free = false
    if (free) return i
  }
  return 0
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
    return uiCache || readJson(this.props, STORAGE_KEYS.HA_UI, { view: 'root' })
  },

  nav(patch) {
    const next = Object.assign({}, this.ui(), patch)
    next._r = Date.now() // force a storage change even when the payload is identical
    uiCache = next
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
            onClick: () => {
              // domain goes into ha_config (proven channel), nav only switches view
              const c = this.cfg()
              c.__domain = d
              this.saveConfig(c)
              this.nav({ view: 'elist' })
            },
          })
        )
      )
    )
    return View({ style: { padding: '12px 16px' } }, rows)
  },

  eListView() {
    const ui = this.ui()
    const domain = this.cfg().__domain || ui.domain
    const rows = [this.back({ view: 'epicker' })]
    const data = this.data()
    const entities = data && domain ? data.entities.filter((e) => e.d === domain) : []
    rows.push(
      Text({ bold: true, style: { fontSize: '18px', color: '#2E7D32', margin: '10px 0 2px' } }, [domainLabel(domain) + ': ' + entities.length]),
      Section(
        {},
        entities.map((e) =>
          Button({
            label: e.n,
            onClick: () => {
              // draft lives in ha_config; nav only switches the view
              const cur = this.editVal()
              const c = this.cfg()
              const d = Object.assign({}, cur, { entity: e.e })
              if (!cur.label) d.label = e.n
              c.__draft = d
              this.saveConfig(c)
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
        rows.push(
          Text({ bold: true, style: { fontSize: '18px', color: '#2E7D32', margin: '10px 0 2px' } }, [domainLabel(domain) + ': ' + entities[domain].length]),
          Section({}, items)
        )
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
              onClick: () => this.openEditor(si, bi),
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
          onClick: () => this.openEditor(si, -1),
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

  // The in-progress button draft lives in ha_config under '__draft'. The
  // settings framework reliably delivers config writes back to the next
  // render (the button list itself renders from cfg()), while ha_ui nav
  // payload (edit/screen/button) was observed to NOT arrive on the phone —
  // the editor kept opening with empty fields.
  openEditor(si, bi) {
    const c = this.cfg()
    const existing = bi >= 0 && c.screens[si] ? (c.screens[si].buttons || [])[bi] : null
    c.__draft = Object.assign({}, EDITOR_DEFAULTS, existing || {})
    if (bi < 0 && c.screens[si]) {
      // new buttons must not stack onto slot 0 — pick the first free grid area
      c.__draft.slot = firstFreeSlot(c.screens[si].buttons || [])
    }
    c.__editTarget = { screen: si, button: bi }
    this.saveConfig(c)
    // seed the label field's storage key (the label TextInput is settingsKey-backed)
    this.props.settingsStorage.setItem('ha_ed_label', c.__draft.label || '')
    this.nav({ view: 'button', screen: si, button: bi })
  },

  // All editor fields are Button rows opening this picker: on phone runtimes
  // Select/TextInput initial `value` props render empty (docs say otherwise),
  // while Button string labels always display.
  openPicker(field) {
    const c = this.cfg()
    c.__pick = field
    this.saveConfig(c)
    this.nav({ view: 'picker' })
  },

  pickerView() {
    const field = this.cfg().__pick
    const rows = [this.back({ view: 'button' })]
    if (!field) {
      rows.push(Text({ style: { color: '#888' } }, [gettext('diag_wait')]))
      return View({ style: { padding: '12px 16px' } }, rows)
    }
    const edit = this.editVal()
    const titleKey = field === 'colorOn' ? 'color_on' : field === 'colorOff' ? 'color_off' : field
    const raw = field === 'slot' ? String(edit.slot) : edit[field]
    rows.push(
      Section(
        { title: gettext(titleKey) },
        fieldOptions(field).map((o) =>
          Button({
            label: (String(o.value) === String(raw) ? '✓ ' : '') + o.name,
            onClick: () => {
              const patch = {}
              patch[field] = field === 'slot' ? parseInt(o.value, 10) : o.value
              this.setEdit(patch) // draft write only; navigation below is the single ha_ui write
              this.nav({ view: 'button' })
            },
          })
        )
      )
    )
    return View({ style: { padding: '12px 16px' } }, rows)
  },

  editVal() {
    const draft = this.cfg().__draft
    if (draft) return Object.assign({}, EDITOR_DEFAULTS, draft)
    // last-resort fallback: read the configured button directly
    const ui = this.ui()
    const config = this.cfg()
    const screen = ui.screen != null ? config.screens[ui.screen] : null
    const existing = screen && ui.button >= 0 ? (screen.buttons || [])[ui.button] : null
    return Object.assign({}, EDITOR_DEFAULTS, existing || {})
  },

  setEdit(patch) {
    const c = this.cfg()
    c.__draft = Object.assign(this.editVal(), patch)
    this.saveConfig(c) // the config write triggers the rebuild
  },

  saveEdit() {
    const ui = this.ui()
    const c = this.cfg()
    const edit = c.__draft
    if (!edit || !edit.entity) return
    // the label TextInput auto-persists to its settingsKey; that value is authoritative
    const savedLabel = this.props.settingsStorage.getItem('ha_ed_label')
    if (typeof savedLabel === 'string') edit.label = savedLabel
    // the editor target also travels inside config — never trust ha_ui here
    const t = c.__editTarget || { screen: ui.screen, button: ui.button }
    delete c.__draft
    delete c.__editTarget
    const screen = c.screens[t.screen]
    if (!screen) {
      this.nav({ view: 'screens', screen: null, button: null, edit: null })
      return
    }
    if (!screen.buttons) screen.buttons = []
    if (t.button >= 0) screen.buttons[t.button] = edit
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
            // settingsKey-backed: storage-bound TextInputs are the ONLY input
            // whose value the phone runtime displays (URL/token fields prove it)
            settingsKey: 'ha_ed_label',
            placeholder: '',
            onChange: (v) => this.setEdit({ label: v }),
          }),
          Button({
            label: gettext('action') + ': ' + fieldCurrent(edit, 'action'),
            onClick: () => this.openPicker('action'),
          }),
          Button({
            label: gettext('shape') + ': ' + fieldCurrent(edit, 'shape'),
            onClick: () => this.openPicker('shape'),
          }),
          Button({
            label: gettext('size') + ': ' + fieldCurrent(edit, 'size'),
            onClick: () => this.openPicker('size'),
          }),
          Button({
            label: gettext('slot') + ': ' + fieldCurrent(edit, 'slot'),
            onClick: () => this.openPicker('slot'),
          }),
          Button({
            label: gettext('icon') + ': ' + fieldCurrent(edit, 'icon'),
            onClick: () => this.openPicker('icon'),
          }),
          Button({
            label: gettext('color_on') + ': ' + edit.colorOn,
            onClick: () => this.openPicker('colorOn'),
          }),
          Button({
            label: gettext('color_off') + ': ' + edit.colorOff,
            onClick: () => this.openPicker('colorOff'),
          }),
        ]
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
                      const t = c.__editTarget || { screen: ui.screen, button: ui.button }
                      delete c.__draft
                      delete c.__editTarget
                      if (c.screens[t.screen] && c.screens[t.screen].buttons) c.screens[t.screen].buttons.splice(t.button, 1)
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
    if (view === 'picker') return this.pickerView()
    if (view === 'epicker') return this.ePickerView()
    if (view === 'elist') return this.eListView()
    if (view === 'diag') return this.diagView()
    return this.rootView()
  },
})
