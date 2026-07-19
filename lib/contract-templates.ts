import { contractNotice, contractSection } from "./contract-format.ts";

export const billOfSaleTerms = [
  "The buyer agrees to purchase the puppy identified above for the stated purchase price. Payments already received are credited toward the balance shown in this agreement.",
  "Ownership and possession transfer only after required funds have cleared and the puppy is released to the buyer. Any separate written payment plan remains part of the parties' agreement.",
  "The buyer acknowledges receiving the puppy information available in SWVAOS, including known health, care, and identification records connected to this puppy at the time of transfer.",
  "The buyer is responsible for future veterinary care, licensing, housing, nutrition, training, transportation, and compliance with applicable local laws after transfer.",
  "Any promise about registration, breeding rights, transportation, or included supplies must be written in this agreement or another signed document to be enforceable between the parties.",
  "The parties consent to electronic records and electronic signatures. This document, its frozen terms, signature timestamp, and audit record form the retained copy of the agreement.",
];

export const virginiaConsumerNotice = `NOTICE

The sale of dogs and cats is subject to the provisions of the Virginia Consumer Protection Act (§ 59.1-196 et seq.). In the event that a licensed veterinarian certifies your animal to be unfit for purchase within 10 days following receipt of your animal, or within 14 days following receipt if the animal is infected with parvovirus, you may choose: (i) to return your animal, or in the case of an animal that has died, the veterinary certification, and receive a refund of the purchase price including sales tax; or (ii) to return the animal and receive an exchange animal of your choice of equivalent value. In the case of an animal purchased from a pet shop or a USDA licensed dealer, you also may choose to retain the animal and receive reimbursement of the cost of veterinary certification and veterinary fees in an amount up to the purchase price of the animal.

In order to exercise these rights you must present a written veterinary certification that the animal is unfit to the pet dealer within three business days after receiving such certification.

If the pet dealer has promised to register your animal or to provide the papers necessary therefor and fails to do so within 120 days following the date of contract, you are entitled to return the animal and receive a refund of the purchase price or to retain the animal and receive a refund of an amount not to exceed 50 percent of the purchase price.`;

const period = (hours: number) => {
  const safeHours = Math.min(336, Math.max(1, Math.round(hours) || 240));
  return safeHours % 24 === 0 ? `${safeHours / 24} calendar days` : `${safeHours} hours`;
};

export function healthGuaranteeTerms(examHours: number, guaranteeMonths: number, microToy = false) {
  const examPeriod = period(examHours);
  const safeMonths = Math.min(120, Math.max(1, Math.round(guaranteeMonths) || 12));
  const terms = [
    contractSection("Initial health guarantee"),
    "Southwest Virginia Chihuahua LLC (Seller) certifies that, at the time of transfer, the puppy identified in this agreement is believed to be free from known contagious or infectious disease and known serious congenital defects, except for any condition expressly disclosed to the Buyer in writing.",
    "The Seller will provide the Buyer with available written records of vaccinations, deworming, veterinary examinations, medications, and other veterinary care administered to the puppy before transfer.",
    "This initial health guarantee applies only to a qualifying condition that existed at the time of transfer. It does not cover an illness, infection, parasite, injury, or other condition contracted, sustained, caused, or materially aggravated after the puppy leaves the Seller's possession.",
    `The Buyer must arrange for the puppy to be examined by a licensed veterinarian of the Buyer's choosing within ${examPeriod} after taking possession. The Buyer is responsible for this examination and related services. Failure to obtain the examination may affect only the Seller's voluntary guarantee; it does not shorten or waive any nonwaivable right stated in the Virginia Consumer Notice below.`,
    "If the veterinarian identifies a potentially qualifying condition, the Buyer must notify the Seller promptly in writing and provide the complete findings, diagnosis, medical records, diagnostic tests, laboratory results, imaging, treatment recommendations, and other supporting documentation. When permitted by law, the Seller may have the diagnosis and records reviewed by a licensed veterinarian or appropriate specialist of the Seller's choosing.",
    "Except when reimbursement is expressly required by applicable law or authorized by the Seller in writing before the expense is incurred, the Seller does not pay or reimburse veterinary examinations, emergency services, hospitalization, diagnostic testing, medication, vaccination, treatment, surgery, transportation, or other expenses incurred by the Buyer.",

    contractSection(`Voluntary ${safeMonths}-month congenital and hereditary defect guarantee`),
    microToy
      ? "This puppy is expressly designated as a Micro-Toy Puppy. The voluntary congenital and hereditary defect guarantee in this section does not apply, subject always to the Buyer's nonwaivable statutory rights described in the Virginia Consumer Notice."
      : `This puppy is not designated as a Micro-Toy Puppy. The Seller provides a voluntary ${safeMonths}-month guarantee beginning on the date the Buyer takes possession of the puppy.`,
    "For a condition to qualify under this voluntary guarantee, it must be life-threatening or significantly impair the puppy's health or quality of life; be diagnosed during the stated guarantee period; be verified in writing by a licensed veterinarian; be supported by appropriate diagnostic testing, imaging, laboratory results, or specialist evaluation; and be determined to have been present from birth rather than caused or materially aggravated after transfer.",
    "Potentially qualifying conditions may include a severe congenital cardiac defect, serious congenital neurological disorder, or significant congenital structural deformity that satisfies every requirement of this voluntary guarantee.",
    "The voluntary guarantee does not cover minor underbites or overbites, retained baby teeth, minor dental irregularities, small or reducible umbilical hernias, inguinal hernias not diagnosed before transfer, a non-impairing open fontanel or molera, grade 1 or grade 2 patellar luxation, retained testicles, minor cosmetic imperfections, or characteristics involving coat, markings, ear carriage, size, height, weight, or physical appearance.",
    "The voluntary guarantee also does not cover fertility, reproductive or show potential, allergies or food sensitivities, hypoglycemia, dehydration, malnutrition, failure to maintain proper body condition, routine parasites, behavioral or training concerns, or a condition caused or materially aggravated by injury, poisoning, foreign-object ingestion, accident, trauma, neglect, improper nutrition, missed meals, excessive exercise, unsafe temperatures, preventable exposure, breeding, or failure to obtain veterinary treatment.",
    "Giardia, coccidia, kennel cough, parvovirus, and other infections or parasites contracted after transfer are not covered by the voluntary guarantee. This exclusion does not restrict the Buyer's statutory remedies when a veterinarian timely certifies the puppy unfit for purchase under applicable Virginia law.",
    "A condition is not automatically excluded solely because it is common in Chihuahuas or toy breeds. An exclusion applies when the condition is mild, cosmetic, non-life-threatening, does not significantly impair quality of life, arose after transfer, or otherwise fails to satisfy the requirements of this voluntary guarantee.",
    "The Buyer must provide a complete written diagnosis and all relevant records and must reasonably cooperate with claim verification and authorization for release of relevant veterinary records. The Seller may request confirmation from another licensed veterinarian or specialist before approving a voluntary claim.",
    "If a qualifying condition is confirmed, the Seller will provide either a replacement puppy of reasonably equivalent value from the next reasonably available litter or a partial refund of the original purchase price reasonably based on the nature and severity of the condition. The Seller may select the voluntary remedy after reviewing the records and circumstances. These voluntary remedies do not replace a remedy the Buyer is legally entitled to select under applicable law.",
    "The maximum voluntary remedy will not exceed the puppy's original purchase price. Transportation, delivery, financing, administrative charges, supplies, sales tax, and third-party expenses are excluded unless applicable law requires otherwise. A replacement is subject to availability and does not guarantee a particular sex, color, coat, parentage, litter, size, or delivery date.",
    "The voluntary guarantee covers the replacement value of the puppy only. It does not reimburse veterinary examinations, emergency care, diagnostic testing, hospitalization, medication, surgery, treatment, specialists, transportation, boarding, lost income, emotional distress, consequential damages, or incidental expenses unless payment is expressly required by applicable law.",
  ];

  if (microToy) {
    terms.push(
      contractSection("Micro-Toy puppy designation and voluntary exclusion"),
      "Micro-Toy is a descriptive term used by the Seller and is not a separate breed, variety, or size classification recognized by the American Kennel Club, Continental Kennel Club, American Canine Association, or another registry. The Seller does not guarantee adult weight, height, body structure, mature appearance, breeding suitability, show suitability, or continued qualification under an estimated size description.",
      "The Buyer understands that an exceptionally small puppy may have increased susceptibility to hypoglycemia, dehydration, difficulty maintaining caloric intake, delayed development, temperature instability, stress-related illness, fragile bones, open fontanel or molera, dental crowding, patellar luxation, congenital or developmental abnormalities, seizures, medication or anesthesia sensitivity, infection, sudden decline, or death despite appropriate care.",
      "The Buyer voluntarily accepts these increased risks and care responsibilities. No voluntary extended refund, replacement, purchase-price credit, reimbursement, or veterinary-expense payment applies to a designated Micro-Toy Puppy. This exclusion applies only to the Seller's voluntary guarantees and does not eliminate or restrict a right or remedy that cannot legally be waived.",
    );
  }

  terms.push(
    contractSection("Buyer responsibilities and required care"),
    "The Buyer assumes responsibility for the puppy's physical, emotional, nutritional, environmental, and medical care upon transfer and will provide clean water, appropriate small-breed puppy food, meals at the frequency directed, safe temperature-controlled indoor housing, warmth, rest, supervised socialization, safe transportation, routine veterinary care, age-appropriate vaccination and deworming, parasite prevention, and prompt emergency treatment.",
    "Because Chihuahuas and exceptionally small puppies can be prone to hypoglycemia, the Buyer will follow all individualized feeding instructions, offer frequent meals, monitor food and water intake, and prevent prolonged fasting, particularly during the first two weeks at home and during travel, stress, illness, vaccination, environmental change, or decreased appetite.",
    microToy
      ? "This designated Micro-Toy Puppy may require feeding approximately every two-and-one-half to three hours, including overnight, depending on age, condition, veterinary advice, and individualized written instructions. The puppy must not be left unattended for a period that interferes with feeding, monitoring, warmth, supervision, or medical needs."
      : "The Buyer will follow any individualized written feeding schedule provided at transfer and will not leave the puppy unattended for a period that interferes with feeding, monitoring, warmth, supervision, or medical needs.",
    "Lethargy, weakness, trembling, staggering, confusion, unusual sleepiness, refusal to eat, vomiting, diarrhea, seizure activity, collapse, or other distress requires an immediate response. A sugar source may be used only as a temporary emergency measure when appropriate; it is not a substitute for immediate veterinary diagnosis and treatment.",
    "Until a licensed veterinarian confirms that the puppy has completed the appropriate vaccination series and may safely enter public areas, the Buyer will avoid high-risk surfaces and locations, including pet stores, dog parks, public parks, rest areas, veterinary waiting-room floors, grooming facilities, shared animal-relief areas, shelters, kennels, and places where unknown, sick, or unvaccinated animals may have been present.",
    "The Buyer will protect the puppy from falls, jumping from furniture, crushing, rough handling, unsafe play, unsupervised children, larger animals, loose vehicle travel, unattended outdoor access, extreme temperatures, unsafe crates or elevated locations, abuse, neglect, and other hazardous conditions.",

    contractSection("Limitations, claim continuation, and nonwaivable rights"),
    "Except for an obligation imposed by law, the Seller is not responsible for a condition or death caused or materially aggravated after transfer by hypoglycemia, dehydration, inadequate meals, improper food changes, nutritional deficiency, unsafe temperatures, stress, trauma, accidents, another person or animal, contaminated environments, incomplete preventive care, toxins, unsafe foods, medication, foreign objects, delayed treatment, failure to follow written care instructions, neglect, abuse, breeding, pregnancy, whelping, or reproductive complications.",
    "The Seller does not guarantee adult size, mature weight, height, coat length, coat color, markings, ear carriage, bite, temperament, fertility, reproductive ability, show quality, or breeding success unless a specific guarantee is written into this agreement. A size or weight prediction is an estimate, not a warranty.",
    "The Seller certifies that the puppy received the age-appropriate preventive care documented in the records provided at transfer. Vaccination does not guarantee complete immunity or that the puppy cannot contract an infectious disease after transfer.",
    "The voluntary guarantee may be denied only to the extent the Buyer's failure to obtain the required examination, provide appropriate care, obtain timely treatment, follow written instructions, provide requested records, or truthfully cooperate caused or materially aggravated the claimed condition or materially prevents reasonable verification of the claim. This limitation does not eliminate any right that cannot legally be waived.",
    "The Buyer acknowledges receipt of or access to the puppy's available health information, preventive-care records, feeding instructions, hypoglycemia guidance, safety instructions, and other applicable care information. The Buyer accepts responsibility for the puppy's care, supervision, safety, and welfare from transfer.",
    "This Health Guarantee is the complete agreement concerning the Seller's health commitments and supersedes prior statements on that subject. A modification must be in writing and signed by both parties. If a provision is invalid or unenforceable, it will be enforced to the greatest lawful extent and the remaining provisions will continue. Virginia law governs this agreement.",

    contractSection("Virginia consumer notice"),
    contractNotice(virginiaConsumerNotice),

    contractSection("Buyer acknowledgment and electronic records"),
    "By signing, the Buyer confirms that the Buyer reviewed this complete Health Guarantee; the available health and preventive-care records; feeding, hypoglycemia, safety, and emergency-care instructions; voluntary guarantee limitations and exclusions; the Micro-Toy designation and exclusion when applicable; and the Virginia Consumer Notice, and had an opportunity to ask questions before signing.",
    "The parties agree that this exact document may be retained and signed electronically. The Buyer's separately recorded electronic-consent checkbox, typed legal name, signature timestamp, network information, document terms, and audit hash form the retained signature record. Nothing in this agreement requires the Buyer to surrender a right or remedy that cannot lawfully be waived.",
  );

  return terms;
}
