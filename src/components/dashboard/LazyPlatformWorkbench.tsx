"use client";

import dynamic from "next/dynamic";
import { LoadingPanel } from "@/components/dashboard/shared";
import type { PlatformWorkbenchSection } from "@/components/PlatformWorkbench";
import type { GymDashboardSnapshot } from "@/server/types";

const PlatformWorkbench = dynamic(
  () =>
    import("@/components/PlatformWorkbench").then((module) => module.PlatformWorkbench),
  {
    loading: () => (
      <LoadingPanel
        title="Werkbank wordt geladen"
        description="De formulieren voor deze pagina worden asynchroon voorbereid."
      />
    ),
    ssr: false,
  },
);

export function LazyPlatformWorkbench({
  snapshot,
  highlightStepKey,
  sections,
  showLaunchHeader,
}: {
  readonly snapshot: GymDashboardSnapshot;
  readonly highlightStepKey?: string | null;
  readonly sections?: ReadonlyArray<PlatformWorkbenchSection>;
  readonly showLaunchHeader?: boolean;
}) {
  return (
    <PlatformWorkbench
      highlightStepKey={highlightStepKey}
      sections={sections}
      showLaunchHeader={showLaunchHeader}
      snapshot={snapshot}
    />
  );
}
