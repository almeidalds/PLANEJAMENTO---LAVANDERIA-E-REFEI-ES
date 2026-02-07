
import { District, PlanTemplateModel, PlanTemplateWeek, PlanTemplateBlock, CountSource, SlotType, MealType } from '../types';

// --- Helper to generate data ---
const createTemplate = (groupName: string, version: number, weeks: number): PlanTemplateModel => ({
  templateModelId: `TM-${groupName}-v${version}`,
  planCode: `${groupName}.${version}`, // Ex: POR6.1
  name: `${groupName} Versão ${version}`,
  category: groupName, // The Group Name acts as Category
  weeksCount: weeks,
  isActive: true,
  createdAt: new Date().toISOString()
});

const generateWeeksForTemplate = (template: PlanTemplateModel): PlanTemplateWeek[] => {
  return Array.from({ length: template.weeksCount }, (_, i) => ({
    templateWeekId: `TW-${template.planCode}-W${i + 1}`,
    templateModelId: template.templateModelId,
    weekIndex: i + 1
  }));
};

// --- 1. Templates Generation ---
// Definition of groups and their default duration (weeks)
const groupDefinitions = [
  { name: 'POR3', weeks: 3 },
  { name: 'POR6', weeks: 6 },
  { name: 'POR4', weeks: 4 },
  { name: 'JPN9', weeks: 9 },
  { name: 'ESP4', weeks: 4 },
  { name: 'ESP3', weeks: 3 },
  { name: 'ING3', weeks: 3 },
  { name: 'CENTRO DE VISITANTES', weeks: 1 },
  { name: 'MISSIONÁRIO SÊNIOR', weeks: 2 },
  { name: 'EXTRA', weeks: 1 }
];

// Generate 8 versions for each group
let allTemplates: PlanTemplateModel[] = [];

groupDefinitions.forEach(group => {
  for (let v = 1; v <= 8; v++) {
    allTemplates.push(createTemplate(group.name, v, group.weeks));
  }
});

export const MOCK_TEMPLATES: PlanTemplateModel[] = allTemplates;

// --- 2. Template Weeks ---
export const MOCK_TEMPLATE_WEEKS: PlanTemplateWeek[] = MOCK_TEMPLATES.flatMap(t => 
  generateWeeksForTemplate(t)
);

// --- 3. Blocks (Sample blocks for POR6.1 Week 1 to demonstrate) ---
export const MOCK_TEMPLATE_BLOCKS: PlanTemplateBlock[] = [
  {
    templateBlockId: 'TB-POR6.1-W1-MEAL-1',
    templateWeekId: 'TW-POR6.1-W1',
    type: SlotType.MEAL,
    weekday: 1, // Seg
    mealType: MealType.ALMOCO,
    startTime: '11:30',
    endTime: '12:00',
    capacityPeople: 50
  },
  {
    templateBlockId: 'TB-POR6.1-W1-LAUN-1',
    templateWeekId: 'TW-POR6.1-W1',
    type: SlotType.LAUN,
    weekday: 1, // Seg
    startTime: '13:00',
    endTime: '14:30',
    capacityPeople: 20
  }
];

// --- 4. Districts ---
export const MOCK_DISTRICTS: District[] = [
  {
    districtId: 'POR6.1-01A',
    training: 'POR6.1',
    districtNumero: '01',
    districtLetra: 'A',
    planCode: 'POR6.1',
    mtcStartDt: '2025-05-01',
    missionaryCount: 10,
    manualMissionaryCount: 10,
    countSource: CountSource.MASTERLIST,
    isManual: false,
    updatedAt: new Date().toISOString()
  },
  {
    districtId: 'POR6.1-01B',
    training: 'POR6.1',
    districtNumero: '01',
    districtLetra: 'B',
    planCode: 'POR6.1',
    mtcStartDt: '2025-05-01',
    missionaryCount: 8,
    manualMissionaryCount: 8,
    countSource: CountSource.MASTERLIST,
    isManual: false,
    updatedAt: new Date().toISOString()
  },
  {
    districtId: 'ESP4.1-05A',
    training: 'ESP4.1',
    districtNumero: '05',
    districtLetra: 'A',
    planCode: 'ESP4.1',
    mtcStartDt: '2025-05-01',
    missionaryCount: 12,
    manualMissionaryCount: 12,
    countSource: CountSource.MASTERLIST,
    isManual: false,
    updatedAt: new Date().toISOString()
  }
];
