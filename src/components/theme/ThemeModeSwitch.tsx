"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";
import { type ThemePreference, isThemePreference } from "@/lib/theme-mode";
import { useThemeMode } from "@/components/theme/ThemeModeProvider";

const themeOptions: ReadonlyArray<{
  key: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { key: "default", label: "Systeem", icon: Monitor },
  { key: "light", label: "Licht", icon: Sun },
  { key: "dark", label: "Donker", icon: Moon },
];

export function ThemeModeSwitch({ className = "" }: { readonly className?: string }) {
  const { preference, setPreference } = useThemeMode();

  return (
    <Segment
      aria-label="Thema kiezen"
      className={`theme-mode-switch ${className}`.trim()}
      onSelectionChange={(key) => {
        const nextPreference = String(key);
        if (isThemePreference(nextPreference)) {
          setPreference(nextPreference);
        }
      }}
      selectedKey={preference}
      size="sm"
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;

        return (
          <Segment.Item
            key={option.key}
            aria-label={option.label}
            id={option.key}
          >
            <Segment.Separator />
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </Segment.Item>
        );
      })}
    </Segment>
  );
}
