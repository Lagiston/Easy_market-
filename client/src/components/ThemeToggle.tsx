import { useEffect } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const NEXT_THEME = {
  light: "dark",
  dark: "system",
  system: "light",
} as const;

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

// Cycles light → dark → system; the icon shows the current *setting*
// (monitor = follow the OS), not the resolved appearance.
export default function ThemeToggle({
  label = "Toggle theme",
}: {
  label?: string;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const setting = (theme ?? "system") as keyof typeof NEXT_THEME;
  const Icon = THEME_ICONS[setting] ?? Monitor;

  // Keep mobile browser chrome matching the page background — runs on
  // toggle and also when the OS theme changes while set to "system".
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
      onClick={() => setTheme(NEXT_THEME[setting] ?? "system")}
    >
      <Icon className="size-4" />
    </Button>
  );
}
