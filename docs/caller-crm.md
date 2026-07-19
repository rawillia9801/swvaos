# SWVAOS Caller CRM

The Caller CRM matches inbound phone numbers to family records and returns the account, assigned puppies, published updates, payment summary, payment plans, application status, and prior calls. Unrecognized numbers receive public information only.

## Connect the existing Studio flow

Keep the phone number attached to the existing 61-state Studio flow. Only update its `lookup_caller` HTTP Request widget:

- Method: `POST`
- Content type: `application/json`
- URL: `https://swvaos:YOUR_CRM_KEY@swvaos.vercel.app/api/caller-crm/lookup`
- Body: `{ "phone": "{{trigger.call.From}}" }`

Set the same long random value as `SWVAOS_CRM_API_KEY` in the production deployment. The endpoint accepts HTTP Basic authentication for Studio and Bearer authentication for server integrations. It never returns family data without one of those credentials.

The response preserves the fields used by the current flow, including `found`, `customer_id`, `first_name`, `email`, `zip`, `application_message`, `reservation_message`, `pickup_delivery_message`, and `voice_prompts`. It also returns structured `puppies`, `updates`, `payment_plans`, `account`, and `calls` data.

## Current-flow correction

The exported public menu announces options 1 through 7, but its `split_1` widget only contains a route for option 1. Add routes for options 2 through 7 in Studio, or use the SWVAOS incoming voice endpoint, which handles every advertised option.

## Optional SWVAOS voice endpoint

To let SWVAOS host the whole incoming menu instead of Studio, configure the phone number's incoming voice webhook as:

- URL: `https://swvaos.vercel.app/api/voice/incoming`
- Method: `POST`

Required deployment settings are `TWILIO_AUTH_TOKEN`, `TWILIO_WEBHOOK_BASE_URL`, `SWVAOS_CALL_TEAM_NUMBERS`, and `SWVAOS_CALLER_ID`. Optional spoken-information settings are `SWVAOS_PUP_LIFT_CALL_INFO` and `SWVAOS_CHIHUAHUA_HQ_CALL_INFO`.

Incoming webhooks and recording callbacks are signature-validated. Caller messages are logged as Call events, and recordings remain in the voice account rather than browser storage.
