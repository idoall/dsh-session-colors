/**
 * Browser half of `@idoall/dsh-session-colors`: per-Session colour marks.
 *
 * Two surfaces, both reached through public slots, so no shipped file is
 * touched and nothing is DOM-patched:
 *
 * - `conversation.session.header.utilities` carries the picker button and its
 *   system-style panel (saturation/value field, hue, alpha, hex, RGBA, theme
 *   swatches, saved colours).
 * - A marked Session row paints its own strip: one CSS rule per mark, keyed by
 *   the row's `data-row-key` (`session:<id>`), paints the colour as a
 *   background image. A background on the row needs no geometry reads and no
 *   listeners, so the strip moves with the list in the same frame, including
 *   during momentum scrolling. The Session-row leading slot shares the
 *   status-dot cell and is not mounted while a Session is running, so it is not
 *   used here.
 *
 * That coupling to `data-row-key` is deliberate and is kept harmless: a rule
 * that matches no row simply paints nothing, so a future DSH change can at
 * worst stop the strips from appearing.
 *
 * Written as a hand-authored `__ModuleLoader__` bundle (the only format the
 * client loader accepts for a package client half), so it needs no build step.
 */
window.__ModuleLoader__.load({
  id: '@idoall/dsh-session-colors',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const NS = 'sessionColor'
    /**
     * Build marker. Stored marks are Host-side as of the `host-routes` build,
     * the chip layer paints just above the sidebar as of `drawer-aware`, as of
     * `animated-rows` it follows the Web-Animations row gliding DSH 0.1.7
     * introduced, and as of `drag-exclude` the picker declares its own macOS
     * Desktop window region (DSH 0.2.2-rc.1). A device that still shows an older
     * marker is running a cached client and must be hard-refreshed.
     */
    const BUILD = 'host-routes+row-strips'

    /**
     * This plugin's own Host route. Kept in sync with the Host half's
     * ROUTE_PREFIX; it is the durable store because DSH only host-backs the
     * `settings` service for loopback pages.
     */
    const MARKS_ROUTE = '/plugins/dsh-session-colors/marks'

    /** How often an open page re-reads marks another device may have changed. */
    const PEER_POLL_MS = 20000
    const ACTION_ID = 'session-color-mark'
    const ROW_STYLE_ID = 'dsh-session-colors-row-strips'
    const STYLE_ID = 'dsh-session-color-style'

    /** Theme swatches: the shipped macOS picker set, last one fully transparent. */
    const THEME = [
      ['#FF3B30', 1], ['#34C759', 1], ['#007AFF', 1], ['#FFCC00', 1],
      ['#FFFFFF', 1], ['#000000', 1], ['#FFFFFF', 0],
    ]

    const zh = {
      mark: '颜色标记',
      clear: '清除标记',
      theme: '主题颜色',
      mine: '我的颜色',
      hex: '十六进制',
      alpha: '透明度',
      saturation: '饱和度与明度',
      hue: '色相',
      eyedrop: '吸取屏幕颜色',
      addMine: '把当前颜色加入我的颜色',
      custom: '自定义颜色',
      layer: '会话颜色标记',
      panelTitle: '选择会话颜色',
      none: '当前会话没有颜色标记',
      current: (hex, alpha) => `当前会话颜色：${hex} · A ${alpha}%`,
      saved: '颜色只保存会话 ID 与颜色值：不复制、不移动会话，也不改所属工作区与排序。',
      hint: '点「颜色标记」打开选择器。',
      offline: '颜色标记暂时读不到宿主设置：这台设备可能还在用旧的客户端缓存，请强制刷新（Cmd+Shift+R）。',
      chip: '已标记颜色',
    }
    const en = {
      mark: 'Colour mark',
      clear: 'Clear mark',
      theme: 'Theme colours',
      mine: 'My colours',
      hex: 'Hex',
      alpha: 'Alpha',
      saturation: 'Saturation and brightness',
      hue: 'Hue',
      eyedrop: 'Pick a colour from the screen',
      addMine: 'Save the current colour',
      custom: 'Custom colour',
      layer: 'Session colour marks',
      panelTitle: 'Choose a Session colour',
      none: 'This Session has no colour mark',
      current: (hex, alpha) => `Session colour: ${hex} · A ${alpha}%`,
      saved: 'A mark stores only the Session id and colour value: it never copies, moves, or reorders a Session.',
      hint: 'Open the picker with “Colour mark”.',
      offline: 'Colour marks cannot reach the Host settings yet: this device may still run a cached client. Hard-refresh (Cmd+Shift+R).',
      chip: 'Colour marked',
    }

    //#region colour maths
    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value))
    }

    function hsvToRgb(h, s, v) {
      const c = v * s
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
      const m = v - c
      let r = 0
      let g = 0
      let b = 0
      if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x } else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
      return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
    }

    function rgbToHsv(r, g, b) {
      const red = r / 255
      const green = g / 255
      const blue = b / 255
      const max = Math.max(red, green, blue)
      const min = Math.min(red, green, blue)
      const delta = max - min
      let h = 0
      if (delta !== 0) {
        if (max === red) h = 60 * (((green - blue) / delta) % 6)
        else if (max === green) h = 60 * ((blue - red) / delta + 2)
        else h = 60 * ((red - green) / delta + 4)
      }
      if (h < 0) h += 360
      return { h, s: max === 0 ? 0 : delta / max, v: max }
    }

    function byteToHex(value) {
      return value.toString(16).padStart(2, '0').toUpperCase()
    }

    function toHex(color) {
      const [r, g, b] = hsvToRgb(color.h, color.s, color.v)
      return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`
    }

    function parseHex(raw) {
      const value = String(raw).trim().replace(/^#/, '').toUpperCase()
      if (!/^[0-9A-F]{3}$|^[0-9A-F]{6}$|^[0-9A-F]{8}$/.test(value)) return undefined
      const full = value.length === 3 ? value.split('').map((ch) => ch + ch).join('') : value.slice(0, 6)
      const r = parseInt(full.slice(0, 2), 16)
      const g = parseInt(full.slice(2, 4), 16)
      const b = parseInt(full.slice(4, 6), 16)
      const a = value.length === 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1
      return { ...rgbToHsv(r, g, b), a }
    }

    /** CSS colour for a stored mark, including its alpha. */
    function cssOf(color) {
      if (color === undefined) return undefined
      const [r, g, b] = hsvToRgb(color.h, color.s, color.v)
      return `rgba(${r}, ${g}, ${b}, ${color.a})`
    }
    //#endregion

    //#region preference store
    /** One HSVA colour, as the Host route accepts it. */
    function isColor(value) {
      return value !== null
        && typeof value === 'object'
        && typeof value.h === 'number'
        && typeof value.s === 'number'
        && typeof value.v === 'number'
        && typeof value.a === 'number'
    }

    /** Keep only well-formed entries so one bad record cannot break the layer. */
    function readMarks(marks) {
      const colors = {}
      if (marks === null || typeof marks !== 'object') return colors
      for (const id of Object.keys(marks)) {
        if (isColor(marks[id])) colors[id] = marks[id]
      }
      return colors
    }

    /**
     * Marks store backed by this plugin's own Host route.
     *
     * Not `settingsScope`: DSH host-backs user settings only for loopback pages
     * (`persistence = $host.isLoopback ? "host" : "memory"`), so a page opened
     * over the LAN or a tunnel gets a permanently `unavailable` scope. An own
     * route is not subject to that rule, which is what makes a mark set on one
     * device visible on another.
     *
     * Writes are optimistic — the UI updates at once — and the Host's answer
     * replaces the view, so a failed write is visible rather than silent.
     */
    function createStore() {
      let snapshot = { colors: {}, ready: false, status: 'loading', writable: true, error: '' }
      const listeners = new Set()

      const publish = () => {
        for (const listener of [...listeners]) {
          try {
            listener()
          } catch {
            // A failing consumer must not stop the others.
          }
        }
      }

      const describe = () => ({
        status: snapshot.status,
        writable: snapshot.writable,
        marks: Object.keys(snapshot.colors).length,
        error: snapshot.error,
      })

      /** Adopt whatever the Host serves. */
      const load = () => {
        let request
        try {
          request = fetch(MARKS_ROUTE, { credentials: 'same-origin', headers: { accept: 'application/json' } })
        } catch (error) {
          snapshot = { ...snapshot, ready: false, status: 'unreachable', error: String(error) }
          publish()
          return
        }
        // `.then(onOk, onErr)` would leave the async handler's own throw
        // unhandled; a trailing catch covers both the HTTP failure and the
        // body parse.
        request
          .then(async (response) => {
            if (!response.ok) throw new Error(`marks route answered ${response.status}`)
            const payload = await response.json()
            snapshot = {
              colors: readMarks(payload === null || payload === undefined ? undefined : payload.marks),
              ready: true,
              status: 'ready',
              writable: true,
              error: '',
            }
            publish()
          })
          .catch((error) => {
            snapshot = { ...snapshot, ready: false, status: 'unreachable', error: String(error) }
            publish()
          })
      }

      const write = (sessionId, color) => {
        const colors = { ...snapshot.colors }
        if (color === undefined) delete colors[sessionId]
        else colors[sessionId] = color
        snapshot = { ...snapshot, colors }
        publish()
        let request
        try {
          request = fetch(MARKS_ROUTE, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId, color: color === undefined ? null : color }),
          })
        } catch (error) {
          snapshot = { ...snapshot, error: String(error), status: 'write-failed' }
          publish()
          return
        }
        request
          .then(async (response) => {
            if (!response.ok) throw new Error(`marks route answered ${response.status}`)
            const payload = await response.json()
            snapshot = {
              colors: readMarks(payload === null || payload === undefined ? undefined : payload.marks),
              ready: true,
              status: 'ready',
              writable: true,
              error: '',
            }
            publish()
          })
          .catch((error) => {
            // Keep the optimistic view but say it is unsaved, then reconcile.
            snapshot = { ...snapshot, status: 'write-failed', error: String(error) }
            publish()
            load()
          })
      }

      // Another device may have changed a mark: re-read when the page becomes
      // visible again and on a slow interval while it stays open.
      const onVisible = () => {
        try {
          if (document.visibilityState === 'visible') load()
        } catch {
          // No document visibility: the interval still covers it.
        }
      }
      try {
        document.addEventListener('visibilitychange', onVisible)
      } catch {
        // Nothing to attach.
      }
      const timer = setInterval(load, PEER_POLL_MS)
      // Under a test runner this is a Node Timeout, and a live interval would
      // hold the process open after the suite finishes. Browsers return a
      // number, where unref does not exist and is not needed.
      if (timer !== null && typeof timer === 'object' && typeof timer.unref === 'function') timer.unref()

      load()

      return {
        describe,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        getSnapshot: () => snapshot,
        set: (sessionId, color) => { write(sessionId, color) },
        clear: (sessionId) => { write(sessionId, undefined) },
        refresh: load,
        dispose: () => {
          clearInterval(timer)
          try {
            document.removeEventListener('visibilitychange', onVisible)
          } catch {
            // Nothing to detach.
          }
          listeners.clear()
        },
      }
    }
    //#endregion

    //#region stylesheet
    /**
     * The picker keeps the system panel's own light palette rather than the
     * app's dark chrome, so it reads as an attached system control.
     */
    const STYLE = `
.dsh-sc-action{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:1px solid rgba(128,128,128,.5);border-radius:7px;color:inherit;background:rgba(128,128,128,.12);cursor:pointer;font-size:13px;line-height:1}
.dsh-sc-action:hover{border-color:rgba(128,128,128,.85);background:rgba(128,128,128,.22)}
.dsh-sc-action:focus-visible{outline:2px solid #76a9ff;outline-offset:2px}
.dsh-sc-dot{width:13px;height:13px;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(128,128,128,.6)}
.dsh-sc-panel{position:fixed;z-index:2147483001;box-sizing:border-box;width:min(268px,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow:auto;padding:12px;border:1px solid #d8d8dc;border-radius:14px;background:#f6f6f8;color:#1d1d1f;box-shadow:0 18px 48px rgba(0,0,0,.34),0 0 0 1px rgba(0,0,0,.05);font:400 13px Inter,ui-sans-serif,system-ui,-apple-system,"PingFang SC",sans-serif}
.dsh-sc-panel *{box-sizing:border-box}
.dsh-sc-title{margin:0 0 10px;color:#1d1d1f;font-size:13px;font-weight:600}
.dsh-sc-sv{position:relative;height:128px;border-radius:10px;overflow:hidden;cursor:crosshair;touch-action:none}
.dsh-sc-sv-w,.dsh-sc-sv-b{position:absolute;inset:0;pointer-events:none}
.dsh-sc-sv-w{background:linear-gradient(to right,#fff,transparent)}
.dsh-sc-sv-b{background:linear-gradient(to bottom,transparent,#000)}
.dsh-sc-ring{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.4),0 1px 3px rgba(0,0,0,.3);pointer-events:none}
.dsh-sc-row{display:flex;align-items:center;gap:10px;margin-top:12px}
.dsh-sc-drop{width:36px;height:36px;flex:none;display:grid;place-items:center;border:1px solid #d0d0d6;border-radius:10px;background:#fff;cursor:pointer;color:#3a3a3c;padding:0}
.dsh-sc-drop[disabled]{opacity:.45;cursor:not-allowed}
.dsh-sc-sliders{flex:1;display:grid;gap:8px}
.dsh-sc-hue,.dsh-sc-alpha{position:relative;height:12px;border-radius:999px;touch-action:none}
.dsh-sc-hue{background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}
.dsh-sc-alpha{background-image:linear-gradient(45deg,#c8c8cc 25%,transparent 25%,transparent 75%,#c8c8cc 75%),linear-gradient(45deg,#c8c8cc 25%,transparent 25%,transparent 75%,#c8c8cc 75%);background-size:8px 8px;background-position:0 0,4px 4px}
.dsh-sc-alpha-fill{position:absolute;inset:0;border-radius:999px}
.dsh-sc-knob{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border:2px solid #fff;border-radius:50%;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.25),0 1px 2px rgba(0,0,0,.25);pointer-events:none}
.dsh-sc-fields{display:grid;grid-template-columns:1.55fr repeat(4,1fr);gap:4px;margin-top:12px}
.dsh-sc-field{display:grid;gap:3px;min-width:0}
.dsh-sc-field span{color:#6e6e73;font-size:11px}
.dsh-sc-field input{width:100%;height:28px;padding:0 2px;border:1px solid #d0d0d6;border-radius:7px;background:#fff;color:#1d1d1f;font-size:11px;text-align:center}
.dsh-sc-field input:focus-visible{outline:2px solid #76a9ff;outline-offset:1px}
.dsh-sc-section{margin-top:12px;padding-top:10px;border-top:1px solid #e5e5ea}
.dsh-sc-section h4{margin:0 0 8px;color:#6e6e73;font-size:12px;font-weight:600}
.dsh-sc-swatches{display:flex;flex-wrap:wrap;gap:7px}
.dsh-sc-swatch{width:22px;height:22px;border:1px solid rgba(0,0,0,.14);border-radius:6px;padding:0;cursor:pointer;background-image:linear-gradient(45deg,#c8c8cc 25%,transparent 25%,transparent 75%,#c8c8cc 75%),linear-gradient(45deg,#c8c8cc 25%,transparent 25%,transparent 75%,#c8c8cc 75%);background-size:8px 8px;background-position:0 0,4px 4px}
.dsh-sc-swatch:focus-visible{outline:2px solid #76a9ff;outline-offset:2px}
.dsh-sc-swatch i{display:block;width:100%;height:100%;border-radius:5px}
.dsh-sc-add{width:22px;height:22px;border:1px dashed #b0b0b8;border-radius:6px;background:#fff;color:#3a3a3c;cursor:pointer;font-size:16px;line-height:1;padding:0}
.dsh-sc-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:10px}
.dsh-sc-btn{height:26px;padding:0 10px;border:1px solid #d0d0d6;border-radius:7px;background:#fff;color:#1d1d1f;cursor:pointer;font-size:12px}
.dsh-sc-btn:focus-visible{outline:2px solid #76a9ff;outline-offset:2px}
`

    /** Escape a value for a double-quoted CSS attribute selector. */
    function cssStringEscape(value) {
      return String(value).replace(/[\\"\n\r\f]/g, (character) => ({
        '\\': '\\\\',
        '"': '\\"',
        '\n': '\\a ',
        '\r': '\\d ',
        '\f': '\\c ',
      }[character]))
    }

    /**
     * Paint each marked Session row's colour on the row itself.
     *
     * One rule per mark, keyed by the row's `data-row-key`. The row owns the
     * painting, so scrolling needs no measurement and the strip never lags the
     * list. `--dsh-sidebar-paint-inset` is the row's own transparent inline
     * border; the strip is placed against the row's outer edge like the shipped
     * row art, and padding-box clipping keeps it inside that border.
     */
    function installRowChips(store) {
      try {
        if (document.getElementById(ROW_STYLE_ID) !== null) return () => {}
        const node = document.createElement('style')
        node.id = ROW_STYLE_ID
        document.head.append(node)
        const paint = () => {
          let colors
          try {
            colors = store.getSnapshot().colors
          } catch {
            return
          }
          const rules = []
          for (const id of Object.keys(colors)) {
            const color = colors[id]
            if (id === '' || !isColor(color)) continue
            const value = cssOf(color)
            const key = cssStringEscape(`${SESSION_ROW_KEY}${id}`)
            rules.push(`div[data-row-key="${key}"]{background-image:linear-gradient(${value},${value});background-size:4px 16px;background-position:calc(2px - var(--dsh-sidebar-paint-inset,0px)) 50%;background-repeat:no-repeat}`)
          }
          node.textContent = rules.join('\n')
        }
        paint()
        const unsubscribe = store.subscribe(paint)
        return () => {
          unsubscribe()
          node.remove()
        }
      } catch {
        return () => {}
      }
    }

    /** Install the stylesheet once per document, and hand back its removal. */
    function installStyle() {
      try {
        if (document.getElementById(STYLE_ID) !== null) return () => {}
        const node = document.createElement('style')
        node.id = STYLE_ID
        node.textContent = STYLE
        document.head.append(node)
        return () => { node.remove() }
      } catch {
        return () => {}
      }
    }
    //#endregion

    //#region row discovery
    /**
     * Prefix DSH 0.1.7 uses for a Session row's `data-row-key`. It is the
     * exact, stable DOM source of a row's Session id; older builds and
     * search-result rows carry no such attribute.
     */
    const SESSION_ROW_KEY = 'session:'

    /**
     * Session id of a rendered row. The `data-row-key` attribute is read first
     * because DSH 0.1.7 marks every row with it; the React fiber the renderer
     * already attached remains the fallback, and the walk is bounded so an
     * unexpected shape only costs that row its chip.
     * @param node - a Session row element.
     */
    function sessionIdOf(node) {
      try {
        const key = node === null || node === undefined || typeof node.getAttribute !== 'function'
          ? undefined
          : node.getAttribute('data-row-key')
        if (typeof key === 'string' && key.startsWith(SESSION_ROW_KEY)) return key.slice(SESSION_ROW_KEY.length)
      } catch {
        // An unreadable attribute only sends this row to the fiber fallback.
      }
      try {
        const key = Object.keys(node).find((name) => name.startsWith('__reactFiber$') || name.startsWith('__reactInternalInstance$'))
        if (key === undefined) return undefined
        let fiber = node[key]
        for (let depth = 0; fiber !== null && fiber !== undefined && depth < 80; depth += 1) {
          const props = fiber.memoizedProps
          if (props !== null && typeof props === 'object') {
            const candidate = props.node
            if (candidate !== null && typeof candidate === 'object' && typeof candidate.id === 'string') return candidate.id
            if (typeof props.sessionId === 'string') return props.sessionId
          }
          fiber = fiber.return
        }
      } catch {
        // An unexpected fiber shape only costs this row its chip.
      }
      return undefined
    }

    //#endregion

    //#region components
    /** Drag helper shared by the field, hue and alpha controls. */
    function dragOn(node, read) {
      const move = (event) => {
        const box = node.getBoundingClientRect()
        if (box.width === 0 || box.height === 0) return
        read(clamp((event.clientX - box.left) / box.width, 0, 1), clamp((event.clientY - box.top) / box.height, 0, 1))
      }
      const stop = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', stop)
      }
      node.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        try {
          node.setPointerCapture(event.pointerId)
        } catch {
          // Capture is a nicety; the window listeners still track the drag.
        }
        move(event)
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', stop)
      })
    }

    /**
     * A text field that owns its keystrokes and commits on blur or Enter.
     * Committing per keystroke would fight the user mid-entry (a partial hex
     * value parses as a different colour), and re-rendering straight from props
     * would remount the input and drop focus. `parse` returns the text to show,
     * or undefined when the entry is not a value yet.
     */
    function Field(props) {
      const { label, value, parse } = props
      const [text, setText] = React.useState(value)
      const editing = React.useRef(false)
      React.useEffect(() => {
        if (!editing.current) setText(value)
      }, [value])
      const commit = (raw) => {
        const next = parse(raw)
        setText(next === undefined ? value : next)
      }
      return React.createElement(
        'label',
        { className: 'dsh-sc-field' },
        React.createElement('span', null, label),
        React.createElement('input', {
          value: text,
          spellCheck: false,
          onFocus: () => { editing.current = true },
          onChange: (event) => setText(event.target.value),
          onBlur: (event) => { editing.current = false; commit(event.target.value) },
          onKeyDown: (event) => {
            if (event.key !== 'Enter') return
            editing.current = false
            commit(event.currentTarget.value)
            event.currentTarget.blur()
          },
        }),
      )
    }

    /** The system-style picker panel, positioned against its trigger. */
    function ColorPanel(props) {
      const { t, value, onChange, onClose, anchor } = props
      const [draft, setDraft] = React.useState(value)
      const [mine, setMine] = React.useState([])
      const panelRef = React.useRef(null)
      const [position, setPosition] = React.useState(null)

      const commit = React.useCallback((next) => {
        setDraft(next)
        onChange(next)
      }, [onChange])

      // Clamp against the panel's MEASURED box, not its nominal width: the
      // border and padding make the rendered box wider than `width`, and a
      // nominal clamp let the panel run off the right edge of a narrow screen.
      // It stays hidden until placed so it never flashes at the wrong corner.
      React.useEffect(() => {
        const node = panelRef.current
        const rect = node === null ? null : node.getBoundingClientRect()
        const margin = 8
        const width = rect === null || rect.width === 0 ? 268 : rect.width
        const height = rect === null || rect.height === 0 ? 500 : rect.height
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        let anchorBox
        try {
          anchorBox = anchor === null || anchor === undefined ? undefined : anchor.getBoundingClientRect()
        } catch {
          anchorBox = undefined
        }
        const left = anchorBox === undefined
          ? margin
          : clamp(anchorBox.left, margin, Math.max(margin, viewportWidth - width - margin))
        const top = anchorBox === undefined
          ? margin
          : clamp(anchorBox.bottom + 6, margin, Math.max(margin, viewportHeight - height - margin))
        setPosition({ left, top })
      }, [anchor])

      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose() }
        const onDown = (event) => {
          const node = panelRef.current
          if (node !== null && !node.contains(event.target) && !(anchor !== null && anchor !== undefined && anchor.contains(event.target))) onClose()
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('pointerdown', onDown, true)
        return () => {
          document.removeEventListener('keydown', onKey)
          document.removeEventListener('pointerdown', onDown, true)
        }
      }, [anchor, onClose])

      const svRef = React.useRef(null)
      const hueRef = React.useRef(null)
      const alphaRef = React.useRef(null)
      // The panel mounts when it opens, so the drag handlers bind once. The
      // latest draft and commit are read through refs: re-binding on every
      // change would stack duplicate pointerdown listeners on the same node.
      const draftRef = React.useRef(draft)
      draftRef.current = draft
      const commitRef = React.useRef(commit)
      commitRef.current = commit
      React.useEffect(() => {
        const bound = [
          [svRef.current, (x, y) => commitRef.current({ ...draftRef.current, s: x, v: 1 - y })],
          [hueRef.current, (x) => commitRef.current({ ...draftRef.current, h: x * 360 })],
          [alphaRef.current, (x) => commitRef.current({ ...draftRef.current, a: x })],
        ]
        for (const [node, read] of bound) {
          if (node !== null && node !== undefined) dragOn(node, read)
        }
      }, [])

      const [r, g, b] = hsvToRgb(draft.h, draft.s, draft.v)
      const hueColor = `hsl(${draft.h} 100% 50%)`

      /**
       * A text field that owns its keystrokes and commits on blur or Enter.
       * Committing per keystroke would fight the user mid-entry (a partial hex
       * value parses as a different colour) and would remount the input.
       */
      const field = (label, key, text, parse) => React.createElement(Field, {
        key,
        label,
        parse,
        value: text,
      })

      return React.createElement(
        'div',
        {
          className: 'dsh-sc-panel',
          ref: panelRef,
          role: 'dialog',
          'aria-label': t('panelTitle'),
          // DSH 0.2.2-rc.1 narrowed macOS Desktop's automatic no-drag exclusion
          // from "any matching control or ARIA role" to interactive elements
          // inside a `data-window-drag` row. This panel is a fixed overlay
          // mounted inside the conversation header, which IS such a row, and
          // the saturation, hue and alpha surfaces are plain `role="presentation"`
          // divs that DSH's control list does not name. On a viewport short
          // enough to clamp the panel up over the header, a drag on them would
          // move the window instead of picking a colour. Declaring the panel's
          // own visible box as an exclusion is DSH's documented migration for a
          // custom overlay, and it only ever applies under
          // `html[data-platform=darwin]`, so Web and Windows are untouched.
          'data-window-drag-exclude': '',
          style: position === null
            ? { left: '0px', top: '0px', visibility: 'hidden' }
            : { left: `${position.left}px`, top: `${position.top}px` },
        },
        React.createElement('h4', { className: 'dsh-sc-title' }, t('mark')),
        React.createElement(
          'div',
          { className: 'dsh-sc-sv', ref: svRef, role: 'presentation', 'aria-label': t('saturation'), style: { background: hueColor } },
          React.createElement('div', { className: 'dsh-sc-sv-w' }),
          React.createElement('div', { className: 'dsh-sc-sv-b' }),
          React.createElement('div', { className: 'dsh-sc-ring', style: { left: `${draft.s * 100}%`, top: `${(1 - draft.v) * 100}%` } }),
        ),
        React.createElement(
          'div',
          { className: 'dsh-sc-row' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dsh-sc-drop',
              title: t('eyedrop'),
              'aria-label': t('eyedrop'),
              disabled: typeof window.EyeDropper !== 'function',
              onClick: async () => {
                try {
                  const picked = await new window.EyeDropper().open()
                  const next = parseHex(picked.sRGBHex)
                  if (next !== undefined) commit({ ...next, a: 1 })
                } catch {
                  // The user dismissed the system picker.
                }
              },
            },
            React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 },
              React.createElement('path', { d: 'M3 21l6.5-6.5' }),
              React.createElement('path', { d: 'M14.5 4.5l5 5' }),
              React.createElement('path', { d: 'M12 7l5 5-7.5 7.5H4.5v-5L12 7z' })),
          ),
          React.createElement(
            'div',
            { className: 'dsh-sc-sliders' },
            React.createElement('div', { className: 'dsh-sc-hue', ref: hueRef, role: 'presentation', 'aria-label': t('hue') },
              React.createElement('div', { className: 'dsh-sc-knob', style: { left: `${(draft.h / 360) * 100}%` } })),
            React.createElement('div', { className: 'dsh-sc-alpha', ref: alphaRef, role: 'presentation', 'aria-label': t('alpha') },
              React.createElement('div', { className: 'dsh-sc-alpha-fill', style: { background: `linear-gradient(to right, transparent, ${hueColor})` } }),
              React.createElement('div', { className: 'dsh-sc-knob', style: { left: `${draft.a * 100}%` } })),
          ),
        ),
        React.createElement(
          'div',
          { className: 'dsh-sc-fields' },
          field(t('hex'), 'hex', toHex(draft), (raw) => {
            const next = parseHex(raw)
            if (next === undefined) return undefined
            commit({ ...next, a: draft.a })
            return toHex(next)
          }),
          field('R', 'r', String(r), (raw) => {
            const next = clamp(Math.round(Number(raw) || 0), 0, 255)
            commit({ ...rgbToHsv(next, g, b), a: draft.a })
            return String(next)
          }),
          field('G', 'g', String(g), (raw) => {
            const next = clamp(Math.round(Number(raw) || 0), 0, 255)
            commit({ ...rgbToHsv(r, next, b), a: draft.a })
            return String(next)
          }),
          field('B', 'b', String(b), (raw) => {
            const next = clamp(Math.round(Number(raw) || 0), 0, 255)
            commit({ ...rgbToHsv(r, g, next), a: draft.a })
            return String(next)
          }),
          field('A', 'a', String(Math.round(draft.a * 100)), (raw) => {
            const next = clamp(Math.round(Number(raw) || 0), 0, 100)
            commit({ ...draft, a: next / 100 })
            return String(next)
          }),
        ),
        React.createElement(
          'div',
          { className: 'dsh-sc-section' },
          React.createElement('h4', null, t('theme')),
          React.createElement('div', { className: 'dsh-sc-swatches' },
            THEME.map(([hex, alpha], index) => React.createElement(
              'button',
              {
                key: `${hex}-${index}`,
                type: 'button',
                className: 'dsh-sc-swatch',
                'aria-label': index === THEME.length - 1 ? t('clear') : t('theme'),
                onClick: () => commit({ ...parseHex(hex), a: alpha }),
              },
              React.createElement('i', { style: { background: cssOf({ ...parseHex(hex), a: alpha }) } }),
            ))),
        ),
        React.createElement(
          'div',
          { className: 'dsh-sc-section' },
          React.createElement('h4', null, t('mine')),
          React.createElement('div', { className: 'dsh-sc-swatches' },
            mine.map((color, index) => React.createElement(
              'button',
              { key: `mine-${index}`, type: 'button', className: 'dsh-sc-swatch', 'aria-label': t('custom'), onClick: () => commit(color) },
              React.createElement('i', { style: { background: cssOf(color) } }),
            )),
            React.createElement('button', {
              type: 'button',
              className: 'dsh-sc-add',
              'aria-label': t('addMine'),
              onClick: () => setMine((current) => (current.some((item) => toHex(item) === toHex(draft) && item.a === draft.a) ? current : [...current, draft])),
            }, '+')),
        ),
        React.createElement(
          'div',
          { className: 'dsh-sc-actions' },
          React.createElement('button', {
            type: 'button',
            className: 'dsh-sc-btn',
            onClick: () => { onChange(undefined); onClose() },
          }, t('clear')),
        ),
      )
    }

    /** Header action: a swatch-plus-label button that opens the picker. */
    function HeaderAction(props) {
      const { store, t, args } = props
      const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
      const [open, setOpen] = React.useState(false)
      const buttonRef = React.useRef(null)
      // The slot is expected to pass the Session it sits in; accept the shapes a
      // header action can plausibly receive so a rename upstream only costs the
      // action instead of silently pinning the wrong Session.
      const sessionId = args === undefined
        ? (props.sessionId === undefined ? (props.session === undefined ? undefined : props.session.id) : props.sessionId)
        : args.sessionId
      if (sessionId === undefined) return null

      const color = snapshot.colors[sessionId]
      const start = color === undefined ? { h: 358, s: 0.68, v: 0.9, a: 1 } : color
      // Marks come from the Host route. When it is not answering, say so on the
      // control instead of looking like a Session that simply has no colour.
      const offline = snapshot.ready !== true

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'button',
          {
            type: 'button',
            ref: buttonRef,
            className: 'dsh-sc-action',
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            // No visible label: the control is a colour swatch, and its meaning
            // is carried by the tooltip, the accessible name and the panel
            // heading. A text label would also have to be legible on both the
            // light and the dark header, which a swatch does not.
            'aria-label': color === undefined ? t('mark') : `${t('mark')}：${toHex(color)}`,
            title: `${offline ? t('offline') : (color === undefined ? t('hint') : `${t('mark')}：${toHex(color)}`)} · ${BUILD}`,
            onClick: () => setOpen((current) => !current),
          },
          offline
            ? React.createElement('span', { 'aria-hidden': 'true' }, '⚠')
            : color === undefined
            ? React.createElement('span', { 'aria-hidden': 'true' }, '🎨')
            : React.createElement('span', { className: 'dsh-sc-dot', 'aria-hidden': 'true', style: { background: cssOf(color) } }),
        ),
        open
          ? React.createElement(ColorPanel, {
            t,
            anchor: buttonRef.current,
            value: start,
            onChange: (next) => {
              if (next === undefined) store.clear(sessionId)
              else store.set(sessionId, next)
            },
            onClose: () => setOpen(false),
          })
          : null,
      )
    }
    //#endregion

    /** Required services; both target slots are reached through `slots.inject`. */
    exports.inject = ['slots', 'locale', 'layout']

    /**
     * Register the two surfaces once their slot declarations exist. Each
     * registration is isolated: a surface the running build does not declare
     * stays absent instead of failing the whole plugin.
     * @param ctx - client root context.
     */
    exports.apply = function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-session-colors: dictionaries')
      ctx.effect(installStyle, 'dsh-session-colors: stylesheet')

      // Marks live in this plugin's own Host route. `settingsScope` cannot be
      // used here: DSH host-backs user settings only for loopback pages, so a
      // LAN or tunnel page would get a permanently unavailable scope.
      const store = createStore()
      ctx.effect(() => () => { store.dispose() }, 'dsh-session-colors: preference store')
      // The strip is painted by the row itself, so it moves with the list
      // without measuring, listening or re-rendering on scroll.
      ctx.effect(() => installRowChips(store), 'dsh-session-colors: row strips')

      // A device that shows nothing should be able to say why.
      try {
        const report = store.describe()
        console.info(`[dsh-session-colors] build=${BUILD} marks route status=${report.status} writable=${report.writable} marks=${report.marks}${report.error === '' ? '' : ` error=${report.error}`}`)
      } catch {
        // Diagnostics must never break the plugin.
      }

      const seats = {}
      const seat = (name, register) => {
        try {
          ctx.slots.inject(name, register)
          seats[name] = 'active'
        } catch {
          seats[name] = 'unavailable'
        }
      }

      // Registered as a right-aligned header utility, not as a title-adjacent
      // action. The title cluster is `flex: 1 1 0%` but cannot shrink below its
      // content, so an extra action there overflows straight into the utilities
      // cluster — on a narrow header that put the colour swatch on top of the
      // model picker. Utilities are right-aligned, so the flexible title
      // absorbs the width instead of two controls colliding.
      seat('conversation.session.header.utilities', () => ctx.slots.register(
        { name: 'conversation.session.header.utilities', id: ACTION_ID, order: 40, locale: NS },
        (props) => React.createElement(HeaderAction, {
          ...props,
          store,
          t,
          args: { sessionId: props.sessionId },
        }),
      ))
      exports.seats = seats
    }

    exports.NS = NS
    exports.ACTION_ID = ACTION_ID
    exports.MARKS_ROUTE = MARKS_ROUTE
    exports.PEER_POLL_MS = PEER_POLL_MS
    exports.BUILD = BUILD
    // Exported for the unit tests: the store, its key scheme and the row lookup
    // are the parts worth pinning down without a browser.
    exports.createStore = createStore
    exports.readMarks = readMarks
    exports.isColor = isColor
    exports.sessionIdOf = sessionIdOf
    exports.hsvToRgb = hsvToRgb
    exports.rgbToHsv = rgbToHsv
    exports.toHex = toHex
    exports.parseHex = parseHex
    exports.cssOf = cssOf
    return module.exports
  },
})
