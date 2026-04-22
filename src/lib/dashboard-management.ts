function flattenValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(flattenValue).join(" ");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function recordMatchesSearch<TRecord>(
  record: TRecord,
  query: string,
  keys: ReadonlyArray<keyof TRecord>,
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return keys.some((key) =>
    flattenValue(record[key]).toLowerCase().includes(normalizedQuery),
  );
}

export function recordMatchesFilter<TRecord>(
  record: TRecord,
  key: keyof TRecord,
  filterValue: string,
) {
  if (!filterValue || filterValue === "all") {
    return true;
  }

  return flattenValue(record[key]).toLowerCase() === filterValue.toLowerCase();
}

export function filterManagementRecords<TRecord>(
  records: ReadonlyArray<TRecord>,
  options: {
    readonly query: string;
    readonly searchKeys: ReadonlyArray<keyof TRecord>;
    readonly filterKey?: keyof TRecord;
    readonly filterValue?: string;
  },
) {
  return records.filter(
    (record) =>
      recordMatchesSearch(record, options.query, options.searchKeys) &&
      (!options.filterKey ||
        recordMatchesFilter(record, options.filterKey, options.filterValue ?? "all")),
  );
}
