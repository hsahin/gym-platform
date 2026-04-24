"use client";

import { Toaster } from "sonner";
import { useThemeMode } from "@/components/theme/ThemeModeProvider";

export function ThemeAwareToaster() {
  const { resolvedTheme } = useThemeMode();

  return <Toaster position="top-right" richColors theme={resolvedTheme} />;
}
