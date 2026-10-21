// Node >= 25 ships its own Web Storage globals. Without --localstorage-file
// the `localStorage` getter returns undefined and shadows jsdom's Storage,
// so restore jsdom's implementation. Must run before any module that touches
// storage at import time (e.g. ./i18n), hence a separate setup file.
const dom = (globalThis as unknown as { jsdom?: { window: Window } }).jsdom;

if (dom) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    if (globalThis[key] === undefined) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        get: () => dom.window[key],
      });
    }
  }
}

export {};
