"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MUTATION_CSRF_TOKEN } from "@/server/http/platform-api";

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
  return "mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-orange-400";
}

function textareaClassName() {
  return "mt-1 min-h-20 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-orange-400";
}

async function submitEntityMutation(
  endpoint: string,
  method: "PATCH" | "DELETE",
  payload: unknown,
) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      "content-type": "application/json",
      "x-claimtech-csrf": MUTATION_CSRF_TOKEN,
      "x-idempotency-key": crypto.randomUUID(),
    },
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

export function DashboardEntityActions({
  endpoint,
  updatePayloadBase,
  archivePayload,
  deletePayload,
  fields,
  entityLabel,
  extraActions = [],
}: {
  endpoint: string;
  updatePayloadBase: Record<string, unknown>;
  archivePayload: Record<string, unknown>;
  deletePayload: Record<string, unknown>;
  fields: ReadonlyArray<EntityActionField>;
  entityLabel: string;
  extraActions?: ReadonlyArray<EntityExtraAction>;
}) {
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
    <details className="mt-3 rounded-xl border border-white/[0.08] bg-black/25 p-3">
      <summary className="cursor-pointer text-sm font-medium text-orange-200">
        Beheer {entityLabel.toLowerCase()}
      </summary>
      <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={updateEntity}>
        {fields.map((field) => (
          <label
            key={field.name}
            className={`text-xs font-medium text-white/55 ${
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
          <button
            className="rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-white/70 transition hover:border-orange-300 hover:text-white"
            type="submit"
            disabled={isPending}
          >
            Opslaan
          </button>
          <button
            className="rounded-full border border-amber-400/30 px-3 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-400/10"
            type="button"
            disabled={isPending}
            onClick={() =>
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
          </button>
          <button
            className="rounded-full border border-red-400/30 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-400/10"
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => submitEntityMutation(endpoint, "DELETE", deletePayload),
                `${entityLabel} verwijderd.`,
              )
            }
          >
            Verwijder
          </button>
          {extraActions.map((action) => (
            <button
              key={action.label}
              className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                action.tone === "danger"
                  ? "border-red-400/30 text-red-200 hover:bg-red-400/10"
                  : action.tone === "warning"
                    ? "border-amber-400/30 text-amber-200 hover:bg-amber-400/10"
                    : "border-white/10 text-white/70 hover:border-orange-300 hover:text-white"
              }`}
              type="button"
              disabled={isPending}
              onClick={() =>
                run(
                  () => submitEntityMutation(endpoint, action.method, action.payload),
                  action.successMessage,
                )
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      </form>
    </details>
  );
}
