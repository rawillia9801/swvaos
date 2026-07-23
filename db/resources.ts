export type ResourceName = "dogs" | "dog_medical_records" | "dog_registrations" | "litters" | "buyers" | "puppies" | "payment_plans" | "transactions" | "events" | "updates";
export type ResourceInput = Record<string, unknown>;

export class ResourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceValidationError";
  }
}

const resources: ResourceName[] = ["dogs", "dog_medical_records", "dog_registrations", "litters", "buyers", "puppies", "payment_plans", "transactions", "events", "updates"];

export function isResource(value: unknown): value is ResourceName {
  return typeof value === "string" && resources.includes(value as ResourceName);
}
