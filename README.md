# SWVAOS

Southwest Virginia Chihuahua operating system for breeding operations, buyer pipeline, payments, documents, care schedules, family updates, inventory, and reports.

## Run Locally

```bash
npm install
npm run dev
npm run build
```

## Environment

Set these for Production, Preview, and Development:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_STORAGE_BUCKET`

The default storage bucket name is `documents` if `SUPABASE_STORAGE_BUCKET` is not set.

## Database Setup

Run [supabase/schema.sql](./supabase/schema.sql) in the database SQL editor. It creates the kennel tables, document metadata tables, and the storage bucket policy shape used by the API routes.

If this project already has older buyer/family records, run [supabase/repair-buyers-schema.sql](./supabase/repair-buyers-schema.sql). It adds the buyer columns SWVAOS expects and backfills names from existing `name` or `full_name` values when present.

## App Surface

- `app/page.tsx` is the SWVAOS interface.
- `app/api/data/route.ts` provides CRUD for dogs, litters, buyers, puppies, payment plans, transactions, events, updates, medical records, and registrations.
- `app/api/documents/*` stores and retrieves buyer documents.
- `app/api/dog-documents/*` stores and retrieves dog documents.

## Migration Helper

`npm run migrate:legacy-to-supabase` remains available only to import previously entered records from the old deployed app or from a local backup directory. The production app itself does not depend on that old host.
