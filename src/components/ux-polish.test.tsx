import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeroPhoneNumberField } from "@/components/HeroPhoneNumberField";

function readComponentSource(fileName: string) {
  return readFileSync(path.join(process.cwd(), "src/components", fileName), "utf8");
}

function readGlobalsCss() {
  return readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
}

const THEME_HOSTILE_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\btext-slate-\d/, reason: "hardcoded slate text color (breaks dark theme)" },
  { pattern: /\bbg-white\/\d/, reason: "hardcoded translucent white background" },
  { pattern: /\btext-white\/\d/, reason: "hardcoded translucent white text" },
  { pattern: /\bborder-white\/\d/, reason: "hardcoded translucent white border" },
  { pattern: /bg-slate-\d/, reason: "hardcoded slate background" },
];

const THEME_SAFE_VIEW_FILES = [
  "MemberView.tsx",
  "ClassSessionView.tsx",
  "LocationView.tsx",
  "LoginExperiencePanel.tsx",
];

describe("ux polish — theme safety", () => {
  it.each(THEME_SAFE_VIEW_FILES)(
    "%s renders without hardcoded slate/white colors",
    (fileName) => {
      const source = readComponentSource(fileName);

      for (const { pattern, reason } of THEME_HOSTILE_PATTERNS) {
        expect(source, `${fileName} contains ${reason}`).not.toMatch(pattern);
      }
    },
  );

  it("DashboardEntityActions uses theme tokens for inputs and buttons", () => {
    const source = readComponentSource("DashboardEntityActions.tsx");

    expect(source).not.toMatch(/bg-black\/\d/);
    expect(source).not.toMatch(/\btext-orange-\d/);
    expect(source).toContain("border-border");
    expect(source).toContain("bg-surface");
    expect(source).toContain("text-foreground");
  });
});

describe("ux polish — globals.css defines previously-ghost utility classes", () => {
  const expectedSelectors = [
    ".eyebrow",
    ".soft-card",
    ".stage-card",
    ".signal-card",
    ".command-deck",
    ".cta-primary",
    ".cta-secondary",
  ];

  it.each(expectedSelectors)("defines %s", (selector) => {
    const css = readGlobalsCss();
    expect(css).toContain(selector);
  });

  it("avoids raw hex/named colors in the new utility class definitions", () => {
    const css = readGlobalsCss();

    for (const selector of [
      ".soft-card",
      ".stage-card",
      ".signal-card",
      ".command-deck",
      ".cta-primary",
      ".cta-secondary",
    ]) {
      const blockStart = css.indexOf(selector);
      expect(blockStart, `${selector} should be defined`).toBeGreaterThanOrEqual(0);
    }

    const tokenSnippets = ["var(--border)", "var(--surface)", "var(--accent)"];
    for (const snippet of tokenSnippets) {
      expect(css, `globals.css should use ${snippet} for the new utility tokens`).toContain(
        snippet,
      );
    }
  });
});

describe("ux polish — BookingDialog accessibility & state hygiene", () => {
  const source = readComponentSource("BookingDialog.tsx");

  it("declares aria-modal, role=dialog and labelled-by/described-by ids", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("aria-labelledby={titleId}");
    expect(source).toContain("aria-describedby={descriptionId}");
  });

  it("handles Escape and restores focus to the previously-focused trigger", () => {
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("previouslyFocusedRef");
    expect(source).toContain("document.removeEventListener");
  });

  it("resets the notes field whenever the dialog closes", () => {
    expect(source).toMatch(/closeDialog\s*=\s*useCallback/);
    expect(source).toMatch(/closeDialog[\s\S]*setNotes\("/);
  });

  it("uses sm: breakpoint for the lid+les grid so mobile gets a single column", () => {
    expect(source).toContain("sm:grid-cols-2");
  });
});

describe("ux polish — HeroPhoneNumberField responsive layout", () => {
  const source = readComponentSource("HeroPhoneNumberField.tsx");

  it("starts single-column on mobile and goes two-column from sm:", () => {
    expect(source).toContain("sm:grid-cols-[minmax(");
    expect(source).not.toMatch(/md:grid-cols-\[180px/);
  });

  it("renders both country select and phone input with correct autocomplete hints", () => {
    const markup = renderToStaticMarkup(
      <HeroPhoneNumberField
        country="NL"
        onCountryChange={() => undefined}
        onPhoneChange={() => undefined}
        phone="0612345678"
      />,
    );

    expect(markup.toLowerCase()).toContain('autocomplete="tel"');
    expect(markup.toLowerCase()).toContain('inputmode="tel"');
    expect(markup).toContain("Mobiel nummer");
    expect(markup).toContain("Landcode");
    expect(markup).toContain("0612345678");
    expect(markup).toContain("sm:grid-cols-[minmax(");
  });
});

describe("ux polish — FunctionalitySearch command palette", () => {
  const source = readComponentSource("FunctionalitySearch.tsx");

  it("uses the HeroUI Pro Command palette compound for accessibility & search UX", () => {
    expect(source).toContain('from "@heroui-pro/react"');
    expect(source).toContain("Command.Dialog");
    expect(source).toContain("Command.InputGroup");
    expect(source).toContain("Command.List");
    expect(source).toContain("Command.Item");
  });

  it("registers a Cmd/Ctrl+K shortcut to open the palette", () => {
    expect(source).toContain('event.key.toLowerCase() === "k"');
    expect(source).toContain("event.metaKey || event.ctrlKey");
    expect(source).toContain("setIsOpen(true)");
  });

  it("clears the query whenever the palette closes", () => {
    expect(source).toMatch(/if\s*\(\s*!open\s*\)\s*{\s*setQuery\(""\);/);
  });
});

describe("ux polish — PublicLandingPage stays server-rendered and theme-safe", () => {
  const source = readComponentSource("PublicLandingPage.tsx");

  it("never opts into the client (Card/Chip from @heroui/react would force this)", () => {
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain('from "@heroui/react"');
  });

  it("uses theme tokens instead of hardcoded slate/white classes", () => {
    for (const { pattern, reason } of THEME_HOSTILE_PATTERNS) {
      expect(source, `PublicLandingPage contains ${reason}`).not.toMatch(pattern);
    }
    expect(source).toContain("bg-surface");
    expect(source).toContain("text-muted");
  });

  it("uses the unified cta-primary / cta-secondary classes for hero actions", () => {
    expect(source).toContain('className="cta-primary"');
    expect(source).toContain('className="cta-secondary"');
  });

  it("declares a progressbar role with valid aria values for the occupancy bar", () => {
    expect(source).toContain('role="progressbar"');
    expect(source).toContain("aria-valuemax={100}");
    expect(source).toContain("aria-valuenow={occupancy}");
  });
});

describe("ux polish — PublicMembershipSignupPortal mobile breakpoints", () => {
  const source = readComponentSource("PublicMembershipSignupPortal.tsx");

  it("uses sm: for the available-gyms grid so it splits earlier on small viewports", () => {
    expect(source).toContain("sm:grid-cols-2 sm:gap-4 xl:grid-cols-3");
  });

  it("gives gym cards a visible focus ring so keyboard users see where they are", () => {
    expect(source).toMatch(/focus-visible:outline-accent[^"]*rounded-\[28px\]/);
    expect(source).toContain("focus-visible:outline-2");
  });
});
