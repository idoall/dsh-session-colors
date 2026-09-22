import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = readFileSync(resolve(root, 'src/client.js'), 'utf8')
const hostSource = readFileSync(resolve(root, 'src/index.js'), 'utf8')

/**
 * Evaluate the plugin's browser half the way the DSH client-modules loader
 * does: the file registers itself through `window.__ModuleLoader__.load`, and
 * its factory receives a `require`. This proves the hand-authored bundle is
 * well formed, that it needs nothing but React, and that `apply` survives the
 * surfaces we target.
 */
function loadClient(host = fakeHost()) {
  let registration
  const route = host
  const storage = new Map()
  const localStorage = {
    get length() { return storage.size },
    key: (index) => [...storage.keys()][index] ?? null,
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, String(value)) },
    removeItem: (key) => { storage.delete(key) },
  }
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    Fragment: Symbol('Fragment'),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: (initial) => ({ current: initial }),
    useEffect: () => {},
    useCallback: (callback) => callback,
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
  // The chip layer portals itself out of the shell overlay's stacking context,
  // so `react-dom` is required alongside React.
  const ReactDOM = { createPortal: (children, container) => ({ portal: { children, container } }) }
  const listeners = new Map()
  const documentStub = {
    head: { append: () => {} },
    body: {},
    getElementById: () => null,
    createElement: () => ({ remove: () => {} }),
    querySelectorAll: () => [],
    addEventListener: (name, handler) => { listeners.set(name, handler) },
    removeEventListener: (name) => { listeners.delete(name) },
  }
  // The layer measures the stacking level of the row's ancestor chain; fake
  // nodes carry their computed style on `__style`.
  const getComputedStyle = (node) => (node === null || node === undefined ? undefined : node.__style) ?? { position: 'static', zIndex: 'auto' }
  const sandbox = {
    console,
    localStorage,
    document: documentStub,
    getComputedStyle,
    fetch: (url, init) => route.fetch(url, init),
    setInterval,
    clearInterval,
    MutationObserver: class { observe() {} disconnect() {} },
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  sandbox.window = {
    __ModuleLoader__: { load: (value) => { registration = value } },
    addEventListener: () => {},
    removeEventListener: () => {},
    innerWidth: 1440,
    innerHeight: 900,
  }
  sandbox.globalThis = sandbox
  new Script(source).runInNewContext(sandbox)
  assert.ok(registration !== undefined, 'the bundle must register through __ModuleLoader__')
  const required = []
  const exports = registration.factory((id) => {
    required.push(id)
    if (id === 'react') return React
    if (id === 'react-dom') return ReactDOM
    throw new Error(`unexpected require: ${id}`)
  })
  return { registration, exports, required, storage, listeners, documentStub }
}

/** A client context stand-in recording every slot registration. */
function fakeContext(home) {
  const effects = []
  const registrations = []
  return {
    effects,
    registrations,
    ctx: {
      locale: { bind: () => (key) => key, register: () => {} },
      effect: (callback) => { effects.push(callback); const disposer = callback(); return disposer },
      remote: { $host: home === undefined ? {} : { home } },
      on: () => () => {},
      get: () => ({ openSession: () => {} }),
      layout: { selectPanel: () => {} },
      slots: {
        inject: (name, register) => { registrations.push({ name, dispose: register() }) },
        register: (options) => { registrations.push(options); return () => {} },
      },
    },
  }
}

/** An observable Host identity the store can follow. */
function hostFacts(initial) {
  let home = initial
  return {
    source: { getSnapshot: () => home, subscribe: () => () => {} },
    set: (next) => { home = next },
  }
}

test('the browser half registers as the package id and needs only shell modules', () => {
  const { registration, required } = loadClient()
  assert.equal(registration.id, '@idoall/dsh-session-colors')
  // Both are DSH web-shell static modules; nothing else may be pulled in.
  assert.deepEqual(required, ['react', 'react-dom'])
})

test('the browser half applies against every surface it targets', () => {
  const { exports } = loadClient()
  const { ctx, registrations } = fakeContext('/Users/one')
  assert.deepEqual([...exports.inject], ['slots', 'locale', 'layout'])
  exports.apply(ctx)
  // Field-by-field: the seats object is created inside the VM realm, so a
  // structural compare against a host object would fail on prototypes.
  assert.equal(exports.seats['conversation.session.header.utilities'], 'active')
  assert.equal(exports.seats['shell.overlay'], 'active')
  const names = registrations.map((entry) => entry.name)
  assert.ok(names.includes('conversation.session.header.utilities'), 'the picker seat is registered')
  assert.ok(names.includes('shell.overlay'), 'the chip layer seat is registered')
})

test('a surface the running build does not declare stays absent, not fatal', () => {
  const { exports } = loadClient()
  const { ctx } = fakeContext('/Users/one')
  ctx.slots.inject = (name) => {
    if (name === 'shell.overlay') throw new Error('slot not declared')
  }
  assert.doesNotThrow(() => exports.apply(ctx))
  assert.equal(exports.seats['shell.overlay'], 'unavailable')
  assert.equal(exports.seats['conversation.session.header.utilities'], 'active')
})

/**
 * A stand-in for the plugin's own Host route. `marks` is the shared document,
 * so two stores pointed at one stub behave like two devices against one Host —
 * the property this feature exists for.
 */
function fakeHost(initial = {}) {
  let marks = { ...initial }
  let status = 200
  return {
    get marks() { return marks },
    set status(next) { status = next },
    /** The `fetch` the browser half calls. */
    fetch(url, init) {
      if (status !== 200) return Promise.resolve({ ok: false, status })
      if (init === undefined || init.method === undefined || init.method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ marks: { ...marks }, storage: { persistence: 'file' } }) })
      }
      const body = JSON.parse(init.body)
      if (body.color === null || body.color === undefined) delete marks[body.sessionId]
      else marks[body.sessionId] = body.color
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ marks: { ...marks }, storage: { persistence: 'file' } }) })
    },
  }
}

/** Let the store's promise chain settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

test('a mark set on one device is visible on another', async () => {
  // One Host document, two stores: a desktop and a phone.
  const host = fakeHost()
  const { exports } = loadClient(host)
  const desktop = exports.createStore()
  const phone = exports.createStore()
  desktop.set('session-aaa', { h: 200, s: 1, v: 1, a: 1 })
  await settle()
  // The write must have reached the shared Host document...
  assert.equal(host.marks['session-aaa'].h, 200)
  // ...and the other device must pick it up when it re-reads.
  phone.refresh()
  await settle()
  assert.equal(phone.getSnapshot().colors['session-aaa'].h, 200)
  desktop.dispose()
  phone.dispose()
})

test('clearing a mark removes it for every device', async () => {
  const host = fakeHost()
  const { exports } = loadClient(host)
  const desktop = exports.createStore()
  const phone = exports.createStore()
  desktop.set('session-aaa', { h: 0, s: 1, v: 1, a: 1 })
  desktop.set('session-bbb', { h: 10, s: 1, v: 1, a: 1 })
  await settle()
  desktop.clear('session-aaa')
  await settle()
  phone.refresh()
  await settle()
  assert.equal(phone.getSnapshot().colors['session-aaa'], undefined)
  assert.notEqual(phone.getSnapshot().colors['session-bbb'], undefined)
  desktop.dispose()
  phone.dispose()
})

test('the snapshot stays referentially stable until something changes', () => {
  const { exports } = loadClient()
  const store = exports.createStore()
  const first = store.getSnapshot()
  // useSyncExternalStore re-renders forever if getSnapshot returns a new object
  // on every call, so identity must be cached.
  assert.equal(store.getSnapshot(), first)
  store.set('session-aaa', { h: 0, s: 1, v: 1, a: 1 })
  assert.notEqual(store.getSnapshot(), first)
  store.dispose()
})

test('a route that cannot be reached says so instead of looking empty', async () => {
  const host = fakeHost()
  host.status = 401
  const { exports } = loadClient(host)
  const store = exports.createStore()
  await settle()
  assert.equal(store.getSnapshot().ready, false)
  assert.equal(store.getSnapshot().status, 'unreachable')
  assert.notEqual(store.getSnapshot().error, '')
  store.dispose()
})

test('a rejected write keeps the view usable and reports it', async () => {
  const host = fakeHost()
  const { exports } = loadClient(host)
  const store = exports.createStore()
  await settle()
  host.status = 403
  store.set('session-aaa', { h: 0, s: 1, v: 1, a: 1 })
  await settle()
  // The write is reported as failed; the follow-up reconcile then reports the
  // route itself as unreachable. Either way it must never look saved.
  assert.notEqual(store.getSnapshot().status, 'ready')
  assert.notEqual(store.getSnapshot().error, '')
  store.dispose()
})

test('a malformed stored value is ignored instead of breaking the layer', async () => {
  const host = fakeHost({ bad: { h: 'x' }, shape: null, good: { h: 10, s: 1, v: 1, a: 1 } })
  const { exports } = loadClient(host)
  const store = exports.createStore()
  await settle()
  assert.deepEqual(Object.keys(store.getSnapshot().colors), ['good'])
  store.dispose()
})

test('the row lookup reads the Session id from the fiber and skips unreadable rows', () => {
  const { exports } = loadClient()
  // The row markup carries no id; the renderer keeps it on the fiber's props.
  const row = { __reactFiber$abc: { memoizedProps: { node: { id: 'session-xyz' } }, return: null } }
  assert.equal(exports.sessionIdOf(row), 'session-xyz')
  assert.equal(exports.sessionIdOf({}), undefined)
  assert.equal(exports.sessionIdOf({ __reactFiber$abc: { memoizedProps: null, return: null } }), undefined)
  // A cyclic fiber chain must terminate rather than hang the layer.
  const loop = {}
  loop.__reactFiber$z = { memoizedProps: {}, return: loop.__reactFiber$z }
  assert.doesNotThrow(() => exports.sessionIdOf(loop))
})

test('colour conversion round-trips and parses the system picker formats', () => {
  const { exports } = loadClient()
  const red = exports.hsvToRgb(0, 1, 1)
  // Spread first: the array is built inside the VM realm, so its prototype
  // differs and a structural compare against a host array would fail.
  assert.deepEqual([...red], [255, 0, 0])
  const back = exports.rgbToHsv(255, 0, 0)
  assert.equal(Math.round(back.h), 0)
  assert.equal(exports.toHex({ h: 0, s: 1, v: 1, a: 1 }), '#FF0000')
  const short = exports.parseHex('#F00')
  assert.deepEqual({ h: short.h, s: short.s, v: short.v, a: short.a }, { h: 0, s: 1, v: 1, a: 1 })
  assert.equal(exports.parseHex('#FF0000').v, 1)
  assert.equal(Math.round(exports.parseHex('#FF000080').a * 255), 128)
  assert.equal(exports.parseHex('nope'), undefined)
})

test('a chip keeps its alpha and never overlaps the row status slot', () => {
  const { exports } = loadClient()
  assert.match(exports.cssOf({ h: 0, s: 1, v: 1, a: 0.5 }), /^rgba\(255, 0, 0, 0\.5\)$/)
  // The row is [8px padding][16px status slot][4px][title]. The chip is a bar in
  // the padding, so it must stay clear of the dot that starts at 8px + 3px.
  assert.ok(exports.CHIP_OFFSET >= 0)
  assert.ok(exports.CHIP_OFFSET + exports.CHIP_WIDTH <= 8, 'the chip stays inside the 8px padding')
})

test('the header control carries no theme-specific colour', () => {
  // The button sits on the app header, which is light or dark depending on the
  // viewer's theme. A hardcoded text colour is invisible in one of them, so the
  // control must inherit its colour and stay label-free.
  const action = /\.dsh-sc-action\{([^}]*)\}/.exec(source)
  assert.ok(action !== null, 'the action rule must exist')
  assert.match(action[1], /color:inherit/)
  assert.doesNotMatch(source, /--dsw-color-text/, 'no dependency on an undeclared theme variable')
  assert.doesNotMatch(source, /--dsw-color-border/, 'no dependency on an undeclared theme variable')
  // Borders and swatch rings must be neutral translucent greys so they read on
  // both surfaces rather than being picked for one theme.
  assert.match(source, /border:1px solid rgba\(128,128,128/)
  assert.match(source, /dsh-sc-dot\{[^}]*rgba\(128,128,128/)
  // A neutral tint makes the control read as a control on either surface.
  assert.match(source, /dsh-sc-action\{[^}]*background:rgba\(128,128,128,\.12\)/)
})

test('a DOM dump answers which build and channel state a device has', () => {
  // The phone cannot open a console; the element carries the answer instead.
  assert.match(source, /'data-dsh-sc-build': BUILD/)
  assert.match(source, /'data-dsh-sc-status': snapshot\.status/)
  assert.match(source, /'data-dsh-sc-writable': String\(snapshot\.writable\)/)
  assert.match(source, /'data-dsh-sc-marks': String\(Object\.keys\(snapshot\.colors\)\.length\)/)
})

test('a device can report which build it runs without a debugger', () => {
  // The old build stored marks in the browser and the build before this one
  // painted the layer inside the shell overlay; telling them apart by eye is
  // what makes "hard-refresh that device" an actionable answer.
  assert.match(source, /const BUILD = 'host-routes\+drawer-aware'/)
  assert.match(source, /build=\$\{BUILD\}/)
  assert.match(source, /· \$\{BUILD\}/)
})

test('a device that cannot read marks says so instead of looking empty', () => {
  // "Set on one device, invisible on another" is undiagnosable if a missing
  // channel renders exactly like a Session with no colour.
  assert.match(source, /const offline = snapshot\.ready !== true/)
  assert.match(source, /offline\s*\n?\s*\? React\.createElement\('span', \{ 'aria-hidden': 'true' \}, '⚠'\)/)
  assert.match(source, /marks route status=/)
  assert.match(source, /describe,/)
})

test('a chip is clipped to the sidebar, never painted outside it', () => {
  // A row scrolled out of the sidebar list still has a viewport-relative box.
  // Without clipping to the scrolling container the chip painted over unrelated
  // UI — reported as a colour "floating outside the workspace".
  assert.match(source, /function scrollContainerOf\(/)
  assert.match(source, /function clipFor\(/)
  assert.match(source, /clipPath: layer\.clip/)
  // Rows entirely outside the container are skipped, not just clipped.
  assert.match(source, /box\.bottom <= bounds\.top \|\| box\.top >= bounds\.bottom/)
})

test('the chip layer paints just above the surface that holds the sidebar', () => {
  const { exports } = loadClient()
  const row = { parentElement: null }
  // Stock desktop DSH: every ancestor is in normal flow, so the layer sits at 1
  // and stays below dialogs rather than floating over them.
  row.parentElement = { parentElement: null }
  assert.equal(exports.layerZIndexOf(row), 1)
  // A phone adapter promotes the sidebar to a fixed z-index:10000 drawer. A
  // layer left at 1 is painted behind that drawer's opaque background — which
  // is exactly how the chips disappeared on a phone while a DOM dump still
  // showed them present.
  row.parentElement = {
    __style: { position: 'fixed', zIndex: '10000' },
    parentElement: { __style: { position: 'relative', zIndex: 'auto' }, parentElement: null },
  }
  assert.equal(exports.layerZIndexOf(row), 10001)
  // An outer stacking context caps an inner value, so the outermost z-index is
  // the level that actually competes with the layer.
  row.parentElement = {
    __style: { position: 'fixed', zIndex: '10000' },
    parentElement: { __style: { position: 'relative', zIndex: '5' }, parentElement: null },
  }
  assert.equal(exports.layerZIndexOf(row), 6)
  // An unreadable chain must not cost the layer its chips.
  assert.equal(exports.layerZIndexOf(undefined), 1)
  assert.equal(exports.layerZIndexOf({}), 1)
})

test('the chip layer leaves the shell overlay so a drawer cannot cover it', () => {
  // DSH confines `shell.overlay` to `z-index: 20` on the overlay layer, and
  // nothing inside a stacking context can be raised above a sibling of it. The
  // portal to the document body is the way out; the layer must stay
  // click-through after it.
  assert.match(source, /require\('react-dom'\)/)
  assert.match(source, /createPortal\(node, document\.body\)/)
  assert.match(source, /\.dsh-sc-layer\{[^}]*pointer-events:none/)
  assert.match(source, /zIndex: layer\.zIndex/)
})

test('each mutation option set gets its own observer', () => {
  // A second observe() call on the SAME target replaces the first one's options
  // instead of merging them (DOM spec). Sharing one observer for childList and
  // for body attributes silently stopped childList from being watched at all, so
  // collapsing a workspace removed its rows without a re-sync and the chips sat
  // at the old coordinates until the peer poll re-rendered the layer ~20s later.
  const watches = [...source.matchAll(/\.observe\(document\.body,\s*\{([^}]*)\}/g)].map((m) => m[1])
  assert.equal(watches.length, 3, 'childList, the drawer class, and the collapsed-workspace state')
  assert.ok(watches.some((w) => /childList: true/.test(w)), 'rows appearing and disappearing must be watched')
  assert.ok(watches.some((w) => /attributeFilter: \['class'\]/.test(w)), 'the phone drawer must be watched')
  assert.ok(watches.some((w) => /aria-expanded/.test(w)), 'a collapse that only hides rows must be watched')
  assert.equal(
    [...source.matchAll(/new MutationObserver\(sync\)/g)].length,
    watches.length,
    'one observer per option set, or the options replace each other',
  )
})

test('the chip layer follows a drawer that slides in without a DOM change', () => {
  // The phone adapter opens its sidebar by toggling a class on `body` and
  // animating a transform: no scroll, no resize, no child mutation. Without
  // these triggers the chips keep the coordinates they had while the drawer was
  // still off-screen, so a fixed stacking level alone would not show them.
  assert.match(source, /addEventListener\('transitionrun', onTransition, true\)/)
  assert.match(source, /addEventListener\('transitionend', onTransition, true\)/)
  assert.match(source, /attributeFilter: \['class'\]/)
  assert.match(source, /const SETTLE_FRAMES = \d+/)
  assert.match(source, /cancelFrame\(frame\)/)
})

test('the hex field has room for all seven characters', () => {
  // Measured on a live panel: the field was 51px wide for a 58px value, so it
  // rendered "#FFCC0". The hex column must stay wider than the numeric ones, and
  // the inputs must keep the tighter padding that made the value fit.
  const fields = /\.dsh-sc-fields\{([^}]*)\}/.exec(source)
  assert.ok(fields !== null, 'the fields grid must exist')
  const columns = /grid-template-columns:([^;}]+)/.exec(fields[1])[1].trim().split(/\s+/)
  assert.equal(columns.length, 2, 'the hex column plus one repeat() for R, G, B and A')
  const numeric = /repeat\(4,\s*([\d.]+)fr\)/.exec(columns[1])
  assert.ok(numeric !== null, 'four numeric columns must follow the hex one')
  assert.ok(parseFloat(columns[0]) > parseFloat(numeric[1]), 'the hex column must be the wider one')
  const input = /\.dsh-sc-field input\{([^}]*)\}/.exec(source)
  assert.match(input[1], /padding:0 2px/, 'seven characters need the tighter padding')
})

test('the picker panel never runs off a narrow screen', () => {
  const panel = /\.dsh-sc-panel\{([^}]*)\}/.exec(source)
  assert.ok(panel !== null, 'the panel rule must exist')
  // The border and padding made the rendered box wider than `width`, so the
  // panel must size itself with border-box and cap against the viewport.
  assert.match(panel[1], /box-sizing:border-box/)
  assert.match(panel[1], /width:min\(268px,calc\(100vw - 16px\)\)/)
  assert.match(panel[1], /max-height:calc\(100vh - 16px\)/)
  // Placement must clamp against the measured box, not the nominal width.
  assert.match(source, /panelRef\.current/)
  assert.match(source, /getBoundingClientRect\(\)/)
  assert.match(source, /viewportWidth - width - margin/)
})

test('the picker panel names itself in visible text', () => {
  // With the label removed from the trigger, the panel must say what it is.
  assert.match(source, /className: 'dsh-sc-title'/)
  assert.match(source, /dsh-sc-title\{/)
})

test('the Host half serves a durable marks route', async () => {
  // Imported by path, not through a data: URL: the Host half has real
  // dependencies that must resolve normally.
  const mod = await import(resolve(root, 'src/index.js'))
  assert.equal(mod.name, 'dsh-session-colors')
  assert.deepEqual([...mod.inject], [])
  assert.equal(mod.ROUTE_PREFIX, '/plugins/dsh-session-colors')
  assert.equal(mod.ROUTE_PREFIX, loadClient().exports.MARKS_ROUTE.replace('/marks', ''),
    'both halves must agree on the route or nothing syncs')
  assert.deepEqual(mod.Config({}), {})
  assert.equal(typeof mod.Config({ dataDir: '/tmp/x' }).dataDir, 'string')

  const routes = []
  const registered = []
  mod.apply({
    inject: (_deps, body) => body({
      webServer: { register: (route) => { routes.push(route); return () => {} } },
      connection: { requestRejection: () => undefined },
    }),
    effect: (fn) => { registered.push(fn); return fn() },
  }, { dataDir: undefined })
  assert.equal(routes.length, 1)
  assert.equal(routes[0].kind, 'exact')
  assert.equal(routes[0].path, '/plugins/dsh-session-colors/marks')
  assert.equal(typeof routes[0].handler, 'function')
})

test('the Host half degrades instead of taking the boot down', async () => {
  const mod = await import(resolve(root, 'src/index.js'))
  const hostile = [
    undefined,
    null,
    {},
    { inject: () => { throw new Error('no web server') } },
    { inject: (_deps, body) => body(undefined) },
    { inject: (_deps, body) => body({}) },
    { inject: (_deps, body) => body({ webServer: {} }) },
    { inject: (_deps, body) => body({ webServer: { register: () => { throw new Error('rejected') } } }) },
  ]
  // A Host half that throws can stop the Host from booting, so every shape of
  // missing or hostile composition must be survivable.
  for (const ctx of hostile) assert.doesNotThrow(() => mod.apply(ctx, {}))
})

test('the declared package id matches package.json and the mount patch', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const patch = readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8')
  const { registration } = loadClient()
  assert.equal(registration.id, pkg.name)
  assert.ok(patch.includes(pkg.name), 'cordis.patch.yml mounts the package name')
  assert.equal(pkg.exports['./client'], './src/client.js')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.deepEqual(pkg.dsh.client.inject, [
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-conversation',
  ])
})
