"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { Kbd } from "@heroui/react";
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
}: {
  readonly ariaLabel: string;
  readonly entries: ReadonlyArray<FunctionalitySearchEntry>;
  readonly placeholder: string;
  readonly tenantId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const results = useMemo(
    () => searchFunctionality(query, { entries, limit: 9 }),
    [entries, query],
  );
  const resultsByKey = useMemo(
    () => new Map(results.map((entry) => [entry.key, entry])),
    [results],
  );
  const hasQuery = query.trim().length > 0;

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
                {results.length > 0 ? (
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
