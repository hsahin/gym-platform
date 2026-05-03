import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import vitestConfig from "../vitest.config";

const rootDir = resolve(__dirname, "..");
const sourceDir = resolve(rootDir, "src");

const bannedProductionSeedFragments = [
  "Northside Athletics",
  "Atlas Forge Club",
  "Downtown Club",
  "Morning Strength",
  "Amina Hassan",
  "Zero demo-data",
] as const;

function readPackageJson() {
  return JSON.parse(
    readFileSync(resolve(rootDir, "package.json"), "utf8"),
  ) as {
    readonly scripts: Record<string, string>;
  };
}

function listSourceFiles(directory: string): ReadonlyArray<string> {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(fullPath);
    }

    if (
      !entry.isFile() ||
      entry.name.endsWith(".test.ts") ||
      entry.name.endsWith(".test.tsx") ||
      entry.name.endsWith(".spec.ts") ||
      entry.name.endsWith(".spec.tsx")
    ) {
      return [];
    }

    const stat = statSync(fullPath);
    return stat.size > 0 ? [fullPath] : [];
  });
}

describe("CI readiness", () => {
  it("uses stable non-deprecated scripts for release verification", () => {
    const scripts = readPackageJson().scripts;

    expect(scripts.lint).toMatch(/^eslint\b/);
    expect(scripts.lint).not.toContain("next lint");
    expect(scripts.typecheck).toContain("next typegen");
    expect(scripts.typecheck).toContain("tsc --noEmit");
    expect(scripts["ci:verify"]).toBe(
      "npm run lint && npm run typecheck && npm run build && npm run test:coverage",
    );
  });

  it("keeps coverage instrumentation from timing out long integration flows", () => {
    expect(vitestConfig.test?.testTimeout).toBeGreaterThanOrEqual(20_000);
  });

  it("keeps local state and placeholder seed names out of production source", () => {
    const gitignore = readFileSync(resolve(rootDir, ".gitignore"), "utf8");
    const productionFiles = listSourceFiles(sourceDir);
    const leakedFragments = productionFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");

      return bannedProductionSeedFragments
        .filter((fragment) => source.includes(fragment))
        .map((fragment) => `${filePath.replace(`${rootDir}/`, "")}: ${fragment}`);
    });

    expect(gitignore).toContain(".data/");
    expect(gitignore).toContain("output/");
    expect(leakedFragments).toEqual([]);
  });
});
