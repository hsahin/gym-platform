import { PublicMembershipSignupPortal } from "@/components/PublicMembershipSignupPortal";
import { RuntimeConfigurationState } from "@/components/RuntimeConfigurationState";
import { toPublicMembershipSignupPortalSnapshot } from "@/lib/public-membership-signup-view";
import { getGymPlatformServices } from "@/server/runtime/gym-services";

export default async function JoinPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const gym =
    typeof resolvedSearchParams?.gym === "string"
      ? resolvedSearchParams.gym
      : Array.isArray(resolvedSearchParams?.gym)
        ? resolvedSearchParams.gym[0]
        : undefined;
  const payment =
    typeof resolvedSearchParams?.payment === "string"
      ? resolvedSearchParams.payment
      : Array.isArray(resolvedSearchParams?.payment)
        ? resolvedSearchParams.payment[0]
        : undefined;
  const invoice =
    typeof resolvedSearchParams?.invoice === "string"
      ? resolvedSearchParams.invoice
      : Array.isArray(resolvedSearchParams?.invoice)
        ? resolvedSearchParams.invoice[0]
        : undefined;
  const paymentReturn =
    payment === "return"
      ? {
          isReturn: true,
          invoiceId: invoice ?? null,
        }
      : undefined;

  try {
    const services = await getGymPlatformServices();
    const snapshot = await services.getPublicMembershipSignupSnapshot({
      tenantSlug: gym,
    });

    return (
      <main className="min-h-screen bg-transparent">
        <div className="app-page">
          <PublicMembershipSignupPortal
            paymentReturn={paymentReturn}
            snapshot={toPublicMembershipSignupPortalSnapshot(snapshot)}
          />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <RuntimeConfigurationState
        detail={
          error instanceof Error
            ? error.message
            : "De publieke aanmeldomgeving kon de live configuratie niet laden."
        }
      />
    );
  }
}
