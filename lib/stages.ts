export const STAGES = [
  'selection',
  'offer_issued',
  'offer_accepted',
  'visa_pending',
  'visa_allocated',
  'medical',
  'biometric',
  'skill_test',
  'visa_stamping',
  'visa_stamped',
  'ticket_booked',
  'mobilized',
  'onboarded',
];

export const STAGE_LABELS: Record<string, string> = {
  selection: 'Selection',
  offer_issued: 'Offer Issued',
  offer_accepted: 'Offer Accepted',
  visa_pending: 'Visa Pending',
  visa_allocated: 'Visa Allocated',
  medical: 'Medical',
  biometric: 'Biometric',
  skill_test: 'Skill Test',
  visa_stamping: 'Visa Stamping (ECR/ECNR)',
  visa_stamped: 'Visa Stamped',
  ticket_booked: 'Ticket Booked',
  mobilized: 'Mobilized',
  onboarded: 'Onboarded',
};

export const DOCUMENT_TYPES = ['CV / Resume', 'Passport Copy', 'Medical Certificate', 'Police Clearance Certificate', 'Visa Copy'];
