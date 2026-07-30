import { prepareCombinedAgreement } from "../../../../db/combined-agreements";
import { requireAdminSession } from "../../../../lib/admin-session";
import { sendBuyerAutomation } from "../../../../lib/automation-email";
import { parseCombinedAgreementContent, type CombinedAgreementDetails } from "../../../../lib/combined-agreement";
import { getTemplatesConfig } from "../../../../lib/templates-config";

const cents = (value: unknown) => Math.round(Math.max(0, Number(value) || 0) * 100);
const text = (value: unknown) => String(value ?? "").trim();
const checked = (value: unknown) => value === true || value === "true" || value === "on" || value === "yes";

export async function POST(request: Request) {
  const unauthorized = requireAdminSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json() as Record<string, unknown>;
    const config = await getTemplatesConfig();
    const template = config.documents.bill_of_sale_health_guarantee;
    if (!template.enabled) return Response.json({ error: "The combined Bill of Sale and Health Guarantee template is disabled." }, { status: 400 });

    const details: CombinedAgreementDetails = {
      agreementNumber: text(body.agreement_number),
      agreementDate: text(body.agreement_date),
      coBuyerName: text(body.co_buyer_name),
      buyerStreetAddress: text(body.buyer_street_address),
      buyerCityStateZip: text(body.buyer_city_state_zip),
      buyerEmergencyContact: text(body.buyer_emergency_contact),
      puppyAgeAtTransfer: text(body.puppy_age_at_transfer),
      puppyCoatType: text(body.puppy_coat_type),
      puppyCurrentWeight: text(body.puppy_current_weight),
      estimatedAdultSize: text(body.estimated_adult_size),
      microchipNumber: text(body.microchip_number),
      registry: text(body.registry),
      registrationNumber: text(body.registration_number),
      litterInternalId: text(body.litter_internal_id),
      bredBySeller: checked(body.bred_by_seller),
      acquiredFrom: text(body.acquired_from),
      sireRegistrationNumber: text(body.sire_registration_number),
      damRegistrationNumber: text(body.dam_registration_number),
      knownConditions: text(body.known_conditions),
      healthRecordStatus: text(body.health_record_status),
      careGuideStatus: text(body.care_guide_status),
      registrationDocumentsStatus: text(body.registration_documents_status),
      microchipInstructionsStatus: text(body.microchip_instructions_status),
      insuranceInformationStatus: text(body.insurance_information_status),
      knownConditionDisclosureStatus: text(body.known_condition_disclosure_status),
      transportInstructionsStatus: text(body.transport_instructions_status),
      paymentMethod: text(body.payment_method),
      transferMethod: text(body.transfer_method),
      transferLocation: text(body.transfer_location),
      transferTime: text(body.transfer_time),
      recipientName: text(body.recipient_name),
      appetiteAtTransfer: text(body.appetite_at_transfer),
      stoolParasiteHistory: text(body.stool_parasite_history),
      respiratoryFindings: text(body.respiratory_findings),
      skinCoatFindings: text(body.skin_coat_findings),
      biteTeethHerniaFindings: text(body.bite_teeth_hernia_findings),
      patellaGaitFindings: text(body.patella_gait_findings),
      medicationSupplement: text(body.medication_supplement),
      otherHealthDisclosure: text(body.other_health_disclosure),
      firstVetClinic: text(body.first_vet_clinic),
      firstVetName: text(body.first_vet_name),
      firstVetAppointment: text(body.first_vet_appointment),
      firstVetPhone: text(body.first_vet_phone),
      firstVetFindingsStatus: text(body.first_vet_findings_status),
      insuranceSelection: text(body.insurance_selection),
      registrationStatus: text(body.registration_status),
      registrationType: text(body.registration_type),
      registryPromised: text(body.registry_promised),
      registrationDueDate: text(body.registration_due_date),
      spayNeuterTerm: text(body.spay_neuter_term),
      breedingAddendum: text(body.breeding_addendum),
      buyerNoticeMethod: text(body.buyer_notice_method),
      sellerRepresentative: text(body.seller_representative),
      attachments: text(body.attachments),
      specialFeedingInstructions: text(body.special_feeding_instructions),
    };

    const result = await prepareCombinedAgreement({
      buyerId: Number(body.buyer_id),
      puppyId: Number(body.puppy_id),
      salePriceCents: cents(body.sale_price),
      salesTaxCents: cents(body.sales_tax),
      transportCents: cents(body.transport_fee),
      otherChargesCents: cents(body.other_charges),
      reservationCreditCents: cents(body.reservation_credit),
      additionalPaymentsCents: cents(body.additional_payments),
      balanceDueDate: text(body.balance_due_date),
      transferDate: text(body.transfer_date),
      microToy: checked(body.micro_toy),
      terms: parseCombinedAgreementContent(template.content),
      details,
    });

    const origin = new URL(request.url).origin;
    const portalUrl = `${origin}/portal/${result.token}`;
    try {
      await sendBuyerAutomation("contract_ready", result.buyerId, {
        puppyId: result.puppyId,
        dedupeKey: `combined-agreement-${result.contracts[0]?.snapshot.groupId ?? result.token.slice(0, 12)}`,
        variables: { portal_url: portalUrl },
      });
    } catch (emailError) {
      console.error("Combined agreement email failed", emailError instanceof Error ? emailError.message : emailError);
    }

    return Response.json({ ...result, portalUrl }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create the combined agreement." }, { status: 400 });
  }
}
