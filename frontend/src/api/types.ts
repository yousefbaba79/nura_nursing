export interface Baby {
  id: string;
  clientId: string;
  fullName: string;
  dateOfBirth: string | null;
  sex: string | null;
  gestationalAgeWeeks: string | null;
  deliveryType: string | null;
  birthWeightGrams: number | null;
  currentWeightGrams: number | null;
  lengthCm: number | null;
  headCircumferenceCm: number | null;
  medicalConditions: string | null;
  medications: string | null;
  allergies: string | null;
  feedingMethod: string | null;
  dailyFeedsCount: number | null;
  supplementationInfo: string | null;
  hospitalInfo: string | null;
  pediatricianName: string | null;
  pediatricianPhone: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  weightLogs?: { id: string; date: string; weightGrams: number }[];
}

export interface Client {
  id: string;
  consultantId: string;
  fullName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  idNumber: string | null;
  clientNumber: string | null;
  address: string | null;
  city: string | null;
  preferredLanguage: string | null;
  preferredContactMethod: string | null;
  occupation: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  referralSource: string | null;
  generalNotes: string | null;
  tags: string | null;
  status: string;
  consentReceived: boolean;
  consentDate: string | null;
  consentMethod: string | null;
  consentFormVersion: string | null;
  consentNotes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
  babies?: Baby[];
  followUps?: FollowUp[];
  lastVisitDate?: string | null;
  nextFollowUpDate?: string | null;
}

export interface FollowUp {
  id: string;
  clientId: string;
  babyId: string | null;
  scheduledAt: string;
  type: string;
  reason: string | null;
  notes: string | null;
  status: string;
  client?: { id: string; fullName: string; phone: string };
  baby?: { id: string; fullName: string } | null;
}

export interface NoteTemplate {
  id: string;
  label: string;
  text: string;
}
