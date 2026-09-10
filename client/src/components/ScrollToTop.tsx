import { useEffect } from "react";
import { useLocation } from "react-router";

// This app uses a plain <BrowserRouter> (not createBrowserRouter), so
// react-router's <ScrollRestoration> — a data-router-only API — isn't
// available. Without this, the browser leaves window.scrollY untouched on a
// client-side navigation, so a <Link> click from partway down a tall page
// (common on mobile, where less horizontal room means taller pages) can land
// the next page already scrolled to the same offset — sometimes on its
// footer. Keyed on pathname only (not the full location), so an in-page hash
// link (e.g. PolicyPage's anchor nav) doesn't get yanked back to the top.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
