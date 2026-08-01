import { combinedAgreementTerms } from "./combined-agreement";
import { billOfSaleTerms, healthGuaranteeTerms } from "./contract-templates";
import { defaultPuppyPacketTemplate, puppyPacketVariables } from "./puppy-packet-template";

export type DocumentTemplateKey = "puppy_packet" | "bill_of_sale_health_guarantee" | "bill_of_sale" | "health_guarantee" | "payment_agreement" | "puppy_application";
export type EmailTemplateKey = "application_received" | "application_approved" | "payment_receipt" | "payment_reminder" | "puppy_update" | "contract_ready" | "contract_signed" | "portal_sign_in";

export type DocumentTemplate = {
  name: string;
  description: string;
  content: string;
  enabled: boolean;
  downloadUrl?: string;
  prepareUrl?: string;
};

export type EmailTemplate = {
  name: string;
  trigger: string;
  subject: string;
  body: string;
  enabled: boolean;
};

export type TemplatesConfig = {
  version: 1;
  updatedAt: string;
  documents: Record<DocumentTemplateKey, DocumentTemplate>;
  emails: Record<EmailTemplateKey, EmailTemplate>;
};

export const templateVariables = [...puppyPacketVariables,
  "{{first_name}}",
  "{{amount}}",
  "{{due_date}}",
  "{{portal_url}}",
  "{{access_link}}",
  "{{update_title}}",
  "{{support_email}}",
  "{{support_phone}}",
].filter((value, index, values) => values.indexOf(value) === index);

export const defaultTemplatesConfig: TemplatesConfig = {
  version: 1,
  updatedAt: "",
  documents: {
    puppy_packet: {
      name: "Complete Personalized Puppy Packet",
      description: "The complete buyer-facing go-home packet: personalized binder cover, puppy and family record, table of contents, Chihuahua care guide, Pup-Lift information, emergency guidance, safety, training, insurance, and go-home checklist. Saved wording remains editable while puppy and buyer fields populate automatically.",
      content: defaultPuppyPacketTemplate,
      enabled: true,
      prepareUrl: "/puppy-packet",
    },
    bill_of_sale_health_guarantee: {
      name: "Bill of Sale + 1-Year Health Guarantee",
      description: "Production combined agreement with animal history, payment and transfer terms, Virginia notice, one-year congenital and hereditary guarantee, care acknowledgments, one electronic signature, and a retained buyer-portal copy.",
      content: combinedAgreementTerms.join("\n\n"),
      enabled: true,
      downloadUrl: "/api/templates/bill-of-sale-health-guarantee",
      prepareUrl: "/forms/bill-of-sale-health-guarantee",
    },
    bill_of_sale: {
      name: "Bill of Sale",
      description: "Default terms used when a separate Bill of Sale is prepared for a family.",
      content: billOfSaleTerms.join("\n\n"),
      enabled: true,
    },
    health_guarantee: {
      name: "Health Guarantee",
      description: "Default examination and 12-month voluntary guarantee language used for the separate-document workflow.",
      content: healthGuaranteeTerms(240, 12, false).join("\n\n"),
      enabled: true,
    },
    payment_agreement: {
      name: "Payment Plan Agreement",
      description: "Additional business-specific terms appended to generated payment agreements.",
      content: "Payments must be made through the processor named in the completed agreement. Any exception, extension, or modification must be approved in writing by Southwest Virginia Chihuahua LLC.",
      enabled: true,
      downloadUrl: "/api/templates/payment-agreement",
    },
    puppy_application: {
      name: "Puppy Application",
      description: "Opening statement shown on the downloadable customer application.",
      content: "Thank you for considering Southwest Virginia Chihuahua. This application helps us evaluate safety, care readiness, household fit, and puppy preferences. Submission does not guarantee approval or reserve a puppy.",
      enabled: true,
      downloadUrl: "/api/templates/puppy-application",
    },
  },
  emails: {
    application_received: {
      name: "Application received",
      trigger: "Sent when a new family/application record is submitted or added.",
      subject: "We received your puppy application",
      body: "Hi {{first_name}},\n\nThank you for submitting your puppy application to {{business_name}}. We have received it and will review your information. We will contact you if we need anything else.\n\nQuestions? Reply to this email or call {{support_phone}}.\n\n{{business_name}}",
      enabled: true,
    },
    application_approved: {
      name: "Application approved",
      trigger: "Sent when an application is approved.",
      subject: "Your puppy application is approved",
      body: "Hi {{first_name}},\n\nYour application with {{business_name}} has been approved. We are excited to continue helping you with puppy selection and placement.\n\nWe will follow up with the next steps.\n\n{{business_name}}",
      enabled: true,
    },
    payment_receipt: {
      name: "Payment receipt",
      trigger: "Sent when a payment or deposit is saved with Paid status.",
      subject: "Payment received — {{amount}}",
      body: "Hi {{first_name}},\n\nWe received your payment of {{amount}}{{puppy_context}}. Thank you. This payment is now recorded in your family account.\n\n{{business_name}}",
      enabled: true,
    },
    payment_reminder: {
      name: "Payment reminder",
      trigger: "Sent automatically each morning for payments due or overdue, once per due item per day.",
      subject: "Payment reminder — {{amount}} due {{due_date}}",
      body: "Hi {{first_name}},\n\nThis is a reminder that {{amount}} is due {{due_date}}{{puppy_context}}. If you have already made this payment, please disregard this message.\n\nReply to this email if you need help.\n\n{{business_name}}",
      enabled: true,
    },
    puppy_update: {
      name: "Puppy update published",
      trigger: "Sent when a connected puppy update is published.",
      subject: "New update for {{puppy_name}}: {{update_title}}",
      body: "Hi {{first_name}},\n\nA new update for {{puppy_name}} is available: {{update_title}}.\n\nOpen your private puppy portal to see the latest information: {{portal_url}}\n\n{{business_name}}",
      enabled: true,
    },
    contract_ready: {
      name: "Contracts ready",
      trigger: "Sent when a Bill of Sale, Health Guarantee, or combined production agreement is prepared.",
      subject: "Your puppy agreement is ready to review",
      body: "Hi {{first_name}},\n\nYour puppy agreement is ready. Please review every page and sign it using your private link:\n\n{{portal_url}}\n\nContact us before signing if any information needs to be corrected.\n\n{{business_name}}",
      enabled: true,
    },
    contract_signed: {
      name: "Contract signed confirmation",
      trigger: "Sent after a customer signs an agreement in the puppy portal.",
      subject: "Signed agreement received",
      body: "Hi {{first_name}},\n\nWe received your signed agreement. A retained copy remains available in your private puppy portal:\n\n{{portal_url}}\n\nThank you,\n{{business_name}}",
      enabled: true,
    },
    portal_sign_in: {
      name: "Puppy Portal sign-in",
      trigger: "Sent when a customer requests secure access to their Puppy Portal.",
      subject: "Your secure Puppy Portal sign-in link",
      body: "Hi {{first_name}},\n\nUse the secure link below to sign in to your Puppy Portal. This link expires shortly and should not be forwarded.\n\n{{access_link}}\n\nIf you did not request this link, you can ignore this email.\n\nQuestions? Reply to this email or call {{support_phone}}.\n\n{{business_name}}",
      enabled: true,
    },
  },
};

export function mergeTemplatesConfig(value: unknown): TemplatesConfig {
  const incoming = value && typeof value === "object" ? value as Partial<TemplatesConfig> : {};
  const documentInput = (incoming.documents && typeof incoming.documents === "object" ? incoming.documents : {}) as Partial<Record<DocumentTemplateKey, Partial<DocumentTemplate>>>;
  const emailInput = (incoming.emails && typeof incoming.emails === "object" ? incoming.emails : {}) as Partial<Record<EmailTemplateKey, Partial<EmailTemplate>>>;
  const documents = { ...defaultTemplatesConfig.documents };
  const emails = { ...defaultTemplatesConfig.emails };

  for (const key of Object.keys(documents) as DocumentTemplateKey[]) {
    const item = documentInput[key];
    if (!item || typeof item !== "object") continue;
    documents[key] = {
      ...documents[key],
      name: String(item.name ?? documents[key].name).slice(0, 120),
      description: String(item.description ?? documents[key].description).slice(0, 600),
      content: String(item.content ?? documents[key].content).slice(0, 100_000),
      enabled: item.enabled !== false,
    };
  }
  for (const key of Object.keys(emails) as EmailTemplateKey[]) {
    const item = emailInput[key];
    if (!item || typeof item !== "object") continue;
    emails[key] = {
      ...emails[key],
      name: String(item.name ?? emails[key].name).slice(0, 120),
      trigger: String(item.trigger ?? emails[key].trigger).slice(0, 600),
      subject: String(item.subject ?? emails[key].subject).replace(/[\r\n]+/g, " ").slice(0, 250),
      body: String(item.body ?? emails[key].body).slice(0, 50_000),
      enabled: item.enabled !== false,
    };
  }
  return { version: 1, updatedAt: String(incoming.updatedAt ?? ""), documents, emails };
}
