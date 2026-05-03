"use client";

import { useEffect, useState } from "react";
import {
  Segment as HeroSegment,
  type SegmentRootProps,
} from "@heroui-pro/react/segment";

function HydrationSafeSegmentRoot(props: SegmentRootProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        aria-busy="true"
        aria-label={props["aria-label"]}
        className={typeof props.className === "string" ? props.className : undefined}
        data-hydration-safe-segment
        role="group"
        suppressHydrationWarning
      />
    );
  }

  return <HeroSegment {...props} />;
}

export const Segment: typeof HeroSegment = Object.assign(HydrationSafeSegmentRoot, {
  Item: HeroSegment.Item,
  Root: HydrationSafeSegmentRoot,
  Separator: HeroSegment.Separator,
});
