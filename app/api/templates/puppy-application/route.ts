import { renderPuppyApplicationPdf } from "../../../../lib/puppy-application";
import { getTemplatesConfig } from "../../../../lib/templates-config";

export async function GET() {
  const config = await getTemplatesConfig();
  const pdf = await renderPuppyApplicationPdf(config.documents.puppy_application.content);
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "content-disposition": 'attachment; filename="swva-chihuahua-puppy-application.pdf"',
      "content-type": "application/pdf",
      "cache-control": "no-store",
    },
  });
}
