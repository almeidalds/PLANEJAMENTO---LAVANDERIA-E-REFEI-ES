import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Calendar, Settings, AlertTriangle, RefreshCw, Lock, Unlock, 
  Plus, Save, Layout, ChevronLeft, ChevronRight, FileText, CheckCircle, Pencil, X,
  Clock, MapPin, Zap, Search, Bell, PieChart, TrendingUp, LogOut, Copy, Download,
  Activity, Grid, Printer, History, AlertCircle, Trash2, Info, Edit, MoreVertical,
  UploadCloud, FileSpreadsheet, AlertOctagon, ChevronDown, Folder, FolderOpen, ArrowRight,
  Sliders, Layers, Timer, Repeat, Hash, Type, CheckSquare, Square, Menu, Home, Loader2, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  District, PlanTemplateModel, PlanTemplateWeek, PlanTemplateBlock, 
  WeekSchedule, Slot, Assignment, SlotType, WeekStatus, SystemLog, Conflict, SlotSource, MealType, CountSource, GlobalSettings
} from './types';
import { MOCK_DISTRICTS, MOCK_TEMPLATES, MOCK_TEMPLATE_WEEKS, MOCK_TEMPLATE_BLOCKS } from './services/mockData';
import { generateWeekSchedule, analyzeSchedule, addDays, generateId, formatTime, duplicateWeek, generateCSV, clearWeekSchedule } from './services/scheduler';

// ==========================================
// 1. HOOKS DE PERSISTÊNCIA (COM AUTO-CURA CONTRA ECRÃ BRANCO)
// ==========================================
function useStickyState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      if (stickyValue !== null) {
          const parsed = JSON.parse(stickyValue);
          return (parsed && typeof parsed === 'object') ? parsed : defaultValue;
      }
      return defaultValue;
    } catch (err) {
      window.localStorage.removeItem(key);
      return defaultValue;
    }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

// Hook específico para Arrays que impede ecrã branco se o cache corromper
function useStickyArray<T>(defaultValue: T[], key: string): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  const [value, setValue] = useState<T[]>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      if (stickyValue !== null) {
         const parsed = JSON.parse(stickyValue);
         if (Array.isArray(parsed)) return parsed;
         // Se o cache for lixo (ex: {}), limpa e usa o padrão
         window.localStorage.removeItem(key);
         return defaultValue;
      }
      return defaultValue;
    } catch (err) {
      window.localStorage.removeItem(key);
      return defaultValue;
    }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

// ==========================================
// 2. COMPONENTES DE UI
// ==========================================
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

// ==========================================
// 3. APLICAÇÃO PRINCIPAL
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useStickyState<'SCHEDULE' | 'TEMPLATES' | 'DISTRICTS'>('SCHEDULE', 'mtc_activeTab');
  const [globalSettings, setGlobalSettings] = useStickyState<GlobalSettings>({ defaultMealCapacity: 155, defaultLaundryCapacity: 120 }, 'mtc_settings');
  
  // Utiliza o novo Hook Blindado contra ecrã branco
  const [districts, setDistricts] = useStickyArray<District>(MOCK_DISTRICTS, 'mtc_districts');
  const [templates, setTemplates] = useStickyArray<PlanTemplateModel>(MOCK_TEMPLATES, 'mtc_templates');
  const [templateWeeks, setTemplateWeeks] = useStickyArray<PlanTemplateWeek>(MOCK_TEMPLATE_WEEKS, 'mtc_templateWeeks');
  const [templateBlocks, setTemplateBlocks] = useStickyArray<PlanTemplateBlock>(MOCK_TEMPLATE_BLOCKS, 'mtc_templateBlocks');
  const [schedules, setSchedules] = useStickyArray<WeekSchedule>([], 'mtc_schedules');
  const [slots, setSlots] = useStickyArray<Slot>([], 'mtc_slots');
  const [assignments, setAssignments] = useStickyArray<Assignment>([], 'mtc_assignments');
  const [logs, setLogs] = useStickyArray<SystemLog>([], 'mtc_logs');

  const [districtSearch, setDistrictSearch] = useState(''); 
  const [selectedDistricts, setSelectedDistricts] = useState<Set<string>>(new Set()); 
  const [filterTraining, setFilterTraining] = useState<string>('ALL');
  
  // Assegura uma data de fallback sólida
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'GRID' | 'HEATMAP'>('GRID');
  const [isGenerating, setIsGenerating] = useState(false);

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [expandedTemplateGroups, setExpandedTemplateGroups] = useState<Set<string>>(new Set(['POR6'])); 
  const [showAddDistrictModal, setShowAddDistrictModal] = useState(false);
  const [showBatchDistrictModal, setShowBatchDistrictModal] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editorWeekIndex, setEditorWeekIndex] = useState<number>(1);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Partial<PlanTemplateBlock> | null>(null);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);
  const [modalSlotType, setModalSlotType] = useState<SlotType>(SlotType.MEAL);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<'UPLOAD' | 'MAP'>('UPLOAD');
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRawData, setImportRawData] = useState<string[][]>([]);
  const [colMapping, setColMapping] = useState<Record<string, number>>({
      trainingBase: -1, distNum: -1, distLet: -1, planNum: -1, startDate: -1
  });

  const [batchConfig, setBatchConfig] = useState({
      trainingBase: 'POR', planNum: '6', startDate: new Date().toISOString().split('T')[0], count: 3, people: 10, startNum: 1, namingMode: 'LETTERS' 
  });

  const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  // Análise com proteção (Arrays Seguros)
  const conflicts = useMemo(() => analyzeSchedule(slots || [], assignments || [], globalSettings || { defaultMealCapacity: 155, defaultLaundryCapacity: 120 }), [slots, assignments, globalSettings]);
  const selectedTemplate = useMemo(() => (templates || []).find(t => t && t.templateModelId === selectedTemplateId), [templates, selectedTemplateId]);

  const generatePreviewDistricts = useMemo(() => {
    if (!showBatchDistrictModal) return [];
    const { trainingBase, planNum, count, startNum, namingMode } = batchConfig;
    const planCode = `${trainingBase}${planNum}`;
    const preview: { id: string; exists: boolean }[] = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (let i = 0; i < count; i++) {
        let districtNumero = '', districtLetra = '';
        if (namingMode === 'LETTERS') {
            districtNumero = startNum.toString();
            districtLetra = alphabet[i % 26];
        } else {
            districtNumero = (startNum + i).toString();
        }
        const suffix = `${districtNumero}${districtLetra}`;
        const districtId = `${planCode} ${suffix}`;
        preview.push({ id: districtId, exists: (districts || []).some(d => d && d.districtId === districtId) });
    }
    return preview;
  }, [batchConfig, districts, showBatchDistrictModal]);

  useEffect(() => {
    if (!selectedTemplateId && (templates || []).length > 0) setSelectedTemplateId(templates[0].templateModelId);
  }, [templates]);

  const addLog = (action: string, summary: string, details?: string, refId?: string) => {
    setLogs(prev => [{ logId: generateId('LOG'), timestamp: new Date().toISOString(), action, summary, details, referenceId: refId } as any, ...(prev || [])]);
  };

  const handleResetData = () => {
    if (confirm("🚨 TEM CERTEZA? Isto vai apagar TODOS os dados e voltar para o sistema de origem. Esta ação não pode ser desfeita.")) {
      window.localStorage.clear();
      window.location.reload();
    }
  };

  const handleGenerateWeek = () => {
    const trainingsToGenerate: string[] = [];
    if (filterTraining === 'ALL') {
       const uniqueTrainings = Array.from(new Set((districts || []).map(d => d?.training))).filter(Boolean) as string[];
       trainingsToGenerate.push(...uniqueTrainings);
    } else {
       trainingsToGenerate.push(filterTraining);
    }

    if (trainingsToGenerate.length === 0) return alert('Nenhum treinamento encontrado para gerar.');
    setIsGenerating(true);

    setTimeout(() => {
      let allNewSlots: Slot[] = [];
      let allNewAssignments: Assignment[] = [];
      let allNewSchedules: WeekSchedule[] = [];

      trainingsToGenerate.forEach(trainingId => {
          const result = generateWeekSchedule(trainingId, 1, selectedDate, (districts || []), (templates || []), (templateWeeks || []), (templateBlocks || []));
          allNewSlots = [...allNewSlots, ...result.slots];
          allNewAssignments = [...allNewAssignments, ...result.assignments];
          allNewSchedules.push(result.schedule);
      });

      const weekEndDate = addDays(selectedDate, 6);
      const unaffectedSlots = (slots || []).filter(s => s && !(trainingsToGenerate.includes(s.training) && s.date >= selectedDate && s.date <= weekEndDate));
      const keptSlotIds = new Set(unaffectedSlots.map(s => s.slotId));
      const unaffectedAssignments = (assignments || []).filter(a => a && keptSlotIds.has(a.slotId));

      setSchedules(prev => [...(prev || []), ...allNewSchedules]);
      setSlots([...unaffectedSlots, ...allNewSlots]);
      setAssignments([...unaffectedAssignments, ...allNewAssignments]);
      addLog('GERAR_SEMANA', `Gerada semana de ${selectedDate} para: ${trainingsToGenerate.join(', ')}`);
      
      setIsGenerating(false);
    }, 50);
  };
  
  const handleClearWeek = () => {
     if(!confirm('Tem certeza que deseja limpar todos os agendamentos a partir desta semana? Isto não pode ser desfeito.')) return;
     const result = clearWeekSchedule(filterTraining, selectedDate, (slots || []), (assignments || []));
     setSlots(result.remainingSlots);
     setAssignments(result.remainingAssignments);
     addLog('LIMPAR_SEMANA', `Removidos ${result.count} agendamentos a partir de ${selectedDate}`);
  };

  const handleDuplicateWeek = (targetDate: string) => {
    const result = duplicateWeek(filterTraining, selectedDate, targetDate, (slots || []), (assignments || []), (districts || []));
    setSlots(prev => [...(prev || []), ...result.newSlots]);
    setAssignments(prev => [...(prev || []), ...result.newAssignments]);
    addLog('DUPLICAR_SEMANA', result.log);
    setShowDuplicateModal(false);
  };

  const handleExportCSV = () => {
     let sd = selectedDate || new Date().toISOString().split('T')[0];
     const parts = sd.split('-');
     const y = Number(parts[0]);
     const m = Number(parts[1]);

     const firstDay = new Date(y, m - 1, 1).toISOString().split('T')[0];
     const lastDay = new Date(y, m, 0).toISOString().split('T')[0];

     const visibleSlots = (slots || []).filter(s => s && (filterTraining === 'ALL' || s.training === filterTraining) && s.date >= firstDay && s.date <= lastDay)
        .sort((a, b) => {
            if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
            if (a.startTime !== b.startTime) return (a.startTime || '').localeCompare(b.startTime || '');
            return (a.training || '').localeCompare(b.training || '');
        });
     const visibleAssignments = (assignments || []).filter(a => a && visibleSlots.some(s => s.slotId === a.slotId));
     const csvContent = generateCSV(visibleSlots, visibleAssignments);
     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.setAttribute('download', `escala_${filterTraining}_${sd.substring(0,7)}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     addLog('EXPORTAR_CSV', `Escala do mês exportada para ${filterTraining}`);
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
            slotId: generateId('MS-MANUAL'), type, training, weekIndex: 0, date, startTime, endTime, capacityPeople: capacity, source: SlotSource.MANUAL, mealType, updatedBy: 'UsuarioManual', overrideReason: formData.get('overrideReason') as string
        };
        setSlots([...(slots || []), newSlot]);
        addLog('CRIAR_SLOT_MANUAL', `Novo horário criado manualmente em ${date} ${startTime}`);
    } else {
        const type = editingSlot.type;
        const mealType = type === SlotType.MEAL ? (formData.get('mealType') as MealType) : undefined;
        const updatedSlot: Slot = {
            ...editingSlot, startTime: formData.get('startTime') as string, endTime: formData.get('endTime') as string, capacityPeople: parseInt(formData.get('capacityPeople') as string, 10), source: SlotSource.MANUAL, mealType, updatedBy: 'UsuarioAtual', overrideReason: formData.get('overrideReason') as string
        };
        setSlots((slots || []).map(s => s?.slotId === updatedSlot.slotId ? updatedSlot : s));
        addLog('EDICAO_MANUAL', `Slot editado manualmente`);
    }
    setEditingSlot(null); setIsCreatingSlot(false);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      setGlobalSettings({ defaultMealCapacity: parseInt(formData.get('defaultMealCapacity') as string, 10), defaultLaundryCapacity: parseInt(formData.get('defaultLaundryCapacity') as string, 10) });
      addLog('ATUALIZAR_CONFIG', 'Capacidades globais atualizadas.');
      setShowSettingsModal(false);
  };
  
  const handleSaveDistrict = (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      let finalDistrictId = formData.get('districtId') as string;
      let planCode = editingDistrict ? (editingDistrict.planCode || '') : `${formData.get('trainingBase')}${formData.get('planNum')}`;
      if (!editingDistrict && !finalDistrictId) finalDistrictId = `${planCode} 1`; 
      if (editingDistrict && !finalDistrictId) finalDistrictId = editingDistrict.districtId;
      
      const derivedPlanCode = planCode.replace(/\d+/g, '');
      const districtNumero = finalDistrictId.replace(/\D/g, '');
      const districtLetra = finalDistrictId.replace(/[^a-zA-Z]/g, '').replace(derivedPlanCode, '');
      const missionaryCount = parseInt(formData.get('missionaryCount') as string, 10);
      const mtcStartDt = formData.get('mtcStartDt') as string;

      if (editingDistrict) {
        if (finalDistrictId !== editingDistrict.districtId && (districts || []).some(d => d?.districtId === finalDistrictId)) return alert(`Erro: O ID de distrito "${finalDistrictId}" já existe. Escolha outro.`);
        const updatedDistrict: District = { ...editingDistrict, districtId: finalDistrictId, training: planCode, planCode: planCode, districtNumero, districtLetra, mtcStartDt, missionaryCount, manualMissionaryCount: missionaryCount, countSource: CountSource.MANUAL, isManual: true, updatedAt: new Date().toISOString() };
        setDistricts(prev => (prev || []).map(d => d?.districtId === editingDistrict.districtId ? updatedDistrict : d));
        if (finalDistrictId !== editingDistrict.districtId) setAssignments(prev => (prev || []).map(a => a?.districtId === editingDistrict.districtId ? { ...a, districtId: finalDistrictId } : a));
        addLog('EDITAR_DISTRITO', `Distrito ${finalDistrictId} atualizado.`);
      } else {
        if ((districts || []).some(d => d?.districtId === finalDistrictId)) return alert('Já existe um distrito com este ID.');
        setDistricts(prev => [...(prev || []), { districtId: finalDistrictId, training: planCode, districtNumero, districtLetra, planCode: planCode, mtcStartDt, missionaryCount, manualMissionaryCount: missionaryCount, countSource: CountSource.MANUAL, isManual: true, updatedAt: new Date().toISOString() }]);
        addLog('CRIAR_DISTRITO', `Distrito ${finalDistrictId} adicionado manualmente.`);
      }
      setShowAddDistrictModal(false); setEditingDistrict(null);
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
              districtNumero = startNum.toString();
              districtLetra = alphabet[i % 26];
          } else {
              districtNumero = (startNum + i).toString();
          }
          const suffix = `${districtNumero}${districtLetra}`;
          const districtId = `${planCode} ${suffix}`;
          if ((districts || []).some(d => d?.districtId === districtId) || newDistricts.some(d => d.districtId === districtId)) continue;
          newDistricts.push({ districtId, training: planCode, districtNumero, districtLetra, planCode, mtcStartDt: startDate, missionaryCount: people, manualMissionaryCount: people, countSource: CountSource.MANUAL, isManual: true, updatedAt: new Date().toISOString() });
      }
      setDistricts(prev => [...(prev || []), ...newDistricts]);
      addLog('CRIAR_LOTE_DISTRITOS', `Criados ${newDistricts.length} distritos para ${planCode}.`);
      setShowBatchDistrictModal(false);
  };
  
  const handleDeleteDistrict = (districtId: string) => {
      if(!confirm(`Tem certeza que deseja remover o distrito ${districtId}?`)) return;
      setDistricts(prev => (prev || []).filter(d => d?.districtId !== districtId));
      setSelectedDistricts(prev => { const next = new Set(prev); next.delete(districtId); return next; });
      setAssignments(prev => (prev || []).filter(a => a?.districtId !== districtId));
      addLog('APAGAR_DISTRITO', `Distrito ${districtId} removido.`);
  };

  const handleBatchDeleteDistricts = () => {
      if (selectedDistricts.size === 0) return;
      if (!confirm(`Tem certeza que deseja excluir ${selectedDistricts.size} distritos?`)) return;
      setDistricts(prev => (prev || []).filter(d => d && !selectedDistricts.has(d.districtId)));
      setAssignments(prev => (prev || []).filter(a => a && !selectedDistricts.has(a.districtId)));
      addLog('APAGAR_LOTE', `Removidos ${selectedDistricts.size} distritos.`);
      setSelectedDistricts(new Set());
  };


  // ==========================================
  // EXCEL IMPORT ENGINE - LÊ TODAS AS ABAS SEM FALHAR
  // ==========================================
  const processFileData = (headers: string[], rawData: string[][]) => {
    setImportHeaders(headers);
    setImportRawData(rawData);
    
    // Auto-mapping expandido para os relatórios da Igreja
    const guessMapping = {
        trainingBase: headers.findIndex(h => /training|treinamento|base|miss[ãa]o|mission/i.test(h)),
        planNum: headers.findIndex(h => /^plan\.?|^plano/i.test(h)),
        distNum: headers.findIndex(h => /distrito numero|numero|num|dist/i.test(h)),
        distLet: headers.findIndex(h => /distrito letra|letra/i.test(h)),
        startDate: headers.findIndex(h => /mtc start|start|data|in[ií]cio|inicio/i.test(h))
    };
    setColMapping(guessMapping);
    setImportStep('MAP');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

      if (isExcel) {
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const data = new Uint8Array(event.target?.result as ArrayBuffer);
                  const workbook = XLSX.read(data, { type: 'array' });
                  
                  let allValidData: any[][] = [];
                  let bestHeaders: string[] = [];
                  
                  // Percorre TODAS as abas para encontrar todos os missionários
                  for (const sheetName of workbook.SheetNames) {
                      const worksheet = workbook.Sheets[sheetName];
                      const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false }) as any[][];
                      
                      let headerRowIdx = -1;
                      
                      // Encontra cabeçalho dinamicamente ignorando lixo acima
                      for (let i = 0; i < Math.min(sheetData.length, 20); i++) {
                          if (!sheetData[i]) continue;
                          const rowStr = sheetData[i].map(c => String(c).toLowerCase()).join(' ');
                          if (rowStr.includes('training') || rowStr.includes('mtc start') || rowStr.includes('missionary') || rowStr.includes('mission assigned')) {
                              headerRowIdx = i;
                              break;
                          }
                      }

                      if (headerRowIdx !== -1) {
                          const headers = sheetData[headerRowIdx].map(String);
                          const rawData = sheetData.slice(headerRowIdx + 1).filter(row => row && row.some(cell => String(cell).trim() !== '')).map(row => row.map(String));
                          
                          if (bestHeaders.length === 0 || headers.length > bestHeaders.length) {
                              bestHeaders = headers;
                          }
                          
                          const mappedData = rawData.map(row => {
                              return bestHeaders.map(bh => {
                                  const idxInThisSheet = headers.findIndex(h => h === bh);
                                  return idxInThisSheet !== -1 ? row[idxInThisSheet] : '';
                              });
                          });

                          allValidData.push(...mappedData);
                      }
                  }

                  if (allValidData.length === 0) {
                      alert("Não foi possível encontrar dados válidos. O documento deve ter palavras como 'Training', 'Mission' ou 'MTC Start Dt'.");
                      return;
                  }
                  
                  processFileData(bestHeaders, allValidData);
              } catch (error) {
                  console.error(error);
                  alert("Erro ao ler o ficheiro Excel. Pode estar corrompido.");
              }
          };
          reader.readAsArrayBuffer(file);
      } else if (file.name.endsWith('.csv')) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const text = event.target?.result as string;
              if (!text) return;
              const lines = text.split('\n').filter(l => l.trim() !== '');
              if (lines.length <= 1) return alert("Ficheiro CSV vazio.");
              
              let headerIdx = lines.findIndex(l => l.toLowerCase().includes('training') || l.toLowerCase().includes('mtc start dt') || l.toLowerCase().includes('missionary'));
              if(headerIdx === -1) headerIdx = 0;

              const headers = lines[headerIdx].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
              const rawData = lines.slice(headerIdx + 1).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
              processFileData(headers, rawData);
          };
          reader.readAsText(file);
      }
  };

  const handleProcessImport = () => {
    const aggregatedDistricts = new Map<string, District>();
    let importedCount = 0;
    
    importRawData.forEach(cols => {
        let tBase = colMapping.trainingBase >= 0 ? cols[colMapping.trainingBase] : null;
        let pNum = colMapping.planNum >= 0 ? cols[colMapping.planNum] : null;
        let dNum = colMapping.distNum >= 0 ? cols[colMapping.distNum] : null;
        let dLet = colMapping.distLet >= 0 ? cols[colMapping.distLet] : null;
        let sDate = colMapping.startDate >= 0 ? cols[colMapping.startDate] : null;

        // Se faltar informação fundamental, o sistema auto-preenche para não descartar a linha
        if (!tBase || tBase.toString().trim() === '') tBase = "GERAL"; 
        if (!sDate || sDate.toString().trim() === '') sDate = selectedDate; 

        tBase = tBase.toString().trim();
        sDate = sDate.toString().trim();

        let derivedPlanCode = '';
        let extractedPlanNum = '';

        // Extrai a Base (POR) e o Plano (6) de nomes sujos como "POR 6 Provo MTC" ou "Brazil Belo Horizonte"
        const matchWithNum = tBase.match(/([A-Z]{3,})[^0-9]*(\d+)/i); 
        if (matchWithNum) {
            derivedPlanCode = matchWithNum[1].toUpperCase().substring(0, 3);
            extractedPlanNum = matchWithNum[2];
        } else {
            const letters = tBase.replace(/[^A-Za-z]/g, '');
            derivedPlanCode = (letters.length > 0 ? letters : 'GER').toUpperCase().substring(0, 3); 
            const numMatch = tBase.match(/\d+/);
            if (numMatch) extractedPlanNum = numMatch[0];
        }
        
        let finalPlan = (pNum || extractedPlanNum || '1').toString().replace(/\D/g, '');
        const planCode = `${derivedPlanCode}${finalPlan}`; // Ex: POR6, BRA1

        if (/^\d+$/.test(sDate)) {
             const excelEpoch = new Date(1899, 11, 30); 
             excelEpoch.setDate(excelEpoch.getDate() + parseInt(sDate, 10));
             sDate = excelEpoch.toISOString().split('T')[0];
        } else {
            try {
                const parsedDate = new Date(sDate);
                if(!isNaN(parsedDate.getTime())) {
                    sDate = parsedDate.toISOString().split('T')[0];
                }
            } catch(e) {} 
        }

        const finalNum = dNum ? parseInt(dNum.toString().replace(/\D/g, ''), 10).toString() : '1'; 
        if (isNaN(finalNum as any)) return; 

        const finalLet = dLet ? dLet.toString().replace(/[^a-zA-Z]/g, '').toUpperCase() : ''; 
        
        // Criação exata do ID (ex: "POR6 1" ou "POR6 1A")
        const districtId = `${planCode} ${finalNum}${finalLet}`.trim();
        
        if (aggregatedDistricts.has(districtId)) {
            aggregatedDistricts.get(districtId)!.missionaryCount += 1;
            aggregatedDistricts.get(districtId)!.manualMissionaryCount += 1;
        } else {
            aggregatedDistricts.set(districtId, { 
                districtId, training: planCode, districtNumero: finalNum, districtLetra: finalLet, planCode: planCode, 
                mtcStartDt: sDate, missionaryCount: 1, manualMissionaryCount: 1, countSource: CountSource.MASTERLIST, 
                isManual: false, updatedAt: new Date().toISOString() 
            });
        }
        importedCount++;
    });

    if (aggregatedDistricts.size > 0) {
        setDistricts(prev => { 
            const map = new Map((prev || []).filter(d => d).map(d => [d.districtId, d])); 
            Array.from(aggregatedDistricts.values()).forEach(d => map.set(d.districtId, d)); 
            return Array.from(map.values()); 
        });
        
        const sampleGroup = aggregatedDistricts.keys().next().value;
        addLog('IMPORTAR_DADOS', `Sucesso! ${importedCount} missionários. Exemplo criado: ${sampleGroup}`);
        closeImportModal();
    } else { 
        alert('Atenção: Nenhum dado foi importado. Verifique o mapeamento das colunas.'); 
    }
  };

  const closeImportModal = () => {
      setShowImportModal(false);
      setImportStep('UPLOAD');
      setImportHeaders([]);
      setImportRawData([]);
  }
  
  const handleDownloadTemplate = () => {
    const csvContent = "Data,Treinamento,Plano,Numero,Letra,Missionario\n2026-05-01,POR,6,1,A,Elder Smith\n2026-05-01,POR,6,1,B,Sister Jones\n2026-05-05,ESP,3,2,,Elder Doe";
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Modelo_Importacao_Distritos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateNewGroup = (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const groupName = formData.get('groupName') as string; 
      const weeksCount = parseInt(formData.get('weeksCount') as string, 10);
      const newTemplate: PlanTemplateModel = { templateModelId: `TM-${groupName}-v1`, planCode: `${groupName}.1`, name: `${groupName} Versão 1`, category: groupName, weeksCount, isActive: true, createdAt: new Date().toISOString() };
      setTemplates(prev => [...(prev || []), newTemplate]);
      setTemplateWeeks(prev => [...(prev || []), ...Array.from({ length: weeksCount }, (_, i) => ({ templateWeekId: `TW-${newTemplate.planCode}-W${i + 1}`, templateModelId: newTemplate.templateModelId, weekIndex: i + 1 }))]);
      setSelectedTemplateId(newTemplate.templateModelId);
      setExpandedTemplateGroups(prev => { const next = new Set(prev); next.add(groupName); return next; });
      addLog('CRIAR_GRUPO', `Novo Grupo ${groupName} criado.`); setShowCreateTemplateModal(false);
  };

  const handleAddVersionToGroup = (groupName: string) => {
      const groupTemplates = (templates || []).filter(t => t?.category === groupName);
      const versions = groupTemplates.map(t => { const match = (t?.planCode || '').match(/\.(\d+)$/); return match ? parseInt(match[1], 10) : 0; });
      const maxVersion = Math.max(0, ...versions);
      const nextVersion = maxVersion + 1;
      const baseTemplate = groupTemplates[groupTemplates.length - 1];
      const weeksCount = baseTemplate ? baseTemplate.weeksCount : 8;

      const newTemplate: PlanTemplateModel = { templateModelId: `TM-${groupName}-v${nextVersion}`, planCode: `${groupName}.${nextVersion}`, name: `${groupName} Versão ${nextVersion}`, category: groupName, weeksCount, isActive: true, createdAt: new Date().toISOString() };
      setTemplates(prev => [...(prev || []), newTemplate]);
      setTemplateWeeks(prev => [...(prev || []), ...Array.from({ length: weeksCount }, (_, i) => ({ templateWeekId: `TW-${newTemplate.planCode}-W${i + 1}`, templateModelId: newTemplate.templateModelId, weekIndex: i + 1 }))]);
      setSelectedTemplateId(newTemplate.templateModelId); addLog('NOVA_VERSAO', `Criada versão ${nextVersion} para ${groupName}.`);
  };

  const handleAddWeekToTemplate = () => {
      if (!selectedTemplate) return;
      const newWeekIndex = selectedTemplate.weeksCount + 1;
      setTemplates(prev => (prev || []).map(t => t?.templateModelId === selectedTemplate.templateModelId ? { ...selectedTemplate, weeksCount: newWeekIndex } : t));
      setTemplateWeeks(prev => [...(prev || []), { templateWeekId: `TW-${selectedTemplate.planCode}-W${newWeekIndex}`, templateModelId: selectedTemplate.templateModelId, weekIndex: newWeekIndex }]);
      setEditorWeekIndex(newWeekIndex); addLog('ADICIONAR_SEMANA', `Adicionada semana ${newWeekIndex} ao modelo.`);
  };

  const handleDeleteTemplate = (templateId: string) => {
      if(!confirm('Tem certeza que deseja excluir esta versão?')) return;
      setTemplates(prev => (prev || []).filter(t => t?.templateModelId !== templateId));
      const weekIdsToDelete = (templateWeeks || []).filter(tw => tw?.templateModelId === templateId).map(tw => tw?.templateWeekId);
      setTemplateWeeks(prev => (prev || []).filter(tw => tw?.templateModelId !== templateId));
      setTemplateBlocks(prev => (prev || []).filter(tb => tb && !weekIdsToDelete.includes(tb.templateWeekId)));
      if (selectedTemplateId === templateId) setSelectedTemplateId(null);
      addLog('APAGAR_TEMPLATE', `Modelo removido.`);
  };

  const handleSaveBlock = (e: React.FormEvent) => {
      e.preventDefault();
      const week = (templateWeeks || []).find(tw => tw?.templateModelId === selectedTemplateId && tw.weekIndex === editorWeekIndex);
      if (!week || !editingBlock) return;
      const formData = new FormData(e.target as HTMLFormElement);
      const type = formData.get('type') as SlotType;
      const blockData: PlanTemplateBlock = { templateBlockId: editingBlock.templateBlockId || generateId('TB'), templateWeekId: week.templateWeekId, type, weekday: parseInt(formData.get('weekday') as string, 10), startTime: formData.get('startTime') as string, endTime: formData.get('endTime') as string, capacityPeople: parseInt(formData.get('capacityPeople') as string, 10), mealType: type === SlotType.MEAL ? (formData.get('mealType') as MealType) : undefined };
      if (editingBlock.templateBlockId) setTemplateBlocks(prev => (prev || []).map(b => b?.templateBlockId === blockData.templateBlockId ? blockData : b));
      else setTemplateBlocks(prev => [...(prev || []), blockData]);
      setShowBlockModal(false); setEditingBlock(null);
  };

  const handleDeleteBlock = (blockId: string) => {
      if (confirm('Remover bloco?')) setTemplateBlocks(prev => (prev || []).filter(b => b?.templateBlockId !== blockId));
  };

  const toggleGroup = (key: string) => {
    setExpandedTemplateGroups(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  const toggleDistrictSelection = (id: string) => {
      setSelectedDistricts(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleAllDistricts = (filtered: District[]) => {
      setSelectedDistricts(selectedDistricts.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(d => d.districtId)));
  };

  const groupedTemplates = useMemo(() => {
    return (templates || []).reduce((acc: any, t: PlanTemplateModel) => {
        if (!t) return acc;
        const groupName = t.category || 'Outros';
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(t);
        return acc;
    }, {});
  }, [templates]);

  const sortedGroupKeys = Object.keys(groupedTemplates).sort();

  // --- VIEWS ---

  const renderScheduleView = () => { 
    const monthDaysArr = useMemo(() => {
        let sd = selectedDate;
        if (!sd || sd.split('-').length !== 3) sd = new Date().toISOString().split('T')[0];

        const [y, m, d] = sd.split('-').map(Number);
        const firstDay = new Date(y, m - 1, 1);
        const lastDay = new Date(y, m, 0);
        
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startDate.getDay()); 
        
        const endDate = new Date(lastDay);
        if (endDate.getDay() !== 6) {
            endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
        }
        
        const days = [];
        let curr = new Date(startDate);
        while (curr <= endDate) {
            const yy = curr.getFullYear();
            const mm = String(curr.getMonth() + 1).padStart(2, '0');
            const dd = String(curr.getDate()).padStart(2, '0');
            days.push(`${yy}-${mm}-${dd}`);
            curr.setDate(curr.getDate() + 1);
        }
        return days;
    }, [selectedDate]);

    const viewStartDate = monthDaysArr[0];
    const viewEndDate = monthDaysArr[monthDaysArr.length - 1];

    const visibleSlots = useMemo(() => (slots || []).filter((s: Slot) => 
        s && (filterTraining === 'ALL' || s.training === filterTraining) && 
        s.date >= viewStartDate && s.date <= viewEndDate
    ).sort((a: Slot, b: Slot) => {
        if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
        return (a.startTime || '').localeCompare(b.startTime || '');
    }), [slots, filterTraining, viewStartDate, viewEndDate]);

    const groupedByDay = useMemo(() => visibleSlots.reduce((acc: any, slot: Slot) => { 
        acc[slot.date] = acc[slot.date] || []; 
        acc[slot.date].push(slot); 
        return acc; 
    }, {}), [visibleSlots]);

    const totalAssignments = useMemo(() => visibleSlots.reduce((acc: number, slot: Slot) => acc + (assignments || []).filter((a: Assignment) => a && a.slotId === slot.slotId).reduce((s: number, a: Assignment) => s + (a.missionaryCountAtCalculation || 0), 0), 0), [visibleSlots, assignments]);

    const [selY, selM] = (selectedDate || new Date().toISOString().split('T')[0]).split('-').map(Number);
    const monthName = new Date(selY, selM - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth()+1).padStart(2,'0')}-${String(todayObj.getDate()).padStart(2,'0')}`;

    return (
      <div className="space-y-6 animate-fade-in h-full flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
            <StatCard label="Conflitos Ativos (Mês)" value={conflicts.length} icon={AlertTriangle} color={conflicts.length > 0 ? "red" : "brand"} />
            <StatCard label="Total Agendado (Mês)" value={totalAssignments} icon={Users} trend="+12% vs mês anterior" />
            <StatCard label="Horários Criados" value={visibleSlots.length} icon={Layout} color="green" />
        </div>
        <div className="neu-card p-4 flex flex-col xl:flex-row justify-between items-center gap-4 flex-shrink-0">
             <div className="flex items-center gap-6 w-full xl:w-auto">
                <div className="px-2">
                    <h2 className="text-xl font-black text-slate-700 capitalize">{monthName} {selY}</h2>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gestão Mensal</div>
                </div>
                <div className="h-10 w-px bg-slate-300"></div>
                <div className="flex bg-neu-base p-1.5 rounded-2xl shadow-soft-pressed-sm">
                   <button onClick={() => setViewMode('GRID')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'GRID' ? 'bg-white text-brand-600 shadow-soft-sm' : 'text-slate-400 hover:text-slate-600'}`}><Grid size={16} /> Grade</button>
                   <button onClick={() => setViewMode('HEATMAP')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'HEATMAP' ? 'bg-white text-brand-600 shadow-soft-sm' : 'text-slate-400 hover:text-slate-600'}`}><Activity size={16} /> Mapa</button>
                </div>
                <div className="hidden md:flex items-center gap-3 neu-input px-4 py-2">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Filtro</span>
                    <select value={filterTraining} onChange={(e) => setFilterTraining(e.target.value)} className="bg-transparent font-bold text-brand-600 outline-none text-sm cursor-pointer"><option value="ALL">Todos</option>{(templates || []).map(t => t && (<option key={t.planCode} value={t.planCode}>{t.planCode}</option>))}</select>
                </div>
            </div>
            <div className="flex items-center gap-4 w-full xl:w-auto justify-end">
                 <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="neu-input px-6 py-3 text-sm text-slate-700 font-bold tracking-wide" />
                 <div className="flex items-center gap-2">
                    <Tooltip text="Limpar Mês"><button onClick={handleClearWeek} className="neu-icon-btn h-10 w-10 text-red-400 hover:text-red-500"><Trash2 size={18} /></button></Tooltip>
                    <Tooltip text="Duplicar Semana"><button onClick={() => setShowDuplicateModal(true)} className="neu-icon-btn h-10 w-10"><Copy size={18} /></button></Tooltip>
                    <Tooltip text="Exportar Mês"><button onClick={handleExportCSV} className="neu-icon-btn h-10 w-10"><Download size={18} /></button></Tooltip>
                 </div>
                 
                 <button onClick={() => { setEditingSlot({ slotId: '', type: SlotType.MEAL, training: '', weekIndex: 0, date: selectedDate, startTime: '12:00', endTime: '13:00', capacityPeople: globalSettings?.defaultMealCapacity || 155, source: SlotSource.MANUAL }); setIsCreatingSlot(true); setModalSlotType(SlotType.MEAL); }} className="neu-btn px-4 py-3 flex items-center gap-2 text-sm"><Plus size={18} /> Novo</button>
                 
                 <button onClick={handleGenerateWeek} disabled={isGenerating} className={`neu-btn-primary px-6 py-3 flex items-center gap-2 text-sm ${isGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} 
                    {isGenerating ? 'Gerando...' : 'Gerar 1 Sem.'}
                 </button>
            </div>
        </div>

        <div className="flex-1 overflow-hidden neu-card p-4 flex flex-col min-h-0 relative z-0">
             {conflicts.length > 0 && (
                <div className="mb-4 neu-card border-none bg-red-50/50 overflow-hidden flex flex-col animate-slide-down flex-shrink-0 shadow-none ring-2 ring-red-100">
                    <div className="p-3 border-b border-red-100 flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-red-100 text-red-500 p-2 rounded-xl shadow-soft-pressed-sm"><AlertTriangle size={16}/></div><div><h3 className="font-bold text-red-800 text-xs">Conflitos de Sobreposição de Capacidade Detectados</h3></div></div></div>
                </div>
             )}
             
             <div className="grid grid-cols-7 gap-2 mb-2 flex-shrink-0 pr-2">
                {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(dayName => (
                    <div key={dayName} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-1">{dayName}</div>
                ))}
             </div>

             <div className="grid grid-cols-7 gap-2 h-full overflow-y-auto pr-2 pb-2 custom-scrollbar">
                {monthDaysArr.map(date => {
                    const daySlots = groupedByDay[date] || [];
                    const [y, m, dNum] = date.split('-').map(Number);
                    const d = new Date(y, m - 1, dNum);
                    
                    const isCurrentMonth = m === selM;
                    const isTodayStr = date === todayStr;

                    return (
                    <div key={date} className={`flex flex-col min-h-[140px] bg-slate-50/30 rounded-2xl p-2 border border-slate-100 transition-all ${!isCurrentMonth ? 'opacity-40 grayscale-[30%]' : ''}`}>
                        <div className={`text-center p-1.5 rounded-xl mb-2 flex-shrink-0 ${isTodayStr ? 'bg-brand-500 text-white shadow-lg shadow-brand-200' : 'text-slate-500'}`}>
                            <div className="text-sm font-black">{d.getDate()}</div>
                        </div>
                        <div className="space-y-1.5 flex-1">
                        {daySlots.map((slot: Slot) => {
                            if (!slot) return null;
                            const slotAssignments = (assignments || []).filter((a: Assignment) => a && a.slotId === slot.slotId);
                            const occupied = slotAssignments.reduce((acc: number, a: Assignment) => acc + (a.missionaryCountAtCalculation || 0), 0);
                            const hasConflict = conflicts.some((c: Conflict) => c.relatedIds.includes(slot.slotId));
                            const isMeal = slot.type === SlotType.MEAL;
                            
                            if (viewMode === 'HEATMAP') {
                                const utilization = slot.capacityPeople > 0 ? occupied/slot.capacityPeople : 0;
                                let heatClass = occupied > slot.capacityPeople ? 'bg-red-400 text-white shadow-lg shadow-red-200' : utilization > 0.8 ? 'bg-amber-400 text-white shadow-lg shadow-amber-200' : 'bg-neu-base text-slate-400 shadow-soft-pressed-sm';
                                return (<div key={slot.slotId} onClick={() => { setEditingSlot(slot); setModalSlotType(slot.type); }} className={`p-1.5 rounded-lg cursor-pointer transition-all ${heatClass} ${hasConflict ? 'ring-2 ring-red-400' : ''}`}><div className="text-[9px] font-bold flex justify-between"><span>{formatTime(slot.startTime)}</span><span>{Math.round(utilization*100)}%</span></div></div>);
                            }
                            return (
                            <div key={slot.slotId} onClick={() => { setEditingSlot(slot); setModalSlotType(slot.type); }} className={`group relative p-2 rounded-xl transition-all cursor-pointer border hover:-translate-y-0.5 hover:shadow-soft-sm ${hasConflict ? 'border-red-300 bg-red-50' : 'border-slate-100 bg-white shadow-sm'}`}>
                                <div className="flex justify-between items-start mb-1"><div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isMeal ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>{formatTime(slot.startTime)}</div><div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{(slot.training || '')}</div></div>
                                <div className="text-slate-600 font-bold text-[9px] mb-1.5 leading-tight truncate">{slot.mealType || 'Lavanderia'}</div>
                                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold"><Users size={10}/><span>{occupied}/{slot.capacityPeople}</span></div>
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
    const currentBlocks = (templateBlocks || []).filter(b => b && b.templateWeekId === (templateWeeks || []).find(tw => tw && tw.templateModelId === selectedTemplateId && tw.weekIndex === editorWeekIndex)?.templateWeekId).sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));
    
    return (
      <div className="h-full flex gap-6 animate-fade-in">
        <div className="w-80 neu-card flex flex-col overflow-hidden flex-shrink-0">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-600">Modelos</h3><button onClick={() => setShowCreateTemplateModal(true)} className="neu-icon-btn h-9 w-9 text-brand-500" title="Novo Grupo"><Plus size={18}/></button></div>
             <div className="overflow-y-auto flex-1 p-4 space-y-4">
                 {sortedGroupKeys.map(groupName => {
                     const isExpanded = expandedTemplateGroups.has(groupName);
                     const items = (groupedTemplates[groupName] || []).filter(Boolean).sort((a: PlanTemplateModel, b: PlanTemplateModel) => parseInt((a.planCode || '').split('.')[1] || '0', 10) - parseInt((b.planCode || '').split('.')[1] || '0', 10));
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
                                     {items.map((t: PlanTemplateModel) => {
                                         if (!t) return null;
                                         return (
                                         <div key={t.templateModelId || Math.random()} className="relative group">
                                             <button onClick={() => setSelectedTemplateId(t.templateModelId)} className={`w-full text-left pl-4 pr-8 py-3 rounded-xl transition-all flex justify-between items-center ${selectedTemplateId === t.templateModelId ? 'bg-white shadow-soft text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                                                 <span className="text-xs truncate">{(t.name || '').replace(groupName, '').trim() || t.name}</span>
                                                 {selectedTemplateId === t.templateModelId && <div className="h-2 w-2 rounded-full bg-brand-500 shadow-glow"></div>}
                                             </button>
                                             <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.templateModelId); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10" title="Excluir versão"><Trash2 size={12}/></button>
                                         </div>
                                     )})}
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
                    <div className="p-8 border-b border-slate-100 flex justify-between items-start"><div><h2 className="text-3xl font-black text-slate-700 tracking-tight">{selectedTemplate?.name}</h2><div className="flex gap-3 mt-3"><Badge color="brand">{selectedTemplate?.category || 'Geral'}</Badge><span className="neu-input px-3 py-1 text-xs font-bold text-slate-400">{selectedTemplate?.planCode}</span></div></div><div className="flex gap-2"><button onClick={() => handleDeleteTemplate(selectedTemplate.templateModelId)} className="neu-icon-btn h-12 w-12 text-red-400 hover:text-red-500"><Trash2 size={20}/></button></div></div>
                    <div className="px-8 pt-6 flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">{Array.from({ length: selectedTemplate?.weeksCount || 0 }).map((_, i) => (<button key={i+1} onClick={() => setEditorWeekIndex(i+1)} className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${editorWeekIndex === i+1 ? 'bg-brand-500 text-white shadow-lg shadow-brand-200 transform -translate-y-1' : 'bg-neu-base text-slate-500 shadow-soft hover:bg-white'}`}>Semana {i+1}</button>))}<button onClick={handleAddWeekToTemplate} className="neu-icon-btn h-11 w-11 flex-shrink-0 text-brand-500"><Plus size={18}/></button></div>
                    <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-transparent to-slate-50/50">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-600 text-lg">Blocos de Horário</h3>
                            <button onClick={() => { setEditingBlock({ templateWeekId: (templateWeeks || []).find((tw: PlanTemplateWeek) => tw && tw.templateModelId === selectedTemplateId && tw.weekIndex === editorWeekIndex)?.templateWeekId, weekday: 1 }); setShowBlockModal(true); setModalSlotType(SlotType.MEAL); }} className="neu-btn-primary px-5 py-2.5 flex items-center gap-2 text-sm"><Plus size={16}/> Adicionar Bloco</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{currentBlocks.map((block: PlanTemplateBlock) => {
                            if (!block) return null;
                            return (
                            <div key={block.templateBlockId} className="group neu-card border-none shadow-soft-sm p-5 relative hover:-translate-y-1 transition-transform">
                                <div className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">{weekDays[(block.weekday || 1) - 1] || 'Dia'}</div>
                                <div className="text-2xl font-black text-slate-700 mb-2">{block.startTime} - {block.endTime}</div>
                                <div className="text-xs font-bold text-brand-500 bg-brand-50 inline-block px-2 py-1 rounded-lg mb-4">{block.type === SlotType.MEAL ? block.mealType : 'Lavanderia'}</div>
                                <div className="flex gap-3 mt-2 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingBlock(block); setShowBlockModal(true); setModalSlotType(block.type); }} className="neu-icon-btn h-8 w-8 text-brand-500"><Pencil size={12}/></button><button onClick={() => handleDeleteBlock(block.templateBlockId)} className="neu-icon-btn h-8 w-8 text-red-500"><Trash2 size={12}/></button></div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Users size={14}/> {block.capacityPeople} pax</div>
                            </div>
                        )})}</div>
                    </div>
                 </>
             ) : <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4"><Layout size={64} className="text-slate-200"/><p className="font-bold text-lg">Selecione um modelo para começar</p></div>}
      </div>
    </div>
  );
};

  const renderDistrictsView = () => {
      const filteredDistricts = (districts || []).filter(d => 
        d && 
        ((d.districtId || '').toLowerCase().includes((districtSearch || '').toLowerCase()) || 
        (d.planCode || '').toLowerCase().includes((districtSearch || '').toLowerCase()) || 
        ((d.districtNumero || '') + (d.districtLetra || '')).toLowerCase().includes((districtSearch || '').toLowerCase()))
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
                              {filteredDistricts.map(d => {
                                  if (!d) return null;
                                  return (
                                  <tr key={d.districtId || Math.random()} className={`group border-b border-slate-100 last:border-0 hover:bg-white/60 transition-colors ${selectedDistricts.has(d.districtId) ? 'bg-brand-50/50' : ''}`}>
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
                                      <td className="p-5 text-sm font-bold text-slate-500">{d.mtcStartDt ? new Date(d.mtcStartDt).toLocaleDateString('pt-BR') : ''}</td>
                                      <td className="p-5">
                                          <div className="flex items-center gap-2">
                                              <div className="bg-neu-base p-2 rounded-full shadow-soft-pressed-sm text-slate-400"><Users size={14}/></div>
                                              <span className="font-bold text-slate-700">{d.missionaryCount}</span>
                                          </div>
                                      </td>
                                      <td className="p-5">
                                          {d.isManual ? <Badge color="blue">Manual</Badge> : <Badge color="green">Auto</Badge>}
                                      </td>
                                      <td className="p-5 text-right">
                                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={() => { setEditingDistrict(d); setShowAddDistrictModal(true); }} className="neu-icon-btn h-9 w-9 text-brand-500" title="Editar"><Pencil size={16}/></button>
                                              <button onClick={() => handleDeleteDistrict(d.districtId)} className="neu-icon-btn h-9 w-9 text-red-500" title="Excluir"><Trash2 size={16}/></button>
                                          </div>
                                      </td>
                                  </tr>
                              )})}
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

  // --- Layout Principal ---
  return (
    <div className="h-screen w-full p-6 flex gap-8 font-sans text-slate-600 overflow-hidden bg-neu-base">
        
        <aside className="hidden md:flex flex-col w-24 hover:w-72 transition-all duration-300 ease-in-out bg-neu-base rounded-[3rem] shadow-soft py-10 px-4 justify-between flex-shrink-0 z-50 overflow-hidden group">
            <div className="flex flex-col items-center w-full">
                <div className="relative flex items-center justify-center group-hover:justify-start w-full h-12 mb-16">
                    <div className="bg-brand-500 text-white p-3 rounded-2xl shadow-lg shadow-brand-300 flex-shrink-0 z-10 transition-all duration-300">
                        <Layout size={24} strokeWidth={3} />
                    </div>
                    <div className="absolute left-16 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
                        <h1 className="text-xl font-black text-slate-700 tracking-tight leading-none">CTM</h1>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Planner Pro</span>
                    </div>
                </div>
                
                <nav className="space-y-6 w-full">
                    {[ 
                        { id: 'SCHEDULE', icon: Calendar, label: 'Agenda' }, 
                        { id: 'TEMPLATES', icon: Layers, label: 'Modelos' }, 
                        { id: 'DISTRICTS', icon: Users, label: 'Distritos' } 
                    ].map(item => (
                        <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`relative w-full flex items-center justify-center group-hover:justify-start p-3 rounded-2xl transition-all duration-300 group-hover:px-4 ${activeTab === item.id ? 'text-brand-600 shadow-soft-pressed' : 'text-slate-400 hover:text-slate-600 hover:shadow-soft'}`}>
                          <item.icon size={24} strokeWidth={activeTab === item.id ? 3 : 2} className={`flex-shrink-0 transition-all z-10 ${activeTab === item.id ? 'scale-110' : ''}`} />
                          <span className={`font-bold text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute left-16 pointer-events-none`}>{item.label}</span>
                          {activeTab === item.id && <div className="absolute right-3 h-2 w-2 rounded-full bg-brand-500 shadow-glow opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="flex flex-col items-center w-full gap-4 pb-2">
               <button onClick={() => setShowSettingsModal(true)} className="neu-icon-btn h-12 w-12 flex items-center justify-center text-slate-400 hover:text-brand-500" title="Configurações"><Settings size={20}/></button>
            </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 relative h-full">
            <header className="flex justify-between items-center mb-8 px-2">
                <div><h1 className="text-4xl font-black text-slate-700 tracking-tight">{activeTab === 'SCHEDULE' ? 'Agenda' : activeTab === 'TEMPLATES' ? 'Modelos' : 'Distritos'}</h1></div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 neu-card px-4 py-2 rounded-full">
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-glow"></div>
                        <span className="text-xs font-bold text-slate-500">Sistema Online</span>
                    </div>
                    <button className="neu-icon-btn h-12 w-12 text-slate-400 relative hover:text-brand-500">
                      <Bell size={22} />{(logs || []).length > 0 && <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#ecf0f3]"></span>}
                    </button>
                    <div className="h-12 w-12 rounded-full bg-slate-200 shadow-soft border-2 border-white overflow-hidden"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="Admin" /></div>
                </div>
            </header>

            <div className="flex-1 min-h-0 relative pb-2">
                 {activeTab === 'SCHEDULE' && renderScheduleView()}
                 {activeTab === 'TEMPLATES' && renderTemplateView()}
                 {activeTab === 'DISTRICTS' && renderDistrictsView()}
            </div>
        </main>
      
        {(logs || []).length > 0 && (
            <div className="fixed bottom-8 right-8 bg-slate-800 text-white p-5 rounded-3xl shadow-2xl flex items-center gap-5 z-50 animate-slide-up max-w-md cursor-pointer hover:scale-105 transition-transform" onClick={() => setLogs(l => (l || []).slice(1))}>
                <div className="bg-emerald-500/20 p-3 rounded-2xl"><CheckCircle size={20} className="text-emerald-400"/></div><div><div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">{logs[0].action}</div><div className="text-sm font-bold">{logs[0].summary}</div></div>
            </div>
        )}

        {(showSettingsModal || showDuplicateModal || showCreateTemplateModal || showBatchDistrictModal || showAddDistrictModal || showImportModal || showBlockModal || editingSlot || isCreatingSlot) && (
            <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
                
                {showSettingsModal && (
                    <div className="neu-card w-full max-w-sm p-8 animate-scale-in relative">
                        <button onClick={() => setShowSettingsModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                        <h3 className="font-black text-2xl text-slate-700 mb-2">Configurações</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-8">Limites Globais do Sistema</p>
                        
                        <form onSubmit={handleSaveSettings} className="space-y-6">
                            <div className="space-y-3"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Capacidade Refeitório</label><input name="defaultMealCapacity" type="number" defaultValue={globalSettings?.defaultMealCapacity || 155} className="neu-input w-full px-5 py-4 text-slate-700 font-bold text-lg" required min="1" /></div>
                            <div className="space-y-3"><label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Capacidade Lavanderia</label><input name="defaultLaundryCapacity" type="number" defaultValue={globalSettings?.defaultLaundryCapacity || 120} className="neu-input w-full px-5 py-4 text-slate-700 font-bold text-lg" required min="1" /></div>
                            <button type="submit" className="neu-btn-primary w-full py-4 text-lg mt-4">Salvar Alterações</button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-3 text-center">Zona de Perigo</p>
                          <button onClick={handleResetData} className="w-full py-3 rounded-xl border border-red-200 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors">Apagar Todos os Dados Salvos</button>
                        </div>
                    </div>
                )}

                {showImportModal && (
                    <div className="neu-card w-full max-w-lg p-8 animate-scale-in relative">
                         <button onClick={closeImportModal} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                         <h3 className="font-black text-2xl text-slate-700 mb-2">Importar Distritos</h3>
                         
                         {importStep === 'UPLOAD' ? (
                           <div className="space-y-6 mt-6">
                              <p className="text-slate-400 text-sm font-bold mb-4">Envie o ficheiro CSV ou Excel (.xlsx) com a lista de missionários. Mapeará as colunas no passo seguinte.</p>
                              <div className="neu-input p-8 text-center relative hover:bg-white/50 transition-colors cursor-pointer border-2 border-dashed border-slate-300 rounded-3xl">
                                  <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                                  <UploadCloud size={32} className="mx-auto text-brand-500 mb-2"/>
                                  <div className="text-sm font-bold text-slate-500">Clique para selecionar CSV ou Excel</div>
                              </div>
                              <button onClick={handleDownloadTemplate} className="neu-btn w-full py-3 flex items-center justify-center gap-2 text-sm">Baixar Modelo Padrão</button>
                           </div>
                         ) : (
                           <div className="space-y-6 mt-4">
                              <div className="bg-brand-50 p-4 rounded-2xl border border-brand-100 mb-6">
                                <p className="text-brand-600 text-xs font-bold flex items-center gap-2"><Check size={14}/> Ficheiro lido com sucesso! Confirme de que coluna devemos extrair cada dado:</p>
                              </div>
                              <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                  {[
                                    { key: 'trainingBase', label: 'Treinamento/Plano (Obrigatório, Ex: POR 6)' },
                                    { key: 'planNum', label: 'Plano (Opcional se já estiver no Treinamento)' },
                                    { key: 'distNum', label: 'Nº Distrito (Opcional, padrão: 1)' },
                                    { key: 'distLet', label: 'Letra (Opcional, Ex: A, B)' },
                                    { key: 'startDate', label: 'Data de Início (Obrigatório)' }
                                  ].map(field => (
                                    <div key={field.key} className="flex flex-col gap-1">
                                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">{field.label}</label>
                                      <select 
                                        className="neu-input px-4 py-2.5 text-sm font-bold text-slate-700 outline-none cursor-pointer"
                                        value={colMapping[field.key as keyof typeof colMapping]}
                                        onChange={e => setColMapping({...colMapping, [field.key]: parseInt(e.target.value)})}
                                      >
                                        <option value="-1">Ignorar / Não existe na folha</option>
                                        {importHeaders.map((header, idx) => (
                                          <option key={idx} value={idx}>{header || `Coluna ${idx + 1}`}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                              </div>
                              <div className="flex gap-4 mt-6">
                                <button onClick={() => setImportStep('UPLOAD')} className="neu-btn flex-1 py-3">Voltar</button>
                                <button onClick={handleProcessImport} className="neu-btn-primary flex-1 py-3 flex items-center justify-center gap-2"><Plus size={16}/> Importar Dados</button>
                              </div>
                           </div>
                         )}
                    </div>
                )}

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

                            <div className="bg-neu-base shadow-soft-pressed rounded-xl p-1.5 flex gap-2">
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="type" value={SlotType.MEAL} checked={modalSlotType === SlotType.MEAL} onChange={() => setModalSlotType(SlotType.MEAL)} className="hidden peer" />
                                    <span className="block text-center py-2.5 rounded-lg text-xs font-bold text-slate-400 peer-checked:bg-neu-base peer-checked:text-brand-600 peer-checked:shadow-soft transition-all">Refeição</span>
                                </label>
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="type" value={SlotType.LAUN} checked={modalSlotType === SlotType.LAUN} onChange={() => setModalSlotType(SlotType.LAUN)} className="hidden peer" />
                                    <span className="block text-center py-2.5 rounded-lg text-xs font-bold text-slate-400 peer-checked:bg-neu-base peer-checked:text-brand-600 peer-checked:shadow-soft transition-all">Lavanderia</span>
                                </label>
                            </div>

                            {modalSlotType === SlotType.MEAL && (
                                <div className="space-y-2 animate-fade-in">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">Tipo de Refeição</label>
                                    <select name="mealType" defaultValue={(showBlockModal ? editingBlock?.mealType : editingSlot?.mealType) || MealType.ALMOCO} className="neu-input w-full px-5 py-3 text-slate-700 font-bold">
                                        <option value={MealType.ALMOCO}>Almoço</option>
                                        <option value={MealType.JANTAR}>Jantar</option>
                                        <option value={MealType.DESJEJUM}>Desjejum</option>
                                    </select>
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide ml-2">
                                    {modalSlotType === SlotType.MEAL ? 'Capacidade do Refeitório' : 'Qtd. Missionários Simultâneos'}
                                </label>
                                <input 
                                    name="capacityPeople" 
                                    type="number" 
                                    defaultValue={(showBlockModal ? editingBlock?.capacityPeople : editingSlot?.capacityPeople) || (modalSlotType === SlotType.MEAL ? globalSettings?.defaultMealCapacity : globalSettings?.defaultLaundryCapacity)} 
                                    className="neu-input w-full px-5 py-3 text-slate-700 font-bold" 
                                    required 
                                />
                                {modalSlotType === SlotType.LAUN && (
                                    <p className="text-[10px] text-slate-400 px-2 leading-tight">Define quantos missionários do mesmo planeamento/distrito podem utilizar a lavanderia ao mesmo tempo neste bloco.</p>
                                )}
                            </div>
                            
                            <button type="submit" className="neu-btn-primary w-full py-4 text-lg mt-4">Salvar</button>
                         </form>
                    </div>
                )}
                
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