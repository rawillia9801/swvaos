export {};

declare module "../lib/email-service" {
  export function sendOwnerNotification(input: {
    category?: "Application" | "Contract" | "Document" | "Message" | "General" | "Transportation";
    subject: string;
    body: string;
    buyerId?: number | null;
  }): Promise<{
    sent: boolean;
    messageId?: string;
    skipped?: string;
  }>;
}
