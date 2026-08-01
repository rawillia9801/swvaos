import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FamilyPortalExperience } from "../../../components/family-portal-experience";
import { PORTAL_SESSION_COOKIE } from "../../../lib/portal-session";
import { verifyPortalToken } from "../../../lib/portal-token";

export const dynamic = "force-dynamic";

export default async function PortalAccountPage() {
  const token = (await cookies()).get(PORTAL_SESSION_COOKIE)?.value ?? "";
  const claims = token ? await verifyPortalToken(token) : null;
  if (!claims) redirect("/portal/login");
  return <FamilyPortalExperience token={token} accountMode />;
}
