"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import {
  resolveFunctionalitySearchHref,
  searchFunctionality,
  type FunctionalitySearchEntry,
} from "@/lib/functionality-search";

const kindLabels: Record<FunctionalitySearchEntry["kind"], string> = {
  page: "Pagina",
  feature: "Module",
  workflow: "Actie",
  public: "Publiek",
};

export function FunctionalitySearch({
  ariaLabel,
  entries,
  placeholder,
  tenantId,
}: {
  readonly ariaLabel: string;
  readonly entries: ReadonlyArray<FunctionalitySearchEntry>;
  readonly placeholder: string;
  readonly tenantId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(
    () => searchFunctionality(query, { entries, limit: 7 }),
    [entries, query],
  );
  const hasQuery = query.trim().length > 0;
  const shouldShowResults = isFocused && hasQuery;

  function openEntry(entry: FunctionalitySearchEntry) {
    router.push(resolveFunctionalitySearchHref(entry, tenantId));
    setQuery("");
    setActiveIndex(0);
    setIsFocused(false);
  }

  function moveActiveIndex(direction: 1 | -1) {
    if (results.length === 0) {
      return;
    }

    setActiveIndex((current) => {
      const next = current + direction;

      if (next < 0) {
        return results.length - 1;
      }

      if (next >= results.length) {
        return 0;
      }

      return next;
    });
  }

  return (
    <div className="relative w-full min-w-0 max-w-xl md:min-w-[14rem] md:w-[min(38vw,34rem)]">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          aria-label={ariaLabel}
          className="h-10 w-full rounded-xl border border-border bg-surface px-9 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
          placeholder={placeholder}
          type="search"
          value={query}
          onBlur={() => setIsFocused(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveIndex(1);
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveIndex(-1);
            }

            if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault();
              openEntry(results[activeIndex]);
            }

            if (event.key === "Escape") {
              setIsFocused(false);
            }
          }}
        />
      </div>

      {shouldShowResults ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          {results.length > 0 ? (
            <ul role="listbox" aria-label="Zoekresultaten functionaliteit">
              {results.map((entry, index) => (
                <li key={entry.key} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition ${
                      index === activeIndex
                        ? "bg-foreground/[0.06]"
                        : "hover:bg-foreground/[0.04]"
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => openEntry(entry)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {entry.title}
                      </span>
                      <span className="text-muted block truncate text-xs">
                        {kindLabels[entry.kind]} · {entry.description}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted px-3 py-3 text-sm">Geen functionaliteit gevonden.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
