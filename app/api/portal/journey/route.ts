import { cookies } from "next/headers";
import { getPuppyPortalForBuyer } from "../../../../db/contracts";
import { supabaseRequest } from "../../../../db/supabase";
import { getBuyerMilestoneConfig } from "../../../../lib/milestone-config";
import { PORTAL_SESSION_COOKIE } from "../../../../lib/portal-session";
import { verifyPortalToken } from "../../../../lib/portal-token";
import { journeyMilestonesForPuppy, projectAdultWeight, syncPuppyJourneyMilestones } from "../../../../lib/puppy-journey";

type Row = Record<string, unknown>;

type AgreementDocument = { title: string; documentType: string; isContract: boolean };
type AgreementContract = { title: string; documentType: string; status: string };

async function rows(path: string) {
  const response = await supabaseRequest(path, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Unable to load the buyer journey.");
  return response.json() as Promise<Row[]>;
}

function normalized(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function agreementStatus(documents: AgreementDocument[], contracts: AgreementContract[], terms: string[]) {
  const contract = contracts.find((item) => terms.some((term) => normalized(`${item.title} ${item.documentType}`).includes(term)));
  if (contract) return contract.status === "signed" ? "Signed" : "Ready to review";
  const document = documents.find((item) => terms.some((term) => normalized(`${item.title} ${item.documentType}`).includes(term)));
  if (document) return /signed|completed|acknowledged/.test(normalized(document.title)) ? "Signed" : "On file";
  return "Not yet assigned";
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const suppliedToken = url.searchParams.get("token")?.trim() || "";
    const sessionToken = (await cookies()).get(PORTAL_SESSION_COOKIE)?.value || "";
    const token = suppliedToken || sessionToken;
    const claims = token ? await verifyPortalToken(token) : null;
    if (!claims) return Response.json({ error: "Your Puppy Portal session is not available." }, { status: 401 });

    await syncPuppyJourneyMilestones(claims.buyerId);
    const [portal, milestoneConfig] = await Promise.all([
      getPuppyPortalForBuyer(claims.buyerId),
      getBuyerMilestoneConfig(),
    ]);
    if (!portal) return Response.json({ error: "The family account was not found." }, { status: 404 });

    const portalContracts = portal.contracts.filter((item): item is NonNullable<typeof item> => Boolean(item));
    const puppyIds = portal.puppies.map((puppy) => puppy.id);
    const rawUpdates = puppyIds.length
      ? await rows(`rest/v1/puppy_updates?select=*&puppy_id=in.(${puppyIds.join(",")})&order=created_at.desc`)
      : [];

    const agreements = [
      { key: "deposit", title: "Deposit Agreement", required: true, status: agreementStatus(portal.documents, portalContracts, ["deposit agreement", "reservation agreement"]) },
      { key: "hypoglycemia", title: "Hypoglycemia Awareness Form", required: true, status: agreementStatus(portal.documents, portalContracts, ["hypoglycemia awareness", "hypoglycemia form", "pup lift acknowledgement"]) },
      { key: "transportation", title: "Transportation Policy", required: true, status: agreementStatus(portal.documents, portalContracts, ["transportation policy", "pickup delivery policy", "transport policy"]) },
      { key: "sale", title: "Puppy Sale Agreement", required: true, status: agreementStatus(portal.documents, portalContracts, ["puppy sale agreement", "bill of sale", "sales agreement"]) },
      { key: "financing", title: "Puppy Payment Financing", required: false, status: agreementStatus(portal.documents, portalContracts, ["payment plan agreement", "financing agreement", "puppy payment financing"]) },
    ];

    const applicationStatus = portal.buyer.applicationStatus || "Applied";
    const inReview = /inquiry|applied|submitted|review|needs information/i.test(applicationStatus);
    const completedAgreementCount = agreements.filter((item) => ["Signed", "On file"].includes(item.status)).length;

    const puppies = portal.puppies.map((puppy) => {
      const weightEntries = rawUpdates
        .filter((update) => Number(update.puppy_id) === puppy.id && Number(update.weight) > 0)
        .map((update) => ({ weight: Number(update.weight), createdAt: String(update.created_at || "") }));
      const latestUpdateWeight = weightEntries.sort((left, right) => left.createdAt.localeCompare(right.createdAt)).at(-1)?.weight || 0;
      const currentWeight = latestUpdateWeight || puppy.currentWeight || 0;
      return {
        id: puppy.id,
        name: puppy.name,
        birthDate: puppy.birthDate,
        currentWeight,
        weightEntries,
        projection: projectAdultWeight({ birthDate: puppy.birthDate, currentWeight, weightEntries }),
        milestones: journeyMilestonesForPuppy({ ...puppy, buyerId: claims.buyerId } as unknown as Row, rawUpdates, milestoneConfig),
      };
    });

    return Response.json({
      buyer: portal.buyer,
      application: {
        status: applicationStatus,
        inReview,
        headline: inReview ? "Your application is in review" : `Application status: ${applicationStatus}`,
        detail: inReview
          ? "Please allow up to 48 business hours for review. We will contact you if additional information is needed."
          : "Your current application and placement status is shown here as it moves through the review process.",
      },
      agreements,
      progress: {
        completedAgreements: completedAgreementCount,
        totalAgreements: agreements.length,
        puppyAssigned: puppies.length > 0,
      },
      puppies,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load the buyer journey." }, { status: 500 });
  }
}
