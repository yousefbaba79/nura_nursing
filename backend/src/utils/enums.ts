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

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const ACTION_ITEM_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const FOLLOW_UP_TYPES = ["CLINIC_VISIT", "VIDEO_MEETING"] as const;

export const FOLLOW_UP_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "RESCHEDULED",
  "CANCELLED",
  "MISSED",
] as const;
