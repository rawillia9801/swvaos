import { renderPuppyApplicationPdf } from "../../../../lib/puppy-application";

export async function GET() {
  const pdf = await renderPuppyApplicationPdf();
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "content-disposition": 'attachment; filename="swva-chihuahua-puppy-application.pdf"',
      "content-type": "application/pdf",
      "cache-control": "no-store",
    },
  });
}
