import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListView } from "@/components/dashboard/HydrationSafeListView";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { NativeSelect } from "@/components/dashboard/HydrationSafeNativeSelect";
import { Segment } from "@/components/dashboard/HydrationSafeSegment";

const dashboardDirectory = path.join(process.cwd(), "src/components/dashboard");
const adapterFile = path.join(dashboardDirectory, "HydrationSafeListView.tsx");
const buttonAdapterFile = path.join(dashboardDirectory, "HydrationSafeButton.tsx");
const nativeSelectAdapterFile = path.join(
  dashboardDirectory,
  "HydrationSafeNativeSelect.tsx",
);
const segmentAdapterFile = path.join(dashboardDirectory, "HydrationSafeSegment.tsx");
const dashboardReachableComponentFiles = [
  path.join(process.cwd(), "src/components/AttendanceButton.tsx"),
  path.join(process.cwd(), "src/components/BookingDialog.tsx"),
  path.join(process.cwd(), "src/components/CancelBookingButton.tsx"),
  path.join(process.cwd(), "src/components/HeroPhoneNumberField.tsx"),
  path.join(process.cwd(), "src/components/PlatformWorkbench.tsx"),
  path.join(process.cwd(), "src/components/GymDashboardClientShell.tsx"),
];

async function collectComponentFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectComponentFiles(entryPath);
      }

      return entry.name.endsWith(".tsx") ? [entryPath] : [];
    }),
  );

  return nestedFiles.flat();
}

describe("dashboard ListView hydration safety", () => {
  it("routes all dashboard ListView usage through the hydration-safe adapter", async () => {
    const dashboardFiles = (await collectComponentFiles(dashboardDirectory)).filter(
      (filePath) => filePath !== adapterFile,
    );
    const files = await Promise.all(
      dashboardFiles.map(async (filePath) => ({
        fileName: path.relative(process.cwd(), filePath),
        source: await readFile(filePath, "utf8"),
      })),
    );

    for (const file of files) {
      expect(file.source, `${file.fileName} imports raw HeroUI ListView`).not.toContain(
        '@heroui-pro/react/list-view',
      );

      if (file.source.includes("<ListView")) {
        expect(file.source, `${file.fileName} must import the safe adapter`).toContain(
          '@/components/dashboard/HydrationSafeListView',
        );
      }
    }
  });

  it("keeps the adapter SSR-stable before mounting React Aria ListView", async () => {
    const source = await readFile(adapterFile, "utf8");

    expect(source).toContain('@heroui-pro/react/list-view');
    expect(source).toContain("data-hydration-safe-list-view");
    expect(source).toContain("suppressHydrationWarning");
    expect(source).toContain("useEffect");
    expect(ListView.Item).toBeTypeOf("function");
    expect(ListView.ItemContent).toBeTypeOf("function");

    const ListViewForRender = ListView as unknown as (
      props: Record<string, unknown>,
    ) => ReactElement;
    const fallbackMarkup = renderToStaticMarkup(
      (createElement as typeof createElement & ((...args: unknown[]) => ReactElement))(
        ListViewForRender,
        {
          "aria-label": "Hydration-safe list",
          className: "dashboard-list",
          items: [],
        },
        () => null,
      ),
    );

    expect(fallbackMarkup).toContain("data-hydration-safe-list-view");
    expect(fallbackMarkup).toContain("Hydration-safe list");
  });

  it("routes React Aria style dashboard controls through hydration-safe adapters", async () => {
    const dashboardFiles = (await collectComponentFiles(dashboardDirectory)).filter(
      (filePath) =>
        ![
          adapterFile,
          buttonAdapterFile,
          nativeSelectAdapterFile,
          segmentAdapterFile,
        ].includes(filePath),
    );
    const files = await Promise.all(
      [...dashboardFiles, ...dashboardReachableComponentFiles].map(async (filePath) => ({
        fileName: path.relative(process.cwd(), filePath),
        source: await readFile(filePath, "utf8"),
      })),
    );

    for (const file of files) {
      expect(file.source, `${file.fileName} imports raw HeroUI NativeSelect`).not.toContain(
        '@heroui-pro/react/native-select',
      );
      expect(file.source, `${file.fileName} imports raw HeroUI Segment`).not.toContain(
        '@heroui-pro/react/segment',
      );

      if (file.source.includes("<Button")) {
        expect(
          file.source,
          `${file.fileName} must import the hydration-safe Button`,
        ).toContain('@/components/dashboard/HydrationSafeButton');
      }

      if (file.source.includes("<NativeSelect")) {
        expect(file.source, `${file.fileName} must import the safe NativeSelect`).toContain(
          '@/components/dashboard/HydrationSafeNativeSelect',
        );
      }

      if (file.source.includes("<Segment")) {
        expect(file.source, `${file.fileName} must import the safe Segment`).toContain(
          '@/components/dashboard/HydrationSafeSegment',
        );
      }
    }
  });

  it("keeps Button, NativeSelect and Segment SSR-stable before mounting client controls", async () => {
    const buttonSource = await readFile(buttonAdapterFile, "utf8");
    const nativeSelectSource = await readFile(nativeSelectAdapterFile, "utf8");
    const segmentSource = await readFile(segmentAdapterFile, "utf8");

    expect(buttonSource).toContain('Button as HeroButton');
    expect(buttonSource).toContain("data-hydration-safe-button");
    expect(buttonSource).toContain("suppressHydrationWarning");
    expect(Button).toBeTypeOf("function");

    expect(nativeSelectSource).toContain('@heroui-pro/react/native-select');
    expect(nativeSelectSource).toContain("data-hydration-safe-native-select");
    expect(nativeSelectSource).toContain("suppressHydrationWarning");
    expect(NativeSelect.Trigger).toBeTypeOf("function");
    expect(NativeSelect.Option).toBeTypeOf("function");

    expect(segmentSource).toContain('@heroui-pro/react/segment');
    expect(segmentSource).toContain("data-hydration-safe-segment");
    expect(segmentSource).toContain("suppressHydrationWarning");
    expect(Segment.Item).toBeTypeOf("function");
    expect(Segment.Separator).toBeTypeOf("function");

    const NativeSelectForRender = NativeSelect as unknown as (
      props: Record<string, unknown>,
    ) => ReactElement;
    const SegmentForRender = Segment as unknown as (
      props: Record<string, unknown>,
    ) => ReactElement;
    const ButtonForRender = Button as unknown as (props: Record<string, unknown>) => ReactElement;
    const buttonFallback = renderToStaticMarkup(
      (createElement as typeof createElement & ((...args: unknown[]) => ReactElement))(
        ButtonForRender,
        {
          children: "Hydration-safe action",
          variant: "outline",
        },
      ),
    );
    const nativeSelectFallback = renderToStaticMarkup(
      (createElement as typeof createElement & ((...args: unknown[]) => ReactElement))(
        NativeSelectForRender,
        {
          "aria-label": "Hydration-safe select",
          className: "dashboard-select",
        },
      ),
    );
    const segmentFallback = renderToStaticMarkup(
      (createElement as typeof createElement & ((...args: unknown[]) => ReactElement))(
        SegmentForRender,
        {
          "aria-label": "Hydration-safe segment",
          className: "dashboard-segment",
        },
      ),
    );

    expect(buttonFallback).toContain("data-hydration-safe-button");
    expect(buttonFallback).toContain("Hydration-safe action");
    expect(nativeSelectFallback).toContain("data-hydration-safe-native-select");
    expect(nativeSelectFallback).toContain("Hydration-safe select");
    expect(segmentFallback).toContain("data-hydration-safe-segment");
    expect(segmentFallback).toContain("Hydration-safe segment");
  });
});
