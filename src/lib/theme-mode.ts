export const THEME_STORAGE_KEY = "gymos-theme-preference";

export const THEME_PREFERENCES = ["default", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "default">;

export function isThemePreference(value: string): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function resolveThemePreference(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === "default") {
    return prefersDark ? "dark" : "light";
  }

  return preference;
}

export function getThemeInitializationScript() {
  return `
    (() => {
      const storageKey = "${THEME_STORAGE_KEY}";
      const root = document.documentElement;
      const stored = window.localStorage.getItem(storageKey);
      const preference =
        stored === "light" || stored === "dark" || stored === "default"
          ? stored
          : "default";
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const resolved =
        preference === "default" ? (prefersDark ? "dark" : "light") : preference;

      root.dataset.themePreference = preference;
      root.dataset.theme = resolved;
      root.style.colorScheme = resolved;
      root.classList.toggle("dark", resolved === "dark");
    })();
  `;
}
