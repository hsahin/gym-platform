"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import {
  DataGrid,
  type DataGridColumn,
  type DataGridSelection,
  type DataGridSortDescriptor,
} from "@/components/dashboard/HydrationSafeDataGrid";
import {
  DashboardEntityActions,
  type DashboardEntityActionsProps,
} from "@/components/DashboardEntityActions";

function getSelectedKey(selection: DataGridSelection): string | number | null {
  if (selection === "all") {
    return null;
  }

  return Array.from(selection)[0] ?? null;
}

export function DashboardEntityDataGrid<T extends object>({
  ariaLabel,
  columns,
  contentClassName = "min-w-[920px]",
  data,
  defaultSortDescriptor,
  getActionsProps,
  getRowId,
}: {
  ariaLabel: string;
  columns: DataGridColumn<T>[];
  contentClassName?: string;
  data: T[];
  defaultSortDescriptor?: DataGridSortDescriptor;
  getActionsProps: (item: T) => DashboardEntityActionsProps;
  getRowId: (item: T) => string | number;
}) {
  const [selectedKeys, setSelectedKeys] = useState<DataGridSelection>(new Set());
  const selectedKey = getSelectedKey(selectedKeys);
  const selectedItem = useMemo(
    () =>
      selectedKey === null
        ? null
        : data.find((item) => String(getRowId(item)) === String(selectedKey)) ?? null,
    [data, getRowId, selectedKey],
  );

  const gridColumns = useMemo<DataGridColumn<T>[]>(
    () => [
      ...columns,
      {
        id: "manage",
        header: "Beheer",
        align: "end",
        minWidth: 112,
        pinned: "end",
        width: 124,
        cell: (item) => {
          const itemId = getRowId(item);
          const isSelected = String(itemId) === String(selectedKey);

          return (
            <Button
              size="sm"
              variant={isSelected ? "primary" : "ghost"}
              onPress={() => setSelectedKeys(new Set([itemId]))}
            >
              Beheer
            </Button>
          );
        },
      },
    ],
    [columns, getRowId, selectedKey],
  );

  return (
    <div className="grid gap-3">
      <DataGrid
        showSelectionCheckboxes
        allowsColumnResize
        aria-label={ariaLabel}
        className="rounded-2xl"
        columns={gridColumns}
        contentClassName={contentClassName}
        data={data}
        defaultSortDescriptor={defaultSortDescriptor}
        getRowId={getRowId}
        scrollContainerClassName="max-w-full overflow-x-auto"
        selectedKeys={selectedKeys}
        selectionBehavior="replace"
        selectionMode="single"
        variant="primary"
        onRowAction={(key) => setSelectedKeys(new Set([key]))}
        onSelectionChange={setSelectedKeys}
      />
      {selectedItem ? (
        <DashboardEntityActions {...getActionsProps(selectedItem)} />
      ) : (
        <div className="rounded-2xl border border-border bg-surface-secondary p-4 text-sm text-muted">
          Selecteer een rij of kies Beheer om gegevens te wijzigen, te archiveren of te verwijderen.
        </div>
      )}
    </div>
  );
}
