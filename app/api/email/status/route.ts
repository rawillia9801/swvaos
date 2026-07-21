import { requireAdminSession } from "../../../../lib/admin-session";
import { getEmailStatus } from "../../../../lib/email-service";

export async function GET(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;
  return Response.json(getEmailStatus(), { headers: { "cache-control": "no-store" } });
}
