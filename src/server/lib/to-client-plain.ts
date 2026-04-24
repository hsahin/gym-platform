export function toClientPlain<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toClientPlain(entry)) as T;
  }

  if (typeof value === "object") {
    if ("toHexString" in value && typeof value.toHexString === "function") {
      return value.toHexString() as T;
    }

    if ("toJSON" in value && typeof value.toJSON === "function") {
      const jsonValue = value.toJSON();

      if (jsonValue !== value) {
        return toClientPlain(jsonValue) as T;
      }
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "_id")
        .map(([key, entry]) => [key, toClientPlain(entry)]),
    ) as T;
  }

  return value;
}
