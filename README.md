# Southwest Virginia Chihuahua OS

Direct Next.js app for Vercel with Supabase as the database and file store. This repo no longer uses external sign-in redirects, OpenAI Sites hosting, Cloudflare Workers, vinext, D1, or Drizzle.

## Run Locally

```bash
npm install
npm run dev
npm run build
```

## Vercel Environment

Set these in Vercel for Production, Preview, and Development:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_STORAGE_BUCKET`

The default storage bucket name is `documents` if `SUPABASE_STORAGE_BUCKET` is not set.

## Supabase Setup

Run [supabase/schema.sql](./supabase/schema.sql) in the Supabase SQL editor. It creates the kennel tables, document metadata tables, and the storage bucket policy shape used by the API routes.

## App Surface

- `app/page.tsx` is the high-tech operations dashboard.
- `app/api/data/route.ts` provides CRUD for dogs, litters, buyers, puppies, payment plans, transactions, events, updates, medical records, and registrations.
- `app/api/documents/*` stores and retrieves buyer documents from Supabase Storage.
- `app/api/dog-documents/*` stores and retrieves dog documents from Supabase Storage.

## Migration Helper

`npm run migrate:legacy-to-supabase` remains available only to import previously entered records from the old deployed app or from a local backup directory. The production app itself does not depend on that old host.
