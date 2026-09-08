export const CLIENT_STATUSES = [
  "ACTIVE",
  "FOLLOW_UP_REQUIRED",
  "TREATMENT_COMPLETED",
  "ARCHIVED",
] as const;

export const FEEDING_METHODS = [
  "BREASTFEEDING",
  "EXPRESSED_BREAST_MILK",
  "FORMULA",
  "MIXED_FEEDING",
  "TUBE_FEEDING",
  "OTHER",
] as const;

export const VISIT_TYPES = [
  "INITIAL_CONSULTATION",
  "FOLLOW_UP_CONSULTATION",
  "PHONE_CONSULTATION",
  "VIDEO_CONSULTATION",
  "HOME_VISIT",
  "CLINIC_VISIT",
  "MESSAGE_CONSULTATION",
  "OTHER",
] as const;

export const VISIT_STATUSES = ["DRAFT", "COMPLETED", "CANCELLED"] as const;

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const PROBLEM_STATUSES = ["NEW", "IN_PROGRESS", "IMPROVED", "RESOLVED"] as const;

export const ACTION_ITEM_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const FOLLOW_UP_TYPES = [
  "CALL",
  "MESSAGE",
  "VIDEO_MEETING",
  "CLINIC_VISIT",
  "HOME_VISIT",
  "OTHER",
] as const;

export const FOLLOW_UP_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "RESCHEDULED",
  "CANCELLED",
  "MISSED",
] as const;
