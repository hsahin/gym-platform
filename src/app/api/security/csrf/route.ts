import {
  IDEMPOTENCY_HEADER,
  MUTATION_CSRF_HEADER,
  createMutationCsrfToken,
  getMutationCsrfMaxAgeSeconds,
  runApiHandler,
} from "@/server/http/platform-api";

export async function GET(request: Request) {
  return runApiHandler(request, async () => ({
    csrfHeader: MUTATION_CSRF_HEADER,
    csrfToken: createMutationCsrfToken(),
    expiresInSeconds: getMutationCsrfMaxAgeSeconds(),
    idempotencyHeader: IDEMPOTENCY_HEADER,
  }));
}
