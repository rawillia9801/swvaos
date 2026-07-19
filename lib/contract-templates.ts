export const billOfSaleTerms = [
  "The buyer agrees to purchase the puppy identified above for the stated purchase price. Payments already received are credited toward the balance shown in this agreement.",
  "Ownership and possession transfer only after required funds have cleared and the puppy is released to the buyer. Any separate written payment plan remains part of the parties' agreement.",
  "The buyer acknowledges receiving the puppy information available in SWVAOS, including known health, care, and identification records connected to this puppy at the time of transfer.",
  "The buyer is responsible for future veterinary care, licensing, housing, nutrition, training, transportation, and compliance with applicable local laws after transfer.",
  "Any promise about registration, breeding rights, transportation, or included supplies must be written in this agreement or another signed document to be enforceable between the parties.",
  "The parties consent to electronic records and electronic signatures. This document, its frozen terms, signature timestamp, and audit record form the retained copy of the agreement.",
];

export function healthGuaranteeTerms(examHours: number, guaranteeMonths: number) {
  return [
    `The buyer must have the puppy examined by a licensed veterinarian within ${examHours} hours after taking possession. Failure to complete the examination within that period may limit remedies under this guarantee.`,
    `The seller provides a ${guaranteeMonths}-month limited guarantee against a life-threatening congenital or hereditary condition that is diagnosed in writing by a licensed veterinarian and was present before transfer.`,
    "The buyer must notify the seller promptly, provide complete veterinary records, and allow the seller a reasonable opportunity to obtain a second veterinary opinion before any remedy is determined.",
    "This guarantee does not cover routine parasites, minor or treatable conditions, injury, neglect, poisoning, improper nutrition, failure to follow veterinary instructions, or illness caused after transfer by exposure or environment.",
    "Unless a different written remedy is agreed upon, an approved claim is limited to a replacement puppy of comparable value when available. Veterinary expenses are not reimbursed unless the seller authorized them in writing before treatment.",
    "The buyer agrees to provide appropriate preventive care, vaccinations, nutrition, shelter, and timely veterinary treatment throughout the puppy's life.",
    "The parties consent to electronic records and electronic signatures. This document, its frozen terms, signature timestamp, and audit record form the retained copy of the guarantee.",
  ];
}
