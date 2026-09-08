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
  visits?: Visit[];
  actionItems?: ActionItem[];
  followUps?: FollowUp[];
  lastVisitDate?: string | null;
  nextFollowUpDate?: string | null;
  openActionItemCount?: number;
}

export interface Problem {
  id: string;
  visitId: string;
  babyId: string | null;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  notes: string | null;
}

export interface Recommendation {
  id: string;
  visitId: string;
  problemId: string | null;
  babyId: string | null;
  title: string;
  instructions: string | null;
  priority: string;
  includeInSummary: boolean;
}

export interface ActionItem {
  id: string;
  clientId: string;
  visitId: string | null;
  problemId: string | null;
  recommendationId: string | null;
  babyId: string | null;
  title: string;
  instructions: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  completedAt: string | null;
  notes: string | null;
  client?: { id: string; fullName: string };
  baby?: { id: string; fullName: string } | null;
}

export interface FollowUp {
  id: string;
  clientId: string;
  babyId: string | null;
  visitId: string | null;
  scheduledAt: string;
  type: string;
  reason: string | null;
  notes: string | null;
  status: string;
  client?: { id: string; fullName: string; phone: string };
  baby?: { id: string; fullName: string } | null;
}

export interface Visit {
  id: string;
  clientId: string;
  client?: { id: string; fullName: string };
  createdById: string;
  createdBy?: { id: string; fullName: string };
  updatedById: string | null;
  updatedBy?: { id: string; fullName: string } | null;
  visitDate: string;
  startTime: string | null;
  endTime: string | null;
  visitType: string;
  location: string | null;
  status: string;
  followUpDate: string | null;
  reasonForConsultation: string | null;
  clientGoals: string | null;
  clientQuestions: string | null;
  currentFeedingRoutine: string | null;
  problemsReported: string | null;
  consultantObservations: string | null;
  feedingAssessment: string | null;
  breastAssessment: string | null;
  babyAssessment: string | null;
  latchAssessment: string | null;
  milkTransferAssessment: string | null;
  weightInformation: string | null;
  relevantMedicalInfo: string | null;
  solutionsDiscussed: string | null;
  clientActionPlan: string | null;
  warningSignsDiscussed: string | null;
  referrals: string | null;
  followUpPlan: string | null;
  privateNotes: string | null;
  lastDraftSavedAt: string | null;
  createdAt: string;
  updatedAt: string;
  babies: { baby: { id: string; fullName: string } }[];
  problems: Problem[];
  recommendations: Recommendation[];
  actionItems: ActionItem[];
  followUps?: FollowUp[];
}
