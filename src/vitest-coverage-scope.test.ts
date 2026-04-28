import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const configSource = readFileSync(path.join(process.cwd(), "vitest.config.ts"), "utf8");

describe("vitest coverage scope", () => {
  it("measures the app surface instead of only low-level helpers", () => {
    const requiredCoverageGlobs = [
      "src/lib/**/*.ts",
      "src/app/**/*.ts",
      "src/app/page.tsx",
      "src/app/dashboard/[section]/page.tsx",
      "src/components/ClassSessionView.tsx",
      "src/components/LoginExperiencePanel.tsx",
      "src/components/dashboard/HydrationSafeListView.tsx",
      "src/server/http/**/*.ts",
      "src/server/runtime/**/*.ts",
    ];

    expect(configSource).toContain('provider: "v8"');

    for (const coverageGlob of requiredCoverageGlobs) {
      expect(configSource).toContain(coverageGlob);
    }
  });

  it("keeps explicit exclusions limited to generated, test, type-only, and framework-only files", () => {
    expect(configSource).toContain('"src/**/*.test.ts"');
    expect(configSource).toContain('"src/**/*.test.tsx"');
    expect(configSource).toContain('"src/server/types.ts"');
    expect(configSource).toContain('"src/app/layout.tsx"');
    expect(configSource).not.toContain('"src/components/**"');
    expect(configSource).not.toContain('"src/app/**"');
    expect(configSource).not.toContain('"src/server/runtime/**"');
  });
});
