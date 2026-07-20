// Persists the guest's active inquiry id across reloads so the chat widget can
// resume the thread — mirrors the localStorage shape in cart.tsx. There are no
// customer accounts, so the (non-enumerable, random) inquiry id is the only
// "session" a guest has.
const STORAGE_KEY = "es-market-inquiry-id";

export function getStoredInquiryId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredInquiryId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage unavailable (private mode, quota) — the widget still works
    // for the current page load, it just won't resume after a reload.
  }
}

export function clearStoredInquiryId(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
