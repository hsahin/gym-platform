"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Search, Sparkles } from "lucide-react";
import { Chip, Kbd } from "@heroui/react";
import {Command} from "@heroui-pro/react";
import { Button } from "@/components/dashboard/HydrationSafeButton";
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
  pinnedSuggestionKeys,
  attentionSuggestionKeys,
}: {
  readonly ariaLabel: string;
  readonly entries: ReadonlyArray<FunctionalitySearchEntry>;
  readonly placeholder: string;
  readonly tenantId: string;
  readonly pinnedSuggestionKeys?: ReadonlyArray<string>;
  readonly attentionSuggestionKeys?: ReadonlyArray<string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const results = useMemo(
    () => searchFunctionality(query, { entries, limit: 9 }),
    [entries, query],
  );
  const entriesByKey = useMemo(
    () => new Map(entries.map((entry) => [entry.key, entry])),
    [entries],
  );
  const attentionEntries = useMemo(
    () =>
      (attentionSuggestionKeys ?? [])
        .map((key) => entriesByKey.get(key))
        .filter((entry): entry is FunctionalitySearchEntry => Boolean(entry)),
    [attentionSuggestionKeys, entriesByKey],
  );
  const pinnedEntries = useMemo(() => {
    const attentionSet = new Set(attentionEntries.map((entry) => entry.key));

    return (pinnedSuggestionKeys ?? [])
      .map((key) => entriesByKey.get(key))
      .filter(
        (entry): entry is FunctionalitySearchEntry =>
          Boolean(entry) && !attentionSet.has((entry as FunctionalitySearchEntry).key),
      );
  }, [attentionEntries, entriesByKey, pinnedSuggestionKeys]);
  const hasQuery = query.trim().length > 0;
  const hasDefaultSuggestions = attentionEntries.length > 0 || pinnedEntries.length > 0;
  const resultsByKey = useMemo(() => {
    const map = new Map<string, FunctionalitySearchEntry>();

    for (const entry of results) {
      map.set(entry.key, entry);
    }

    if (!hasQuery) {
      for (const entry of [...attentionEntries, ...pinnedEntries]) {
        map.set(entry.key, entry);
      }
    }

    return map;
  }, [attentionEntries, hasQuery, pinnedEntries, results]);

  function openEntry(entry: FunctionalitySearchEntry) {
    router.push(resolveFunctionalitySearchHref(entry, tenantId));
    setQuery("");
    setIsOpen(false);
  }

  function openEntryByKey(key: string) {
    const entry = resultsByKey.get(key);

    if (!entry) {
      return;
    }

    openEntry(entry);
  }

  useEffect(() => {
    function openSearchWithShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
    }

    window.addEventListener("keydown", openSearchWithShortcut);

    return () => window.removeEventListener("keydown", openSearchWithShortcut);
  }, []);

  return (
    <div className="w-full min-w-0 max-w-[22rem] max-[520px]:max-w-none sm:max-w-[20rem] md:w-[clamp(12rem,24vw,22rem)] lg:max-w-[22rem]">
      <Button
        fullWidth
        aria-label={ariaLabel}
        className="h-9 justify-start rounded-xl px-2.5 text-sm text-muted"
        type="button"
        variant="outline"
        onPress={() => setIsOpen(true)}
      >
        <Search
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-left">{placeholder}</span>
        <Kbd className="hidden shrink-0 text-xs xl:inline-flex">
          <Kbd.Abbr keyValue="command" />
          <Kbd.Content>K</Kbd.Content>
        </Kbd>
      </Button>

      <Command>
        <Command.Backdrop
          isOpen={isOpen}
          variant="opaque"
          onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) {
              setQuery("");
            }
          }}
        >
          <Command.Container size="lg">
            <Command.Dialog
              filter={() => true}
              inputValue={query}
              onInputChange={setQuery}
            >
              <Command.InputGroup>
                <Command.InputGroup.Prefix>
                  <Search className="h-4 w-4" aria-hidden="true" />
                </Command.InputGroup.Prefix>
                <Command.InputGroup.Input
                  aria-label={ariaLabel}
                  placeholder={placeholder}
                />
                <Command.InputGroup.ClearButton />
                <Command.InputGroup.Suffix>
                  <Kbd className="text-xs">
                    <Kbd.Content>Esc</Kbd.Content>
                  </Kbd>
                </Command.InputGroup.Suffix>
              </Command.InputGroup>
              <Command.List
                renderEmptyState={() => (
                  <div className="text-muted flex h-16 items-center justify-center px-4 text-center text-sm">
                    {hasQuery
                      ? "Geen functionaliteit gevonden."
                      : "Typ om pagina's, acties en ledenroutes te vinden."}
                  </div>
                )}
                onAction={(key) => openEntryByKey(String(key))}
              >
                {hasQuery && results.length > 0 ? (
                  <Command.Group heading="Resultaten">
                    {results.map((entry) => (
                      <Command.Item
                        key={entry.key}
                        id={entry.key}
                        textValue={`${entry.title} ${entry.description} ${entry.keywords.join(" ")}`}
                      >
                        <span className="grid min-w-0 flex-1 gap-0.5">
                          <span className="truncate text-sm font-medium">{entry.title}</span>
                          <span className="text-muted truncate text-xs">
                            {kindLabels[entry.kind]} · {entry.description}
                          </span>
                        </span>
                        <ArrowRight className="ms-auto h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}
                {!hasQuery && attentionEntries.length > 0 ? (
                  <Command.Group heading="Nodig nog aandacht">
                    {attentionEntries.map((entry) => (
                      <Command.Item
                        key={entry.key}
                        id={entry.key}
                        textValue={`${entry.title} ${entry.description}`}
                      >
                        <AlertCircle
                          aria-hidden="true"
                          className="text-warning size-4 shrink-0"
                        />
                        <span className="grid min-w-0 flex-1 gap-0.5">
                          <span className="truncate text-sm font-medium">{entry.title}</span>
                          <span className="text-muted truncate text-xs">
                            {entry.description}
                          </span>
                        </span>
                        <Chip color="warning" size="sm" variant="soft">
                          Setup
                        </Chip>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}
                {!hasQuery && pinnedEntries.length > 0 ? (
                  <Command.Group heading="Snel openen">
                    {pinnedEntries.map((entry) => (
                      <Command.Item
                        key={entry.key}
                        id={entry.key}
                        textValue={`${entry.title} ${entry.description}`}
                      >
                        <Sparkles
                          aria-hidden="true"
                          className="text-accent size-4 shrink-0"
                        />
                        <span className="grid min-w-0 flex-1 gap-0.5">
                          <span className="truncate text-sm font-medium">{entry.title}</span>
                          <span className="text-muted truncate text-xs">
                            {kindLabels[entry.kind]} · {entry.description}
                          </span>
                        </span>
                        <ArrowRight
                          className="ms-auto h-4 w-4 shrink-0 text-muted"
                          aria-hidden="true"
                        />
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}
                {!hasQuery && !hasDefaultSuggestions ? (
                  <div className="text-muted flex h-16 items-center justify-center px-4 text-center text-sm">
                    Typ om pagina&apos;s, acties en ledenroutes te vinden.
                  </div>
                ) : null}
              </Command.List>
              <Command.Footer className="justify-between [&_kbd]:h-5 [&_kbd]:text-xs">
                <span>Zoek door dashboard, acties en publieke routes.</span>
                <span className="hidden items-center gap-2 sm:flex">
                  <Kbd>
                    <Kbd.Abbr keyValue="enter" />
                  </Kbd>
                  Openen
                </span>
              </Command.Footer>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
    </div>
  );
}
