import { isResource, type ResourceInput, type ResourceName } from "../../../db/resources";
import { getKennelDataFromSupabase } from "../../../db/supabase-kennel";

type ClaudeBlock = { type: string; text?: string; name?: string; input?: unknown };

const createRecordTool = {
  name: "create_record",
  description: "Prepare one new kennel record from the operator's request. Use this only when the request includes enough information to create a useful record. Never update or delete a record.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["resource", "data", "summary"],
    properties: {
      resource: { type: "string", enum: ["dogs", "dog_medical_records", "dog_registrations", "litters", "buyers", "puppies", "payment_plans", "transactions", "events", "updates"] },
      data: { type: "object", description: "Fields for the selected resource. Use IDs from the supplied context for relationships." },
      summary: { type: "string", description: "A short, operator-friendly explanation of the record that will be created." },
    },
  },
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "Claude is not configured. Add ANTHROPIC_API_KEY to the runtime environment." }, { status: 503 });

  try {
    const { message } = await request.json() as { message?: unknown };
    if (typeof message !== "string" || !message.trim()) return Response.json({ error: "Enter a request for the operations assistant." }, { status: 400 });

    const data = await getKennelDataFromSupabase();
    const context = {
      dogs: data.dogs.map((dog) => ({ id: dog.id, name: dog.name })),
      buyers: data.buyers.map((buyer) => ({ id: buyer.id, name: `${buyer.first_name} ${buyer.last_name}`, email: buyer.email })),
      litters: data.litters.map((litter) => ({ id: litter.id, name: litter.name })),
      puppies: data.puppies.map((puppy) => ({ id: puppy.id, name: puppy.name, litter_id: puppy.litter_id, buyer_id: puppy.buyer_id })),
    };
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 700,
        system: "You are the Southwest Virginia Chihuahuas operations copilot. Help the owner turn plain-language notes into accurate kennel records. You may prepare only a single CREATE action using the supplied tool. Never invent names, dates, prices, or relationship IDs; ask a concise follow-up when information is missing. A person must explicitly approve every proposed change in the interface. Use YYYY-MM-DD dates and dollar numbers (not cents) for money fields. Existing record context follows:\n" + JSON.stringify(context),
        tools: [createRecordTool],
        messages: [{ role: "user", content: message.trim() }],
      }),
    });
    const payload = await response.json() as { error?: { message?: string }; content?: ClaudeBlock[] };
    if (!response.ok) throw new Error(payload.error?.message || "Claude could not process this request.");
    const blocks = payload.content ?? [];
    const tool = blocks.find((block) => block.type === "tool_use" && block.name === "create_record");
    const text = blocks.filter((block) => block.type === "text").map((block) => block.text).filter(Boolean).join("\n") || "I need a little more detail before I can prepare a record.";
    if (!tool || !tool.input || typeof tool.input !== "object") return Response.json({ message: text });
    const input = tool.input as { resource?: unknown; data?: unknown; summary?: unknown };
    if (!isResource(input.resource) || !input.data || typeof input.data !== "object" || typeof input.summary !== "string") return Response.json({ message: text });
    return Response.json({ message: text, action: { resource: input.resource as ResourceName, data: input.data as ResourceInput, summary: input.summary } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The operations assistant is unavailable." }, { status: 500 });
  }
}
