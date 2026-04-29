import { describe, expect, it } from "vitest";
import {
  ALL_CLASS_TYPE_KEY,
  OPEN_GYM_CLASS_TYPE_KEY,
  buildClassTypeTabs,
  filterClassSessionsByType,
  normalizeClassTypeKey,
  resolveSelectedClassType,
} from "@/lib/class-types";

const sessions = [
  { title: "Morning HIIT", focus: "HIIT" },
  { title: "Forge HIIT", focus: "HIIT" },
  { title: "Heavy Boxing", focus: "Boxing" },
  { title: "Engine Friday", focus: "Engine" },
];

describe("class type tabs", () => {
  it("normalizes class type keys for stable tab selection", () => {
    expect(normalizeClassTypeKey("  Small Group PT ")).toBe("small-group-pt");
    expect(normalizeClassTypeKey("")).toBe("overig");
  });

  it("builds default and data-driven tabs with counts", () => {
    const tabs = buildClassTypeTabs(sessions);

    expect(tabs[0]).toMatchObject({
      key: ALL_CLASS_TYPE_KEY,
      label: "Alle lessen",
      count: 4,
    });
    expect(tabs.find((tab) => tab.key === "hiit")).toMatchObject({
      label: "HIIT",
      focus: "HIIT",
      count: 2,
    });
    expect(tabs.find((tab) => tab.key === "boxing")).toMatchObject({
      label: "Boxing",
      count: 1,
    });
    expect(tabs.find((tab) => tab.key === "engine")).toMatchObject({
      label: "Engine",
      count: 1,
    });
    expect(tabs.find((tab) => tab.key === OPEN_GYM_CLASS_TYPE_KEY)).toMatchObject({
      label: "Gymplek",
      focus: "Open gym",
      defaultTitle: "Vrij trainen",
      count: 0,
    });
  });

  it("keeps custom lesson type tabs sorted and names empty types clearly", () => {
    const tabs = buildClassTypeTabs([
      { title: "Zumba Night", focus: "Zumba" },
      { title: "Athletic Skills", focus: "Athletic Skills" },
      { title: "", focus: "" },
    ]);
    const customLabels = tabs.slice(8).map((tab) => tab.label);

    expect(customLabels).toEqual(["Athletic Skills", "Overig", "Zumba"]);
  });

  it("routes trainerless open gym slots to the gymplek tab", () => {
    const tabs = buildClassTypeTabs([
      { title: "Vrij trainen", focus: "Open gym", bookingKind: "open_gym" },
      { title: "Open fitness", focus: "Vrij trainen", bookingKind: "open_gym" },
    ]);

    expect(tabs.find((tab) => tab.key === OPEN_GYM_CLASS_TYPE_KEY)).toMatchObject({
      label: "Gymplek",
      count: 2,
    });
    expect(
      filterClassSessionsByType(
        [
          { title: "Vrij trainen", focus: "Open gym", bookingKind: "open_gym" },
          { title: "Forge HIIT", focus: "HIIT" },
        ],
        OPEN_GYM_CLASS_TYPE_KEY,
      ).map((session) => session.title),
    ).toEqual(["Vrij trainen"]);
  });

  it("filters lessons by the selected type and keeps all lessons in the all tab", () => {
    expect(filterClassSessionsByType(sessions, ALL_CLASS_TYPE_KEY)).toHaveLength(4);
    expect(filterClassSessionsByType(sessions, "hiit").map((session) => session.title)).toEqual([
      "Morning HIIT",
      "Forge HIIT",
    ]);
  });

  it("resolves selected tab defaults for planning forms", () => {
    const tabs = buildClassTypeTabs(sessions);

    expect(resolveSelectedClassType(tabs, "boxing")).toMatchObject({
      focus: "Boxing",
      defaultTitle: "Boxing",
    });
    expect(resolveSelectedClassType(tabs, "missing")).toMatchObject({
      key: "hiit",
      defaultTitle: "HIIT",
    });
  });
});
