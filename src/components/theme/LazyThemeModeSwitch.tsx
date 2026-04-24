"use client";

import dynamic from "next/dynamic";

const ThemeModeSwitch = dynamic(
  () =>
    import("@/components/theme/ThemeModeSwitch").then((module) => module.ThemeModeSwitch),
  {
    loading: () => (
      <div
        aria-hidden="true"
        className="h-9 w-[8.75rem] rounded-full border border-border/70 bg-surface-secondary"
      />
    ),
    ssr: false,
  },
);

export function LazyThemeModeSwitch({
  className,
}: {
  readonly className?: string;
}) {
  return <ThemeModeSwitch className={className} />;
}
