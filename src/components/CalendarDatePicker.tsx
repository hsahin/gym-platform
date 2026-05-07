"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Calendar, Popover } from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";

interface CalendarDatePickerProps {
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly name?: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly value: string;
}

function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function getCalendarDatePart(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  return trimmedValue.slice(0, 10);
}

function toCalendarValue(value: string): DateValue | null {
  const datePart = getCalendarDatePart(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null;
  }

  try {
    return parseDate(datePart);
  } catch {
    return null;
  }
}

export function formatCalendarDateLabel(value: string, placeholder = "Kies datum") {
  const datePart = getCalendarDatePart(value);

  if (!datePart) {
    return placeholder;
  }

  const parsedDate = toCalendarValue(datePart);

  if (!parsedDate) {
    return datePart;
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(parsedDate.year, parsedDate.month - 1, parsedDate.day));
}

export function CalendarDatePicker({
  ariaLabel = "Datum kiezen",
  className,
  disabled = false,
  id,
  name,
  onChange,
  placeholder = "Kies datum",
  value,
}: CalendarDatePickerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const datePart = getCalendarDatePart(value);
  const calendarValue = useMemo(() => toCalendarValue(value), [value]);
  const displayLabel = formatCalendarDateLabel(value, placeholder);
  const triggerClassName = cx(
    "flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 text-left text-sm shadow-sm transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45",
    "data-[hovered]:border-accent/50 data-[pressed]:scale-[0.99]",
    disabled && "cursor-not-allowed opacity-60",
    className,
  );
  const hiddenInput = name ? (
    <input id={id} name={name} type="hidden" value={datePart} readOnly />
  ) : null;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || disabled) {
    return (
      <>
        <button
          aria-label={ariaLabel}
          className={triggerClassName}
          data-hydration-safe-calendar-date-picker
          disabled={disabled}
          suppressHydrationWarning
          type="button"
        >
          <span className={datePart ? "truncate" : "truncate text-muted"}>
            {displayLabel}
          </span>
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted" />
        </button>
        {hiddenInput}
      </>
    );
  }

  return (
    <>
      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger aria-label={ariaLabel} className={triggerClassName}>
          <span className={datePart ? "truncate" : "truncate text-muted"}>
            {displayLabel}
          </span>
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted" />
        </Popover.Trigger>
        <Popover.Content
          className="w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-2"
          offset={8}
          placement="bottom start"
        >
          <Popover.Dialog className="outline-none">
            <Calendar
              aria-label={ariaLabel}
              className="mx-auto w-full"
              value={calendarValue ?? undefined}
              onChange={(nextValue) => {
                onChange(nextValue.toString());
                setIsOpen(false);
              }}
            >
              <Calendar.Header>
                <Calendar.NavButton slot="previous" />
                <Calendar.Heading />
                <Calendar.NavButton slot="next" />
              </Calendar.Header>
              <Calendar.Grid className="w-full">
                <Calendar.GridHeader>
                  {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                </Calendar.GridHeader>
                <Calendar.GridBody>
                  {(date) => <Calendar.Cell date={date} />}
                </Calendar.GridBody>
              </Calendar.Grid>
            </Calendar>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      {hiddenInput}
    </>
  );
}
