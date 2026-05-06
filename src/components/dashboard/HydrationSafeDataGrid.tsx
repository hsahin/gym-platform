"use client";

import { useEffect, useState } from "react";
import {
  DataGrid as HeroDataGrid,
  type DataGridColumn,
  type DataGridProps,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@heroui-pro/react/data-grid";

function HydrationSafeDataGridRoot<T extends object>(props: DataGridProps<T>) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        aria-busy="true"
        aria-label={props["aria-label"]}
        className={props.className}
        data-hydration-safe-data-grid
        role="grid"
        suppressHydrationWarning
      />
    );
  }

  return <HeroDataGrid {...props} />;
}

export const DataGrid = HydrationSafeDataGridRoot;
export type { DataGridColumn, DataGridProps, DataGridSelection, DataGridSortDescriptor };
