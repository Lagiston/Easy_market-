// Apply the persisted theme before first paint so a dark-mode user
// never sees a white flash. Must match next-themes' storageKey.
// Also points theme-color (mobile browser chrome) at the resolved
// theme's background; ThemeToggle keeps it in sync on later toggles.
// Firefox/Opera don't support the meta tag and just ignore it, so
// there's no need to omit it for their sake.
(function () {
  var theme = localStorage.getItem("es-market-theme");
  if (
    theme === "dark" ||
    (theme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
    document
      .querySelector('meta[name="theme-color"]')
      .setAttribute("content", "#080c0e");
  }
})();
