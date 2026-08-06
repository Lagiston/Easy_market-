import { useEffect } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Two-option toggle: light/dark only, no "system" setting to cycle through.
// The very first visit still follows the OS preference (ThemeProvider's
// defaultTheme="system" in main.tsx), so `theme` may still read "system"
// until the user actually clicks this — the icon and the toggle target both
// key off `resolvedTheme` (the appearance actually shown), not `theme`
// itself, so the first click always flips to the *opposite* of what's
// currently on screen rather than jumping to a third state.
export default function ThemeToggle({
  label = "Toggle theme",
}: {
  label?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? Moon : Sun;

  // Keep mobile browser chrome matching the page background — runs on
  // toggle and also on the very first render once resolvedTheme settles.
  // Hex values mirror --background in index.css / index.html.
  useEffect(() => {
    if (!resolvedTheme) return;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolvedTheme === "dark" ? "#090c09" : "#ffffff");
  }, [resolvedTheme]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Icon className="size-4" />
    </Button>
  );
}
