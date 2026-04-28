"use client";

import { useEffect, useState } from "react";
import { ListView as HeroListView, type ListViewRootProps } from "@heroui-pro/react/list-view";

function HydrationSafeListViewRoot<T extends object>(props: ListViewRootProps<T>) {
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
        data-hydration-safe-list-view
        role="list"
        suppressHydrationWarning
      />
    );
  }

  return <HeroListView {...props} />;
}

export const ListView: typeof HeroListView = Object.assign(HydrationSafeListViewRoot, {
  Item: HeroListView.Item,
  ItemAction: HeroListView.ItemAction,
  ItemContent: HeroListView.ItemContent,
  Root: HydrationSafeListViewRoot,
  Title: HeroListView.Title,
  Description: HeroListView.Description,
});
