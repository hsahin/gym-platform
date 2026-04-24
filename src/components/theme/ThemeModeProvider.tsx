"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
  isThemePreference,
  resolveThemePreference,
} from "@/lib/theme-mode";

type ThemeModeContextValue = {
  readonly preference: ThemePreference;
  readonly resolvedTheme: ResolvedTheme;
  readonly setPreference: (nextPreference: ThemePreference) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function readInitialPreference(): ThemePreference {
  if (typeof document === "undefined") {
    return "default";
  }

  const value = document.documentElement.dataset.themePreference;
  return value && isThemePreference(value) ? value : "default";
}

function readInitialResolvedTheme(): ResolvedTheme {
  if (typeof document === "undefined") {
    return "light";
  }

  const value = document.documentElement.dataset.theme;
  if (value === "light" || value === "dark") {
    return value;
  }

  return resolveThemePreference(
    readInitialPreference(),
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
}

function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolvedTheme = resolveThemePreference(
    preference,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const root = document.documentElement;

  root.dataset.themePreference = preference;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  root.classList.toggle("dark", resolvedTheme === "dark");
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);

  return resolvedTheme;
}

export function ThemeModeProvider({ children }: { readonly children: ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readInitialPreference);
  const [resolvedTheme, setResolvedTheme] =
    useState<ResolvedTheme>(readInitialResolvedTheme);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
  }, []);

  useEffect(() => {
    setResolvedTheme(applyTheme(preference));
  }, [preference]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (preference === "default") {
        setResolvedTheme(applyTheme("default"));
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [preference]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
    }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error("useThemeMode must be used inside ThemeModeProvider.");
  }

  return context;
}
