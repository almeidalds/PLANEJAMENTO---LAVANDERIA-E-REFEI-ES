import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calendar, Settings, AlertTriangle, RefreshCw, Lock, Unlock, 
  Plus, Save, Layout, ChevronLeft, ChevronRight, FileText, CheckCircle, Pencil, X,
  Clock, MapPin, Zap, Search, Bell, PieChart, TrendingUp, LogOut, Copy, Download,
  Activity, Grid, Printer, History, AlertCircle, Trash2, Info, Edit, MoreVertical,
  UploadCloud, FileSpreadsheet, AlertOctagon, ChevronDown, Folder, FolderOpen, ArrowRight,
  Sliders, Layers, Timer, Repeat, Hash, Type, CheckSquare, Square, Menu, Home
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
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-auto whitespace-nowrap bg-slate-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-xl shadow-lg z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-700"></div>
        </div>
    </div>
);

const Badge = ({ children, color, className = "" }: { children?: React.ReactNode; color: 'red' | 'green' | 'yellow' | 'blue' | 'gray' | 'brand'; className?: string }) => {
  const colors = {
    red: 'text-red-500 shadow-soft-pressed bg-neu-base',
    green: 'text-emerald-500 shadow-soft-pressed bg-neu-base',
    yellow: 'text-amber-500 shadow-soft-pressed bg-neu-base',
    blue: 'text-blue-500 shadow-soft-pressed bg-neu-base',
    gray: 'text-slate-400 shadow-soft-pressed bg-neu-base',
    brand: 'text-brand-600 shadow-soft-pressed bg-neu-base',
  };
  return <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${colors[color]} ${className}`}>{children}</span>;
};

const StatCard = ({ label, value, icon: Icon, trend, color = "brand" }: any) => (
  <div className="neu-card p-6 flex items-center justify-between min-w-[200px] hover:-translate-y-1 transition-transform duration-300">
    <div>
      <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{label}</div>
      <div className="text-3xl font-black text-slate-700 mb-1">{value}</div>
      {trend && <div className="text-xs text-emerald-500 font-bold flex items-center gap-1"><TrendingUp size={12}/> {trend}</div>}
    </div>
    <div className={`p-4 rounded-full shadow-soft-pressed ${color === 'brand' ? 'text-brand-500' : (color === 'red' ? 'text-red-500' : 'text-emerald-500')}`}>
      <Icon size={24} strokeWidth={3} />
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
      
      let finalDistrictId = districtId;
      let planCode = '';

      if (!editingDistrict && inputTraining && inputPlanNum) {
           planCode = `${inputTraining}${inputPlanNum}`;
           if (!finalDistrictId) {
                finalDistrictId = `${planCode}-01A`; 
           }
      } else if (editingDistrict) {
           planCode = editingDistrict.planCode;
           if (!finalDistrictId) finalDistrictId = editingDistrict.districtId;
      }
      
      const parts = finalDistrictId.split('-');
      const derivedPlanCode = parts[0];
      const suffix = parts[1] || '01A';
      const districtNumero = suffix.replace(/\D/g, '');
      const districtLetra = suffix.replace(/\d/g, '');
      
      const missionaryCount = parseInt(formData.get('missionaryCount') as string, 10);
      const mtcStartDt = formData.get('mtcStartDt') as string;

      if (editingDistrict) {
        if (finalDistrictId !== editingDistrict.districtId && districts.some(d => d.districtId === finalDistrictId)) {
            alert(`Erro: O ID de distrito "${finalDistrictId}" já existe. Escolha outro.`);
            return;
        }

        const updatedDistrict: District = {
            ...editingDistrict,
            districtId: finalDistrictId, training: derivedPlanCode, planCode: derivedPlanCode, districtNumero, districtLetra, mtcStartDt, missionaryCount, manualMissionaryCount: missionaryCount, countSource: CountSource.MANUAL, isManual: true, updatedAt: new Date().toISOString()
        };
        setDistricts(prev => prev.map(d => d.districtId === editingDistrict.districtId ? updatedDistrict : d));
        
        if (finalDistrictId !== editingDistrict.districtId) {
            setAssignments(prev => prev.map(a => a.districtId === editingDistrict.districtId ? { ...a, districtId: finalDistrictId } : a));
        }
        
        addLog('EDITAR_DISTRITO', `Distrito ${finalDistrictId} atualizado manualmente.`);
      } else {
        if (districts.some(d => d.districtId === finalDistrictId)) { alert('Já existe um distrito com este ID.'); return; }
        const newDistrict: District = {
            districtId: finalDistrictId, training: derivedPlanCode, districtNumero, districtLetra, planCode: derivedPlanCode, mtcStartDt, missionaryCount, manualMissionaryCount: missionaryCount, countSource: CountSource.MANUAL, isManual: true, updatedAt: new Date().toISOString()
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
      setAssignments(prev => prev.filter(a => a.districtId !== districtId));
      addLog('APAGAR_DISTRITO', `Distrito ${districtId} e seus agendamentos removidos.`);
  };

  const handleBatchDeleteDistricts = () => {
      if (selectedDistricts.size === 0) return;
      if (!confirm(`Tem certeza que deseja excluir ${selectedDistricts.size} distritos?`)) return;
      setDistricts(prev => prev.filter(d => !selectedDistricts.has(d.districtId)));
      setAssignments(prev => prev.filter(a => !selectedDistricts.has(a.districtId)));
      addLog('APAGAR_LOTE', `Removidos ${selectedDistricts.size} distritos e seus agendamentos.`);
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
      if(!confirm('Tem certeza que deseja excluir esta versão do planejamento? Essa ação não pode ser desfeita.')) return;
      
      // 1. Remove Template
      setTemplates(prev => prev.filter(t => t.templateModelId !== templateId));
      
      // 2. Remove Weeks associated
      const weeksToDelete = templateWeeks.filter(tw => tw.templateModelId === templateId);
      const weekIdsToDelete = weeksToDelete.map(tw => tw.templateWeekId);
      setTemplateWeeks(prev => prev.filter(tw => tw.templateModelId !== templateId));
      
      // 3. Remove Blocks associated
      setTemplateBlocks(prev => prev.filter(tb => !weekIdsToDelete.includes(tb.templateWeekId)));

      if (selectedTemplateId === templateId) setSelectedTemplateId(null);
      addLog('APAGAR_TEMPLATE', `Modelo e seus dados associados foram removidos.`);
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
        <div className="neu-card p-4 flex flex-col xl:flex-row justify-between items-center gap-4 flex-shrink-0">
             <div className="flex items-center gap-6 w-full xl:w-auto">
                <div className="px-2"><h2 className="text-xl font-black text-slate-700">Agenda</h2><div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gestão Semanal</div></div>
                <div className="h-10 w-px bg-slate-300"></div>
                <div className="flex bg-neu-base p-1.5 rounded-2xl shadow-soft-pressed-sm">
                   <button onClick={() => setViewMode('GRID')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'GRID' ? 'bg-white text-brand-600 shadow-soft-sm' : 'text-slate-400 hover:text-slate-600'}`}><Grid size={16} /> Grade</button>
                   <button onClick={() => setViewMode('HEATMAP')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'HEATMAP' ? 'bg-white text-brand-600 shadow-soft-sm' : 'text-slate-400 hover:text-slate-600'}`}><Activity size={16} /> Mapa</button>
                </div>
                <button onClick={() => setShowSettingsModal(true)} className="neu-icon-btn h-10 w-10"><Sliders size={18} /></button>
                <div className="hidden md:flex items-center gap-3 neu-input px-4 py-2">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Filtro</span>
                    <select value={filterTraining} onChange={(e) => setFilterTraining(e.target.value)} className="bg-transparent font-bold text-brand-600 outline-none text-sm cursor-pointer"><option value="ALL">Todos</option>{templates.map(t => (<option key={t.planCode} value={t.planCode}>{t.planCode}</option>))}</select>
                </div>
            </div>
            <div className="flex items-center gap-4 w-full xl:w-auto justify-end">
                 <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="neu-input px-6 py-3 text-sm text-slate-700 font-bold tracking-wide" />
                 <div className="flex items-center gap-2">
                    <Tooltip text="Limpar"><button onClick={handleClearWeek} className="neu-icon-btn h-10 w-10 text-red-400 hover:text-red-500"><Trash2 size={18} /></button></Tooltip>
                    <Tooltip text="Duplicar"><button onClick={() => setShowDuplicateModal(true)} className="neu-icon-btn h-10 w-10"><Copy size={18} /></button></Tooltip>
                    <Tooltip text="Exportar"><button onClick={handleExportCSV} className="neu-icon-btn h-10 w-10"><Download size={18} /></button></Tooltip>
                 </div>
                 <button onClick={() => { setEditingSlot({ slotId: '', type: SlotType.MEAL, training: '', weekIndex: 0, date: selectedDate, startTime: '12:00', endTime: '13:00', capacityPeople: 155, source: SlotSource.MANUAL }); setIsCreatingSlot(true); }} className="neu-btn px-4 py-3 flex items-center gap-2 text-sm"><Plus size={18} /> Novo</button>
                 <button onClick={handleGenerateWeek} className="neu-btn-primary px-6 py-3 flex items-center gap-2 text-sm"><RefreshCw size={18} className={slots.length === 0 ? "animate-spin-slow" : ""} /> Gerar</button>
            </div>
        </div>
        <div className="flex-1 overflow-hidden neu-card p-6 flex flex-col min-h-0 relative z-0">
             {conflicts.length > 0 && (
                <div className="mb-6 neu-card border-none bg-red-50/50 overflow-hidden flex flex-col animate-slide-down flex-shrink-0 shadow-none ring-2 ring-red-100">
                    <div className="p-4 border-b border-red-100 flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-red-100 text-red-500 p-2 rounded-xl shadow-soft-pressed-sm"><AlertTriangle size={20}/></div><div><h3 className="font-bold text-red-800 text-sm">Conflitos Detectados ({conflicts.length})</h3></div></div></div>
                    <div className="max-h-48 overflow-y-auto p-2">
                        {conflicts.map(c => (
                            <button key={c.id} className="w-full text-left p-3 hover:bg-white/50 rounded-xl flex items-start gap-3 transition-all group">
                                <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" /><div className="flex-1"><div className="text-sm font-bold text-slate-600">{c.type}</div><div className="text-xs text-slate-400">{c.description}</div></div>
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
                        <div className="text-center p-4 rounded-2xl mb-4 neu-card border-none shadow-soft-sm bg-neu-base"><div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{d.toLocaleDateString('pt-BR', {weekday: 'short'})}</div><div className="text-2xl font-black text-slate-600">{d.getDate()}</div></div>
                        <div className="space-y-4 flex-1">
                        {daySlots.map(slot => {
                            const slotAssignments = assignments.filter(a => a.slotId === slot.slotId);
                            const occupied = slotAssignments.reduce((acc, a) => acc + a.missionaryCountAtCalculation, 0);
                            const hasConflict = conflicts.some(c => c.relatedIds.includes(slot.slotId));
                            const isMeal = slot.type === SlotType.MEAL;
                            
                            if (viewMode === 'HEATMAP') {
                                const utilization = slot.capacityPeople > 0 ? occupied/slot.capacityPeople : 0;
                                let heatClass = occupied > slot.capacityPeople ? 'bg-red-400 text-white shadow-lg shadow-red-200' : utilization > 0.8 ? 'bg-amber-400 text-white shadow-lg shadow-amber-200' : 'bg-neu-base text-slate-400 shadow-soft-pressed-sm';
                                return (<div key={slot.slotId} onClick={() => setEditingSlot(slot)} className={`p-3 rounded-xl cursor-pointer transition-all ${heatClass} ${hasConflict ? 'ring-2 ring-red-400' : ''}`}><div className="text-xs font-bold flex justify-between"><span>{formatTime(slot.startTime)}</span><span>{Math.round(utilization*100)}%</span></div></div>);
                            }
                            return (
                            <div key={slot.slotId} onClick={() => setEditingSlot(slot)} className={`group relative p-4 rounded-2xl transition-all cursor-pointer border-2 hover:-translate-y-1 hover:shadow-soft-sm ${hasConflict ? 'border-red-300 bg-red-50' : 'border-transparent bg-neu-base shadow-soft'}`}>
                                <div className="flex justify-between items-start mb-3"><div className={`text-[10px] font-bold px-2 py-1 rounded-lg shadow-soft-pressed-sm ${isMeal ? 'text-orange-500' : 'text-blue-500'}`}>{formatTime(slot.startTime)}</div><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{slot.training}</div></div>
                                <div className="text-slate-600 font-bold text-xs mb-2 leading-tight">{slot.mealType || 'Lavanderia'}</div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold"><Users size={12}/><span>{occupied}/{slot.capacityPeople}</span></div>
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
        <div className="w-80 neu-card flex flex-col overflow-hidden flex-shrink-0">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-600">Modelos</h3><button onClick={() => setShowCreateTemplateModal(true)} className="neu-icon-btn h-9 w-9 text-brand-500" title="Novo Grupo"><Plus size={18}/></button></div>
             <div className="overflow-y-auto flex-1 p-4 space-y-4">
                 {sortedGroupKeys.map(groupName => {
                     const isExpanded = expandedTemplateGroups.has(groupName);
                     const items = groupedTemplates[groupName].sort((a, b) => {
                         const vA = parseInt(a.planCode.split('.')[1] || '0');
                         const vB = parseInt(b.planCode.split('.')[1] || '0');
                         return vA - vB;
                     });

                     return (
                         <div key={groupName} className="neu-card border-none shadow-soft-sm overflow-hidden bg-neu-base">
                             <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/40 transition-colors" onClick={() => toggleGroup(groupName)}>
                                 <div className="flex items-center gap-3">
                                     <div className={`p-1 rounded-full ${isExpanded ? 'bg-brand-500 text-white shadow-lg' : 'text-slate-400'}`}>{isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</div>
                                     <span className="font-bold text-slate-600 text-sm uppercase tracking-wide">{groupName}</span>
                                 </div>
                                 <button onClick={(e) => { e.stopPropagation(); handleAddVersionToGroup(groupName); }} className="p-1 text-slate-400 hover:text-brand-500 transition-colors" title={`Adicionar Versão a ${groupName}`}><Plus size={14}/></button>
                             </div>
                             
                             {isExpanded && (
                                 <div className="px-3 pb-3 space-y-2 bg-white/30 pt-1">
                                     {items.map(t => (
                                         <div key={t.templateModelId} className="relative group">
                                             <button onClick={() => setSelectedTemplateId(t.templateModelId)} className={`w-full text-left pl-4 pr-8 py-3 rounded-xl transition-all flex justify-between items-center ${selectedTemplateId === t.templateModelId ? 'bg-white shadow-soft text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                                                 <span className="text-xs truncate">{t.name.replace(groupName, '').trim() || t.name}</span>
                                                 {selectedTemplateId === t.templateModelId && <div className="h-2 w-2 rounded-full bg-brand-500 shadow-glow"></div>}
                                             </button>
                                             <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteTemplate(t.templateModelId);
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                                title="Excluir versão"
                                             >
                                                <Trash2 size={12}/>
                                             </button>
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>
                     );
                 })}
             </div>
        </div>
        <div className="flex-1 neu-card flex flex-col overflow-hidden relative z-0">
             {selectedTemplate ? (
                 <>
                    <div className="p-8 border-b border-slate-100 flex justify-between items-start"><div><h2 className="text-3xl font-black text-slate-700 tracking-tight">{selectedTemplate.name}</h2><div className="flex gap-3 mt-3"><Badge color="brand">{selectedTemplate.category || 'Geral'}</Badge><span className="neu-input px-3 py-1 text-xs font-bold text-slate-400">{selectedTemplate.planCode}</span></div></div><div className="flex gap-2"><button onClick={() => handleDeleteTemplate(selectedTemplate.templateModelId)} className="neu-icon-btn h-12 w-12 text-red-400 hover:text-red-500"><Trash2 size={20}/></button></div></div>
                    <div className="px-8 pt-6 flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">{Array.from({ length: selectedTemplate.weeksCount }).map((_, i) => (<button key={i+1} onClick={() => setEditorWeekIndex(i+1)} className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${editorWeekIndex === i+1 ? 'bg-brand-500 text-white shadow-lg shadow-brand-200 transform -translate-y-1' : 'bg-neu-base text-slate-500 shadow-soft hover:bg-white'}`}>Semana {i+1}</button>))}<button onClick={handleAddWeekToTemplate} className="neu-icon-btn h-11 w-11 flex-shrink-0 text-brand-500"><Plus size={18}/></button></div>
                    <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-transparent to-slate-50/50">
                        <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-600 text-lg">Blocos de Horário</h3><button onClick={() => { setEditingBlock({ templateWeekId: templateWeeks.find(tw => tw.templateModelId === selectedTemplateId && tw.weekIndex === editorWeekIndex)?.templateWeekId, weekday: 1 }); setShowBlockModal(true); }} className="neu-btn-primary px-5 py-2.5 flex items-center gap-2 text-sm"><Plus size={16}/> Adicionar Bloco</button></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{currentBlocks.map(block => (<div key={block.templateBlockId} className="group neu-card border-none shadow-soft-sm p-5 relative hover:-translate-y-1 transition-transform"><div className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">{weekDays[block.weekday - 1]}</div><div className="text-2xl font-black text-slate-700 mb-2">{block.startTime} - {block.endTime}</div><div className="text-xs font-bold text-brand-500 bg-brand-50 inline-block px-2 py-1 rounded-lg mb-4">{block.type === SlotType.MEAL ? block.mealType : 'Lavanderia'}</div><div className="flex gap-3 mt-2 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingBlock(block); setShowBlockModal(true); }} className="neu-icon-btn h-8 w-8 text-brand-500"><Pencil size={12}/></button><button onClick={() => handleDeleteBlock(block.templateBlockId)} className="neu-icon-btn h-8 w-8 text-red-500"><Trash2 size={12}/></button></div><div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Users size={14}/> {block.capacityPeople} pax</div></div>))}</div>
                    </div>
                 </>
             ) : <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4"><Layout size={64} className="text-slate-200"/><p className="font-bold text-lg">Selecione um modelo para começar</p></div>}
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
              <div className="neu-card p-4 flex justify-between items-center flex-shrink-0">
                  <div className="flex items-center gap-6">
                       <h2 className="text-xl font-black text-slate-700 ml-4">Distritos</h2>
                       <div className="h-10 w-px bg-slate-200"></div>
                       <div className="flex items-center gap-3 neu-input px-4 py-2 w-72">
                           <Search size={18} className="text-slate-400"/>
                           <input type="text" placeholder="Buscar distrito..." value={districtSearch} onChange={(e) => setDistrictSearch(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full placeholder:text-slate-300" />
                       </div>
                  </div>
                  <div className="flex gap-3">
                      {selectedDistricts.size > 0 && (
                          <button onClick={handleBatchDeleteDistricts} className="neu-btn px-4 py-2 bg-red-50 text-red-500 flex items-center gap-2 animate-scale-in">
                              <Trash2 size={18}/> Excluir ({selectedDistricts.size})
                          </button>
                      )}
                      <div className="w-px h-8 bg-slate-200 mx-2"></div>
                      <button onClick={() => setShowImportModal(true)} className="neu-btn px-4 py-2 text-slate-500 flex items-center gap-2"><UploadCloud size={18}/> Importar</button>
                      <button onClick={() => setShowBatchDistrictModal(true)} className="neu-btn px-4 py-2 text-brand-600 flex items-center gap-2"><Layers size={18}/> Gerar Lote</button>
                      <button onClick={() => { setEditingDistrict(null); setShowAddDistrictModal(true); }} className="neu-btn-primary px-5 py-2 flex items-center gap-2"><Plus size={18}/> Novo Distrito</button>
                  </div>
              </div>

              <div className="neu-card flex-1 overflow-hidden flex flex-col relative z-0">
                  <div className="overflow-x-auto overflow-y-auto flex-1 p-4">
                      <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-neu-base z-10 shadow-sm">
                              <tr>
                                  <th className="p-5 w-16">
                                      <button onClick={() => toggleAllDistricts(filteredDistricts)} className="text-slate-400 hover:text-brand-500 transition-colors">
                                          {allSelected ? <CheckSquare size={20} className="text-brand-500"/> : <Square size={20}/>}
                                      </button>
                                  </th>
                                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider">ID Distrito</th>
                                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider">Plano</th>
                                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider">Início</th>
                                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider">Missionários</th>
                                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider text-right">AÇÕES</th>
                              </tr>
                          </thead>
                          <tbody className="bg-transparent">
                              {filteredDistricts.map(d => (
                                  <tr key={d.districtId} className={`group border-b border-slate-100 last:border-0 hover:bg-white/60 transition-colors ${selectedDistricts.has(d.districtId) ? 'bg-brand-50/50' : ''}`}>
                                      <td className="p-5">
                                          <button onClick={() => toggleDistrictSelection(d.districtId)} className={`transition-colors ${selectedDistricts.has(d.districtId) ? 'text-brand-500' : 'text-slate-300 hover:text-slate-500'}`}>
                                              {selectedDistricts.has(d.districtId) ? <CheckSquare size={20}/> : <Square size={20}/>}
                                          </button>
                                      </td>
                                      <td className="p-5">
                                          <div className="font-bold text-slate-700 text-lg">{d.districtId}</div>
                                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Num: {d.districtNumero}{d.districtLetra}</div>
                                      </td>
                                      <td className="p-5">
                                          <span className="neu-input px-3 py-1 text-slate-500 text-xs font-bold">{d.planCode}</span>
                                      </td>
                                      <td className="p-5 text-sm font-bold text-slate-500">{new Date(d.mtcStartDt).toLocaleDateString('pt-BR')}</td>
                                      <td className="p-5">
                                          <div className="flex items-center gap-2">
                                              <div className="bg-neu-base p-2 rounded-full shadow-soft-pressed-sm text-slate-400"><Users size={14}/></div>
                                              <span className="font-bold text-slate-700">{d.missionaryCount}</span>
                                          </div>
                                      </td>
                                      <td className="p-5">
                                          {d.isManual ? (
                                              <Badge color="blue">Manual</Badge>
                                          ) : (
                                              <Badge color="green">Auto</Badge>
                                          )}
                                      </td>
                                      <td className="p-5 text-right">
                                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={() => { setEditingDistrict(d); setShowAddDistrictModal(true); }} className="neu-icon-btn h-9 w-9 text-brand-500" title="Editar"><Pencil size={16}/></button>
                                              <button onClick={() => handleDeleteDistrict(d.districtId)} className="neu-icon-btn h-9 w-9 text-red-500" title="Excluir"><Trash2 size={16}/></button>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                              {filteredDistricts.length === 0 && (
                                  <tr>
                                      <td colSpan={7} className="p-12 text-center text-slate-400 font-bold">Nenhum distrito encontrado.</td>
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
    <div className="h-screen w-full p-6 flex gap-8 font-sans text-slate-600 overflow-hidden bg-neu-base">
        {/* Floating Sidebar */}
        <aside className="hidden md:flex flex-col w-24 hover:w-72 transition-all duration-300 ease-in-out bg-neu-base rounded-[3rem] shadow-soft py-10 px-4 justify-between flex-shrink-0 z-50 overflow-hidden group">
            
            <div className="flex flex-col items-center group-hover:items-start w-full">
                
                {/* LOGO */}
                <div className="flex items-center justify-center group-hover:justify-start w-full mb-16">
                    <div className="bg-brand-500 text-white p-3 rounded-2xl shadow-lg shadow-brand-300 flex-shrink-0">
                        <Layout size={24} strokeWidth={3} />
                    </div>
                    <div className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[200px] group-hover:ml-4 group-hover:opacity-100 transition-all duration-300 ease-in-out whitespace-nowrap">
                        <h1 className="text-xl font-black text-slate-700 tracking-tight leading-none">Organização</h1>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lavanderia e Refeições</span>
                    </div>
                </div>
                
                {/* NAVEGAÇÃO */}
                <nav className="space-y-6 w-full">
                    {[ 
                        { id: 'SCHEDULE', icon: Calendar, label: 'Agenda' }, 
                        { id: 'TEMPLATES', icon: Layers, label: 'Modelos' }, 
                        { id: 'DISTRICTS', icon: Users, label: 'Distritos' } 
                    ].map(item => (
                        <button 
                            key={item.id} 
                            onClick={() => item.id !== 'SETTINGS' && setActiveTab(item.id as any)} 
                            className={`relative w-full flex items-center justify-center group-hover:justify-start p-3 rounded-2xl transition-all duration-300 group-hover:px-4 ${activeTab === item.id ? 'text-brand-600 shadow-soft-pressed' : 'text-slate-400 hover:text-slate-600 hover:shadow-soft'}`}
                        >
                          <item.icon size={24} strokeWidth={activeTab === item.id ? 3 : 2} className={`flex-shrink-0 transition-all z-10 ${activeTab === item.id ? 'scale-110' : ''}`} />
                          <span className={`font-bold text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute left-16`}>{item.label}</span>
                          {activeTab === item.id && <div className="absolute right-3 h-2 w-2 rounded-full bg-brand-500 shadow-glow opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                        </button>
                    ))}
                </nav>
            </div>
            
            {/* LOGOUT */}
            <div className="flex flex-col items-center w-full">
               <button className="neu-icon-btn h-12 w-12 flex items-center justify-center text-slate-400 hover:text-red-500 mb-2">
                   <LogOut size={20}/>
               </button>
            </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 relative h-full">
            <header className="flex justify-between items-center mb-8 px-2">
                <div><h1 className="text-4xl font-black text-slate-700 tracking-tight">{activeTab === 'SCHEDULE' ? 'Agenda' : activeTab === 'TEMPLATES' ? 'Modelos' : 'Distritos'}</h1></div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 neu-card px-4 py-2 rounded-full">
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-glow"></div>
                        <span className="text-xs font-bold text-slate-500">Sistema Online</span>
                    </div>
                    <button className="neu-icon-btn h-12 w-12 text-slate-400 relative hover:text-brand-500"><Bell size={22} />{logs.length > 0 && <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#ecf0f3]"></span>}</button>
                    <div className="h-12 w-12 rounded-full bg-slate-200 shadow-soft border-2 border-white overflow-hidden"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="Admin" /></div>
                </div>
            </header>

            <div className="flex-1 min-h-0 relative pb-2">
                 {activeTab === 'SCHEDULE' && renderScheduleView()}
                 {activeTab === 'TEMPLATES' && renderTemplateView()}
                 {activeTab === 'DISTRICTS' && renderDistrictsView()}
            </div>
        </main>
      
        {/* Toast Notification */}
        {logs.length > 0 && (
            <div className="fixed bottom-8 right-8 bg-slate-800 text-white p-5 rounded-3xl shadow-2xl flex items-center gap-5 z-50 animate-slide-up max-w-md cursor-pointer hover:scale-105 transition-transform" onClick={() => setLogs(l => l.slice(1))}>
                <div className="bg-emerald-500/20 p-3 rounded-2xl"><CheckCircle size={20} className="text-emerald-400"/></div><div><div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">{logs[0].action}</div><div className="text-sm font-bold">{logs[0].summary}</div></div>
            </div>
        )}

        {/* --- GLOBAL MODALS --- */}
        {/* General Modal Backdrop & Container */}
        {(showSettingsModal || showDuplicateModal || showCreateTemplateModal || showBatchDistrictModal || showAddDistrictModal || showImportModal || showBlockModal || editingSlot || isCreatingSlot) && (
             <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
                
                {/* Global Settings Modal */}
                {showSettingsModal && (
                    <div className="neu-card w-full max-w-sm p-8 animate-scale-in relative">
                         <button onClick={() => setShowSettingsModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                         <h3 className="font-black text-2xl text-slate-700 mb-2">Configurações</h3>
                         <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-8">Limites Globais</p>
                         <form onSubmit={handleSaveSettings} className="space-y-6">
                            <div className="space-y-3"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Capacidade Refeitório</label><input name="defaultMealCapacity" type="number" defaultValue={globalSettings.defaultMealCapacity} className="neu-input w-full px-5 py-4 text-slate-700 font-bold text-lg" required min="1" /></div>
                            <div className="space-y-3"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Capacidade Lavanderia</label><input name="defaultLaundryCapacity" type="number" defaultValue={globalSettings.defaultLaundryCapacity} className="neu-input w-full px-5 py-4 text-slate-700 font-bold text-lg" required min="1" /></div>
                            <button type="submit" className="neu-btn-primary w-full py-4 text-lg mt-4">Salvar Alterações</button>
                         </form>
                    </div>
                )}

                {/* Duplicate Week Modal */}
                {showDuplicateModal && (
                    <div className="neu-card w-full max-w-sm p-8 animate-scale-in relative">
                         <button onClick={() => setShowDuplicateModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                         <h3 className="font-black text-2xl text-slate-700 mb-2">Duplicar</h3>
                         <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-8">Copiar semana de {selectedDate}</p>
                         <div className="space-y-6">
                            <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Semana Alvo (Segunda)</label><input type="date" id="targetDateInput" className="neu-input w-full px-5 py-4 text-slate-700 font-bold mt-2" /></div>
                            <button onClick={() => { const input = document.getElementById('targetDateInput') as HTMLInputElement; if(input.value) handleDuplicateWeek(input.value); }} className="neu-btn-primary w-full py-4 text-lg">Confirmar Cópia</button>
                         </div>
                    </div>
                )}
                
                {/* Create Template Modal */}
                {showCreateTemplateModal && (
                    <div className="neu-card w-full max-w-sm p-8 animate-scale-in relative">
                         <button onClick={() => setShowCreateTemplateModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                         <h3 className="font-black text-2xl text-slate-700 mb-2">Novo Grupo</h3>
                         <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-8">Família de Planos</p>
                         <form onSubmit={handleCreateNewGroup} className="space-y-6">
                            <div className="space-y-3"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Nome (Ex: POR6)</label><input name="groupName" type="text" placeholder="POR6" className="neu-input w-full px-5 py-4 text-slate-700 font-bold text-lg uppercase" required /></div>
                            <div className="space-y-3"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Duração (Semanas)</label><input name="weeksCount" type="number" min="1" max="50" defaultValue="6" className="neu-input w-full px-5 py-4 text-slate-700 font-bold text-lg" required /></div>
                            <button type="submit" className="neu-btn-primary w-full py-4 text-lg mt-4">Criar Grupo</button>
                         </form>
                    </div>
                )}

                {/* Add/Edit District Modal */}
                {showAddDistrictModal && (
                    <div className="neu-card w-full max-w-md p-8 animate-scale-in relative">
                         <button onClick={() => setShowAddDistrictModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                         <h3 className="font-black text-2xl text-slate-700 mb-2">{editingDistrict ? 'Editar' : 'Novo'} Distrito</h3>
                         <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-8">Dados do Distrito</p>
                         <form onSubmit={handleSaveDistrict} className="space-y-5">
                            {!editingDistrict && (
                                <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-3xl mb-2">
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Treinamento</label><input name="trainingBase" type="text" placeholder="POR" className="neu-input w-full px-3 py-2 text-sm font-bold uppercase bg-white" required /></div>
                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Plano</label><input name="planNum" type="text" placeholder="6" className="neu-input w-full px-3 py-2 text-sm font-bold bg-white" required /></div>
                                </div>
                            )}
                            <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">ID Completo</label><input name="districtId" type="text" placeholder="Opcional" defaultValue={editingDistrict?.districtId} className="neu-input w-full px-5 py-3 text-slate-700 font-bold" /></div>
                            <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Data Início</label><input name="mtcStartDt" type="date" defaultValue={editingDistrict?.mtcStartDt} className="neu-input w-full px-5 py-3 text-slate-700 font-bold" required /></div>
                            <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Missionários</label><input name="missionaryCount" type="number" min="1" defaultValue={editingDistrict?.missionaryCount || 1} className="neu-input w-full px-5 py-3 text-slate-700 font-bold" required /></div>
                            <button type="submit" className="neu-btn-primary w-full py-4 text-lg mt-4">Salvar</button>
                         </form>
                    </div>
                )}
                
                {/* Import Modal */}
                {showImportModal && (
                    <div className="neu-card w-full max-w-sm p-8 animate-scale-in relative">
                         <button onClick={() => setShowImportModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                         <h3 className="font-black text-2xl text-slate-700 mb-2">Importar CSV</h3>
                         <div className="space-y-6 mt-6">
                            <div className="neu-input p-8 text-center relative hover:bg-white/50 transition-colors">
                                <input type="file" accept=".csv" onChange={handleImportDistricts} className="absolute inset-0 opacity-0 cursor-pointer" />
                                <UploadCloud size={32} className="mx-auto text-brand-500 mb-2"/>
                                <div className="text-sm font-bold text-slate-500">Arraste ou Clique</div>
                            </div>
                            <button onClick={handleDownloadTemplate} className="neu-btn w-full py-3 flex items-center justify-center gap-2 text-sm">Baixar Modelo</button>
                         </div>
                    </div>
                )}

                {/* Edit Slot/Block Modal (Combined Style) */}
                {(showBlockModal || editingSlot || isCreatingSlot) && (
                    <div className="neu-card w-full max-w-sm p-8 animate-scale-in relative">
                         <button onClick={() => { setShowBlockModal(false); setEditingSlot(null); setIsCreatingSlot(false); }} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                         <h3 className="font-black text-2xl text-slate-700 mb-2">{(showBlockModal ? (editingBlock?.templateBlockId ? 'Editar Bloco' : 'Novo Bloco') : (isCreatingSlot ? 'Novo Agendamento' : 'Editar Horário'))}</h3>
                         <form onSubmit={showBlockModal ? handleSaveBlock : handleSaveSlot} className="space-y-5 mt-6">
                            {showBlockModal && <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Dia da Semana</label><select name="weekday" defaultValue={editingBlock?.weekday || 1} className="neu-input w-full px-5 py-3 text-slate-700 font-bold"><option value="1">Segunda</option><option value="2">Terça</option><option value="3">Quarta</option><option value="4">Quinta</option><option value="5">Sexta</option><option value="6">Sábado</option><option value="7">Domingo</option></select></div>}
                            {(isCreatingSlot && !showBlockModal) && <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Data</label><input name="date" type="date" defaultValue={editingSlot?.date} className="neu-input w-full px-5 py-3 text-slate-700 font-bold" required /></div>}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Início</label><input name="startTime" type="time" defaultValue={showBlockModal ? editingBlock?.startTime : editingSlot?.startTime} className="neu-input w-full px-4 py-3 text-slate-700 font-bold text-center" required /></div>
                                <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Fim</label><input name="endTime" type="time" defaultValue={showBlockModal ? editingBlock?.endTime : editingSlot?.endTime} className="neu-input w-full px-4 py-3 text-slate-700 font-bold text-center" required /></div>
                            </div>

                            {/* Type Toggle Neumorphic */}
                            <div className="bg-neu-base shadow-soft-pressed rounded-xl p-1.5 flex gap-2">
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="type" value={SlotType.MEAL} defaultChecked={showBlockModal ? (!editingBlock?.type || editingBlock?.type === SlotType.MEAL) : (editingSlot?.type === SlotType.MEAL)} className="hidden peer" />
                                    <span className="block text-center py-2.5 rounded-lg text-xs font-bold text-slate-400 peer-checked:bg-neu-base peer-checked:text-brand-600 peer-checked:shadow-soft transition-all">Refeição</span>
                                </label>
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="type" value={SlotType.LAUN} defaultChecked={showBlockModal ? (editingBlock?.type === SlotType.LAUN) : (editingSlot?.type === SlotType.LAUN)} className="hidden peer" />
                                    <span className="block text-center py-2.5 rounded-lg text-xs font-bold text-slate-400 peer-checked:bg-neu-base peer-checked:text-brand-600 peer-checked:shadow-soft transition-all">Lavanderia</span>
                                </label>
                            </div>

                            {/* Conditional Meal Type */}
                            <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Tipo de Refeição</label><select name="mealType" defaultValue={(showBlockModal ? editingBlock?.mealType : editingSlot?.mealType) || MealType.ALMOCO} className="neu-input w-full px-5 py-3 text-slate-700 font-bold"><option value={MealType.ALMOCO}>Almoço</option><option value={MealType.JANTAR}>Jantar</option><option value={MealType.DESJEJUM}>Desjejum</option></select></div>
                            
                            <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Capacidade</label><input name="capacityPeople" type="number" defaultValue={(showBlockModal ? editingBlock?.capacityPeople : editingSlot?.capacityPeople) || 50} className="neu-input w-full px-5 py-3 text-slate-700 font-bold" required /></div>
                            
                            <button type="submit" className="neu-btn-primary w-full py-4 text-lg mt-4">Salvar</button>
                         </form>
                    </div>
                )}
                
                {/* Batch Create District Modal - Large */}
                {showBatchDistrictModal && (
                    <div className="neu-card w-full max-w-4xl p-8 animate-scale-in relative flex flex-col md:flex-row gap-8">
                         <button onClick={() => setShowBatchDistrictModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                         <div className="flex-1">
                            <h3 className="font-black text-2xl text-slate-700 mb-2">Gerar Lote</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-8">Criação em Massa</p>
                            <form onSubmit={handleBatchCreateDistricts} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-2">Treinamento</label><input type="text" placeholder="POR" className="neu-input w-full px-5 py-3 font-bold uppercase" value={batchConfig.trainingBase} onChange={(e) => setBatchConfig({...batchConfig, trainingBase: e.target.value.toUpperCase()})} required /></div>
                                    <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-2">Plano</label><input type="text" placeholder="6" className="neu-input w-full px-5 py-3 font-bold" value={batchConfig.planNum} onChange={(e) => setBatchConfig({...batchConfig, planNum: e.target.value})} required /></div>
                                </div>
                                <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-2">Início</label><input name="mtcStartDt" type="date" value={batchConfig.startDate} onChange={(e) => setBatchConfig({...batchConfig, startDate: e.target.value})} className="neu-input w-full px-5 py-3 font-bold" required /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-2">Qtd.</label><input name="districtCount" type="number" min="1" max="20" value={batchConfig.count} onChange={(e) => setBatchConfig({...batchConfig, count: parseInt(e.target.value)})} className="neu-input w-full px-5 py-3 font-bold" required /></div>
                                    <div className="space-y-2"><label className="text-xs font-bold text-slate-400 uppercase ml-2">Pax/Distrito</label><input name="peoplePerDistrict" type="number" min="1" value={batchConfig.people} onChange={(e) => setBatchConfig({...batchConfig, people: parseInt(e.target.value)})} className="neu-input w-full px-5 py-3 font-bold" required /></div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-2">Sufixo</label>
                                    <div className="neu-input p-2 flex gap-2">
                                        <label className="flex-1 cursor-pointer"><input type="radio" name="namingMode" value="LETTERS" checked={batchConfig.namingMode === 'LETTERS'} onChange={() => setBatchConfig({...batchConfig, namingMode: 'LETTERS'})} className="hidden peer" /><div className="text-center py-2 rounded-lg text-xs font-bold text-slate-400 peer-checked:bg-white peer-checked:text-brand-600 peer-checked:shadow-soft transition-all">Letras (01A)</div></label>
                                        <label className="flex-1 cursor-pointer"><input type="radio" name="namingMode" value="NUMBERS" checked={batchConfig.namingMode === 'NUMBERS'} onChange={() => setBatchConfig({...batchConfig, namingMode: 'NUMBERS'})} className="hidden peer" /><div className="text-center py-2 rounded-lg text-xs font-bold text-slate-400 peer-checked:bg-white peer-checked:text-brand-600 peer-checked:shadow-soft transition-all">Números (01)</div></label>
                                    </div>
                                </div>
                                <button type="submit" className="neu-btn-primary w-full py-4 text-lg mt-2">Gerar Distritos</button>
                            </form>
                         </div>
                         <div className="w-full md:w-72 bg-neu-base rounded-3xl p-6 shadow-soft-pressed">
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Activity size={14}/> Preview</div>
                            <div className="h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {generatePreviewDistricts.map((item, idx) => (<div key={idx} className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold border-l-4 ${item.exists ? 'border-red-400 bg-red-50 text-red-500' : 'border-brand-400 bg-white text-slate-600'}`}><span>{item.id}</span>{item.exists && <AlertCircle size={14} />}</div>))}
                            </div>
                         </div>
                    </div>
                )}

             </div>
        )}

    </div>
  );
}