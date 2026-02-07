
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calendar, Settings, AlertTriangle, RefreshCw, Lock, Unlock, 
  Plus, Save, Layout, ChevronLeft, ChevronRight, FileText, CheckCircle, Pencil, X,
  Clock, MapPin, Zap, Search, Bell, PieChart, TrendingUp, LogOut, Copy, Download,
  Activity, Grid, Printer, History, AlertCircle, Trash2, Info, Edit, MoreVertical,
  UploadCloud, FileSpreadsheet, AlertOctagon, ChevronDown, Folder, FolderOpen, ArrowRight,
  Sliders, Layers, Timer, Repeat, Hash, Type, CheckSquare, Square
} from 'lucide-react';
import { 
  District, PlanTemplateModel, PlanTemplateWeek, PlanTemplateBlock, 
  WeekSchedule, Slot, Assignment, SlotType, WeekStatus, SystemLog, Conflict, SlotSource, MealType, CountSource, GlobalSettings
} from './types';
import { MOCK_DISTRICTS, MOCK_TEMPLATES, MOCK_TEMPLATE_WEEKS, MOCK_TEMPLATE_BLOCKS } from './services/mockData';
import { generateWeekSchedule, analyzeSchedule, addDays, generateId, formatTime, duplicateWeek, generateCSV, clearWeekSchedule } from './services/scheduler';

// --- Components ---

const Tooltip = ({ text, children }: { text: string, children?: React.ReactNode }) => (
    <div className="group relative inline-flex items-center justify-center">
        {children}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-auto whitespace-nowrap bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded shadow-lg z-50 pointer-events-none">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
        </div>
    </div>
);

const Badge = ({ children, color, className = "" }: { children?: React.ReactNode; color: 'red' | 'green' | 'yellow' | 'blue' | 'gray' | 'brand'; className?: string }) => {
  const colors = {
    red: 'bg-red-50 text-red-600 border border-red-100',
    green: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    yellow: 'bg-amber-50 text-amber-600 border border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border border-blue-100',
    gray: 'bg-slate-100 text-slate-500 border border-slate-200',
    brand: 'bg-brand-50 text-brand-600 border border-brand-100',
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${colors[color]} ${className}`}>{children}</span>;
};

const Card = ({ title, children, action, className = "" }: { title?: string, children?: React.ReactNode, action?: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-3xl shadow-soft border border-white/50 p-6 ${className}`}>
    {(title || action) && (
      <div className="flex justify-between items-center mb-6">
        {title && <h3 className="font-bold text-slate-800 text-lg">{title}</h3>}
        {action}
      </div>
    )}
    <div>{children}</div>
  </div>
);

const StatCard = ({ label, value, icon: Icon, trend, color = "brand" }: any) => (
  <div className="bg-white rounded-3xl p-6 shadow-soft flex items-start justify-between min-w-[200px]">
    <div>
      <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className="text-3xl font-extrabold text-slate-800 mb-1">{value}</div>
      {trend && <div className="text-xs text-emerald-500 font-medium flex items-center gap-1"><TrendingUp size={12}/> {trend}</div>}
    </div>
    <div className={`p-3 rounded-2xl ${color === 'brand' ? 'bg-brand-50 text-brand-600' : (color === 'red' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500')}`}>
      <Icon size={24} strokeWidth={2.5} />
    </div>
  </div>
);

// --- App ---

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'SCHEDULE' | 'TEMPLATES' | 'DISTRICTS'>('SCHEDULE');
  
  // Settings State
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
      defaultMealCapacity: 155,
      defaultLaundryCapacity: 120
  });

  const [districts, setDistricts] = useState<District[]>(MOCK_DISTRICTS);
  const [districtSearch, setDistrictSearch] = useState(''); // Added search state
  const [selectedDistricts, setSelectedDistricts] = useState<Set<string>>(new Set()); // For batch actions

  const [templates, setTemplates] = useState<PlanTemplateModel[]>(MOCK_TEMPLATES);
  const [templateWeeks, setTemplateWeeks] = useState<PlanTemplateWeek[]>(MOCK_TEMPLATE_WEEKS);
  const [templateBlocks, setTemplateBlocks] = useState<PlanTemplateBlock[]>(MOCK_TEMPLATE_BLOCKS);
  
  const [schedules, setSchedules] = useState<WeekSchedule[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // Selection State
  const [filterTraining, setFilterTraining] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('2025-05-05');
  
  // UI View States
  const [viewMode, setViewMode] = useState<'GRID' | 'HEATMAP'>('GRID');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [expandedTemplateGroups, setExpandedTemplateGroups] = useState<Set<string>>(new Set(['POR6'])); // Accordion state

  // District Management States
  const [showAddDistrictModal, setShowAddDistrictModal] = useState(false);
  const [showBatchDistrictModal, setShowBatchDistrictModal] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Batch Creation State (Enhanced)
  const [batchConfig, setBatchConfig] = useState({
      trainingBase: 'POR',
      planNum: '6',
      startDate: new Date().toISOString().split('T')[0],
      count: 3,
      people: 10,
      startNum: 1,
      namingMode: 'LETTERS' // 'LETTERS' | 'NUMBERS'
  });

  // Template Editor State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editorWeekIndex, setEditorWeekIndex] = useState<number>(1);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Partial<PlanTemplateBlock> | null>(null);

  // Editing State (Schedule)
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);

  // Derived state
  const generatePreviewDistricts = useMemo(() => {
    if (!showBatchDistrictModal) return [];
    
    const { trainingBase, planNum, count, startNum, namingMode } = batchConfig;
    const planCode = `${trainingBase}${planNum}`;
    const preview: { id: string; exists: boolean }[] = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (let i = 0; i < count; i++) {
        let districtNumero = '', districtLetra = '';
        if (namingMode === 'LETTERS') {
            districtNumero = startNum.toString().padStart(2, '0');
            districtLetra = alphabet[i % 26];
        } else {
            const currentNum = startNum + i;
            districtNumero = currentNum.toString().padStart(2, '0');
        }
        const suffix = `${districtNumero}${districtLetra}`;
        const districtId = `${planCode}-${suffix}`;
        
        preview.push({
            id: districtId,
            exists: districts.some(d => d.districtId === districtId)
        });
    }
    return preview;
  }, [batchConfig, districts, showBatchDistrictModal]);

  const selectedTemplate = templates.find(t => t.templateModelId === selectedTemplateId);
  const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  // --- Effects ---
  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
        setSelectedTemplateId(templates[0].templateModelId);
    }
  }, [templates]);

  // --- Actions ---

  const addLog = (action: string, summary: string, details?: string, refId?: string) => {
    const newLog: SystemLog = {
      logId: generateId('LOG'),
      timestamp: new Date().toISOString(),
      action,
      summary,
      details,
    };
    if (refId) (newLog as any).referenceId = refId; 
    setLogs(prev => [newLog, ...prev]);
  };

  const handleGenerateWeek = () => {
    const trainingsToGenerate: string[] = [];
    if (filterTraining === 'ALL') {
       const uniqueTrainings = Array.from(new Set(districts.map(d => d.training))) as string[];
       trainingsToGenerate.push(...uniqueTrainings);
    } else {
       trainingsToGenerate.push(filterTraining);
    }

    if (trainingsToGenerate.length === 0) {
        alert('Nenhum treinamento encontrado para gerar.');
        return;
    }

    let allNewSlots: Slot[] = [];
    let allNewAssignments: Assignment[] = [];
    let allNewSchedules: WeekSchedule[] = [];

    trainingsToGenerate.forEach(trainingId => {
        const weekIndex = 1; 
        const result = generateWeekSchedule(
            trainingId,
            weekIndex,
            selectedDate,
            districts,
            templates,
            templateWeeks,
            templateBlocks
        );
        allNewSlots = [...allNewSlots, ...result.slots];
        allNewAssignments = [...allNewAssignments, ...result.assignments];
        allNewSchedules.push(result.schedule);
    });

    const weekEndDate = addDays(selectedDate, 6);
    const unaffectedSlots = slots.filter(s => 
        !(trainingsToGenerate.includes(s.training) && s.date >= selectedDate && s.date <= weekEndDate)
    );
    const keptSlotIds = new Set(unaffectedSlots.map(s => s.slotId));
    const unaffectedAssignments = assignments.filter(a => keptSlotIds.has(a.slotId));

    setSchedules(prev => [...prev, ...allNewSchedules]);
    setSlots([...unaffectedSlots, ...allNewSlots]);
    setAssignments([...unaffectedAssignments, ...allNewAssignments]);
    addLog('GERAR_SEMANA', `Gerada semana de ${selectedDate} para: ${trainingsToGenerate.join(', ')}`);
    const newConflicts = analyzeSchedule([...unaffectedSlots, ...allNewSlots], [...unaffectedAssignments, ...allNewAssignments], globalSettings);
    setConflicts(newConflicts);
  };
  
  const handleClearWeek = () => {
     if(!confirm('Tem certeza que deseja limpar todos os agendamentos desta semana? Isso não pode ser desfeito.')) return;
     const result = clearWeekSchedule(filterTraining, selectedDate, slots, assignments);
     setSlots(result.remainingSlots);
     setAssignments(result.remainingAssignments);
     addLog('LIMPAR_SEMANA', `Removidos ${result.count} agendamentos de ${selectedDate}`);
     const newConflicts = analyzeSchedule(result.remainingSlots, result.remainingAssignments, globalSettings);
     setConflicts(newConflicts);
  };

  const handleDuplicateWeek = (targetDate: string) => {
    const result = duplicateWeek(filterTraining, selectedDate, targetDate, slots, assignments, districts);
    setSlots(prev => [...prev, ...result.newSlots]);
    setAssignments(prev => [...prev, ...result.newAssignments]);
    addLog('DUPLICAR_SEMANA', result.log);
    const newConflicts = analyzeSchedule([...slots, ...result.newSlots], [...assignments, ...result.newAssignments], globalSettings);
    setConflicts(newConflicts);
    setShowDuplicateModal(false);
  };

  const handleExportCSV = () => {
     const weekEndDate = addDays(selectedDate, 6);
     const visibleSlots = slots
        .filter(s => 
            (filterTraining === 'ALL' || s.training === filterTraining) && 
            s.date >= selectedDate && s.date <= weekEndDate
        )
        .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
            return a.training.localeCompare(b.training);
        });
     const visibleAssignments = assignments.filter(a => visibleSlots.some(s => s.slotId === a.slotId));
     const csvContent = generateCSV(visibleSlots, visibleAssignments);
     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.setAttribute('download', `escala_${filterTraining}_${selectedDate}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     addLog('EXPORTAR_CSV', `Escala exportada para ${filterTraining} semana de ${selectedDate}`);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    if (isCreatingSlot) {
        const date = formData.get('date') as string;
        const startTime = formData.get('startTime') as string;
        const endTime = formData.get('endTime') as string;
        const type = formData.get('type') as SlotType;
        const mealType = type === SlotType.MEAL ? formData.get('mealType') as MealType : undefined;
        const training = formData.get('training') as string || filterTraining === 'ALL' ? 'MANUAL' : filterTraining;
        const capacity = parseInt(formData.get('capacityPeople') as string, 10);

        const newSlot: Slot = {
            slotId: generateId('MS-MANUAL'),
            type, training, weekIndex: 0, date, startTime, endTime, capacityPeople: capacity,
            source: SlotSource.MANUAL, mealType, updatedBy: 'UsuarioManual', overrideReason: formData.get('overrideReason') as string
        };
        const newSlotsList = [...slots, newSlot];
        setSlots(newSlotsList);
        addLog('CRIAR_SLOT_MANUAL', `Novo horário criado manualmente em ${date} ${startTime}`);
        setConflicts(analyzeSchedule(newSlotsList, assignments, globalSettings));
    } else {
        const currentType = editingSlot.type;
        const mealType = currentType === SlotType.MEAL ? (formData.get('mealType') as MealType) : undefined;
        const updatedSlot: Slot = {
            ...editingSlot,
            startTime: formData.get('startTime') as string,
            endTime: formData.get('endTime') as string,
            capacityPeople: parseInt(formData.get('capacityPeople') as string, 10),
            source: SlotSource.MANUAL, mealType, updatedBy: 'UsuarioAtual', overrideReason: formData.get('overrideReason') as string
        };
        const newSlots = slots.map(s => s.slotId === updatedSlot.slotId ? updatedSlot : s);
        setSlots(newSlots);
        addLog('EDICAO_MANUAL', `Slot ${updatedSlot.type} editado manualmente`, `Motivo: ${updatedSlot.overrideReason}`, updatedSlot.slotId);
        setConflicts(analyzeSchedule(newSlots, assignments, globalSettings));
    }
    setEditingSlot(null);
    setIsCreatingSlot(false);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const newSettings: GlobalSettings = {
          defaultMealCapacity: parseInt(formData.get('defaultMealCapacity') as string, 10),
          defaultLaundryCapacity: parseInt(formData.get('defaultLaundryCapacity') as string, 10)
      };
      setGlobalSettings(newSettings);
      addLog('ATUALIZAR_CONFIG', 'Capacidades globais atualizadas.');
      setShowSettingsModal(false);
      setConflicts(analyzeSchedule(slots, assignments, newSettings));
  };
  
  const handleSaveDistrict = (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const districtId = formData.get('districtId') as string;
      const inputTraining = formData.get('trainingBase') as string;
      const inputPlanNum = formData.get('planNum') as string; 
      const planCode = `${inputTraining}${inputPlanNum}`; 
      const missionaryCount = parseInt(formData.get('missionaryCount') as string, 10);
      const mtcStartDt = formData.get('mtcStartDt') as string;
      
      const finalDistrictId = districtId || `${planCode}-01A`;
      const suffix = finalDistrictId.split('-')[1] || '01A';
      const districtNumero = suffix.replace(/\D/g, '');
      const districtLetra = suffix.replace(/\d/g, '');

      if (editingDistrict) {
        const updatedDistrict: District = {
            ...editingDistrict,
            districtId: finalDistrictId, training: planCode, planCode, mtcStartDt, missionaryCount, manualMissionaryCount: missionaryCount, countSource: CountSource.MANUAL, isManual: true, updatedAt: new Date().toISOString()
        };
        setDistricts(prev => prev.map(d => d.districtId === editingDistrict.districtId ? updatedDistrict : d));
        addLog('EDITAR_DISTRITO', `Distrito ${finalDistrictId} atualizado manualmente.`);
      } else {
        if (districts.some(d => d.districtId === finalDistrictId)) { alert('Já existe um distrito com este ID.'); return; }
        const newDistrict: District = {
            districtId: finalDistrictId, training: planCode, districtNumero, districtLetra, planCode, mtcStartDt, missionaryCount, manualMissionaryCount: missionaryCount, countSource: CountSource.MANUAL, isManual: true, updatedAt: new Date().toISOString()
        };
        setDistricts(prev => [...prev, newDistrict]);
        addLog('CRIAR_DISTRITO', `Distrito ${finalDistrictId} adicionado manualmente.`);
      }
      setShowAddDistrictModal(false);
      setEditingDistrict(null);
  };

  const handleBatchCreateDistricts = (e: React.FormEvent) => {
      e.preventDefault();
      const { trainingBase, planNum, startDate, count, people, startNum, namingMode } = batchConfig;
      const planCode = `${trainingBase}${planNum}`;
      const newDistricts: District[] = [];
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      for (let i = 0; i < count; i++) {
          let districtNumero = '', districtLetra = '';
          if (namingMode === 'LETTERS') {
              districtNumero = startNum.toString().padStart(2, '0');
              districtLetra = alphabet[i % 26];
          } else {
              const currentNum = startNum + i;
              districtNumero = currentNum.toString().padStart(2, '0');
          }
          const suffix = `${districtNumero}${districtLetra}`;
          const districtId = `${planCode}-${suffix}`;
          if (districts.some(d => d.districtId === districtId) || newDistricts.some(d => d.districtId === districtId)) continue;
          newDistricts.push({ districtId, training: planCode, districtNumero, districtLetra, planCode, mtcStartDt: startDate, missionaryCount: people, manualMissionaryCount: people, countSource: CountSource.MANUAL, isManual: true, updatedAt: new Date().toISOString() });
      }
      if (newDistricts.length === 0) { alert('Nenhum distrito criado (possíveis duplicatas).'); return; }
      setDistricts(prev => [...prev, ...newDistricts]);
      addLog('CRIAR_LOTE_DISTRITOS', `Criados ${newDistricts.length} distritos para ${planCode}.`);
      setShowBatchDistrictModal(false);
  };
  
  const handleDeleteDistrict = (districtId: string) => {
      if(!confirm(`Tem certeza que deseja remover o distrito ${districtId}?`)) return;
      setDistricts(prev => prev.filter(d => d.districtId !== districtId));
      setSelectedDistricts(prev => { const next = new Set(prev); next.delete(districtId); return next; });
      addLog('APAGAR_DISTRITO', `Distrito ${districtId} removido.`);
  };

  const handleBatchDeleteDistricts = () => {
      if (selectedDistricts.size === 0) return;
      if (!confirm(`Tem certeza que deseja excluir ${selectedDistricts.size} distritos?`)) return;
      setDistricts(prev => prev.filter(d => !selectedDistricts.has(d.districtId)));
      addLog('APAGAR_LOTE', `Removidos ${selectedDistricts.size} distritos.`);
      setSelectedDistricts(new Set());
  };

  const toggleDistrictSelection = (id: string) => {
      setSelectedDistricts(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const toggleAllDistricts = (filtered: District[]) => {
      if (selectedDistricts.size === filtered.length && filtered.length > 0) {
          setSelectedDistricts(new Set());
      } else {
          setSelectedDistricts(new Set(filtered.map(d => d.districtId)));
      }
  };

  const handleImportDistricts = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const text = event.target?.result as string;
          if (!text) return;
          const lines = text.split('\n');
          const aggregatedDistricts = new Map<string, District>();
          let importedCount = 0;
          const startIndex = lines[0].toLowerCase().includes('training') ? 1 : 0;

          for (let i = startIndex; i < lines.length; i++) {
              const cols = lines[i].trim().split(',').map(c => c.trim().replace(/^"|"$/g, ''));
              if (cols.length >= 6 && cols[0] && cols[3]) {
                   const trainingBase = cols[0]; const distNum = cols[1].padStart(2, '0'); const distLet = cols[2].toUpperCase(); const planNum = cols[3]; const startDate = cols[5]; 
                   const planCode = `${trainingBase}${planNum}`;
                   const districtId = `${planCode}-${distNum}${distLet}`;
                   if (aggregatedDistricts.has(districtId)) {
                       const existing = aggregatedDistricts.get(districtId)!; existing.missionaryCount += 1; existing.manualMissionaryCount += 1;
                   } else {
                       aggregatedDistricts.set(districtId, { districtId, training: planCode, districtNumero: distNum, districtLetra: distLet, planCode: planCode, mtcStartDt: startDate, missionaryCount: 1, manualMissionaryCount: 1, countSource: CountSource.MASTERLIST, isManual: false, updatedAt: new Date().toISOString() });
                   }
                   importedCount++;
              }
          }
          if (aggregatedDistricts.size > 0) {
              const newDistricts = Array.from(aggregatedDistricts.values());
              setDistricts(prev => { const map = new Map(prev.map(d => [d.districtId, d])); newDistricts.forEach(d => map.set(d.districtId, d)); return Array.from(map.values()); });
              addLog('IMPORTAR_MASTER_LIST', `Processados ${importedCount} missionários em ${newDistricts.length} distritos.`);
              setShowImportModal(false);
          } else { alert('Nenhum dado válido encontrado. Verifique o formato CSV.'); }
      };
      reader.readAsText(file);
  };
  
  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Training,DistrictNum,DistrictLet,Plan,MissionaryName,StartDate\nPOR,01,A,6,Elder Smith,2025-05-01\nPOR,01,A,6,Elder Jones,2025-05-01\nESP,02,B,3,Sister Doe,2025-05-05";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "master_list_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Template Creation & Grouping Logic ---

  const handleCreateNewGroup = (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const groupName = formData.get('groupName') as string; // Acts as Category & Base Code
      const weeksCount = parseInt(formData.get('weeksCount') as string, 10);
      
      // Create Version 1 automatically
      const newTemplate: PlanTemplateModel = { 
          templateModelId: `TM-${groupName}-v1`, 
          planCode: `${groupName}.1`, 
          name: `${groupName} Versão 1`, 
          category: groupName, 
          weeksCount, 
          isActive: true, 
          createdAt: new Date().toISOString() 
      };
      
      const newWeeks: PlanTemplateWeek[] = Array.from({ length: weeksCount }, (_, i) => ({ templateWeekId: `TW-${newTemplate.planCode}-W${i + 1}`, templateModelId: newTemplate.templateModelId, weekIndex: i + 1 }));
      
      setTemplates(prev => [...prev, newTemplate]);
      setTemplateWeeks(prev => [...prev, ...newWeeks]);
      setSelectedTemplateId(newTemplate.templateModelId);
      
      // Expand the new group
      setExpandedTemplateGroups(prev => { const next = new Set(prev); next.add(groupName); return next; });
      
      addLog('CRIAR_GRUPO', `Novo Grupo ${groupName} criado com Versão 1.`);
      setShowCreateTemplateModal(false);
  };

  const handleAddVersionToGroup = (groupName: string) => {
      // Find existing templates in this group to calculate next version
      const groupTemplates = templates.filter(t => t.category === groupName);
      // Heuristic: Extract the number after the last dot or space
      const versions = groupTemplates.map(t => {
          const match = t.planCode.match(/\.(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
      });
      const maxVersion = Math.max(0, ...versions);
      const nextVersion = maxVersion + 1;
      
      // Use duration of latest version as default, or 8 weeks fallback
      const baseTemplate = groupTemplates[groupTemplates.length - 1];
      const weeksCount = baseTemplate ? baseTemplate.weeksCount : 8;

      const newTemplate: PlanTemplateModel = {
          templateModelId: `TM-${groupName}-v${nextVersion}`,
          planCode: `${groupName}.${nextVersion}`,
          name: `${groupName} Versão ${nextVersion}`,
          category: groupName,
          weeksCount,
          isActive: true,
          createdAt: new Date().toISOString()
      };
      
      const newWeeks: PlanTemplateWeek[] = Array.from({ length: weeksCount }, (_, i) => ({ templateWeekId: `TW-${newTemplate.planCode}-W${i + 1}`, templateModelId: newTemplate.templateModelId, weekIndex: i + 1 }));

      setTemplates(prev => [...prev, newTemplate]);
      setTemplateWeeks(prev => [...prev, ...newWeeks]);
      setSelectedTemplateId(newTemplate.templateModelId);
      addLog('NOVA_VERSAO', `Criada versão ${nextVersion} para ${groupName}.`);
  };

  const handleAddWeekToTemplate = () => {
      if (!selectedTemplate) return;
      const newWeekIndex = selectedTemplate.weeksCount + 1;
      const updatedTemplate = { ...selectedTemplate, weeksCount: newWeekIndex };
      const newWeek: PlanTemplateWeek = { templateWeekId: `TW-${selectedTemplate.planCode}-W${newWeekIndex}`, templateModelId: selectedTemplate.templateModelId, weekIndex: newWeekIndex };
      setTemplates(prev => prev.map(t => t.templateModelId === selectedTemplate.templateModelId ? updatedTemplate : t));
      setTemplateWeeks(prev => [...prev, newWeek]);
      setEditorWeekIndex(newWeekIndex);
      addLog('ADICIONAR_SEMANA', `Adicionada semana ${newWeekIndex} ao modelo.`);
  };

  const handleDeleteTemplate = (templateId: string) => {
      if(!confirm('Tem certeza?')) return;
      setTemplates(prev => prev.filter(t => t.templateModelId !== templateId));
      if (selectedTemplateId === templateId) setSelectedTemplateId(null);
      addLog('APAGAR_TEMPLATE', `Modelo removido.`);
  };

  const handleSaveBlock = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTemplateId || !editingBlock) return;
      const week = templateWeeks.find(tw => tw.templateModelId === selectedTemplateId && tw.weekIndex === editorWeekIndex);
      if (!week) return;
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const type = formData.get('type') as SlotType;
      const blockData: PlanTemplateBlock = {
          templateBlockId: editingBlock.templateBlockId || generateId('TB'),
          templateWeekId: week.templateWeekId,
          type: type,
          weekday: parseInt(formData.get('weekday') as string, 10),
          startTime: formData.get('startTime') as string,
          endTime: formData.get('endTime') as string,
          capacityPeople: parseInt(formData.get('capacityPeople') as string, 10),
          mealType: type === SlotType.MEAL ? (formData.get('mealType') as MealType) : undefined
      };
      if (editingBlock.templateBlockId) {
          setTemplateBlocks(prev => prev.map(b => b.templateBlockId === blockData.templateBlockId ? blockData : b));
      } else {
          setTemplateBlocks(prev => [...prev, blockData]);
      }
      setShowBlockModal(false);
      setEditingBlock(null);
  };

  const handleDeleteBlock = (blockId: string) => {
      if (!confirm('Remover bloco?')) return;
      setTemplateBlocks(prev => prev.filter(b => b.templateBlockId !== blockId));
  };

  // --- Helpers for Grouping ---
  const toggleGroup = (key: string) => {
    setExpandedTemplateGroups(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });
  };

  const groupedTemplates = useMemo(() => {
    // Group purely by category (which is the Group Name e.g., POR6)
    return templates.reduce((acc, t) => {
        const groupName = t.category || 'Outros';
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(t);
        return acc;
    }, {} as Record<string, PlanTemplateModel[]>);
  }, [templates]);

  // Sort groups naturally (try to keep standard ones first if needed, but alphabet is fine)
  // Sort versions numerically inside group
  const sortedGroupKeys = Object.keys(groupedTemplates).sort();

  // --- Views Renders ---

  const renderScheduleView = () => { /* Same as before, keeping code minimal change */
    const weekEndDate = addDays(selectedDate, 6);
    const visibleSlots = slots.filter(s => (filterTraining === 'ALL' || s.training === filterTraining) && s.date >= selectedDate && s.date <= weekEndDate);
    const sortedSlots = visibleSlots.sort((a,b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
    });
    const groupedByDay = sortedSlots.reduce((acc, slot) => { acc[slot.date] = acc[slot.date] || []; acc[slot.date].push(slot); return acc; }, {} as Record<string, Slot[]>);
    const weekDaysArr = Array.from({length: 7}, (_, i) => addDays(selectedDate, i));
    const totalAssignments = visibleSlots.reduce((acc, slot) => acc + assignments.filter(a => a.slotId === slot.slotId).reduce((s, a) => s + a.missionaryCountAtCalculation, 0), 0);

    return (
      <div className="space-y-6 animate-fade-in h-full flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
            <StatCard label="Conflitos Ativos" value={conflicts.length} icon={AlertTriangle} color={conflicts.length > 0 ? "red" : "brand"} />
            <StatCard label="Total Agendado" value={totalAssignments} icon={Users} trend="+12% vs sem. anterior" />
            <StatCard label="Horários Criados" value={visibleSlots.length} icon={Layout} color="green" />
        </div>
        <div className="flex flex-col xl:flex-row justify-between items-center bg-white p-4 rounded-3xl border border-white shadow-soft gap-4 flex-shrink-0">
             <div className="flex items-center gap-6 w-full xl:w-auto">
                <div><h2 className="text-lg font-black text-slate-800">Agenda Semanal</h2><div className="text-xs text-slate-400 font-medium">Gestão de alocações</div></div>
                <div className="h-8 w-px bg-slate-100"></div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                   <button onClick={() => setViewMode('GRID')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'GRID' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Grid size={14} /> Grade</button>
                   <button onClick={() => setViewMode('HEATMAP')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'HEATMAP' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Activity size={14} /> Mapa</button>
                </div>
                <button onClick={() => setShowSettingsModal(true)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-all"><Sliders size={20} /></button>
                <div className="hidden md:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Filtro</span>
                    <select value={filterTraining} onChange={(e) => setFilterTraining(e.target.value)} className="bg-transparent font-bold text-brand-600 outline-none text-sm cursor-pointer"><option value="ALL">Todos</option>{templates.map(t => (<option key={t.planCode} value={t.planCode}>{t.planCode}</option>))}</select>
                </div>
            </div>
            <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
                 <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-50 border border-transparent hover:border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 font-bold outline-none focus:ring-2 focus:ring-brand-100 transition-all" />
                 <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
                    <Tooltip text="Limpar"><button onClick={handleClearWeek} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg"><Trash2 size={18} /></button></Tooltip>
                    <div className="w-px h-6 bg-slate-200 mx-1"></div>
                    <Tooltip text="Duplicar"><button onClick={() => setShowDuplicateModal(true)} className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg"><Copy size={18} /></button></Tooltip>
                    <Tooltip text="Exportar"><button onClick={handleExportCSV} className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg"><Download size={18} /></button></Tooltip>
                 </div>
                 <button onClick={() => { setEditingSlot({ slotId: '', type: SlotType.MEAL, training: '', weekIndex: 0, date: selectedDate, startTime: '12:00', endTime: '13:00', capacityPeople: 155, source: SlotSource.MANUAL }); setIsCreatingSlot(true); }} className="bg-white text-brand-600 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-soft border border-slate-100 hover:bg-brand-50 transition-all"><Plus size={18} /> Novo Horário</button>
                 <button onClick={handleGenerateWeek} className="bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-brand-200 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"><RefreshCw size={18} className={slots.length === 0 ? "animate-spin-slow" : ""} /> Gerar</button>
            </div>
        </div>
        <div className="flex-1 overflow-hidden rounded-3xl bg-white shadow-soft border border-white/50 p-6 flex flex-col min-h-0">
             {conflicts.length > 0 && (
                <div className="mb-6 bg-white rounded-3xl shadow-soft border border-red-100 overflow-hidden flex flex-col animate-slide-down flex-shrink-0">
                    <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-red-100 text-red-600 p-2 rounded-xl"><AlertTriangle size={20}/></div><div><h3 className="font-bold text-red-900 text-sm">Alertas ({conflicts.length})</h3></div></div></div>
                    <div className="max-h-48 overflow-y-auto p-2">
                        {conflicts.map(c => (
                            <button key={c.id} className="w-full text-left p-3 hover:bg-red-50 rounded-xl flex items-start gap-3 transition-colors group border border-transparent hover:border-red-100">
                                <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" /><div className="flex-1"><div className="text-sm font-bold text-slate-700">{c.type}</div><div className="text-xs text-slate-500">{c.description}</div></div>
                            </button>
                        ))}
                    </div>
                </div>
             )}
             <div className="grid grid-cols-7 gap-4 h-full overflow-y-auto pr-2 pb-2">
                {weekDaysArr.map(date => {
                    const daySlots = groupedByDay[date] || [];
                    const d = new Date(date);
                    return (
                    <div key={date} className="flex flex-col min-h-[300px]">
                        <div className="text-center p-3 rounded-2xl mb-3 border bg-white text-slate-500 border-slate-100"><div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{d.toLocaleDateString('pt-BR', {weekday: 'short'})}</div><div className="text-lg font-black">{d.getDate()}</div></div>
                        <div className="space-y-3 flex-1">
                        {daySlots.map(slot => {
                            const slotAssignments = assignments.filter(a => a.slotId === slot.slotId);
                            const occupied = slotAssignments.reduce((acc, a) => acc + a.missionaryCountAtCalculation, 0);
                            const hasConflict = conflicts.some(c => c.relatedIds.includes(slot.slotId));
                            const isMeal = slot.type === SlotType.MEAL;
                            
                            if (viewMode === 'HEATMAP') {
                                const utilization = slot.capacityPeople > 0 ? occupied/slot.capacityPeople : 0;
                                let heatClass = occupied > slot.capacityPeople ? 'bg-red-500 text-white' : utilization > 0.8 ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-400';
                                return (<div key={slot.slotId} onClick={() => setEditingSlot(slot)} className={`p-3 rounded-xl cursor-pointer border ${heatClass} ${hasConflict ? 'ring-4 ring-red-300' : ''}`}><div className="text-xs font-bold flex justify-between"><span>{formatTime(slot.startTime)}</span><span>{Math.round(utilization*100)}%</span></div></div>);
                            }
                            return (
                            <div key={slot.slotId} onClick={() => setEditingSlot(slot)} className={`group relative p-3.5 rounded-2xl transition-all cursor-pointer border-2 hover:-translate-y-1 ${hasConflict ? 'border-red-400 bg-red-50' : 'border-transparent bg-slate-50 hover:border-brand-200'}`}>
                                <div className="flex justify-between items-start mb-2"><div className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isMeal ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{formatTime(slot.startTime)}</div><div className="text-[9px] font-black bg-white/60 px-1.5 py-0.5 rounded text-slate-500 uppercase tracking-wider">{slot.training}</div></div>
                                <div className="text-slate-700 font-bold text-xs mb-1.5 leading-tight">{slot.mealType || 'Lavanderia'}</div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold mb-3"><Users size={12}/><span>{occupied}/{slot.capacityPeople}</span></div>
                            </div>
                            );
                        })}
                        </div>
                    </div>
                    );
                })}
             </div>
        </div>
      </div>
    );
  };

  const renderTemplateView = () => {
    const currentBlocks = templateBlocks.filter(b => b.templateWeekId === templateWeeks.find(tw => tw.templateModelId === selectedTemplateId && tw.weekIndex === editorWeekIndex)?.templateWeekId).sort((a,b) => a.startTime.localeCompare(b.startTime));
    return (
      <div className="h-full flex gap-6 animate-fade-in">
        <div className="w-80 bg-white rounded-3xl shadow-soft border border-white/50 flex flex-col overflow-hidden flex-shrink-0">
             <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50"><h3 className="font-bold text-slate-700">Modelos</h3><button onClick={() => setShowCreateTemplateModal(true)} className="p-2 bg-white text-brand-600 rounded-xl shadow-sm hover:bg-brand-50" title="Novo Grupo"><Plus size={18}/></button></div>
             <div className="overflow-y-auto flex-1 p-2 space-y-2">
                 {sortedGroupKeys.map(groupName => {
                     const isExpanded = expandedTemplateGroups.has(groupName);
                     const items = groupedTemplates[groupName].sort((a, b) => {
                         const vA = parseInt(a.planCode.split('.')[1] || '0');
                         const vB = parseInt(b.planCode.split('.')[1] || '0');
                         return vA - vB;
                     });

                     return (
                         <div key={groupName} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                             <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                                 <button onClick={() => toggleGroup(groupName)} className="flex items-center gap-2 flex-1 text-left">
                                     {isExpanded ? <ChevronDown size={16} className="text-slate-400"/> : <ChevronRight size={16} className="text-slate-400"/>}
                                     <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">{groupName}</span>
                                 </button>
                                 <button onClick={() => handleAddVersionToGroup(groupName)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg transition-colors" title={`Adicionar Versão a ${groupName}`}>
                                     <Plus size={14}/>
                                 </button>
                             </div>
                             
                             {isExpanded && (
                                 <div className="px-2 pb-2 space-y-1">
                                     {items.map(t => (
                                         <button key={t.templateModelId} onClick={() => setSelectedTemplateId(t.templateModelId)} className={`w-full text-left px-3 py-2 rounded-xl transition-all flex justify-between items-center ${selectedTemplateId === t.templateModelId ? 'bg-brand-50 text-brand-700 font-bold border border-brand-100' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'}`}>
                                             <span className="text-xs">{t.name.replace(groupName, '').trim() || t.name}</span>
                                             {selectedTemplateId === t.templateModelId && <CheckCircle size={12} />}
                                         </button>
                                     ))}
                                 </div>
                             )}
                         </div>
                     );
                 })}
             </div>
        </div>
        <div className="flex-1 bg-white rounded-3xl shadow-soft border border-white/50 flex flex-col overflow-hidden">
             {selectedTemplate ? (
                 <>
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center"><div><h2 className="text-xl font-black text-slate-800">{selectedTemplate.name}</h2><div className="flex gap-2 mt-1"><Badge color="brand">{selectedTemplate.category || 'Geral'}</Badge><span className="text-xs font-bold text-slate-400">{selectedTemplate.planCode}</span></div></div><div className="flex gap-2"><button onClick={() => handleDeleteTemplate(selectedTemplate.templateModelId)} className="p-2.5 text-slate-400 hover:text-red-500 rounded-xl"><Trash2 size={20}/></button></div></div>
                    <div className="px-6 pt-4 flex items-center gap-2 overflow-x-auto no-scrollbar">{Array.from({ length: selectedTemplate.weeksCount }).map((_, i) => (<button key={i+1} onClick={() => setEditorWeekIndex(i+1)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${editorWeekIndex === i+1 ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-400'}`}>Semana {i+1}</button>))}<button onClick={handleAddWeekToTemplate} className="px-3 py-2 rounded-xl bg-brand-50 text-brand-600"><Plus size={16}/></button></div>
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700">Blocos</h3><button onClick={() => { setEditingBlock({ templateWeekId: templateWeeks.find(tw => tw.templateModelId === selectedTemplateId && tw.weekIndex === editorWeekIndex)?.templateWeekId, weekday: 1 }); setShowBlockModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold"><Plus size={16}/> Bloco</button></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{currentBlocks.map(block => (<div key={block.templateBlockId} className="group bg-slate-50 border border-slate-100 p-4 rounded-2xl relative"><div className="text-[10px] font-bold uppercase text-slate-400">{weekDays[block.weekday - 1]}</div><div className="text-lg font-black text-slate-800 mb-1">{block.startTime} - {block.endTime}</div><div className="flex gap-2 mt-2"><button onClick={() => { setEditingBlock(block); setShowBlockModal(true); }} className="p-1.5 bg-white text-brand-600 rounded-lg shadow-sm"><Pencil size={12}/></button><button onClick={() => handleDeleteBlock(block.templateBlockId)} className="p-1.5 bg-white text-red-500 rounded-lg shadow-sm"><Trash2 size={12}/></button></div></div>))}</div>
                    </div>
                 </>
             ) : <div className="flex items-center justify-center h-full text-slate-300">Selecione um modelo</div>}
        </div>
      </div>
    );
  };

  const renderDistrictsView = () => {
      const filteredDistricts = districts.filter(d => 
        d.districtId.toLowerCase().includes(districtSearch.toLowerCase()) || 
        d.planCode.toLowerCase().includes(districtSearch.toLowerCase()) ||
        (d.districtNumero + d.districtLetra).toLowerCase().includes(districtSearch.toLowerCase())
      );
      
      const allSelected = filteredDistricts.length > 0 && selectedDistricts.size === filteredDistricts.length;

      return (
          <div className="space-y-6 animate-fade-in h-full flex flex-col">
              <div className="bg-white p-4 rounded-3xl shadow-soft border border-white/50 flex justify-between items-center flex-shrink-0">
                  <div className="flex items-center gap-4">
                       <h2 className="text-lg font-black text-slate-800 ml-2">Distritos</h2>
                       <div className="h-8 w-px bg-slate-100"></div>
                       <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl w-64">
                           <Search size={18} className="text-slate-400"/>
                           <input type="text" placeholder="Buscar distrito..." value={districtSearch} onChange={(e) => setDistrictSearch(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full placeholder:text-slate-300" />
                       </div>
                  </div>
                  <div className="flex gap-2">
                      {selectedDistricts.size > 0 && (
                          <button onClick={handleBatchDeleteDistricts} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-xl text-sm font-bold transition-colors animate-scale-in">
                              <Trash2 size={18}/> Excluir ({selectedDistricts.size})
                          </button>
                      )}
                      <div className="w-px h-8 bg-slate-100 mx-2"></div>
                      <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors"><UploadCloud size={18}/> Importar</button>
                      <button onClick={() => setShowBatchDistrictModal(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-100 text-brand-700 hover:bg-brand-200 rounded-xl text-sm font-bold transition-colors"><Layers size={18}/> Gerar Lote</button>
                      <button onClick={() => { setEditingDistrict(null); setShowAddDistrictModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-brand-200"><Plus size={18}/> Novo Distrito</button>
                  </div>
              </div>

              <div className="bg-white rounded-3xl shadow-soft border border-white/50 flex-1 overflow-hidden flex flex-col">
                  <div className="overflow-x-auto overflow-y-auto flex-1 p-2">
                      <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-white z-10">
                              <tr>
                                  <th className="p-4 w-12 border-b border-slate-100">
                                      <button onClick={() => toggleAllDistricts(filteredDistricts)} className="text-slate-400 hover:text-brand-600 transition-colors">
                                          {allSelected ? <CheckSquare size={20} className="text-brand-600"/> : <Square size={20}/>}
                                      </button>
                                  </th>
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">ID Distrito</th>
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Plano</th>
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Início</th>
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Missionários</th>
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Status</th>
                                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">AÇÕES</th>
                              </tr>
                          </thead>
                          <tbody>
                              {filteredDistricts.map(d => (
                                  <tr key={d.districtId} className={`group transition-colors ${selectedDistricts.has(d.districtId) ? 'bg-brand-50/50' : 'hover:bg-slate-50'}`}>
                                      <td className="p-4 border-b border-slate-50">
                                          <button onClick={() => toggleDistrictSelection(d.districtId)} className={`transition-colors ${selectedDistricts.has(d.districtId) ? 'text-brand-600' : 'text-slate-300 hover:text-slate-500'}`}>
                                              {selectedDistricts.has(d.districtId) ? <CheckSquare size={20}/> : <Square size={20}/>}
                                          </button>
                                      </td>
                                      <td className="p-4 border-b border-slate-50">
                                          <div className="font-bold text-slate-700">{d.districtId}</div>
                                          <div className="text-[10px] text-slate-400 font-medium">Num: {d.districtNumero}{d.districtLetra}</div>
                                      </td>
                                      <td className="p-4 border-b border-slate-50">
                                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold">{d.planCode}</span>
                                      </td>
                                      <td className="p-4 border-b border-slate-50 text-sm font-medium text-slate-600">{new Date(d.mtcStartDt).toLocaleDateString('pt-BR')}</td>
                                      <td className="p-4 border-b border-slate-50">
                                          <div className="flex items-center gap-2">
                                              <Users size={14} className="text-slate-400"/>
                                              <span className="font-bold text-slate-700">{d.missionaryCount}</span>
                                          </div>
                                      </td>
                                      <td className="p-4 border-b border-slate-50">
                                          {d.isManual ? (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded"><Edit size={10}/> Manual</span>
                                          ) : (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded"><CheckCircle size={10}/> Auto</span>
                                          )}
                                      </td>
                                      <td className="p-4 border-b border-slate-50 text-right">
                                          <div className="flex justify-end gap-1">
                                              <button onClick={() => { setEditingDistrict(d); setShowAddDistrictModal(true); }} className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Editar"><Pencil size={16}/></button>
                                              <button onClick={() => handleDeleteDistrict(d.districtId)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><Trash2 size={16}/></button>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                              {filteredDistricts.length === 0 && (
                                  <tr>
                                      <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">Nenhum distrito encontrado.</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="h-screen w-full bg-slate-100 p-4 md:p-6 flex gap-6 font-sans text-slate-900 overflow-hidden">
        {/* Floating Sidebar */}
        <aside className="hidden md:flex flex-col w-72 bg-white rounded-[2.5rem] shadow-soft py-8 px-6 justify-between flex-shrink-0 z-20">
            <div>
                <div className="flex items-center gap-3 mb-12 px-2">
                    <div className="bg-brand-600 text-white p-2.5 rounded-2xl shadow-lg shadow-brand-300"><Layout size={24} strokeWidth={3} /></div>
                    <div><h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">CTM</h1><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Agendamento</span></div>
                </div>
                <nav className="space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 mb-4">Menu Principal</div>
                    {[ { id: 'SCHEDULE', icon: Calendar, label: 'Agenda' }, { id: 'TEMPLATES', icon: Layout, label: 'Modelos' }, { id: 'DISTRICTS', icon: Users, label: 'Distritos' }, { id: 'SETTINGS', icon: Settings, label: 'Configurações' } ].map(item => (
                        <button key={item.id} onClick={() => item.id !== 'SETTINGS' && setActiveTab(item.id as any)} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${activeTab === item.id ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 scale-105' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                        <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />{item.label}</button>
                    ))}
                </nav>
            </div>
            <div className="bg-slate-50 p-4 rounded-3xl flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="w-10 h-10 rounded-full bg-brand-200 border-2 border-white shadow-sm flex items-center justify-center text-brand-700 font-bold">AD</div>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-slate-900 truncate">Admin</div><div className="text-xs text-slate-500 truncate">admin@ctm.org</div></div>
                <LogOut size={16} className="text-slate-400"/>
            </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 relative">
            <header className="flex justify-between items-center mb-6 px-2">
                <div><h1 className="text-3xl font-black text-slate-800 tracking-tight">{activeTab === 'SCHEDULE' ? 'Agenda' : activeTab === 'TEMPLATES' ? 'Modelos' : 'Distritos'}</h1><p className="text-slate-400 font-medium">Bem-vindo, aqui está o resumo de hoje.</p></div>
                <div className="flex items-center gap-4"><button className="bg-white p-3 rounded-2xl shadow-soft text-slate-400 hover:text-brand-600 transition-colors relative"><Bell size={20} />{logs.length > 0 && <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}</button></div>
            </header>

            <div className="flex-1 min-h-0 relative">
                 {activeTab === 'SCHEDULE' && renderScheduleView()}
                 {activeTab === 'TEMPLATES' && renderTemplateView()}
                 {activeTab === 'DISTRICTS' && renderDistrictsView()}
            </div>
        </main>
      
        {/* Toast Notification */}
        {logs.length > 0 && (
            <div className="fixed bottom-6 right-6 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-slide-up max-w-sm cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => setLogs(l => l.slice(1))}>
                <div className="bg-slate-800 p-2 rounded-xl"><CheckCircle size={16} className="text-emerald-400"/></div><div><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{logs[0].action}</div><div className="text-sm font-medium">{logs[0].summary}</div></div><button className="text-slate-500 hover:text-white"><X size={16}/></button>
            </div>
        )}

        {/* --- GLOBAL MODALS --- */}
        {/* Global Settings Modal */}
        {showSettingsModal && (
             <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm animate-scale-in p-8 border border-white">
                     <h3 className="font-black text-2xl text-slate-800 mb-2">Configurações Globais</h3>
                     <p className="text-slate-500 text-sm mb-6">Defina os limites padrão de capacidade.</p>
                     <form onSubmit={handleSaveSettings} className="space-y-4">
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Capacidade Refeitório (Geral)</label><input name="defaultMealCapacity" type="number" defaultValue={globalSettings.defaultMealCapacity} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required min="1" /></div>
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Capacidade Lavanderia (Geral)</label><input name="defaultLaundryCapacity" type="number" defaultValue={globalSettings.defaultLaundryCapacity} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required min="1" /></div>
                        <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowSettingsModal(false)} className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button><button type="submit" className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 transition-all hover:-translate-y-1">Salvar</button></div>
                     </form>
                </div>
             </div>
        )}

        {/* Duplicate Week Modal */}
        {showDuplicateModal && (
             <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm animate-scale-in p-8 border border-white">
                     <h3 className="font-black text-2xl text-slate-800 mb-2">Duplicar Semana</h3>
                     <p className="text-slate-500 text-sm mb-6">Copiar agenda de <span className="font-bold text-slate-800">{selectedDate}</span> para outra semana.</p>
                     <div className="space-y-4">
                        <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Início da Semana Alvo (Segunda)</label><input type="date" id="targetDateInput" className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none mt-1" /></div>
                        <div className="bg-blue-50 p-3 rounded-xl text-xs text-blue-700 border border-blue-100"><strong>Nota:</strong> Isso criará cópias manuais de todos os horários. Recomendamos limpar a semana alvo antes.</div>
                        <div className="flex gap-3 pt-2"><button onClick={() => setShowDuplicateModal(false)} className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button><button onClick={() => { const input = document.getElementById('targetDateInput') as HTMLInputElement; if(input.value) handleDuplicateWeek(input.value); }} className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 transition-all hover:-translate-y-1">Duplicar</button></div>
                     </div>
                </div>
             </div>
        )}
        
        {/* Create Template Modal */}
        {showCreateTemplateModal && (
             <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm animate-scale-in p-8 border border-white">
                     <h3 className="font-black text-2xl text-slate-800 mb-2">Novo Grupo</h3>
                     <p className="text-slate-500 text-sm mb-6">Crie uma nova família de planos (inicia na v1).</p>
                     <form onSubmit={handleCreateNewGroup} className="space-y-4">
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Nome do Grupo (Ex: ALE5)</label><input name="groupName" type="text" placeholder="Ex: POR6, ALE3" className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none uppercase" required /></div>
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Duração Padrão (Semanas)</label><input name="weeksCount" type="number" min="1" max="50" defaultValue="6" className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div>
                        <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowCreateTemplateModal(false)} className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button><button type="submit" className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 transition-all hover:-translate-y-1">Criar Grupo</button></div>
                     </form>
                </div>
             </div>
        )}

        {/* Batch Create District Modal */}
        {showBatchDistrictModal && (
             <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl animate-scale-in p-8 border border-white flex flex-col md:flex-row gap-8">
                     <div className="flex-1">
                        <h3 className="font-black text-2xl text-slate-800 mb-2">Criar Distritos em Lote</h3>
                        <p className="text-slate-500 text-sm mb-6">Gere múltiplos distritos automaticamente.</p>
                        <form onSubmit={handleBatchCreateDistricts} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Treinamento</label>
                                    <input type="text" placeholder="Ex: POR" className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none uppercase" value={batchConfig.trainingBase} onChange={(e) => setBatchConfig({...batchConfig, trainingBase: e.target.value.toUpperCase()})} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Num. Plano</label>
                                    <input type="text" placeholder="Ex: 6" className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" value={batchConfig.planNum} onChange={(e) => setBatchConfig({...batchConfig, planNum: e.target.value})} required />
                                </div>
                            </div>
                            <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Início</label><input name="mtcStartDt" type="date" value={batchConfig.startDate} onChange={(e) => setBatchConfig({...batchConfig, startDate: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div>
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Qtd. Distritos</label><input name="districtCount" type="number" min="1" max="20" value={batchConfig.count} onChange={(e) => setBatchConfig({...batchConfig, count: parseInt(e.target.value)})} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div><div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pessoas/Distrito</label><input name="peoplePerDistrict" type="number" min="1" value={batchConfig.people} onChange={(e) => setBatchConfig({...batchConfig, people: parseInt(e.target.value)})} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div></div>
                            <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Padrão de Nomenclatura</label><div className="grid grid-cols-2 gap-4 bg-slate-50 p-2 rounded-xl"><label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white transition-colors"><input type="radio" name="namingMode" value="LETTERS" checked={batchConfig.namingMode === 'LETTERS'} onChange={() => setBatchConfig({...batchConfig, namingMode: 'LETTERS'})} className="accent-brand-600 w-4 h-4" /><div className="text-xs"><span className="block font-bold text-slate-700">Letras</span><span className="text-[10px] text-slate-400">01A, 01B...</span></div></label><label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white transition-colors"><input type="radio" name="namingMode" value="NUMBERS" checked={batchConfig.namingMode === 'NUMBERS'} onChange={() => setBatchConfig({...batchConfig, namingMode: 'NUMBERS'})} className="accent-brand-600 w-4 h-4" /><div className="text-xs"><span className="block font-bold text-slate-700">Sequencial</span><span className="text-[10px] text-slate-400">01, 02...</span></div></label></div></div>
                            <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Número Inicial</label><input name="startNumber" type="number" min="1" value={batchConfig.startNum} onChange={(e) => setBatchConfig({...batchConfig, startNum: parseInt(e.target.value)})} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div>
                            <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowBatchDistrictModal(false)} className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button><button type="submit" className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 transition-all hover:-translate-y-1">Gerar Lote</button></div>
                        </form>
                     </div>
                     <div className="w-full md:w-64 bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2"><Activity size={14}/> Pré-visualização</div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {generatePreviewDistricts.map((item, idx) => (<div key={idx} className={`p-2 rounded-lg flex items-center justify-between text-xs font-bold border ${item.exists ? 'bg-red-50 text-red-600 border-red-100' : 'bg-white text-slate-600 border-slate-200'}`}><span>{item.id}</span>{item.exists && <AlertCircle size={14} />}</div>))}
                            {generatePreviewDistricts.length === 0 && <div className="text-center text-slate-400 text-xs italic py-4">Configure para visualizar</div>}
                        </div>
                        <div className="pt-3 border-t border-slate-200 mt-2 text-[10px] text-slate-400 font-medium text-center">Total: {batchConfig.count} distritos</div>
                     </div>
                </div>
             </div>
        )}

        {/* Add/Edit District Modal */}
        {showAddDistrictModal && (
             <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md animate-scale-in p-8 border border-white">
                     <h3 className="font-black text-2xl text-slate-800 mb-2">{editingDistrict ? 'Editar Distrito' : 'Novo Distrito'}</h3>
                     <p className="text-slate-500 text-sm mb-6">{editingDistrict ? 'Atualizar dados existentes.' : 'Cadastro manual de um distrito individual.'}</p>
                     
                     <form onSubmit={handleSaveDistrict} className="space-y-4">
                        {!editingDistrict && (
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-2">
                                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Treinamento</label><input name="trainingBase" type="text" placeholder="POR" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold uppercase" required /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Plano</label><input name="planNum" type="text" placeholder="6" className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold" required /></div>
                            </div>
                        )}
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">ID Completo</label><input name="districtId" type="text" placeholder="Ex: POR6-01A (Opcional se preencher acima)" defaultValue={editingDistrict?.districtId} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" /></div>
                        
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Data Início (CTM)</label><input name="mtcStartDt" type="date" defaultValue={editingDistrict?.mtcStartDt} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div>
                        
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Qtd. Missionários</label><input name="missionaryCount" type="number" min="1" defaultValue={editingDistrict?.missionaryCount || 1} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div>

                        <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowAddDistrictModal(false)} className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button><button type="submit" className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 transition-all hover:-translate-y-1">Salvar</button></div>
                     </form>
                </div>
             </div>
        )}
        
        {/* Import Modal */}
        {showImportModal && (
             <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm animate-scale-in p-8 border border-white">
                     <h3 className="font-black text-2xl text-slate-800 mb-2">Importar CSV</h3>
                     <p className="text-slate-500 text-sm mb-6">Carregue a Master List para criar distritos.</p>
                     <div className="space-y-4">
                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative">
                            <input type="file" accept=".csv" onChange={handleImportDistricts} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <UploadCloud size={32} className="mx-auto text-slate-300 mb-2"/>
                            <div className="text-sm font-bold text-slate-500">Clique ou arraste o arquivo CSV</div>
                        </div>
                        <button onClick={handleDownloadTemplate} className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 flex items-center justify-center gap-2"><FileSpreadsheet size={16}/> Baixar Modelo</button>
                        <button onClick={() => setShowImportModal(false)} className="w-full py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button>
                     </div>
                </div>
             </div>
        )}

        {/* Edit Block Modal */}
        {showBlockModal && (
             <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm animate-scale-in p-8 border border-white">
                     <h3 className="font-black text-2xl text-slate-800 mb-2">{editingBlock?.templateBlockId ? 'Editar Bloco' : 'Novo Bloco'}</h3>
                     <form onSubmit={handleSaveBlock} className="space-y-4">
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Dia da Semana</label><select name="weekday" defaultValue={editingBlock?.weekday || 1} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none"><option value="1">Segunda</option><option value="2">Terça</option><option value="3">Quarta</option><option value="4">Quinta</option><option value="5">Sexta</option><option value="6">Sábado</option><option value="7">Domingo</option></select></div>
                        <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Início</label><input name="startTime" type="time" defaultValue={editingBlock?.startTime || '12:00'} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div><div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Fim</label><input name="endTime" type="time" defaultValue={editingBlock?.endTime || '13:00'} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div></div>
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tipo</label><div className="flex bg-slate-50 p-1 rounded-xl"><label className="flex-1 text-center cursor-pointer"><input type="radio" name="type" value={SlotType.MEAL} defaultChecked={!editingBlock?.type || editingBlock?.type === SlotType.MEAL} className="hidden peer" /><span className="block py-2 rounded-lg text-xs font-bold text-slate-400 peer-checked:bg-white peer-checked:text-brand-600 peer-checked:shadow-sm">Refeição</span></label><label className="flex-1 text-center cursor-pointer"><input type="radio" name="type" value={SlotType.LAUN} defaultChecked={editingBlock?.type === SlotType.LAUN} className="hidden peer" /><span className="block py-2 rounded-lg text-xs font-bold text-slate-400 peer-checked:bg-white peer-checked:text-brand-600 peer-checked:shadow-sm">Lavanderia</span></label></div></div>
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tipo de Refeição</label><select name="mealType" defaultValue={editingBlock?.mealType || MealType.ALMOCO} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none"><option value={MealType.ALMOCO}>Almoço</option><option value={MealType.JANTAR}>Jantar</option><option value={MealType.DESJEJUM}>Desjejum</option></select></div>
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Capacidade</label><input name="capacityPeople" type="number" defaultValue={editingBlock?.capacityPeople || 50} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div>
                        <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowBlockModal(false)} className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button><button type="submit" className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 transition-all hover:-translate-y-1">Salvar</button></div>
                     </form>
                </div>
             </div>
        )}

        {/* Edit Slot Modal (Manual Override) */}
        {(editingSlot || isCreatingSlot) && (
             <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm animate-scale-in p-8 border border-white">
                     <h3 className="font-black text-2xl text-slate-800 mb-2">{isCreatingSlot ? 'Novo Agendamento' : 'Editar Agendamento'}</h3>
                     <p className="text-slate-500 text-sm mb-6">Ajuste manual de horário específico.</p>
                     <form onSubmit={handleSaveSlot} className="space-y-4">
                        {isCreatingSlot && (
                            <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Data</label><input name="date" type="date" defaultValue={editingSlot?.date} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div>
                        )}
                        <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Início</label><input name="startTime" type="time" defaultValue={editingSlot?.startTime} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div><div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Fim</label><input name="endTime" type="time" defaultValue={editingSlot?.endTime} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div></div>
                        {isCreatingSlot && (
                            <>
                                <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tipo</label><div className="flex bg-slate-50 p-1 rounded-xl"><label className="flex-1 text-center cursor-pointer"><input type="radio" name="type" value={SlotType.MEAL} defaultChecked={editingSlot?.type === SlotType.MEAL} className="hidden peer" /><span className="block py-2 rounded-lg text-xs font-bold text-slate-400 peer-checked:bg-white peer-checked:text-brand-600 peer-checked:shadow-sm">Refeição</span></label><label className="flex-1 text-center cursor-pointer"><input type="radio" name="type" value={SlotType.LAUN} defaultChecked={editingSlot?.type === SlotType.LAUN} className="hidden peer" /><span className="block py-2 rounded-lg text-xs font-bold text-slate-400 peer-checked:bg-white peer-checked:text-brand-600 peer-checked:shadow-sm">Lavanderia</span></label></div></div>
                                <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Treinamento (Opcional)</label><input name="training" type="text" defaultValue={editingSlot?.training || (filterTraining !== 'ALL' ? filterTraining : '')} placeholder="Ex: POR6.1" className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none uppercase" /></div>
                            </>
                        )}
                        {(editingSlot?.type === SlotType.MEAL || isCreatingSlot) && (
                            <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Refeição</label><select name="mealType" defaultValue={editingSlot?.mealType || MealType.ALMOCO} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none"><option value={MealType.ALMOCO}>Almoço</option><option value={MealType.JANTAR}>Jantar</option><option value={MealType.DESJEJUM}>Desjejum</option></select></div>
                        )}
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Capacidade</label><input name="capacityPeople" type="number" defaultValue={editingSlot?.capacityPeople} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" required /></div>
                        <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Motivo da Alteração</label><input name="overrideReason" type="text" placeholder="Ex: Feriado, Manutenção..." defaultValue={editingSlot?.overrideReason} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-2 focus:ring-brand-500 outline-none" /></div>
                        <div className="flex gap-3 pt-2"><button type="button" onClick={() => { setEditingSlot(null); setIsCreatingSlot(false); }} className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button><button type="submit" className="flex-[2] bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 transition-all hover:-translate-y-1">Salvar</button></div>
                     </form>
                </div>
             </div>
        )}

    </div>
  );
}
