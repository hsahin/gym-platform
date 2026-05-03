"use client";

import { useEffect, useState } from "react";
import {
  Button as HeroButton,
  type ButtonRootProps,
} from "@heroui/react";

function fallbackButtonClassName(props: ButtonRootProps) {
  const size = props.size ?? "md";
  const variant = props.variant ?? "primary";
  const baseClassName = `button button--${size} button--${variant}`;

  return typeof props.className === "string"
    ? `${baseClassName} ${props.className}`
    : baseClassName;
}

function HydrationSafeButtonRoot(props: ButtonRootProps) {
  const [isMounted, setIsMounted] = useState(false);
  const fallbackChildren =
    typeof props.children === "function" ? undefined : props.children;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <button
        aria-busy="true"
        className={fallbackButtonClassName(props)}
        data-hydration-safe-button
        disabled={props.isDisabled}
        name={props.name}
        suppressHydrationWarning
        type={props.type ?? "button"}
        value={props.value}
      >
        {fallbackChildren}
      </button>
    );
  }

  return <HeroButton {...props} />;
}

export const Button: typeof HeroButton = Object.assign(HydrationSafeButtonRoot, {
  Root: HydrationSafeButtonRoot,
});
