import { describe, expect, it } from "vitest";
import { toClientPlain } from "@/server/lib/to-client-plain";

describe("toClientPlain", () => {
  it("removes private document fields and converts non-plain values", () => {
    const objectId = {
      toHexString: () => "507f1f77bcf86cd799439011",
    };
    const timestamp = new Date("2026-04-23T10:30:00.000Z");

    const value = {
      _id: objectId,
      id: "loc_123",
      createdAt: timestamp,
      nested: {
        _id: objectId,
        ownerId: objectId,
      },
      record: {
        toJSON: () => ({
          status: "active",
          updatedAt: timestamp,
        }),
      },
      items: [
        {
          _id: objectId,
          code: "north",
        },
      ],
    };

    expect(toClientPlain(value)).toEqual({
      id: "loc_123",
      createdAt: "2026-04-23T10:30:00.000Z",
      nested: {
        ownerId: "507f1f77bcf86cd799439011",
      },
      record: {
        status: "active",
        updatedAt: "2026-04-23T10:30:00.000Z",
      },
      items: [
        {
          code: "north",
        },
      ],
    });
  });
});
