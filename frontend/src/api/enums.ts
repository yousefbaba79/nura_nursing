export const CLIENT_STATUSES = ["ACTIVE", "FOLLOW_UP_REQUIRED", "TREATMENT_COMPLETED", "ARCHIVED"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const FEEDING_METHODS = [
  "BREASTFEEDING",
  "EXPRESSED_BREAST_MILK",
  "FORMULA",
  "MIXED_FEEDING",
  "TUBE_FEEDING",
  "OTHER",
] as const;
export type FeedingMethod = (typeof FEEDING_METHODS)[number];

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
export type VisitType = (typeof VISIT_TYPES)[number];

export const VISIT_STATUSES = ["DRAFT", "COMPLETED", "CANCELLED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PROBLEM_STATUSES = ["NEW", "IN_PROGRESS", "IMPROVED", "RESOLVED"] as const;
export const ACTION_ITEM_STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

export const FOLLOW_UP_TYPES = ["CALL", "MESSAGE", "VIDEO_MEETING", "CLINIC_VISIT", "HOME_VISIT", "OTHER"] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const FOLLOW_UP_STATUSES = ["SCHEDULED", "COMPLETED", "RESCHEDULED", "CANCELLED", "MISSED"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const CLIENT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  FOLLOW_UP_REQUIRED: "bg-amber-100 text-amber-800",
  TREATMENT_COMPLETED: "bg-blue-100 text-blue-800",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-red-100 text-red-800",
};

export const ACTION_ITEM_STATUS_COLORS: Record<string, string> = {
  TODO: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-400 line-through",
};

export const FOLLOW_UP_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  RESCHEDULED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-100 text-gray-500",
  MISSED: "bg-red-100 text-red-800",
};
