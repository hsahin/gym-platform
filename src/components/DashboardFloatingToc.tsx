"use client";

import { useCallback, useEffect, useState } from "react";
import { FloatingToc } from "@heroui-pro/react";
import type { DashboardPageKey } from "@/lib/dashboard-pages";

type TocItem = {
  readonly id: string;
  readonly label: string;
  readonly level: number;
};

function clampLevel(value: string | undefined) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(3, Math.max(1, parsed));
}

function areTocItemsEqual(left: ReadonlyArray<TocItem>, right: ReadonlyArray<TocItem>) {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.id === right[index]?.id &&
        item.label === right[index]?.label &&
        item.level === right[index]?.level,
    )
  );
}

function collectTocItems(root: HTMLElement) {
  const usedIds = new Set<string>();

  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-dashboard-toc-section]"),
  ).reduce<TocItem[]>((items, section) => {
    const label =
      section.dataset.dashboardTocLabel?.trim() ||
      section.querySelector("h2, h3")?.textContent?.trim() ||
      "";

    if (!label) {
      return items;
    }

    if (!section.id || usedIds.has(section.id)) {
      return items;
    }

    const id = section.id;

    usedIds.add(id);

    items.push({
      id,
      label,
      level: clampLevel(section.dataset.dashboardTocLevel),
    });

    return items;
  }, []);
}

function getActiveSectionId(items: ReadonlyArray<TocItem>) {
  const anchorOffset = 150;
  const candidates = items
    .map((item) => {
      const element = document.getElementById(item.id);

      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();

      return {
        id: item.id,
        bottom: rect.bottom,
        top: rect.top,
      };
    })
    .filter((item): item is { id: string; bottom: number; top: number } =>
      Boolean(item),
    );

  const current = candidates
    .filter((item) => item.top <= anchorOffset && item.bottom > anchorOffset)
    .at(-1);

  if (current) {
    return current.id;
  }

  const previous = candidates.filter((item) => item.top <= anchorOffset).at(-1);

  return previous?.id ?? candidates[0]?.id ?? "";
}

export function DashboardFloatingToc({
  pageKey,
}: {
  readonly pageKey: DashboardPageKey;
}) {
  const [items, setItems] = useState<ReadonlyArray<TocItem>>([]);
  const [activeId, setActiveId] = useState("");

  const refreshItems = useCallback(() => {
    const root = document.querySelector<HTMLElement>(
      `[data-dashboard-toc-root][data-dashboard-page="${pageKey}"]`,
    );
    const nextItems = root ? collectTocItems(root) : [];

    setItems((currentItems) =>
      areTocItemsEqual(currentItems, nextItems) ? currentItems : nextItems,
    );
    setActiveId((currentActiveId) =>
      nextItems.some((item) => item.id === currentActiveId)
        ? currentActiveId
        : nextItems[0]?.id ?? "",
    );
  }, [pageKey]);

  useEffect(() => {
    refreshItems();

    const root = document.querySelector<HTMLElement>("[data-dashboard-toc-root]");

    if (!root) {
      return undefined;
    }

    let animationFrame = 0;
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(refreshItems);
    });

    observer.observe(root, {
      attributeFilter: [
        "class",
        "data-dashboard-toc-label",
        "data-dashboard-toc-level",
        "data-dashboard-toc-section",
        "hidden",
        "id",
      ],
      attributes: true,
      childList: true,
      subtree: true,
    });

    window.addEventListener("resize", refreshItems);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", refreshItems);
    };
  }, [refreshItems]);

  useEffect(() => {
    if (items.length < 2) {
      return undefined;
    }

    let animationFrame = 0;
    const updateActiveSection = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const nextActiveId = getActiveSectionId(items);

        if (nextActiveId) {
          setActiveId(nextActiveId);
        }
      });
    };

    const observer = new IntersectionObserver(updateActiveSection, {
      rootMargin: "-18% 0px -58% 0px",
      threshold: [0.05, 0.2, 0.45, 0.7],
    });

    for (const item of items) {
      const element = document.getElementById(item.id);

      if (element) {
        observer.observe(element);
      }
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("scroll", updateActiveSection);
    };
  }, [items]);

  if (items.length < 2) {
    return null;
  }

  function scrollToSection(id: string) {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="Pagina-inhoud"
      className="pointer-events-none fixed right-2 top-1/2 z-40 -translate-y-1/2 max-[520px]:bottom-[max(1rem,env(safe-area-inset-bottom))] max-[520px]:right-1.5 max-[520px]:top-auto max-[520px]:translate-y-0 md:right-4 xl:right-6"
    >
      <div className="pointer-events-auto">
        <FloatingToc placement="left" triggerMode="press" closeDelay={140} openDelay={0}>
          <FloatingToc.Trigger aria-label="Pagina-inhoud">
            {items.map((item) => (
              <FloatingToc.Bar
                key={item.id}
                active={item.id === activeId}
                level={item.level}
              />
            ))}
          </FloatingToc.Trigger>
          <FloatingToc.Content className="max-w-[min(18rem,calc(100vw-3rem))]">
            <span className="text-muted mb-1 block px-3 py-1 text-[10px] font-semibold uppercase">
              Op deze pagina
            </span>
            {items.map((item) => (
              <FloatingToc.Item
                key={item.id}
                active={item.id === activeId}
                level={item.level}
                onClick={() => scrollToSection(item.id)}
              >
                {item.label}
              </FloatingToc.Item>
            ))}
          </FloatingToc.Content>
        </FloatingToc>
      </div>
    </nav>
  );
}
