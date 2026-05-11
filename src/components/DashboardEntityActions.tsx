"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/dashboard/HydrationSafeButton";
import { buildMutationHeaders } from "@/lib/mutation-security-client";

export interface EntityActionOption {
  readonly value: string;
  readonly label: string;
}

export interface EntityActionField {
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string | number | ReadonlyArray<string>;
  readonly type?: "text" | "email" | "number" | "datetime-local" | "select" | "textarea" | "list";
  readonly options?: ReadonlyArray<EntityActionOption>;
}

export interface EntityExtraAction {
  readonly label: string;
  readonly method: "PATCH" | "DELETE";
  readonly payload: Record<string, unknown>;
  readonly successMessage: string;
  readonly tone?: "neutral" | "warning" | "danger";
}

function inputClassName() {
  return "mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent";
}

function textareaClassName() {
  return "mt-1 min-h-24 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent";
}

async function submitEntityMutation(
  endpoint: string,
  method: "PATCH" | "DELETE",
  payload: unknown,
) {
  const response = await fetch(endpoint, {
    method,
    headers: await buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as {
    ok: boolean;
    error?: {
      message: string;
    };
  };

  if (!response.ok || !result.ok) {
    throw new Error(result.error?.message ?? "Actie is mislukt.");
  }
}

function normalizeDefaultValue(value: EntityActionField["defaultValue"]) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function readFieldValue(formData: FormData, field: EntityActionField) {
  const raw = String(formData.get(field.name) ?? "");

  switch (field.type) {
    case "number":
      return Number(raw);
    case "list":
      return raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    case "datetime-local":
      return new Date(raw).toISOString();
    default:
      return raw;
  }
}

export interface DashboardEntityActionsProps {
  endpoint: string;
  updatePayloadBase: Record<string, unknown>;
  archivePayload: Record<string, unknown>;
  deletePayload: Record<string, unknown>;
  fields: ReadonlyArray<EntityActionField>;
  entityLabel: string;
  extraActions?: ReadonlyArray<EntityExtraAction>;
}

function extraActionVariant(action: EntityExtraAction) {
  if (action.tone === "danger") {
    return "danger-soft" as const;
  }

  if (action.tone === "warning") {
    return "outline" as const;
  }

  return "ghost" as const;
}

export function DashboardEntityActions({
  endpoint,
  updatePayloadBase,
  archivePayload,
  deletePayload,
  fields,
  entityLabel,
  extraActions = [],
}: DashboardEntityActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Actie is mislukt.");
      }
    });
  }

  function updateEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(
      fields.map((field) => [field.name, readFieldValue(formData, field)]),
    );

    run(
      () =>
        submitEntityMutation(endpoint, "PATCH", {
          ...updatePayloadBase,
          ...values,
        }),
      `${entityLabel} bijgewerkt.`,
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-secondary p-4">
      <div className="mb-4">
        <p className="text-sm font-semibold">Beheer geselecteerde</p>
        <p className="text-muted mt-1 text-sm">{entityLabel}</p>
      </div>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={updateEntity}>
        {fields.map((field) => (
          <label
            key={field.name}
            className={`text-xs font-medium text-muted ${
              field.type === "textarea" || field.type === "list" ? "md:col-span-2" : ""
            }`}
          >
            {field.label}
            {field.type === "select" ? (
              <select
                className={inputClassName()}
                name={field.name}
                defaultValue={normalizeDefaultValue(field.defaultValue)}
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" || field.type === "list" ? (
              <textarea
                className={textareaClassName()}
                name={field.name}
                defaultValue={normalizeDefaultValue(field.defaultValue)}
              />
            ) : (
              <input
                className={inputClassName()}
                name={field.name}
                type={field.type ?? "text"}
                defaultValue={normalizeDefaultValue(field.defaultValue)}
              />
            )}
          </label>
        ))}
        <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
          <Button isDisabled={isPending} size="sm" type="submit" variant="primary">
            Opslaan
          </Button>
          <Button
            isDisabled={isPending}
            size="sm"
            type="button"
            variant="outline"
            onPress={() =>
              run(
                () =>
                  submitEntityMutation(endpoint, "PATCH", {
                    ...archivePayload,
                    operation: "archive",
                  }),
                `${entityLabel} gearchiveerd.`,
              )
            }
          >
            Archiveer
          </Button>
          <Button
            isDisabled={isPending}
            size="sm"
            type="button"
            variant="danger-soft"
            onPress={() => {
              const confirmation = window.prompt(
                `Verwijderen kan niet ongedaan worden gemaakt. Typ "${entityLabel}" om te bevestigen:`,
              );

              if (confirmation === null) {
                return;
              }

              if (confirmation.trim().toLowerCase() !== entityLabel.trim().toLowerCase()) {
                toast.error("Bevestiging klopt niet. Verwijderen is geannuleerd.");
                return;
              }

              run(
                () => submitEntityMutation(endpoint, "DELETE", deletePayload),
                `${entityLabel} verwijderd.`,
              );
            }}
          >
            Verwijder
          </Button>
          {extraActions.map((action) => (
            <Button
              key={action.label}
              isDisabled={isPending}
              size="sm"
              type="button"
              variant={extraActionVariant(action)}
              onPress={() =>
                run(
                  () => submitEntityMutation(endpoint, action.method, action.payload),
                  action.successMessage,
                )
              }
            >
              {action.label}
            </Button>
          ))}
        </div>
      </form>
    </div>
  );
}
