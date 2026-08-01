import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

function wrap(font: PDFFont, text: string, size: number, width: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderPuppyApplicationPdf(introduction = "Thank you for considering Southwest Virginia Chihuahua. This application helps us evaluate safety, care readiness, household fit, and puppy preferences. Submission does not guarantee approval or reserve a puppy.") {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.16, 0.35, 0.31);
  const pale = rgb(0.92, 0.96, 0.94);
  const warning = rgb(1, 0.96, 0.86);
  const warningInk = rgb(0.47, 0.29, 0.05);
  const ink = rgb(0.12, 0.18, 0.17);
  const margin = 44;
  const width = 612;
  const height = 792;
  let page!: PDFPage;
  let y!: number;

  const newPage = () => {
    page = pdf.addPage([width, height]);
    y = height - 42;
    page.drawText("SOUTHWEST VIRGINIA CHIHUAHUA | PUPPY APPLICATION", { x: margin, y, size: 8, font: bold, color: green });
    page.drawText("swvachihuahua.com | 855-506-5425 | info@swvchihuahua.com", { x: margin, y: 28, size: 7.5, font: regular, color: green });
    y -= 24;
  };
  const ensure = (space: number) => { if (y - space < 48) newPage(); };
  const heading = (title: string) => {
    ensure(34);
    page.drawRectangle({ x: margin, y: y - 21, width: width - margin * 2, height: 25, color: pale });
    page.drawText(title, { x: margin + 8, y: y - 14, size: 11, font: bold, color: green });
    y -= 34;
  };
  const paragraph = (text: string, size = 8.7, font: PDFFont = regular) => {
    const wrapped = wrap(font, text, size, width - margin * 2);
    ensure(wrapped.length * 12 + 6);
    for (const line of wrapped) {
      page.drawText(line, { x: margin, y, size, font, color: ink });
      y -= 12;
    }
    y -= 5;
  };
  const notice = (title: string, text: string) => {
    const titleLines = wrap(bold, title, 9.2, width - margin * 2 - 20);
    const bodyLines = wrap(regular, text, 8.35, width - margin * 2 - 20);
    const boxHeight = 14 + titleLines.length * 12 + bodyLines.length * 11 + 12;
    ensure(boxHeight + 8);
    page.drawRectangle({ x: margin, y: y - boxHeight + 5, width: width - margin * 2, height: boxHeight, color: warning });
    let boxY = y - 10;
    for (const line of titleLines) {
      page.drawText(line, { x: margin + 10, y: boxY, size: 9.2, font: bold, color: warningInk });
      boxY -= 12;
    }
    boxY -= 2;
    for (const line of bodyLines) {
      page.drawText(line, { x: margin + 10, y: boxY, size: 8.35, font: regular, color: ink });
      boxY -= 11;
    }
    y -= boxHeight + 6;
  };
  const field = (label: string, choices?: string) => {
    ensure(19);
    page.drawText(label, { x: margin, y, size: 8.6, font: bold, color: ink });
    page.drawText(choices || "____________________________________________", { x: 205, y, size: 8.6, font: regular, color: ink });
    y -= 17;
  };
  const lines = (count = 2) => {
    ensure(count * 17);
    for (let index = 0; index < count; index += 1) {
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.63, 0.69, 0.67) });
      y -= 17;
    }
  };

  newPage();
  page.drawText("PUPPY APPLICATION", { x: margin, y, size: 20, font: bold, color: green });
  y -= 26;
  paragraph(introduction, 9.5);

  heading("1. Applicant Information");
  field("Applicant name"); field("Co-applicant name"); field("Street address"); field("City / state / ZIP");
  field("Phone"); field("Email"); field("Preferred contact", "[ ] Email   [ ] Telephone   [ ] Client portal");

  heading("2. Identity and Eligibility");
  field("Applicant age", "[ ] 18-20   [ ] 21-24   [ ] 25 or older");
  field("Photo ID name"); field("Occupation / employer"); field("Typical work schedule");
  field("All decision-makers agree?", "[ ] Yes   [ ] No   [ ] Need to discuss");

  heading("3. Household and Housing");
  field("Housing", "[ ] Own   [ ] Rent   [ ] Live with family   [ ] Other");
  field("Home type", "[ ] House   [ ] Apartment   [ ] Townhome   [ ] Other");
  field("Applicant confirms pets are permitted", "[ ] Yes   [ ] Not applicable   [ ] Need to confirm");
  field("Adults in household"); field("Children and ages"); field("Frequent young visitors?", "[ ] No   [ ] Yes");
  field("Fenced yard", "[ ] Yes   [ ] No   [ ] Not applicable"); field("Upcoming move/travel", "[ ] No   [ ] Yes");
  paragraph("Please describe who lives in the home and who will be primarily responsible for the puppy:"); lines();

  heading("4. Current and Previous Animals");
  field("Current dogs", "Number: ______   Breeds/sizes: ______________________");
  field("Current cats", "Number: ______   Details: __________________________");
  field("Other animals"); field("Animals vaccinated?", "[ ] Yes   [ ] No   [ ] Not applicable");
  field("Animals altered?", "[ ] All   [ ] Some   [ ] None   [ ] N/A");
  field("Past Chihuahua experience", "[ ] None   [ ] Some   [ ] Extensive");
  field("Past toy-breed experience", "[ ] None   [ ] Some   [ ] Extensive");
  paragraph("Describe your experience with Chihuahuas, toy breeds, puppies, or other dogs:"); lines();
  paragraph("Have you ever surrendered, rehomed, returned, or given away an animal? If yes, explain:"); lines();
  paragraph("Has an animal in your care ever been seized, neglected, seriously injured through lack of supervision, or ordered removed? If yes, explain:"); lines();

  heading("5. Veterinary Care Planning");
  field("Planned veterinary practice");
  field("Emergency veterinary hospital");
  field("Practice accepts new patients", "[ ] Confirmed   [ ] Not yet confirmed   [ ] Existing client");
  paragraph("Southwest Virginia Chihuahua does not contact an applicant's veterinarian as part of the application review. The applicant is responsible for selecting a licensed veterinarian, confirming access to routine and emergency care, and completing the post-transfer examination required by the final agreement.");

  heading("6. Puppy Preferences");
  field("Preferred sex", "[ ] Male   [ ] Female   [ ] Either"); field("Preferred coat", "[ ] Short   [ ] Long   [ ] Either");
  field("Preferred registry", "[ ] AKC   [ ] CKC   [ ] ACA   [ ] Flexible");
  field("Preferred placement", "[ ] Standard   [ ] Naturally small   [ ] Micro / Micro-Toy   [ ] Flexible");
  field("Preferred colors"); field("Primary purpose", "[ ] Companion   [ ] Breeding   [ ] Showing   [ ] Other");
  field("Desired timeframe"); field("Budget range", "$________________ to $________________"); field("Specific puppy/litter");
  paragraph("Describe the personality, energy level, and characteristics you hope to find:"); lines();
  paragraph("Which preferences are essential, and which are flexible?"); lines();

  heading("7. Naturally Small, Micro, and Micro-Toy Puppy Policy");
  notice("IMPORTANT: SOUTHWEST VIRGINIA CHIHUAHUA DOES NOT BREED FOR EXTREME SMALL SIZE", "We select for health, structure, temperament, and overall quality. Occasionally, a puppy may remain exceptionally small despite responsible breeding. Labels such as Micro or Micro-Toy are descriptive business terms only and are not separate recognized Chihuahua varieties. Adult weight or final size cannot be guaranteed.");
  paragraph("Exceptionally small puppies have very limited body reserves. Missing a meal, stress, chilling, overactivity, vomiting, diarrhea, or illness can cause blood sugar to fall rapidly and may lead to weakness, tremors, seizures, loss of consciousness, or medical collapse. These puppies may also be more vulnerable to dehydration, temperature instability, traumatic injury, falls, rough handling, larger animals, delayed development, congenital problems, and other serious complications.");
  paragraph("A naturally small, Micro, or Micro-Toy puppy generally remains with the Seller for an additional two to four weeks beyond the normal go-home schedule, and longer when the Seller or veterinarian determines additional development or monitoring is needed. Transfer will not occur until the puppy is consistently eating independently, maintaining weight and body temperature, and considered ready for the transition.");
  paragraph("During the extended-care period, the puppy may require measured meals approximately every two hours, including overnight, together with weight checks, temperature management, restricted activity, close observation, and immediate response to signs of hypoglycemia or illness. The Buyer must be able to continue the puppy-specific feeding and monitoring schedule after transfer and must maintain an emergency plan and a reliable backup caregiver.");
  paragraph("Because of the additional two-to-four-week care period, round-the-clock feeding, monitoring, and increased placement risk, an additional $2,500.00 small-puppy care charge is added to the puppy's approved price. This additional charge must be paid in full before transfer and is not eligible for financing or a payment plan.");
  paragraph("Naturally small, Micro, and Micro-Toy puppies are excluded from the Seller's voluntary one-year congenital and hereditary health guarantee. This exclusion does not limit any right or remedy that cannot legally be waived. These puppies may have a shorter or less predictable lifespan than a normally sized Chihuahua and can be more easily injured, even during ordinary household activity.");
  field("Interested in a naturally small / Micro puppy?", "[ ] Yes   [ ] No   [ ] Unsure");
  field("Two-hour feeding schedule possible?", "[ ] Yes   [ ] No   [ ] Need to discuss");
  field("Overnight monitoring possible?", "[ ] Yes   [ ] No   [ ] Need to discuss");
  field("Emergency veterinary access", "[ ] Confirmed   [ ] Not confirmed   [ ] Need guidance");
  field("Caregiver away from home", "Approximate hours per day: __________________");
  field("Backup caregiver");
  paragraph("If seeking an exceptionally small puppy, explain your feeding, supervision, backup-caregiver, and emergency-care plan:"); lines(3);
  paragraph("[ ] I understand that Southwest Virginia Chihuahua does not intentionally breed for Micro or Micro-Toy size, does not guarantee adult size, and may decline or delay placement when the puppy's welfare requires it.");
  paragraph("[ ] I understand the additional two-to-four-week or longer go-home period, approximately every-two-hour feedings including overnight, increased health and injury risks, $2,500.00 additional charge, no-financing policy, and exclusion from the voluntary one-year health guarantee.");
  field("Applicant initials acknowledging Section 7");

  heading("8. Daily Care and Safety Plan");
  field("Puppy location during day"); field("Puppy location overnight"); field("Typical time alone");
  field("Primary caregiver"); field("Training plan"); field("Travel restraint", "[ ] Carrier   [ ] Harness/restraint   [ ] Need guidance");
  paragraph("How will you prevent falls, rough handling, escape, exposure to large animals, and access to unsafe foods or substances?"); lines(3);
  paragraph("How will you manage safe socialization before the vaccination series is complete?"); lines();

  heading("9. Breeding Intentions and Registration");
  field("Plan to breed?", "[ ] No   [ ] Possibly   [ ] Yes"); field("Prior breeding experience", "[ ] None   [ ] Limited   [ ] Experienced");
  field("Breeds previously bred"); field("Health testing planned"); field("Breeding mentor / veterinarian");
  paragraph("If you may breed, describe your goals, health-testing plan, housing, emergency veterinary access, and plan for resulting puppies:"); lines(3);

  heading("10. Payment and Reservation Planning");
  field("Expected payment method", "[ ] Pay in full   [ ] Financing request   [ ] Undecided");
  field("Ready to place deposit?", "[ ] Yes   [ ] No   [ ] After puppy selection"); field("Estimated deposit date");
  field("Need payment-plan review?", "[ ] Yes   [ ] No"); field("Billing name"); field("Billing email");
  paragraph("Financing or a structured payment plan is not guaranteed and requires separate approval and written terms. Naturally small, Micro, and Micro-Toy puppies and the related $2,500.00 additional care charge are not eligible for financing. Sensitive financial information will be collected only through the designated secure payment process.");

  heading("11. Pickup and Transportation");
  field("Preferred transfer", "[ ] Marion-area pickup   [ ] Ground meet-up/delivery"); field("Person receiving puppy");
  field("Pickup photo ID name"); field("Starting city/state"); field("Transport assistance", "[ ] Not needed   [ ] Requested   [ ] Unsure");
  field("Scheduling limitations");
  paragraph("Ground delivery or a meet-up may be available for an additional fee and must be agreed upon in writing. Puppies are not shipped as unattended airline cargo. A requested date is not guaranteed. A naturally small, Micro, or Micro-Toy puppy normally requires an additional two to four weeks, and possibly longer, before transfer.");

  heading("12. References");
  field("Reference 1 name"); field("Relationship"); field("Phone/email"); field("Reference 2 name"); field("Relationship"); field("Phone/email");

  heading("13. Additional Information");
  paragraph("Why would you like to purchase a puppy from Southwest Virginia Chihuahua?"); lines(3);
  paragraph("Is there anything about your household, schedule, animals, finances, or care plan that may affect placement or that we should discuss before approval?"); lines(3);
  field("How did you hear about us?");

  heading("14. Applicant Authorizations and Acknowledgments");
  for (const statement of [
    "I certify that the information in this application is complete and truthful to the best of my knowledge.",
    "If I rent or live in housing controlled by another person, I confirm that I am responsible for verifying that the puppy is permitted. I understand that Southwest Virginia Chihuahua does not contact my landlord as part of the application review.",
    "I understand that Southwest Virginia Chihuahua does not contact my veterinarian as part of the application review and that I am responsible for arranging routine and emergency veterinary care.",
    "I authorize Southwest Virginia Chihuahua LLC to contact the personal references or other non-landlord, non-veterinary contacts that I voluntarily identify for the limited purpose of evaluating this application and placement.",
    "I authorize information from this application to be used to prepare reservation agreements, deposit records, invoices, transportation forms, the Bill of Sale, Health Guarantee, registration paperwork, and client-portal records associated with my puppy placement.",
    "I understand that submitting this application does not guarantee approval, a specific puppy, availability, adult size, registration, financing, reservation, or placement.",
    "I understand that no puppy is reserved until all required steps are completed, the written deposit agreement is signed, cleared funds are received, and the reservation is confirmed by the Seller.",
    "I understand that deposits are generally non-refundable after confirmation, subject to the written Deposit & Reservation Agreement.",
    "I understand that a puppy's projected adult size is an estimate only and that health, development, and safe placement take priority over a requested size or transfer date.",
    "I agree to notify the Seller promptly if any material information in this application changes before transfer.",
  ]) paragraph(`[ ] ${statement}`);

  heading("15. Communication Preferences");
  field("Transactional email", "[ ] Yes   [ ] No"); field("Telephone calls", "[ ] Yes   [ ] No");
  field("Client-portal notices", "[ ] Yes   [ ] No"); field("Voicemail permitted", "[ ] Yes   [ ] No"); field("Alternate contact");
  paragraph("Communication preferences do not prevent legally required notices, requested responses, transaction records, safety information, or communications reasonably necessary to administer an active application or placement.");

  heading("16. Applicant Signature");
  paragraph("By signing, I confirm that I reviewed the application, including the complete Naturally Small, Micro, and Micro-Toy Puppy Policy in Section 7, and that I had the opportunity to ask questions before submitting the application.");
  field("Applicant printed name"); field("Applicant signature"); field("Date and time");
  field("Co-applicant name"); field("Co-applicant signature"); field("Date and time");

  heading("17. Seller Use Only");
  field("Application ID"); field("Date received"); field("Reviewer");
  field("Status", "[ ] New   [ ] Reviewing   [ ] Approved   [ ] Wait list   [ ] Declined");
  field("Approved registry", "[ ] AKC   [ ] CKC   [ ] ACA   [ ] Any eligible");
  field("Approved placement", "[ ] Standard   [ ] Naturally small   [ ] Micro / Micro-Toy");
  field("Section 7 acknowledgment reviewed", "[ ] Yes   [ ] Not applicable");
  field("Assigned puppy ID"); field("Approved price"); field("Additional small-puppy charge", "$2,500.00 / N/A");
  field("Deposit amount"); field("Deposit due"); field("Document package ID"); field("Notes / conditions"); lines();

  return pdf.save();
}
