import { supabaseRequest } from "../../../../../db/supabase";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const buyerId = Number(id);
    if (!Number.isInteger(buyerId) || buyerId <= 0) throw new Error("A valid buyer is required.");

    const now = new Date().toISOString();
    const response = await supabaseRequest(`rest/v1/buyers?id=eq.${buyerId}`, {
     