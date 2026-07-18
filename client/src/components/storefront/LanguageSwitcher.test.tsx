import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import i18n from "@/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

async function selectLanguage(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name }));
}

describe("LanguageSwitcher", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("shows the current language in its native name", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole("combobox")).toHaveTextContent("English");
  });

  it("switches to Arabic: sets rtl direction, lang, and persists", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await selectLanguage(user, "العربية");

    expect(i18n.language).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(window.localStorage.getItem("language")).toBe("ar");
  });

  it("switches back to an LTR language and restores ltr direction", async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage("ar");
    render(<LanguageSwitcher />);

    await selectLanguage(user, "Français");

    expect(i18n.language).toBe("fr");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("fr");
    expect(window.localStorage.getItem("language")).toBe("fr");
  });
});
