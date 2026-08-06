import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import ThemeToggle from "./ThemeToggle";

// The test-setup matchMedia stub always reports light, so "system" resolves
// to light deterministically here.
function renderToggle() {
  return render(
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="es-market-theme"
      disableTransitionOnChange
    >
      <ThemeToggle />
    </ThemeProvider>
  );
}

const themeColorMeta = () =>
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    // index.html provides this tag in the real app
    themeColorMeta()?.remove();
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#ffffff";
    document.head.appendChild(meta);
  });

  it("renders an accessible toggle button", () => {
    renderToggle();
    expect(
      screen.getByRole("button", { name: "Toggle theme" })
    ).toBeInTheDocument();
  });

  it("toggles between light and dark only, persisting the setting and applying the .dark class", async () => {
    const user = userEvent.setup();
    renderToggle();
    const button = screen.getByRole("button", { name: "Toggle theme" });

    // Starts on "system", which resolves to light under the test matchMedia
    // stub — the first click should flip to the opposite (dark), not cycle
    // through a third "system" state.
    await user.click(button);
    expect(localStorage.getItem("es-market-theme")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");

    await user.click(button);
    expect(localStorage.getItem("es-market-theme")).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");

    await user.click(button);
    expect(localStorage.getItem("es-market-theme")).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("keeps the theme-color meta in sync with the resolved theme", async () => {
    const user = userEvent.setup();
    renderToggle();
    const button = screen.getByRole("button", { name: "Toggle theme" });

    await user.click(button); // dark
    await waitFor(() =>
      expect(themeColorMeta()).toHaveAttribute("content", "#090c09")
    );

    await user.click(button); // light
    await waitFor(() =>
      expect(themeColorMeta()).toHaveAttribute("content", "#ffffff")
    );
  });

  it("uses a custom aria-label when provided", () => {
    render(
      <ThemeProvider attribute="class" storageKey="es-market-theme">
        <ThemeToggle label="Basculer le thème" />
      </ThemeProvider>
    );
    expect(
      screen.getByRole("button", { name: "Basculer le thème" })
    ).toBeInTheDocument();
  });
});
