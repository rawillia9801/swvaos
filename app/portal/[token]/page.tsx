"use client";

import { use } from "react";
import { FamilyPortalExperience } from "../../../components/family-portal-experience";

export function PuppyPortalExperience({ token, accountMode = false }: { token: string; accountMode?: boolean }) {
  return <FamilyPortalExperience token={token} accountMode={accountMode} />;
}

export default function PuppyPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <FamilyPortalExperience token={token} />;
}
