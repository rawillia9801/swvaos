# Contracts and puppy portal

SWVAOS can generate a Bill of Sale and Health Guarantee from an assigned family and puppy record. Both PDFs are placed in the existing private buyer document vault and linked to the puppy.

## Staff workflow

1. Open Caller CRM and select a recognized family.
2. Select **Contracts** or **Prepare documents**.
3. Choose the assigned puppy and confirm the price, credited payments, due date, transfer date, veterinary exam period, and guarantee period.
4. Expand **Review and edit contract language** to review every clause.
5. Select **Create both documents**.
6. Copy the puppy portal link and provide it to the buyer through the normal approved communication channel.

Existing documents remain available through **Open existing portal**. Creating a new package creates new document records; it does not silently replace a prior package.

## Buyer workflow

The private puppy portal displays assigned puppy information, published updates, the buyer's payment summary, and generated agreements. Pending agreements open into a full review page.

The buyer must:

- enter a full legal name;
- affirmatively consent to the document terms and electronic signature;
- select **Sign agreement**.

The server records the signer name, UTC timestamp, network address, browser record, and a SHA-256 integrity hash covering the frozen document and signature event. A signed PDF replaces the pending PDF in the buyer's vault and remains downloadable through the private portal.

## Configuration

Set these production environment variables:

```text
SWVAOS_PORTAL_SECRET=a-long-random-secret-different-from-other-keys
SWVAOS_SELLER_NAME=Southwest Virginia Chihuahua
SWVAOS_SELLER_LOCATION=Southwest Virginia
```

If `SWVAOS_PORTAL_SECRET` is omitted, the server uses the existing service credential as a compatibility fallback. A separate portal secret is recommended so portal links can be rotated independently.

## Legal review

The included clauses are an editable operational template, not legal advice. Have a Virginia attorney review the exact Bill of Sale, warranty period, covered conditions, exclusions, remedies, venue, and any breeding or registration terms before using the documents for real transactions.
