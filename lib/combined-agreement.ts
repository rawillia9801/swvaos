import { CONTRACT_NOTICE_PREFIX, CONTRACT_SECTION_PREFIX, contractNotice, contractSection } from "./contract-format";
import { virginiaConsumerNotice } from "./contract-templates";

export type CombinedAgreementDetails = {
  agreementNumber?: string;
  agreementDate?: string;
  coBuyerName?: string;
  buyerStreetAddress?: string;
  buyerCityStateZip?: string;
  buyerEmergencyContact?: string;
  puppyAgeAtTransfer?: string;
  puppyCoatType?: string;
  puppyCurrentWeight?: string;
  estimatedAdultSize?: string;
  microchipNumber?: string;
  registry?: string;
  registrationNumber?: string;
  litterInternalId?: string;
  bredBySeller?: boolean;
  acquiredFrom?: string;
  sireRegistrationNumber?: string;
  damRegistrationNumber?: string;
  knownConditions?: string;
  healthRecordStatus?: string;
  careGuideStatus?: string;
  registrationDocumentsStatus?: string;
  microchipInstructionsStatus?: string;
  insuranceInformationStatus?: string;
  knownConditionDisclosureStatus?: string;
  transportInstructionsStatus?: string;
  salesTaxCents?: number;
  transportCents?: number;
  otherChargesCents?: number;
  reservationCreditCents?: number;
  additionalPaymentsCents?: number;
  paymentMethod?: string;
  transferMethod?: string;
  transferLocation?: string;
  transferTime?: string;
  recipientName?: string;
  appetiteAtTransfer?: string;
  stoolParasiteHistory?: string;
  respiratoryFindings?: string;
  skinCoatFindings?: string;
  biteTeethHerniaFindings?: string;
  patellaGaitFindings?: string;
  medicationSupplement?: string;
  otherHealthDisclosure?: string;
  firstVetClinic?: string;
  firstVetName?: string;
  firstVetAppointment?: string;
  firstVetPhone?: string;
  firstVetFindingsStatus?: string;
  insuranceSelection?: string;
  registrationStatus?: string;
  registrationType?: string;
  registryPromised?: string;
  registrationDueDate?: string;
  spayNeuterTerm?: string;
  breedingAddendum?: string;
  buyerNoticeMethod?: string;
  sellerRepresentative?: string;
  attachments?: string;
  specialFeedingInstructions?: string;
};

export const combinedAgreementTerms = [
  contractSection("1. Parties, purpose, and effective date"),
  "This Puppy Bill of Sale, Animal History Certificate, and One-Year Limited Health Guarantee (Agreement) is entered into by Southwest Virginia Chihuahua LLC, Marion, Virginia (Seller), and the Buyer or Buyers identified in the completed agreement (collectively, Buyer). The Agreement becomes effective when electronically signed by the Buyer and issued by the Seller through SWVAOS. Ownership and risk of loss transfer only as stated below.",
  "This Agreement replaces prior oral discussions concerning the final sale, health coverage, registration, ownership, and post-transfer obligations. A separate Deposit and Reservation Agreement or Payment Plan and Financing Agreement remains controlling on subjects expressly assigned to that document.",

  contractSection("2. Puppy identification and animal history"),
  "The puppy description, parent information, available veterinary findings, vaccination and medication history, registry information, microchip information, and written disclosures shown in this Agreement and its retained records are incorporated into the sale. The Buyer confirms that the Buyer reviewed the completed identifying information before signing.",
  "The Seller will disclose known material conditions, findings, medications, special feeding needs, and other information reasonably relevant to the puppy at transfer. The animal history information is provided to the best of the Seller's knowledge and based on available records.",

  contractSection("3. Purchase price, taxes, credits, and payment"),
  "Unless a separate signed payment-plan agreement expressly permits post-transfer financing, all amounts required before transfer must be paid and cleared before the puppy is released. A pending, reversed, disputed, stopped, or rejected payment is not considered paid. A legitimate dispute of an unauthorized or erroneous transaction is not prohibited.",
  "Deposits and reservation payments are governed by the separate Deposit and Reservation Agreement. Transport, delivery, administrative, financing, boarding, supplies, and other separately itemized charges are not part of the puppy purchase price for purposes of the voluntary one-year guarantee unless applicable law requires otherwise.",
  "The payment summary shown in this Agreement is based on transactions recorded in SWVAOS and any corrections entered by the Seller before generation. The Buyer must report a material payment discrepancy before signing.",

  contractSection("4. Transfer of ownership, possession, and risk"),
  "Transfer occurs when the puppy is physically delivered to the Buyer or the Buyer's authorized transporter, the required sale documents are signed, and all amounts required before transfer have cleared.",
  "From transfer forward, the Buyer assumes responsibility for supervision, feeding, housing, transportation, veterinary care, licensing, safety, and ordinary expenses, subject to the statutory and contractual health remedies stated in this Agreement.",
  "The Seller may delay transfer when the Seller reasonably believes additional time is needed for safe weaning, stable eating, weight maintenance, vaccination timing, veterinary care, or the welfare of a very small puppy.",
  "No financing default automatically transfers ownership back to the Seller or authorizes forcible self-help repossession. Any surrender or return after transfer must be voluntary and documented in writing or accomplished through lawful process.",

  contractSection("5. Seller health representations and disclosures"),
  "To the Seller's knowledge on the transfer date, and subject to all written disclosures, the puppy is alert and suitable for transfer, is eating as represented, and has received the age-appropriate care identified in the retained health record. The Seller does not knowingly conceal an infection, communicable disease, parasitic infestation, abnormality, or physical defect.",
  "The Seller's statements are based on the puppy's known history, observation, available veterinary information, and disclosed testing. No breeder can promise that a living animal will never become ill or develop a condition after transfer. Except for the express promises in this Agreement and rights imposed by law, no additional oral, implied, or future-health warranty is made.",

  contractSection("6. Virginia statutory consumer notice"),
  contractNotice(virginiaConsumerNotice),
  "A veterinary certification presented for statutory remedies must contain the information required by Virginia law. A finding of intestinal parasites alone does not make the puppy unfit unless the puppy is clinically ill because of the parasites. Injury or illness contracted after possession does not qualify as a pre-sale condition.",
  "Nothing in this Agreement shortens, eliminates, or conditions a statutory remedy that cannot legally be waived. If a conflict exists between a non-waivable law and this Agreement, the law controls.",

  contractSection("7. Prompt veterinary examination"),
  "The Buyer agrees to arrange an examination by a licensed veterinarian within 72 hours after receiving the puppy, excluding a day when the chosen clinic is closed. This prompt examination supports early care and the voluntary initial-health portion of this Agreement.",
  "The Buyer must provide the veterinarian with the puppy's health record and disclose the puppy's age, size, transfer date, feeding schedule, and any known symptoms.",
  "The Buyer should notify the Seller promptly of a serious concern and provide the complete written veterinary record. For a statutory unfit-for-purchase claim, the Buyer must comply with the statutory deadline stated in the Virginia Consumer Notice.",
  "Failure to obtain the 72-hour examination may limit the voluntary initial-health coverage for a condition that a timely examination probably would have discovered. It does not eliminate a non-waivable statutory right and does not automatically eliminate the one-year congenital guarantee unless the delay materially caused or worsened the condition or prevented reliable diagnosis.",
  "Emergency treatment must never be delayed to contact the Seller. The Buyer shall obtain necessary care first and notify the Seller as soon as reasonably possible.",

  contractSection("8. One-year limited congenital and hereditary health guarantee"),
  "The voluntary guarantee begins when the Buyer takes possession and ends at 11:59 p.m. local time on the first anniversary of that transfer date. A diagnosis must be made within the guarantee period, and the Buyer must begin the claim process stated below.",
  "This guarantee covers a severe congenital or hereditary defect that was present at birth or resulted from an inherited abnormality; is diagnosed by a licensed veterinarian and supported by appropriate diagnostic evidence; is life-threatening, requires major corrective treatment, or substantially and permanently impairs the dog's normal quality of life; and was not caused or materially worsened by trauma, neglect, inadequate nutrition, infection acquired after transfer, toxin exposure, inappropriate exercise, breeding, or another excluded cause.",
  "Examples that may qualify when severe and properly documented include major congenital cardiac defects, serious inherited neurological disease, severe structural malformation, or another congenital or hereditary disorder that meets every requirement above. Naming a condition does not guarantee coverage without diagnosis, causation, severity, and timely documentation.",

  contractSection("9. One-year guarantee claim procedure"),
  "The Buyer must notify the Seller in writing within five business days after receiving the diagnosis, and before elective euthanasia or non-emergency major corrective surgery whenever medically reasonable. This five-day term applies to the voluntary one-year guarantee and does not replace the shorter statutory notice period for a Virginia unfit-for-purchase claim.",
  "The Buyer must provide the complete medical record, laboratory results, imaging, treatment plan, prognosis, itemized invoices, and a written statement identifying why the veterinarian believes the condition is congenital or hereditary.",
  "For a cardiac, neurological, orthopedic, ophthalmic, hepatic, or other specialized diagnosis, the Seller may reasonably require confirmation by a board-certified veterinary specialist or a veterinarian with appropriate advanced experience.",
  "The Buyer authorizes the Seller to communicate directly with the treating veterinarian and obtain relevant records. The Seller may request a second opinion at the Seller's expense. If the veterinarians materially disagree, the parties may jointly select a third veterinarian and share that examination cost unless they agree otherwise.",
  "The Buyer must continue medically appropriate care while the claim is reviewed. The Buyer remains responsible for treatment decisions and expenses unless the parties sign a different written agreement or applicable law requires reimbursement.",
  "After an unexplained death, the Buyer should not dispose of the body until the Seller has had a reasonable opportunity to request a necropsy, unless immediate disposition is required by law, public health, veterinary instruction, or practical necessity.",

  contractSection("10. Remedies under the one-year guarantee"),
  "After a covered claim is verified, the Seller will provide either a replacement puppy of reasonably comparable value from a suitable future litter, generally within 18 months after claim approval, or a purchase-price refund or credit up to the puppy purchase price actually paid. The Seller selects the voluntary remedy after considering availability, diagnosis, prognosis, the Buyer's preference, and the welfare of the dog.",
  "A replacement need not have identical sex, color, coat, size, parentage, registry, or delivery date. The Buyer is responsible for future transport or delivery unless agreed otherwise in writing.",
  "A refund or credit excludes transport, delivery, financing charges, administrative fees, supplies, boarding, and optional services unless applicable law requires a different calculation.",
  "The Seller may condition a voluntary refund or replacement on return of the living dog if return is humane and lawful. If the dog has died or was euthanized on veterinary advice, the Seller may require a necropsy report and proof of death instead of return. The Seller does not require return when a veterinarian states that transport would be medically unsafe.",
  "The total voluntary remedy will not exceed the puppy purchase price actually paid. Veterinary bills, emergency fees, medications, specialist fees, surgery, travel, lost income, emotional distress, supplies, and incidental or consequential expenses are not reimbursed under the voluntary one-year guarantee unless the Seller agrees in writing or applicable law requires otherwise.",
  "A replacement puppy is subject to a new written agreement and current placement requirements. No cash difference is due solely because a future puppy has a higher advertised price; if the Buyer chooses a more expensive puppy, the parties may agree in writing to the difference.",

  contractSection("11. Conditions and events not covered by the voluntary guarantee"),
  "The voluntary guarantee does not cover an illness, injury, or infection contracted after transfer, including exposure to parvovirus, distemper, kennel cough, influenza, parasites, coccidia, giardia, or contaminated environments after the puppy leaves the Seller's care.",
  "Common and treatable intestinal or external parasites are not covered unless the puppy was clinically ill from the condition at sale and a statutory remedy applies.",
  "Hypoglycemia, dehydration, malnutrition, missed meals, abrupt food changes, chilling, overheating, stress, or failure to follow age- and size-appropriate feeding and supervision instructions are not covered.",
  "Trauma, falls, rough handling, being stepped or sat on, ingestion of a foreign object or toxin, attack or injury by another animal, vehicle injury, escape, theft, or unsafe confinement are not covered.",
  "Failure to obtain timely veterinary care, failure to follow a reasonable treatment plan, use of unlicensed treatment, or medication not prescribed for the puppy is not covered.",
  "Conditions caused or materially worsened by breeding, pregnancy, whelping, inappropriate exercise, obesity, inadequate conditioning, or a preventable environmental factor are not covered.",
  "Cosmetic, mild, or non-life-threatening variations are not covered, including minor underbite or overbite, retained puppy teeth, a small reducible umbilical hernia, grade 1 or grade 2 patellar luxation without major functional impairment, ear carriage, tear staining, coat length or texture, color change, size, or conformation preferences.",
  "Undescended testicle, fertility, ability to breed, litter size, show success, working ability, adult temperament, or breeding outcome is not covered unless a separate signed breeding-rights addendum expressly guarantees that matter.",
  "Allergy, sensitivity, elective procedure, routine dental care, spay or neuter expense, vaccination reaction, or an adverse event not shown to result from a covered congenital or hereditary defect is not covered.",
  "A Buyer's failure does not void the entire guarantee unless the failure materially caused or worsened the claimed condition, prevented a reliable diagnosis, or substantially prejudiced the Seller's ability to evaluate the claim. This causation-based rule does not limit statutory rights.",

  contractSection("12. Buyer care and welfare obligations"),
  "The Buyer accepts responsibility for humane lifelong care and will provide a safe indoor home, clean water, age-appropriate high-quality food, proper warmth, secure confinement, and close supervision.",
  "The Buyer will maintain a consistent feeding schedule, monitor intake and weight, and promptly respond to refusal to eat, vomiting, diarrhea, lethargy, weakness, trembling, disorientation, respiratory distress, or other warning signs.",
  "The Buyer will establish a relationship with a licensed veterinarian and obtain vaccinations, deworming, parasite prevention, dental care, wellness examinations, and emergency treatment based on veterinary advice.",
  "The Buyer will protect the puppy from falls, high furniture, stairs, rough play, children who cannot safely handle a toy-breed puppy, larger animals, open doors, unsecured yards, extreme temperatures, and vehicle hazards.",
  "The Buyer will use safe transport restraint, never leave the puppy unattended in a vehicle or outside, comply with applicable animal-care laws, and inform future veterinarians of the dog's small size, known history, and any prior reaction or medical concern.",

  contractSection("13. Toy and Micro-Toy safety acknowledgment"),
  "Southwest Virginia Chihuahua does not guarantee a specific adult weight and does not represent micro, teacup, or toy as a separate registry-recognized Chihuahua variety. When a puppy is described as especially small, the description concerns current size or estimated growth only.",
  "If the puppy is designated by the Seller as very small, toy, or Micro-Toy, the Buyer acknowledges the need for additional precautions, including frequent meals, continuous access to appropriate food as directed, careful temperature control, restricted access to stairs and elevated furniture, immediate response to appetite loss or weakness, and delayed transfer until the Seller believes the puppy is maintaining weight and eating safely.",
  "The Buyer understands that hypoglycemia can progress rapidly. Home sugar products or nutritional gels are emergency first aid only and are not substitutes for veterinary care. A weak, unresponsive, seizing, repeatedly vomiting, or non-eating puppy requires immediate veterinary attention.",

  contractSection("14. Vaccination, parasite prevention, and exposure"),
  "The Seller will provide a record of vaccines, dewormers, and known treatment given before transfer. The Buyer shall show that record to the veterinarian and avoid unnecessary duplicate vaccination.",
  "Until the veterinarian confirms adequate vaccination protection, the Buyer should avoid dog parks, pet-store floors, shared relief areas, high-traffic sidewalks, unknown dogs, and locations where unvaccinated or ill animals may have been.",
  "No vaccine provides an absolute guarantee of immunity. The Seller is not responsible for infection acquired after transfer, but statutory rights concerning a disease present at sale remain unaffected.",
  "A positive parasite test does not necessarily prove pre-sale infection because parasites can be intermittent, environmentally acquired, and common in young puppies. Claims are evaluated using timing, symptoms, records, and applicable law.",

  contractSection("15. Complimentary pet insurance or trial coverage"),
  "Any complimentary insurance or trial offer identified in the completed agreement is provided by the insurance company, not by the Seller. The Buyer is responsible for activating coverage by the insurer's deadline, reviewing exclusions and waiting periods, maintaining premiums after the trial, and submitting claims. The Seller is not the insurer and does not guarantee eligibility, continuation, reimbursement, or claim approval. Insurance does not replace this Agreement or veterinary care.",

  contractSection("16. Registration, pedigree documents, and breeding rights"),
  "If the Seller promises registration or documents necessary for registration, the Seller will provide or effect them within the time required by Virginia law. Registration identifies pedigree eligibility; it does not guarantee show quality, breeding quality, fertility, adult size, temperament, or freedom from every inherited condition.",
  "Unless full registration or breeding rights are expressly selected in the completed agreement and any required addendum is signed, the puppy is sold as a companion with no representation that breeding is authorized. A Buyer who breeds without required written rights may lose voluntary guarantee benefits for conditions caused or worsened by breeding, but ownership does not automatically revert and no self-help seizure is authorized.",

  contractSection("17. No guarantee of adult size, appearance, temperament, or performance"),
  "Adult weight, height, coat, color, ear set, bite, body structure, temperament, trainability, show result, and breeding result are influenced by genetics, nutrition, health, environment, training, and development. Any estimate is a good-faith opinion, not a promise. The Seller does not guarantee that the dog will remain under a particular weight or meet a Buyer's subjective preference.",

  contractSection("18. Rehoming, return, resale, and shelter surrender"),
  "If the Buyer cannot keep the dog at any age, the Buyer must notify the Seller before advertising, selling, gifting, surrendering, or transferring the dog, except when an immediate emergency makes prior notice impossible.",
  "The Seller will be given a reasonable opportunity to accept a voluntary return or assist with an appropriate new placement. The Seller is not required to refund the purchase price, reimburse expenses, pay the dog's current market value, or accept an unsafe or legally restricted transfer.",
  "The Buyer shall not abandon the dog or surrender it to a shelter or rescue without first contacting the Seller, unless required by law or necessary to protect a person or animal in an emergency.",
  "A return or surrender must be documented in writing. Ownership does not automatically revert merely because the Buyer discusses rehoming, breaches a term, or stops making payments.",
  "The Buyer shall disclose material health and behavior history to any approved new owner. No transfer may be made for dog fighting, illegal activity, neglectful breeding, laboratory use, or an inhumane purpose.",

  contractSection("19. Serious illness, death, euthanasia, and necropsy"),
  "If the dog dies or must be euthanized during a potential guarantee claim, the Buyer must notify the Seller as soon as reasonably possible. When the cause is uncertain, the Seller may require a complete necropsy by a licensed veterinarian or veterinary diagnostic laboratory. The report should identify the probable cause of death and whether the condition was congenital, hereditary, infectious, traumatic, toxic, nutritional, or undetermined.",
  "Emergency euthanasia may proceed when a veterinarian determines it is necessary to prevent suffering. The Buyer should request preservation of records and diagnostic samples when practical. No claim will be denied merely because immediate humane treatment was necessary, but absence of reasonably available evidence may prevent verification.",

  contractSection("20. Veterinary expenses and limitation of voluntary liability"),
  "After transfer, the Buyer is responsible for veterinary care and related expenses except to the extent a signed written agreement or applicable law requires the Seller to pay or reimburse them. The Buyer decides whether to authorize treatment and remains responsible to the veterinary provider regardless of a pending claim.",
  "For the voluntary one-year guarantee, the Seller's maximum financial responsibility is the puppy purchase price actually paid. To the extent permitted by law, the Seller is not liable under the voluntary guarantee for incidental, consequential, punitive, or special damages, including travel, lodging, lost wages, loss of companionship, training, boarding, supplies, future breeding value, or emotional distress. This limitation does not exclude liability or a remedy that applicable law does not permit the parties to waive.",

  contractSection("21. Payment plan, outstanding balance, and health claims"),
  "If a separate post-transfer financing agreement applies, illness, injury, insurance denial, rehoming, loss, theft, surrender, or death does not automatically cancel the lawful unpaid balance. A verified refund or credit will be applied as required by the applicable written agreements and law. The dog is not collateral subject to automatic repossession, and a default does not authorize trespass, breach of the peace, or unilateral alteration of ownership.",

  contractSection("22. Dispute resolution and general contract terms"),
  "Before filing a non-emergency lawsuit, the complaining party should provide a written description of the dispute and requested resolution and allow at least 10 business days for a response, unless a deadline, safety concern, statute of limitation, or need for immediate relief makes delay unreasonable.",
  "Virginia law governs this Agreement without waiving any consumer right that cannot legally be waived. Subject to mandatory law and jurisdictional limits, an action concerning this Agreement may be filed in a court with proper jurisdiction in Smyth County, Virginia.",
  "Each party bears its own attorney fees and costs unless a statute, court order, or separate enforceable term permits recovery.",
  "This Agreement and its signed attachments contain the complete agreement on the subjects they address. A modification must be in a written record accepted by both parties. Informal messages do not change a material term unless they clearly identify the change and are accepted by both parties.",
  "If a provision is invalid or unenforceable, it will be enforced to the maximum lawful extent and the remaining provisions will continue. Delay or failure to enforce a term once does not waive future enforcement.",
  "The Buyer may not assign this Agreement without written consent. The Seller may assign a payment right or administrative obligation only as permitted by law.",
  "Electronic signatures, scanned signatures, and separately signed counterparts may be treated as originals to the extent permitted by law. Headings are for organization and do not narrow the text. Payment duties, registration duties, claim procedures, liability limitations, rehoming notice, dispute terms, and record authorizations survive transfer as applicable.",

  contractSection("23. Final acknowledgments"),
  "By signing, each Buyer confirms that the Buyer is legally competent to enter a binding agreement and has provided accurate identity, contact, household, and placement information.",
  "The Buyer confirms that the Buyer reviewed the puppy description, known health disclosures, medical record, payment summary, registration selection, and transfer information.",
  "The Buyer confirms receipt of the Virginia statutory consumer notice before delivery and understands that statutory deadlines may be shorter than the voluntary one-year guarantee deadlines.",
  "The Buyer understands that the one-year guarantee is limited to verified severe congenital or hereditary defects and does not reimburse ordinary veterinary expenses.",
  "The Buyer understands the specialized feeding, supervision, temperature, hypoglycemia, and injury-prevention needs of a Chihuahua puppy.",
  "The Buyer had an opportunity to ask questions, obtain independent veterinary or legal advice, and decline the transaction before signing; is not relying on an oral promise omitted from this Agreement; and voluntarily accepts the puppy and the responsibilities stated in this Agreement.",

  contractSection("Appendix A - Animal history and medical record"),
  "The puppy identification, parent information, transfer-date findings, available veterinary information, vaccinations, deworming, medications, diet, and known reactions recorded in SWVAOS or attached to the buyer portal are incorporated into this Agreement. The Seller certifies this information to the best of the Seller's knowledge as of transfer.",
  "The Seller shall retain the signed animal-history record for the period required by applicable law.",

  contractSection("Appendix B - Health guarantee claim and veterinary release"),
  "A voluntary claim should identify the Buyer, puppy, transfer date, symptom onset, first examination date, diagnosis date, treating veterinarian, clinic contact information, diagnosed condition, requested remedy, and the veterinarian's explanation of congenital or hereditary cause and severity.",
  "The Buyer authorizes any veterinarian, clinic, laboratory, insurer, or specialist that treated or evaluated the dog to release relevant medical records and discuss diagnosis, causation, prognosis, and treatment with Southwest Virginia Chihuahua LLC for claim evaluation. This authorization may be revoked prospectively in writing, but revocation may prevent claim verification.",
  "The Buyer certifies that submitted claim information is complete and accurate to the best of the Buyer's knowledge.",

  contractSection("Appendix C - Go-home care and safety acknowledgment"),
  "The Buyer confirms receipt and understanding of the Seller's meal and monitoring instructions, hypoglycemia response guidance, temperature precautions, injury-prevention instructions, disease-exposure precautions, veterinary-care expectations, safe-transport requirements, and lifetime rehoming-notice requirement.",
  "A very small puppy that refuses food, becomes weak, trembles, vomits repeatedly, has diarrhea with lethargy, struggles to breathe, collapses, or has a seizure requires immediate veterinary attention. The Buyer must not wait for the Seller to respond before obtaining emergency care.",

  contractSection("Electronic records and signature"),
  "The parties agree that this exact document may be retained and signed electronically. The Buyer's separately recorded agreement checkbox, health and Virginia-notice acknowledgment, electronic-consent checkbox, typed legal name, signature timestamp, network information, frozen document terms, and audit hash form the retained signature record.",
  "The Seller's generation and issuance of this document through the authenticated SWVAOS account constitutes the Seller's electronic preparation and delivery of the Agreement. Nothing in this Agreement requires the Buyer to surrender a right or remedy that cannot lawfully be waived.",
];

export function parseCombinedAgreementContent(value: unknown) {
  if (typeof value !== "string") return undefined;
  const blocks = value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  if (!blocks.length) return undefined;

  const terms: string[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block.startsWith(CONTRACT_NOTICE_PREFIX)) {
      terms.push(block);
      continue;
    }

    const noticeParts = [block.slice(CONTRACT_NOTICE_PREFIX.length).trim()];
    const statutoryNoticeBlockCount = virginiaConsumerNotice.split(/\n\s*\n/).filter(Boolean).length;
    while (noticeParts.length < statutoryNoticeBlockCount && index + 1 < blocks.length && !blocks[index + 1].startsWith(CONTRACT_SECTION_PREFIX)) {
      noticeParts.push(blocks[index + 1]);
      index += 1;
    }
    terms.push(contractNotice(noticeParts.join("\n\n")));
  }
  return terms;
}
