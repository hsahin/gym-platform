import { describe, expect, it } from "vitest";
import {
  filterManagementRecords,
  recordMatchesFilter,
  recordMatchesSearch,
} from "@/lib/dashboard-management";

const records = [
  {
    id: "member_1",
    fullName: "Noa van Dijk",
    email: "noa@example.nl",
    status: "active",
    tags: ["hyrox", "morning"],
  },
  {
    id: "member_2",
    fullName: "Mila Jansen",
    email: "mila@example.nl",
    status: "paused",
    tags: ["yoga"],
  },
];

describe("dashboard management filtering", () => {
  it("matches records by trimmed search terms across strings and arrays", () => {
    expect(recordMatchesSearch(records[0]!, " NOA ", ["fullName", "email"])).toBe(true);
    expect(recordMatchesSearch(records[0]!, "hyrox", ["tags"])).toBe(true);
    expect(recordMatchesSearch(records[0]!, "mila", ["fullName", "email"])).toBe(false);
  });

  it("treats empty and all filters as pass-through", () => {
    expect(recordMatchesFilter(records[0]!, "status", "")).toBe(true);
    expect(recordMatchesFilter(records[0]!, "status", "all")).toBe(true);
    expect(recordMatchesFilter(records[0]!, "status", "active")).toBe(true);
    expect(recordMatchesFilter(records[0]!, "status", "paused")).toBe(false);
  });

  it("combines search and status filters for dashboard tables", () => {
    expect(
      filterManagementRecords(records, {
        query: "example",
        searchKeys: ["fullName", "email", "tags"],
        filterKey: "status",
        filterValue: "paused",
      }),
    ).toEqual([records[1]]);
  });

  it("handles missing searchable values without hiding blank queries", () => {
    const incomplete = { id: "record_1", name: null, status: undefined };

    expect(recordMatchesSearch(incomplete, "", ["name", "status"])).toBe(true);
    expect(recordMatchesSearch(incomplete, "x", ["name", "status"])).toBe(false);
  });
});
