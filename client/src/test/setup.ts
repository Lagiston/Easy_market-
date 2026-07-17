import '@testing-library/jest-dom/vitest'

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
