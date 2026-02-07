
import {
  District,
  PlanTemplateModel,
  PlanTemplateWeek,
  PlanTemplateBlock,
  WeekSchedule,
  Slot,
  Assignment,
  SlotType,
  SlotSource,
  WeekStatus,
  Conflict,
  MealType,
  GlobalSettings
} from '../types';

// --- Helpers ---

export const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const parseDate = (dateStr: string) => new Date(dateStr + 'T00:00:00');

export const addDays = (dateStr: string, days: number): string => {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const getDayOfWeek = (dateStr: string): number => {
  // 1 = Mon ... 7 = Sun
  const day = parseDate(dateStr).getDay();
  return day === 0 ? 7 : day;
};

export const formatTime = (time: string) => time; // Already HH:mm

// --- 4.1 Calculate WeekIndexReal ---

export const calculateWeekIndexReal = (mtcStartDt: string, targetDate: string): number => {
  const start = parseDate(mtcStartDt);
  const current = parseDate(targetDate);
  
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 0;
  
  const weekIndex = Math.floor(diffDays / 7) + 1;
  return weekIndex;
};

// --- 4.2 Generate Week ---

export const generateWeekSchedule = (
  training: string,
  weekIndex: number,
  weekStartDate: string,
  districts: District[],
  templates: PlanTemplateModel[],
  templateWeeks: PlanTemplateWeek[],
  templateBlocks: PlanTemplateBlock[]
): { schedule: WeekSchedule; slots: Slot[]; assignments: Assignment[], logs: string[] } => {
  
  const logs: string[] = [];
  const weekEndDate = addDays(weekStartDate, 6);
  
  const schedule: WeekSchedule = {
    id: generateId('WS'),
    training,
    weekIndex,
    weekStartDate,
    weekEndDate,
    status: WeekStatus.ACTIVE,
    generatedAt: new Date().toISOString()
  };

  const generatedSlots: Slot[] = [];
  const generatedAssignments: Assignment[] = [];

  // Filter districts active in this week
  const activeDistricts = districts.filter(d => d.training === training);

  // Group districts by plan code to optimize
  const districtsByPlan = activeDistricts.reduce((acc, d) => {
    acc[d.planCode] = acc[d.planCode] || [];
    acc[d.planCode].push(d);
    return acc;
  }, {} as Record<string, District[]>);

  // Iterate plans used by districts
  Object.keys(districtsByPlan).forEach(planCode => {
    const model = templates.find(t => t.planCode === planCode && t.isActive);
    if (!model) {
      logs.push(`Nenhum modelo ativo encontrado para o Plano: ${planCode}`);
      return;
    }

    const planDistricts = districtsByPlan[planCode];

    // For each district, determine which Template Week to use
    planDistricts.forEach(district => {
      const realWeekIdx = calculateWeekIndexReal(district.mtcStartDt, weekStartDate);
      
      // Fallback logic: if real > max, use max
      const templateWeekIdx = realWeekIdx > model.weeksCount ? model.weeksCount : realWeekIdx;
      
      if (templateWeekIdx < 1) return; // Not started yet

      // Find the specific template week definition
      const tWeek = templateWeeks.find(tw => tw.templateModelId === model.templateModelId && tw.weekIndex === templateWeekIdx);
      if (!tWeek) return;

      // Find blocks for this week
      const blocks = templateBlocks.filter(tb => tb.templateWeekId === tWeek.templateWeekId);

      blocks.forEach(block => {
        // 4.3 Convert weekday to date
        const offset = block.weekday - 1;
        const slotDate = addDays(weekStartDate, offset);

        // Check if slot already exists for this block/time (merge logic)
        let slot = generatedSlots.find(s => 
          s.templateBlockId === block.templateBlockId && 
          s.date === slotDate &&
          s.training === training
        );

        if (!slot) {
          slot = {
            slotId: block.type === SlotType.MEAL 
              ? `MS-${training}-${weekIndex}-${slotDate}-${block.mealType}-${block.startTime.replace(':','')}`
              : `LS-${training}-${weekIndex}-${slotDate}-${block.startTime.replace(':','')}`,
            type: block.type,
            training,
            weekIndex,
            date: slotDate,
            startTime: block.startTime,
            endTime: block.endTime,
            capacityPeople: block.capacityPeople,
            templateBlockId: block.templateBlockId,
            source: SlotSource.AUTOMATIC,
            mealType: block.mealType
          };
          generatedSlots.push(slot);
        }

        // Create assignment
        const assignment: Assignment = {
          assignmentId: generateId('ASN'),
          slotId: slot.slotId,
          districtId: district.districtId,
          missionaryCountAtCalculation: district.missionaryCount,
          source: SlotSource.AUTOMATIC
        };
        generatedAssignments.push(assignment);
      });
    });
  });

  logs.push(`Gerados ${generatedSlots.length} horários e ${generatedAssignments.length} atribuições para ${training}.`);

  return { schedule, slots: generatedSlots, assignments: generatedAssignments, logs };
};

// --- Duplicate Week Logic ---

export const duplicateWeek = (
  sourceTraining: string,
  sourceDate: string, // Monday of source
  targetDate: string, // Monday of target
  slots: Slot[],
  assignments: Assignment[],
  districts: District[]
): { newSlots: Slot[], newAssignments: Assignment[], log: string } => {
  
  const daysDiff = (parseDate(targetDate).getTime() - parseDate(sourceDate).getTime()) / (1000 * 60 * 60 * 24);
  const weekEndDate = addDays(sourceDate, 6);

  // Filter items from source week. If sourceTraining is 'ALL', we take all trainings.
  const sourceSlots = slots.filter(s => 
    (sourceTraining === 'ALL' || s.training === sourceTraining) && 
    s.date >= sourceDate && 
    s.date <= weekEndDate
  );

  const newSlots: Slot[] = [];
  const newAssignments: Assignment[] = [];

  sourceSlots.forEach(oldSlot => {
    const newDate = addDays(oldSlot.date, daysDiff);
    const newSlotId = generateId(`COPY-${oldSlot.type}`);

    const newSlot: Slot = {
      ...oldSlot,
      slotId: newSlotId,
      date: newDate,
      source: SlotSource.MANUAL, // Marked as manual because it's a copy
      updatedBy: 'Cópia do Sistema'
    };
    newSlots.push(newSlot);

    // Copy assignments
    const relatedAssignments = assignments.filter(a => a.slotId === oldSlot.slotId);
    relatedAssignments.forEach(oldAsn => {
      // Recalculate count based on current district data
      const district = districts.find(d => d.districtId === oldAsn.districtId);
      const currentCount = district ? district.missionaryCount : oldAsn.missionaryCountAtCalculation;

      newAssignments.push({
        ...oldAsn,
        assignmentId: generateId('ASN-COPY'),
        slotId: newSlotId,
        source: SlotSource.MANUAL,
        missionaryCountAtCalculation: currentCount
      });
    });
  });

  return {
    newSlots,
    newAssignments,
    log: `Duplicados ${newSlots.length} horários de ${sourceDate} para ${targetDate} (Contagens Recalculadas)`
  };
};

export const clearWeekSchedule = (
  training: string,
  weekStartDate: string,
  slots: Slot[],
  assignments: Assignment[]
): { remainingSlots: Slot[], remainingAssignments: Assignment[], count: number } => {
  
  const weekEndDate = addDays(weekStartDate, 6);
  
  // Find IDs of deleted slots
  const deletedSlotIds = slots
    .filter(s => (training === 'ALL' || s.training === training) && s.date >= weekStartDate && s.date <= weekEndDate)
    .map(s => s.slotId);

  // Filter out
  const remainingSlots = slots.filter(s => !deletedSlotIds.includes(s.slotId));
  const remainingAssignments = assignments.filter(a => !deletedSlotIds.includes(a.slotId));

  return {
    remainingSlots,
    remainingAssignments,
    count: deletedSlotIds.length
  };
};

// --- CSV Export ---

export const generateCSV = (slots: Slot[], assignments: Assignment[]) => {
  const header = ['Data', 'Hora', 'Tipo', 'Refeicao', 'Capacidade', 'Ocupado', 'Distritos', 'Status', 'Training'];
  const rows = slots.map(slot => {
    const slotAsns = assignments.filter(a => a.slotId === slot.slotId);
    const occupied = slotAsns.reduce((sum, a) => sum + a.missionaryCountAtCalculation, 0);
    const districtNames = slotAsns.map(a => a.districtId).join('; ');
    
    return [
      slot.date,
      slot.startTime,
      slot.type,
      slot.mealType || 'N/A',
      slot.capacityPeople,
      occupied,
      `"${districtNames}"`,
      occupied > slot.capacityPeople ? 'EXCESSO' : 'OK',
      slot.training
    ].join(',');
  });
  
  return [header.join(','), ...rows].join('\n');
};

// --- 5. & 6. Conflict Detection (Refactored) ---

export const analyzeSchedule = (slots: Slot[], assignments: Assignment[], settings: GlobalSettings): Conflict[] => {
  const conflicts: Conflict[] = [];
  
  // Helper to get slot for assignment
  const getSlot = (slotId: string) => slots.find(s => s.slotId === slotId);

  // 1. Capacity Check (Global Limit)
  // --------------------------------------------------------------------------------
  const usageMap: Record<string, { total: number; slotIds: string[]; type: SlotType; time: string; date: string; details: string[] }> = {};

  slots.forEach(slot => {
    const slotAssignments = assignments.filter(a => a.slotId === slot.slotId);
    const occupied = slotAssignments.reduce((sum, a) => sum + a.missionaryCountAtCalculation, 0);
    
    // Grouping Key: e.g., "MEAL|2025-05-05|12:00"
    const key = `${slot.type}|${slot.date}|${slot.startTime}`;
    
    if (!usageMap[key]) {
      usageMap[key] = { 
        total: 0, 
        slotIds: [], 
        type: slot.type, 
        time: slot.startTime, 
        date: slot.date,
        details: [] 
      };
    }
    
    usageMap[key].total += occupied;
    usageMap[key].slotIds.push(slot.slotId);
    if (occupied > 0) {
        usageMap[key].details.push(`${slot.training}: ${occupied}`);
    }
  });

  Object.values(usageMap).forEach(usage => {
    const limit = usage.type === SlotType.MEAL ? settings.defaultMealCapacity : settings.defaultLaundryCapacity;
    if (usage.total > limit) {
      conflicts.push({
        id: generateId('CONF-CAP'),
        type: 'CAPACITY',
        severity: 'CRITICAL',
        description: `Capacidade excedida: ${usage.type === SlotType.MEAL ? 'Refeitório' : 'Lavanderia'} em ${usage.date} às ${usage.time} (${usage.total}/${limit}).`,
        relatedIds: usage.slotIds
      });
    }
  });


  // 2. Laundry Overlap (Same District, Same Day, Time Overlap)
  // --------------------------------------------------------------------------------
  // Filter only laundry assignments
  const laundryAsns = assignments.filter(a => {
    const s = getSlot(a.slotId);
    return s && s.type === SlotType.LAUN;
  });

  // Group by District + Date
  const laundryByDistDate: Record<string, { assignment: Assignment, slot: Slot }[]> = {};
  
  laundryAsns.forEach(a => {
    const s = getSlot(a.slotId);
    if (!s) return;
    const key = `${a.districtId}|${s.date}`;
    if (!laundryByDistDate[key]) laundryByDistDate[key] = [];
    laundryByDistDate[key].push({ assignment: a, slot: s });
  });

  Object.entries(laundryByDistDate).forEach(([key, items]) => {
    if (items.length > 1) {
      // Sort by start time
      items.sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));
      
      const [distId, date] = key.split('|');

      for (let i = 0; i < items.length - 1; i++) {
        const current = items[i];
        const next = items[i+1];
        
        // Check overlap: next starts before current ends
        if (next.slot.startTime < current.slot.endTime) {
          conflicts.push({
            id: generateId('CONF-LAUN-OVERLAP'),
            type: 'OVERLAP',
            severity: 'CRITICAL',
            description: `Distrito ${distId.split('-')[1]} tem conflito de Lavanderia (Sobreposição) em ${date} (${current.slot.startTime}-${current.slot.endTime} e ${next.slot.startTime}-${next.slot.endTime}).`,
            relatedIds: [current.slot.slotId, next.slot.slotId]
          });
        }
      }
    }
  });


  // 3. Meal Double Booking (Same District, Same Day, Same MealType)
  // --------------------------------------------------------------------------------
  // Filter only meal assignments
  const mealAsns = assignments.filter(a => {
    const s = getSlot(a.slotId);
    return s && s.type === SlotType.MEAL && s.mealType;
  });

  // Group by District + Date + MealType
  const mealByDistDateType: Record<string, { assignment: Assignment, slot: Slot }[]> = {};

  mealAsns.forEach(a => {
    const s = getSlot(a.slotId);
    if (!s || !s.mealType) return;
    const key = `${a.districtId}|${s.date}|${s.mealType}`;
    if (!mealByDistDateType[key]) mealByDistDateType[key] = [];
    mealByDistDateType[key].push({ assignment: a, slot: s });
  });

  Object.entries(mealByDistDateType).forEach(([key, items]) => {
    // If a district has more than 1 assignment for the SAME meal type on the SAME day
    if (items.length > 1) {
      const [distId, date, mealType] = key.split('|');
      const times = items.map(i => i.slot.startTime).join(', ');
      
      conflicts.push({
        id: generateId('CONF-MEAL-DBL'),
        type: 'DOUBLE_BOOKING',
        severity: 'WARNING',
        description: `Distrito ${distId.split('-')[1]} agendado ${items.length} vezes para ${mealType} em ${date} (Horários: ${times}).`,
        relatedIds: items.map(i => i.slot.slotId)
      });
    }
  });

  return conflicts;
};
