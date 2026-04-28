import path from "node:path";
import { transformWithOxc } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "src-tsx-transform",
      enforce: "pre",
      async transform(code, id) {
        if (!id.includes("/src/") || !id.endsWith(".tsx")) {
          return null;
        }

        return transformWithOxc(code, id, {
          jsx: {
            runtime: "automatic",
          },
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/lib/**/*.ts",
        "src/app/**/*.ts",
        "src/app/page.tsx",
        "src/app/login/page.tsx",
        "src/app/join/page.tsx",
        "src/app/reserve/page.tsx",
        "src/app/pricing/page.tsx",
        "src/app/dashboard/page.tsx",
        "src/app/dashboard/[section]/page.tsx",
        "src/components/ClassSessionView.tsx",
        "src/components/HeroCompat.tsx",
        "src/components/LocationView.tsx",
        "src/components/LoginExperiencePanel.tsx",
        "src/components/MemberView.tsx",
        "src/components/dashboard/HydrationSafeListView.tsx",
        "src/server/http/**/*.ts",
        "src/server/runtime/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/server/types.ts",
        "src/app/layout.tsx",
        "src/app/globals.css",
        "src/app/fonts/**",
        "src/app/favicon.ico",
      ],
      thresholds: {
        statements: 90,
        branches: 75,
        functions: 90,
        lines: 90,
      },
    },
  },
});
