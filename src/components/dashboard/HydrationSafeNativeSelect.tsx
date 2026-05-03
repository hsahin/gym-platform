"use client";

import { useEffect, useState } from "react";
import {
  NativeSelect as HeroNativeSelect,
  type NativeSelectRootProps,
} from "@heroui-pro/react/native-select";

function HydrationSafeNativeSelectRoot(props: NativeSelectRootProps) {
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
        data-hydration-safe-native-select
        suppressHydrationWarning
      />
    );
  }

  return <HeroNativeSelect {...props} />;
}

export const NativeSelect: typeof HeroNativeSelect = Object.assign(
  HydrationSafeNativeSelectRoot,
  {
    Indicator: HeroNativeSelect.Indicator,
    OptGroup: HeroNativeSelect.OptGroup,
    Option: HeroNativeSelect.Option,
    Root: HydrationSafeNativeSelectRoot,
    Trigger: HeroNativeSelect.Trigger,
  },
);
