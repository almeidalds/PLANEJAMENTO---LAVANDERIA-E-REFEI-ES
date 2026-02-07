
// 1. Identifiers & Enums

export type TrainingId = string; // e.g., POR6
export type DistrictId = string; // e.g., POR6-02A
export type PlanCode = string; // e.g., "3" (3-week plan)

export enum SlotType {
  MEAL = 'MEAL',
  LAUN = 'LAUN'
}

export enum MealType {
  DESJEJUM = 'DESJEJUM',
  ALMOCO = 'ALMOCO',
  JANTAR = 'JANTAR'
}

export enum SlotSource {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
  TEMPLATE_SYNC = 'TEMPLATE_SYNC'
}

export enum WeekStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  LOCKED = 'LOCKED'
}

export enum CountSource {
  MASTERLIST = 'MASTERLIST',
  MANUAL = 'MANUAL'
}

// 2. Data Structures

export interface GlobalSettings {
  defaultMealCapacity: number;
  defaultLaundryCapacity: number;
}

export interface District {
  districtId: DistrictId;
  training: TrainingId;
  districtNumero: string; // "02"
  districtLetra: string; // "A"
  planCode: PlanCode;
  mtcStartDt: string; // YYYY-MM-DD
  asgnmtStartDt?: string;
  missionaryCount: number;
  manualMissionaryCount: number;
  countSource: CountSource;
  isManual: boolean;
  updatedAt: string;
}

export interface PlanTemplateModel {
  templateModelId: string;
  planCode: PlanCode;
  name: string;
  category?: string; // Groups: Portuguese, International, etc.
  weeksCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface PlanTemplateWeek {
  templateWeekId: string;
  templateModelId: string;
  weekIndex: number;
}

export interface PlanTemplateBlock {
  templateBlockId: string;
  templateWeekId: string;
  type: SlotType;
  weekday: number; // 1=Mon, 7=Sun
  mealType?: MealType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  capacityPeople: number;
}

export interface WeekSchedule {
  id: string; // unique key for React lists
  training: TrainingId;
  weekIndex: number;
  weekStartDate: string; // YYYY-MM-DD
  weekEndDate: string;
  status: WeekStatus;
  templateSyncAt?: string;
  generatedAt: string;
}

export interface Slot {
  slotId: string;
  type: SlotType;
  training: TrainingId;
  weekIndex: number;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  capacityPeople: number;
  templateBlockId?: string | null;
  source: SlotSource;
  mealType?: MealType; // Only for MEAL
  updatedBy?: string;
  overrideReason?: string;
}

export interface Assignment {
  assignmentId: string;
  slotId: string;
  districtId: DistrictId;
  missionaryCountAtCalculation: number;
  source: SlotSource;
  overrideReason?: string;
}

export interface Conflict {
  id: string;
  type: 'CAPACITY' | 'OVERLAP' | 'DOUBLE_BOOKING';
  severity: 'WARNING' | 'CRITICAL';
  description: string;
  relatedIds: string[]; // Slot IDs or District IDs
}

export interface SystemLog {
  logId: string;
  timestamp: string;
  action: string;
  summary: string;
  details?: string;
}
