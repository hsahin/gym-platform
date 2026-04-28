import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListView } from "@/components/dashboard/HydrationSafeListView";

const dashboardDirectory = path.join(process.cwd(), "src/components/dashboard");
const adapterFile = path.join(dashboardDirectory, "HydrationSafeListView.tsx");

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
});
