import '@testing-library/jest-dom/vitest'

// jsdom has no matchMedia implementation — needed by the sonner Toaster
// (used for toast notifications on add-to-cart/buy-now) for theme detection.
if (!globalThis.matchMedia) {
  globalThis.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList
}

// Node >=22 defines a global `localStorage` that is undefined unless the
// --localstorage-file flag is set, shadowing jsdom's implementation when
// vitest merges the jsdom window onto globalThis. Restore a working Storage.
if (!globalThis.localStorage) {
  let store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(String(key)) ?? null,
      setItem: (key: string, value: string) => {
        store.set(String(key), String(value))
      },
      removeItem: (key: string) => {
        store.delete(String(key))
      },
      clear: () => {
        store = new Map()
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size
      },
    } satisfies Storage,
  })
}
