import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRootFile(filePath: string) {
  return readFileSync(path.join(process.cwd(), filePath), "utf8");
}

describe("native member app shell", () => {
  it("ships a local Capacitor app instead of opening the production website as server.url", () => {
    const source = readRootFile("capacitor.config.ts");

    expect(source).not.toContain("CAPACITOR_SERVER_URL");
    expect(source).not.toContain("https://gym-platform-vc9yk.ondigitalocean.app/reserve");
    expect(source).not.toMatch(/\bserver\s*:\s*\{[\s\S]*\burl\s*:/);
    expect(source).toContain('webDir: "mobile-shell"');
    expect(source).toContain('loggingBehavior: "production"');
  });

  it("keeps the packaged mobile shell as an app-like member experience, not a single website link", () => {
    const source = readRootFile("mobile-shell/index.html");

    expect(source).toContain('data-screen="today"');
    expect(source).toContain('data-screen="classes"');
    expect(source).toContain('data-screen="service"');
    expect(source).toContain('data-screen="account"');
    expect(source).toContain("Volgende training");
    expect(source).toContain("Mijn planning");
    expect(source).toContain("Ledenservice");
    expect(source).toContain("Open ledenportaal");
    expect(source).toContain("navigator.onLine");
    expect(source).toContain("localStorage");
    expect(source).not.toContain(">Open ledenapp<");
  });
});
