import { describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  getThemeInitializationScript,
  isThemePreference,
  resolveThemePreference,
} from "@/lib/theme-mode";

describe("theme mode helpers", () => {
  it("recognizes supported theme preferences", () => {
    expect(isThemePreference("default")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
  });

  it("resolves the default preference against the OS setting", () => {
    expect(resolveThemePreference("default", true)).toBe("dark");
    expect(resolveThemePreference("default", false)).toBe("light");
  });

  it("keeps explicit light and dark preferences stable", () => {
    expect(resolveThemePreference("light", true)).toBe("light");
    expect(resolveThemePreference("dark", false)).toBe("dark");
  });

  it("builds an initialization script that restores the stored preference", () => {
    const script = getThemeInitializationScript();

    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain("window.localStorage.getItem");
    expect(script).toContain('root.classList.toggle("dark", resolved === "dark")');
  });
});
