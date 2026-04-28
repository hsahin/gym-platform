import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function findFiles(root: string, fileName: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...findFiles(fullPath, fileName));
    } else if (entry === fileName) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function toAppImportPath(filePath: string) {
  const relativePath = path
    .relative(process.cwd(), filePath)
    .replace(/\\/g, "/")
    .replace(/\.(ts|tsx)$/, "");

  return `@/${relativePath.replace(/^src\//, "")}`;
}

function readTestSources(files: string[]) {
  return files
    .map((file) => readFileSync(path.join(process.cwd(), file), "utf8"))
    .join("\n");
}

describe("system and integration flow coverage map", () => {
  it("keeps every API route represented in a route-level integration test", () => {
    const routeFiles = findFiles(path.join(process.cwd(), "src/app/api"), "route.ts");
    const routeIntegrationSources = readTestSources([
      "src/app/api/routes.integration.test.ts",
      "src/app/api/platform-routes.integration.test.ts",
      "src/app/api/system-flows.integration.test.ts",
    ]);
    const missingRoutes = routeFiles
      .map(toAppImportPath)
      .filter((importPath) => !routeIntegrationSources.includes(importPath));

    expect(missingRoutes).toEqual([]);
  });

  it("keeps every app page represented in a page-level integration test", () => {
    const pageFiles = findFiles(path.join(process.cwd(), "src/app"), "page.tsx");
    const pageIntegrationSources = readTestSources([
      "src/app/page-flows.integration.test.tsx",
    ]);
    const missingPages = pageFiles
      .map(toAppImportPath)
      .filter((importPath) => !pageIntegrationSources.includes(importPath));

    expect(missingPages).toEqual([]);
  });
});
