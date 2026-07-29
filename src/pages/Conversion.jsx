import { useState, useMemo, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { 
  Upload, Download, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, 
  Users, Calendar, DollarSign, Clock, Settings, Filter, Search, 
  Briefcase, FileText, ChevronRight, Sparkles, TrendingUp, Info, Layers, RefreshCw, Plus, Trash2, X, UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { extractWorkbookMetadata, extractSiteFromFilename } from '../lib/utils';

const STANDARD_DEPARTMENTS = [
  'MACONS', 
  'FERRAILLEURS', 
  'COFFREURS', 
  'PLOMBIERS', 
  "CONDUCTEUR D'ENGINS", 
  'OPERATEUR BETONNIERE', 
  'AIDE CHANTIER',
  'GEBAT'
];

const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const [hh, mm] = timeStr.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;
  return hh * 60 + mm;
};

const calculateHikCentralDays = (row, headers) => {
  const times = [];
  ['Entrée 1', 'Sortie 1', 'Entrée 2', 'Sortie 2', 'Entrée 3', 'Sortie 3', 'Heures sup. entrée', 'Heures sup. sortie'].forEach(col => {
    const idx = headers.indexOf(col);
    if (idx !== -1) {
      const min = timeToMinutes(row[idx]);
      if (min !== null) times.push(min);
    }
  });

  if (times.length === 0) return 0;
  
  const earliest = Math.min(...times);
  const latest = Math.max(...times);
  
  let days = 0;
  // Morning shift: from ~08:00 to ~12:30 (Arrive <= 10:00, Leave >= 12:00)
  if (earliest <= 10 * 60 && latest >= 12 * 60) {
    days += 0.5;
  }
  
  // Afternoon shift: from ~13:00 to ~17:30 (Arrive <= 14:30, Leave >= 16:00)
  if (earliest <= 14.5 * 60 && latest >= 16 * 60) {
    days += 0.5;
  }
  
  return days;
};

export default function Conversion() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [manualOverrides, setManualOverrides] = useState({});
  
  // Settings & Legends
  const [dailyWage, setDailyWage] = useState(7500);
  const [dailyHours, setDailyHours] = useState(8);
  const [otThresholdHours, setOtThresholdHours] = useState(1); // 1h HS considered when exceeding 1 hour
  const [siteName, setSiteName] = useState('SONGON');
  const [dateRangeStr, setDateRangeStr] = useState('03 JUILLET AU 09 JUILLET 2026');
  const [otCalculationMode, setOtCalculationMode] = useState('rule_2h'); // 'rule_2h' | 'proportional_15'

  // Salaires journaliers de base spéciaux pour certains ouvriers
  const [customRates, setCustomRates] = useState([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomWage, setNewCustomWage] = useState('');
  const [newCustomSite, setNewCustomSite] = useState('TOUS');
  const [newCustomDept, setNewCustomDept] = useState('TOUS');
  const [newCustomDate, setNewCustomDate] = useState('TOUS');
  const [customDateInput, setCustomDateInput] = useState('');
  const [sitesList, setSitesList] = useState(['SONGON', 'BINGERVILLE']);
  const [showCustomModal, setShowCustomModal] = useState(false);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('easypaie_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.epi_limits) {
          const keys = Object.keys(parsed.epi_limits).map(k => k.toUpperCase());
          if (keys.length > 0) setSitesList(keys);
        }
      }
      const savedCustom = localStorage.getItem('easypaie_custom_worker_rates');
      if (savedCustom) {
        setCustomRates(JSON.parse(savedCustom));
      }
    } catch (e) {
      console.error('Error loading custom worker rates:', e);
    }
  }, []);

  const handleAddOrUpdateCustomRate = (e) => {
    if (e) e.preventDefault();
    if (!newCustomName || !newCustomName.trim() || !newCustomWage || Number(newCustomWage) <= 0) return;
    const cleanName = newCustomName.trim().toUpperCase();
    const cleanWage = Number(newCustomWage);
    const cleanSite = newCustomSite || 'TOUS';
    const cleanDept = newCustomDept || 'TOUS';
    const cleanDate = (newCustomDate === 'CUSTOM_INPUT' ? (customDateInput || 'TOUS') : (newCustomDate || 'TOUS')).trim().toUpperCase();

    setCustomRates(prev => {
      const existingIdx = prev.findIndex(c => 
        c.nom.toLowerCase().trim() === cleanName.toLowerCase() &&
        (c.date || 'TOUS').toUpperCase() === cleanDate &&
        (c.site || 'TOUS').toUpperCase() === cleanSite &&
        (c.dept || 'TOUS').toUpperCase() === cleanDept
      );
      let updated;
      const newEntry = { nom: cleanName, salaire: cleanWage, site: cleanSite, dept: cleanDept, date: cleanDate };
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = newEntry;
      } else {
        updated = [...prev, newEntry];
      }
      localStorage.setItem('easypaie_custom_worker_rates', JSON.stringify(updated));
      return updated;
    });
    setNewCustomName('');
    setNewCustomWage('');
    setNewCustomSite('TOUS');
    setNewCustomDept('TOUS');
    setNewCustomDate('TOUS');
    setCustomDateInput('');
  };

  const handleRemoveCustomRate = (target) => {
    setCustomRates(prev => {
      let updated;
      if (typeof target === 'number') {
        updated = prev.filter((_, idx) => idx !== target);
      } else {
        updated = prev.filter(c => c.nom.toLowerCase().trim() !== String(target).toLowerCase().trim());
      }
      localStorage.setItem('easypaie_custom_worker_rates', JSON.stringify(updated));
      return updated;
    });
  };

  // Processed state
  const [workers, setWorkers] = useState([]);
  const [normalShiftData, setNormalShiftData] = useState(null);
  const [daysHeader, setDaysHeader] = useState(['Vendredi', 'Samedi', 'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi']);
  
  // UI Tabs & Filters
  const [activeTab, setActiveTab] = useState('recap'); // 'recap' | 'heures_sup' | 'departments' | 'legend' | 'salaires_speciaux'
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setError('');
      processFile(uploadedFile);
    }
  };

  const getKnownSites = () => {
    const defaultSites = ['SONGON', 'BINGERVILLE', 'JACQUEVILLE', 'ABOBO', 'COCODY', 'YAMOUSSOUKRO', 'SAN-PEDRO', 'GRAND-BASSAM', 'PORT-BOUET', 'PLATEAU'];
    try {
      const saved = JSON.parse(localStorage.getItem('easypaie_settings') || '{}');
      if (saved && saved.epi_limits) {
        const customSites = Object.keys(saved.epi_limits).map(s => s.toUpperCase());
        return Array.from(new Set([...customSites, ...defaultSites]));
      }
    } catch (e) {
      console.error('Error reading known sites from settings:', e);
    }
    return defaultSites;
  };

  const detectSiteFromWorkbookAndFilename = (workbook, filename = '') => {
    const siteFromName = extractSiteFromFilename(filename);
    if (siteFromName) return siteFromName;

    const knownSites = getKnownSites();
    const textToCheck = [];
    if (filename) textToCheck.push(filename.toUpperCase());

    if (workbook && workbook.SheetNames) {
      workbook.SheetNames.forEach(sheetName => {
        textToCheck.push(sheetName.toUpperCase());
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          for (let i = 0; i < Math.min(30, rows.length); i++) {
            if (rows[i] && Array.isArray(rows[i])) {
              textToCheck.push(rows[i].join(' ').toUpperCase());
            }
          }
        }
      });
    }

    const combined = textToCheck.join(' | ');

    // 1. Check against exact known sites first (sorted by length descending so longer site names match first)
    const sortedKnown = [...knownSites].sort((a, b) => b.length - a.length);
    for (const site of sortedKnown) {
      const regex = new RegExp(`\\b${site.replace(/[^A-Z0-9]/g, '[^A-Z0-9]*')}\\b`, 'i');
      if (regex.test(combined)) {
        return site.toUpperCase();
      }
    }

    // 2. Check for dynamic CHANTIER or SITE headers inside cells or filename (en ignorant AIDE CHANTIER et les nombres)
    const cleanCombined = combined.replace(/AIDE\s+CHANTIER/gi, 'AIDE_OUVRIER');
    const dynamicHeaderMatch = cleanCombined.match(/(?:CHANTIER|SITE|PROJET)(?:\s+DE|\s*[:-])?\s+([A-Z][A-Z0-9_-]{2,15})/i);
    if (dynamicHeaderMatch && dynamicHeaderMatch[1]) {
      const candidate = dynamicHeaderMatch[1].toUpperCase();
      if (!/^\d+$/.test(candidate) && isNaN(Number(candidate)) && !['PAIE', 'POINTAGE', 'MAIN', 'HEBDOMADAIRE', 'NORMAL', 'SHIFT', 'ATTENDANCE', 'SUMMARY', 'RECORD'].includes(candidate)) {
        return candidate;
      }
    }

    // 3. Fallback check for common variants
    if (/BINGERVILLE|BENGERVILLE|BENGUERVILLE|BINGERVIL/i.test(combined)) return 'BINGERVILLE';
    if (/SONGON|SONGO|SONGONG/i.test(combined)) return 'SONGON';

    // 4. Default return SONGON
    return 'SONGON';
  };

  const processFile = async (targetFile) => {
    if (!targetFile) return;
    setLoading(true);
    setError('');

    try {
      const data = await targetFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      // Extraction complète du site et de la période
      const meta = extractWorkbookMetadata(workbook, targetFile.name, XLSX);
      const siteFound = meta.site || detectSiteFromWorkbookAndFilename(workbook, targetFile.name);
      setSiteName(siteFound);
      if (meta.period.label) setDateRangeStr(meta.period.label);
      
      let dbWorkers = [];
      try {
        const res = await apiFetch('/api/ouvriers');
        if (res.ok) {
          dbWorkers = await res.json();
        }
      } catch (err) {
        console.warn("Could not fetch DB workers", err);
      }
      
      try {
        localStorage.setItem('gebat_last_import_meta', JSON.stringify({
          site: siteFound,
          semaine: meta.period.week || '',
          dateDebut: meta.period.start || '',
          dateFin: meta.period.end || '',
          label: meta.period.label || '',
          timestamp: Date.now()
        }));
      } catch (e) {}

      // 1. Extract NormalShift legend if available
      let nsInfo = {
        start1: '08:00', end1: '12:30',
        start2: '13:30', end2: '17:00',
        overStart: '18:00', overEnd: '23:00',
        rawRows: []
      };

      if (workbook.Sheets['NormalShift']) {
        const nsJson = XLSX.utils.sheet_to_json(workbook.Sheets['NormalShift'], { header: 1 });
        nsInfo.rawRows = nsJson.filter(r => r && r.some(c => c !== null && c !== undefined && c !== ''));
        const shiftRow = nsJson.find(r => r && (String(r[1]).includes('Heures de travail') || String(r[1]).includes('Normal Shift')));
        if (shiftRow) {
          nsInfo.start1 = shiftRow[2] || '08:00';
          nsInfo.end1 = shiftRow[3] || '12:30';
          nsInfo.start2 = shiftRow[4] || '13:30';
          nsInfo.end2 = shiftRow[5] || '17:00';
          nsInfo.overStart = shiftRow[8] || '18:00';
          nsInfo.overEnd = shiftRow[9] || '23:00';
        }
      }
      setNormalShiftData(nsInfo);

      // 2. Locate Attendance Summary and Record
      const summarySheet = workbook.Sheets['Attendance Summary'] || workbook.Sheets[workbook.SheetNames[0]];
      const recordSheet = workbook.Sheets['Attendance Record'] || summarySheet;
      
      if (!summarySheet) {
        throw new Error('Feuille de pointage introuvable dans le fichier Excel.');
      }

      const sumJson = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });
      const recJson = XLSX.utils.sheet_to_json(recordSheet, { header: 1 });

      // Extract date range and dynamic days if present
      let parsedDays = ['Vendredi', 'Samedi', 'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi'];
      const madeDateRow = recJson.find(r => r && r[0] && String(r[0]).includes('Made Date'));
      if (madeDateRow) {
        const cleanRange = String(madeDateRow[0]).replace('Made Date:', '').trim();
        setDateRangeStr(cleanRange);
      }

      setDaysHeader(parsedDays);

      const isHikCentral = sumJson[0] && sumJson[0].some(c => c && c.toString() === 'Entrée 1') && sumJson[0].some(c => c && c.toString() === 'Nom et prénoms');

      // 3. Process workers
      const processedWorkers = [];

      if (isHikCentral) {
        const headers = sumJson[0];
        const nameIdx = headers.indexOf('Nom et prénoms');
        const deptIdx = headers.indexOf('Département');
        const idIdx = headers.indexOf('ID');
        const jourIdx = headers.indexOf('Jour');
        const statusIdx = headers.indexOf('Statut');
        
        const workerMap = new Map();
        
        for (let i = 1; i < sumJson.length; i++) {
          const row = sumJson[i];
          if (!row || !row[nameIdx]) continue;
          
          const rawName = row[nameIdx];
          const name = rawName.toString().trim().toUpperCase();
          if (!name) continue;
          
          let worker = workerMap.get(name);
          if (!worker) {
            let rawDept = (row[deptIdx] || 'Aide Chantier').trim();
            let deptUpper = rawDept.toUpperCase();
            let dept = rawDept;
            if (deptUpper.includes('MACON') || deptUpper.includes('MAÇON')) dept = 'MACONS';
            else if (deptUpper.includes('FERRAIL') || deptUpper.includes('FERAIL')) dept = 'FERRAILLEURS';
            else if (deptUpper.includes('COFFR')) dept = 'COFFREURS';
            else if (deptUpper.includes('PLOMB')) dept = 'PLOMBIERS';
            else if (deptUpper.includes('ENGIN')) dept = "CONDUCTEUR D'ENGINS";
            else if (deptUpper.includes('BETON') || deptUpper.includes('PAVE') || deptUpper.includes('PAVÉ')) dept = 'OPERATEUR BETONNIERE';
            else if (deptUpper.includes('AIDE')) dept = 'AIDE CHANTIER';
            else if (deptUpper.includes('GEBAT')) dept = 'GEBAT';
            else dept = deptUpper;
            
            workerMap.set(name, { id: row[idIdx], name, dept, daily: {}, totalWorkDays: 0 });
            worker = workerMap.get(name);
          }
          
          const dayName = (row[jourIdx] || '').toString().trim();
          let days = calculateHikCentralDays(row, headers);
          
          if (days === 0 && statusIdx !== -1) {
             const status = row[statusIdx];
             if (status && typeof status === 'string' && (status.includes("Présent") || status.includes("Normal"))) {
                 days = 1;
             }
          }
          if (days > 0 && dayName) {
            // Find which day of the week it matches
            const matchedDayIdx = parsedDays.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
            if (matchedDayIdx !== -1) {
              worker.daily[matchedDayIdx] = days;
            }
          }
        }
        
        for (const worker of workerMap.values()) {
          const isAide = String(worker.dept || '').trim().toUpperCase().includes('AIDE');
          const baseRate = isAide ? 4500 : (Number(dailyWage) || 7500);
          const dailyAttendance = [];
          
          for (let d = 0; d < 7; d++) {
            const dName = parsedDays[d];
            const dValue = worker.daily[d] || 0;
            dailyAttendance.push({
              dayIdx: d,
              dayName: dName,
              punches: [],
              jrTravaille: dValue,
              mtJournalier: dValue * baseRate,
              otHours: 0,
              otAmount: 0
            });
            worker.totalWorkDays += dValue;
          }
          
          const netPay = worker.totalWorkDays * baseRate;
          
          processedWorkers.push({
            id: String(worker.id),
            name: worker.name,
            dept: worker.dept,
            dailyAttendance,
            totalWorkDays: worker.totalWorkDays,
            totalBasePay: worker.totalWorkDays * baseRate,
            totalOTHours: 0,
            totalOTAmount: 0,
            netPay
          });
        }
      } else {
        // ZKTeco logic
        for (let i = 6; i < sumJson.length; i++) {
        const row = sumJson[i];
        if (!row || !row[1] || typeof row[1] !== 'string') continue;

        const id = String(row[0] || i);
        const name = row[1].trim();
        let rawDept = (row[2] || 'Aide Chantier').trim();

        // Normalize department name to standard construction categories
        let deptUpper = rawDept.toUpperCase();
        let dept = rawDept;
        if (deptUpper.includes('MACON') || deptUpper.includes('MAÇON')) dept = 'MACONS';
        else if (deptUpper.includes('FERRAIL') || deptUpper.includes('FERAIL')) dept = 'FERRAILLEURS';
        else if (deptUpper.includes('COFFR')) dept = 'COFFREURS';
        else if (deptUpper.includes('PLOMB')) dept = 'PLOMBIERS';
        else if (deptUpper.includes('ENGIN')) dept = "CONDUCTEUR D'ENGINS";
        else if (deptUpper.includes('BETON') || deptUpper.includes('PAVE') || deptUpper.includes('PAVÉ')) dept = 'OPERATEUR BETONNIERE';
        else if (deptUpper.includes('AIDE')) dept = 'AIDE CHANTIER';
        else if (deptUpper.includes('GEBAT')) dept = 'GEBAT';
        else dept = deptUpper;

        const isAide = String(dept || rawDept || '').trim().toUpperCase().includes('AIDE');
        const baseRate = isAide ? 4500 : (Number(dailyWage) || 7500);
        const hourlyBase = baseRate / (Number(dailyHours) || 8);
        const otRate15 = hourlyBase * 1.15; // Formule: (Salaire de base / nombre d'heures) * 1.15 (majoration +15%)

        // Locate daily punches in record sheet
        const recRow = recJson.find(r => r && String(r[0]) === id);
        const dailyAttendance = [];
        let totalWorkDays = 0;
        let totalOTHours = 0;
        let totalOTAmount = 0;

        for (let d = 0; d < 7; d++) {
          const punchStr = recRow ? String(recRow[3 + d] || '') : '';
          const punches = punchStr.split('\n').map(p => p.trim()).filter(Boolean);

          let jrTravaille = 0;
          let otHoursToday = 0;
          let otAmountToday = 0;

          if (punches.length > 0) {
            jrTravaille = 1; // 1 full day = 7 500 FCFA
            totalWorkDays += 1;

            // Check exit time for overtime calculation
            const lastPunch = punches[punches.length - 1];
            if (lastPunch) {
              const [hh, mm] = lastPunch.split(':').map(Number);
              // Overtime starts beyond normal shift (17:00 / 18:00)
              if (hh >= 18) {
                const elapsedMins = (hh - 18) * 60 + mm;
                if (elapsedMins >= 0) {
                  const elapsedHours = (elapsedMins + 60) / 60; // elapsed hours after 17:00
                  
                  if (otCalculationMode === 'rule_2h') {
                    // Rule: 1 heure supplémentaire est considérée lorsqu'il dépasse 2 heures du temps
                    // E.g. for every 2 hours of elapsed extra time, 1 hour HS is credited
                    if (elapsedHours >= otThresholdHours) {
                      otHoursToday = Math.floor(elapsedHours / otThresholdHours) || 1;
                      otAmountToday = Number((otHoursToday * otRate15).toFixed(2));
                    }
                  } else {
                    // Proportional +15% calculation based on exact exit punch
                    otHoursToday = Number(elapsedHours.toFixed(2));
                    otAmountToday = Number((otHoursToday * otRate15).toFixed(2));
                  }
                }
              }
            }
          }

          dailyAttendance.push({
            dayIdx: d,
            dayName: parsedDays[d],
            punches,
            jrTravaille,
            mtJournalier: jrTravaille * baseRate,
            otHours: otHoursToday,
            otAmount: otAmountToday
          });

          totalOTHours += otHoursToday;
          totalOTAmount += otAmountToday;
        }

        const workerObj = {
          id,
          name,
          dept,
          dailyAttendance,
          totalWorkDays,
          totalBasePay: totalWorkDays * baseRate,
          totalOTHours,
          totalOTAmount,
          netPay: totalWorkDays * baseRate + totalOTAmount
        };

        processedWorkers.push(workerObj);
      }
      } // End of ZKTeco logic
      
      setWorkers(processedWorkers);
    } catch (err) {
      console.error('Error parsing file:', err);
      setError(err.message || 'Erreur lors de la lecture du fichier Excel brut.');
    } finally {
      setLoading(false);
    }
  };

  // Recalculate if settings or custom rates change
  const updatedWorkers = useMemo(() => {
    const defaultBaseRate = Number(dailyWage) || 7500;

    return workers.map(w => {
      const workerCustomRates = customRates.filter(c => {
        if (!c.nom || !w.name || w.name.toLowerCase().trim() !== c.nom.toLowerCase().trim()) return false;
        if (c.site && c.site !== 'TOUS' && c.site !== 'ALL' && c.site.toUpperCase() !== siteName.toUpperCase()) return false;
        return true;
      });

      const customEntryAllDays = workerCustomRates.find(c => !c.date || c.date.toUpperCase() === 'TOUS' || c.date.toUpperCase() === 'ALL');
      const anyCustomEntry = customEntryAllDays || workerCustomRates[0];

      // Si un département est configuré dans le tarif spécial, l'appliquer ou le prioriser
      const effectiveDept = (anyCustomEntry && anyCustomEntry.dept && anyCustomEntry.dept !== 'TOUS' && anyCustomEntry.dept !== 'ALL')
        ? anyCustomEntry.dept
        : w.dept;

      const isAide = String(effectiveDept || w.dept || '').trim().toUpperCase().includes('AIDE');
      const standardRateForWorker = isAide ? 4500 : defaultBaseRate;

      const weeklyBaseRate = customEntryAllDays && Number(customEntryAllDays.salaire) > 0 
        ? Number(customEntryAllDays.salaire) 
        : standardRateForWorker;

      let totalWorkDays = 0;
      let totalOTHours = 0;
      let totalOTAmount = 0;

      const newDaily = w.dailyAttendance.map((day, d) => {
        const dayNameUpper = String(day.dayName || '').trim().toUpperCase();
        const daySpecificEntry = workerCustomRates.find(c => {
          const cDate = String(c.date || 'TOUS').trim().toUpperCase();
          if (cDate === 'TOUS' || cDate === 'ALL' || !cDate) return false;
          if (cDate === dayNameUpper || cDate === `JOUR ${day.dayIdx + 1}`) return true;
          if (day.dateStr && cDate === String(day.dateStr).trim().toUpperCase()) return true;
          return false;
        });

        const dayBaseRate = daySpecificEntry && Number(daySpecificEntry.salaire) > 0
          ? Number(daySpecificEntry.salaire)
          : weeklyBaseRate;

        let jrTravailleRaw = day.jrTravaille;
        if (manualOverrides[w.id]?.daily?.[d]?.jrTravaille !== undefined) {
          jrTravailleRaw = manualOverrides[w.id].daily[d].jrTravaille;
        }
        let jrTravaille = jrTravailleRaw === '' ? '' : Number(jrTravailleRaw);

        let mtJournalierRaw = jrTravaille === '' ? 0 : (jrTravaille * dayBaseRate);
        if (manualOverrides[w.id]?.daily?.[d]?.mtJournalier !== undefined) {
          mtJournalierRaw = manualOverrides[w.id].daily[d].mtJournalier;
        }
        let mtJournalier = mtJournalierRaw === '' ? '' : Number(mtJournalierRaw);

        totalWorkDays += (jrTravaille === '' ? 0 : jrTravaille);

        const hourlyBase = dayBaseRate / (Number(dailyHours) || 8);
        const otRate15 = hourlyBase * 1.15; // Formule: (Salaire du jour / nombre d'heures) * 1.15 (majoration +15%)

        let otHoursToday = day.otHours;
        let otAmountToday = day.otAmount;

        if (day.punches && day.punches.length > 0) {
          const lastPunch = day.punches[day.punches.length - 1];
          const [hh, mm] = lastPunch.split(':').map(Number);
          if (hh >= 18) {
            const elapsedMins = (hh - 18) * 60 + mm;
            if (elapsedMins >= 0) {
              const elapsedHours = (elapsedMins + 60) / 60;
              if (otCalculationMode === 'rule_2h') {
                if (elapsedHours >= Number(otThresholdHours)) {
                  otHoursToday = Math.floor(elapsedHours / Number(otThresholdHours)) || 1;
                  otAmountToday = Number((otHoursToday * otRate15).toFixed(2));
                } else {
                  otHoursToday = 0;
                  otAmountToday = 0;
                }
              } else {
                otHoursToday = Number(elapsedHours.toFixed(2));
                otAmountToday = Number((otHoursToday * otRate15).toFixed(2));
              }
            }
          }
        }

        totalOTHours += otHoursToday;
        totalOTAmount += otAmountToday;

        return {
          ...day,
          jrTravaille,
          mtJournalier,
          dayBaseRate,
          otHours: otHoursToday,
          otAmount: otAmountToday
        };
      });

      const totalBasePay = newDaily.reduce((sum, d) => sum + (d.mtJournalier === '' ? 0 : Number(d.mtJournalier) || 0), 0);
      const hasDailyCustomRate = workerCustomRates.some(c => c.date && c.date.toUpperCase() !== 'TOUS' && c.date.toUpperCase() !== 'ALL');

      // Application des modifications manuelles (overrides)
      let finalWorkDays = totalWorkDays;
      let finalBaseRate = weeklyBaseRate;

      if (manualOverrides[w.id]) {
        if (manualOverrides[w.id].totalWorkDays !== undefined) {
          finalWorkDays = manualOverrides[w.id].totalWorkDays === '' ? '' : Number(manualOverrides[w.id].totalWorkDays);
        }
        if (manualOverrides[w.id].baseRate !== undefined) {
          finalBaseRate = manualOverrides[w.id].baseRate === '' ? '' : Number(manualOverrides[w.id].baseRate);
        }
      }

      const finalTotalBasePay = (finalWorkDays === '' ? 0 : finalWorkDays) * (finalBaseRate === '' ? 0 : finalBaseRate);
      const finalNetPay = finalTotalBasePay + totalOTAmount;

      return {
        ...w,
        dept: effectiveDept,
        baseRate: finalBaseRate,
        hasCustomRate: workerCustomRates.length > 0 || !!manualOverrides[w.id],
        hasDailyCustomRate,
        customSite: anyCustomEntry?.site || 'TOUS',
        customDept: anyCustomEntry?.dept || 'TOUS',
        dailyAttendance: newDaily,
        totalWorkDays: finalWorkDays,
        totalBasePay: finalTotalBasePay,
        totalOTHours,
        totalOTAmount,
        netPay: finalNetPay
      };
    }).filter(w => w.netPay > 0);
  }, [workers, dailyWage, dailyHours, otThresholdHours, otCalculationMode, customRates, manualOverrides]);

  // Group workers by department
  const departmentGroups = useMemo(() => {
    const map = new Map();
    updatedWorkers.forEach(w => {
      if (!map.has(w.dept)) map.set(w.dept, []);
      map.get(w.dept).push(w);
    });
    return map;
  }, [updatedWorkers]);

  const allDepartments = useMemo(() => Array.from(departmentGroups.keys()), [departmentGroups]);
  const availableDepartments = useMemo(() => Array.from(new Set([...STANDARD_DEPARTMENTS, ...allDepartments])), [allDepartments]);

  // Filtered workers for current department tab
  const filteredWorkers = useMemo(() => {
    return updatedWorkers.filter(w => {
      const matchesDept = selectedDept === 'ALL' || w.dept === selectedDept;
      const matchesSearch = !searchQuery || w.name.toLowerCase().includes(searchQuery.toLowerCase()) || w.id.includes(searchQuery);
      return matchesDept && matchesSearch;
    });
  }, [updatedWorkers, selectedDept, searchQuery]);

  // Workers who performed overtime
  const overtimeWorkers = useMemo(() => {
    return updatedWorkers.filter(w => w.totalOTAmount > 0 || w.totalOTHours > 0);
  }, [updatedWorkers]);

  // Grand summary stats
  const stats = useMemo(() => {
    let totalPresence = 0;
    let totalBase = 0;
    let totalOTHours = 0;
    let totalOTPay = 0;

    updatedWorkers.forEach(w => {
      totalPresence += w.totalWorkDays;
      totalBase += w.totalBasePay;
      totalOTHours += w.totalOTHours;
      totalOTPay += w.totalOTAmount;
    });

    return {
      workerCount: updatedWorkers.length,
      totalPresence,
      totalBase,
      totalOTHours,
      totalOTPay,
      grandTotalPay: totalBase + totalOTPay
    };
  }, [updatedWorkers]);

  const handleManualOverride = (workerId, field, value, dayIndex = null) => {
    setManualOverrides(prev => {
      const workerState = prev[workerId] || {};
      if (dayIndex !== null) {
        const dailyState = workerState.daily || {};
        const dayState = dailyState[dayIndex] || {};
        return {
          ...prev,
          [workerId]: {
            ...workerState,
            daily: {
              ...dailyState,
              [dayIndex]: {
                ...dayState,
                [field]: value
              }
            }
          }
        };
      }
      return {
        ...prev,
        [workerId]: {
          ...workerState,
          [field]: value
        }
      };
    });
  };

  const handleSaveToDatabase = () => {
    if (updatedWorkers.length === 0) {
      alert('Aucune donnée à enregistrer.');
      return;
    }
    alert('Le fichier est prêt ! Vous allez être redirigé vers la page d\'Import Pointage pour détecter les nouveaux ouvriers et enregistrer les données.');
    navigate('/import-pointage', { state: { importedData: updatedWorkers, siteName, dateRangeStr } });
  };

  // EXCEL EXPORT (100% compliant with target file structure)
  const exportToTargetExcel = () => {
    if (updatedWorkers.length === 0) return;

    const workbook = XLSX.utils.book_new();

    // 1. Sheet: Instruction
    const instructionRows = [
      ["Instruction relatives à l'utilisation du fichier"],
      [],
      ['1. Prière de renseigner uniquement les feuilles des ouvriers (Maçons, ferrailleurs, coffreurs, etc.)'],
      [],
      ['2. Pour les présents, renseigner "1" sinon "0"'],
      [],
      ['3. La feuille "SUIVI HEBDOMADAIRE PAIE" sera renseignée automatiquement.']
    ];
    const wsInstruction = XLSX.utils.aoa_to_sheet(instructionRows);
    wsInstruction['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, wsInstruction, 'Instruction');

    // 2. Sheet: SUIVI HEBDOMADAIRE PAIE
    const recapRows = [
      [`SUIVI HEBDOMADAIRE DE LA PAIE DE LA MAIN D'ŒUVRE / SEMAINE DU ${dateRangeStr.toUpperCase()} ${siteName.toUpperCase()}`],
      [],
      [
        'N°', 'DESIGNATION', 'SALAIRE UNITAIRE',
        daysHeader[0]?.toUpperCase() || 'VENDREDI', null,
        daysHeader[1]?.toUpperCase() || 'SAMEDI', null,
        daysHeader[2]?.toUpperCase() || 'DIMANCHE', null,
        daysHeader[3]?.toUpperCase() || 'LUNDI', null,
        daysHeader[4]?.toUpperCase() || 'MARDI', null,
        daysHeader[5]?.toUpperCase() || 'MERCREDI', null,
        daysHeader[6]?.toUpperCase() || 'JEUDI', null,
        'MONTANT TOTAL BRUT', 'RETENUE EPI', 'NET A PAYER'
      ],
      [
        null, null, null,
        'EFFECTIF PRESENTS', 'MONTANT',
        'EFFECTIF PRESENTS', 'MONTANT',
        'EFFECTIF PRESENTS', 'MONTANT',
        'EFFECTIF PRESENTS', 'MONTANT',
        'EFFECTIF PRESENTS', 'MONTANT',
        'EFFECTIF PRESENTS', 'MONTANT',
        'EFFECTIF PRESENTS', 'MONTANT',
        null, 'EPI', null
      ],
      ['JOURNAMIERS']
    ];

    let deptIdx = 1;
    const deptsToReport = Array.from(new Set([...STANDARD_DEPARTMENTS, ...allDepartments]));

    deptsToReport.forEach(deptName => {
      const deptWorkers = departmentGroups.get(deptName) || [];
      if (deptWorkers.length === 0 && !STANDARD_DEPARTMENTS.includes(deptName)) return;

      const firstRate = deptWorkers[0]?.baseRate || (String(deptName || '').toUpperCase().includes('AIDE') ? 4500 : Number(dailyWage));
      const isUniform = deptWorkers.every(w => w.baseRate === firstRate);
      const rowData = [deptIdx++, deptName, isUniform ? firstRate : "Taux Spéciaux"];
      let deptTotalGross = 0;

      for (let d = 0; d < 7; d++) {
        let dayEffectif = 0;
        let dayAmount = 0;
        deptWorkers.forEach(w => {
          const day = w.dailyAttendance[d];
          if (day) {
            dayEffectif += day.jrTravaille;
            dayAmount += day.mtJournalier;
          }
        });
        rowData.push(dayEffectif, dayAmount);
        deptTotalGross += dayAmount;
      }

      rowData.push(deptTotalGross, 0, deptTotalGross);
      recapRows.push(rowData);
    });

    // Add HEURES SUPPLEMENTAIRES row
    const firstHSRate = overtimeWorkers[0] ? Math.round((overtimeWorkers[0].baseRate / (Number(dailyHours) || 8)) * 1.15) : Math.round((Number(dailyWage) / (Number(dailyHours) || 8)) * 1.15);
    const isHSUniform = overtimeWorkers.every(w => Math.round((w.baseRate / (Number(dailyHours) || 8)) * 1.15) === firstHSRate);
    const hsRow = [deptIdx++, 'HEURES SUPPLEMENTAIRES', isHSUniform ? firstHSRate : "Taux Variables"];
    let totalHSGross = 0;
    for (let d = 0; d < 7; d++) {
      let dayHSHours = 0;
      let dayHSAmount = 0;
      overtimeWorkers.forEach(w => {
        const day = w.dailyAttendance[d];
        if (day) {
          dayHSHours += day.otHours;
          dayHSAmount += day.otAmount;
        }
      });
      hsRow.push(dayHSHours, dayHSAmount);
      totalHSGross += dayHSAmount;
    }
    hsRow.push(totalHSGross, 0, totalHSGross);
    recapRows.push(hsRow);

    const wsRecap = XLSX.utils.aoa_to_sheet(recapRows);
    wsRecap['!cols'] = [
      { wch: 6 }, { wch: 28 }, { wch: 16 },
      { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 20 }
    ];
    wsRecap['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 19 } },
      { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
      { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },
      { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },
      { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } },
      { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } },
      { s: { r: 2, c: 7 }, e: { r: 2, c: 8 } },
      { s: { r: 2, c: 9 }, e: { r: 2, c: 10 } },
      { s: { r: 2, c: 11 }, e: { r: 2, c: 12 } },
      { s: { r: 2, c: 13 }, e: { r: 2, c: 14 } },
      { s: { r: 2, c: 15 }, e: { r: 2, c: 16 } },
      { s: { r: 2, c: 17 }, e: { r: 3, c: 17 } },
      { s: { r: 2, c: 18 }, e: { r: 3, c: 18 } },
      { s: { r: 2, c: 19 }, e: { r: 3, c: 19 } }
    ];
    XLSX.utils.book_append_sheet(workbook, wsRecap, 'SUIVI HEBDOMADAIRE PAIE');

    // 3. Department Sheets
    deptsToReport.forEach(deptName => {
      const deptWorkers = departmentGroups.get(deptName) || [];
      const deptRows = [
        [],
        [`FICHE D'EMARGEMENT DES ${deptName} / SEMAINE DU ${dateRangeStr.toUpperCase()}`],
        [],
        [
          'S/N', 'NOM ET PRENOMS',
          daysHeader[0]?.toUpperCase() || 'VENDREDI', null,
          daysHeader[1]?.toUpperCase() || 'SAMEDI', null,
          daysHeader[2]?.toUpperCase() || 'DIMANCHE', null,
          daysHeader[3]?.toUpperCase() || 'LUNDI', null,
          daysHeader[4]?.toUpperCase() || 'MARDI', null,
          daysHeader[5]?.toUpperCase() || 'MERCREDI', null,
          daysHeader[6]?.toUpperCase() || 'JEUDI', null,
          'TOTAL', null, 'RETENUE EPI', 'NET A PAYER'
        ],
        [
          null, null,
          'JR TRAVAILLE', 'MT JOURNALIER',
          'JR TRAVAILLE', 'MT JOURNALIER',
          'JR TRAVAILLE', 'MT JOURNALIER',
          'JR TRAVAILLE', 'MT JOURNALIER',
          'JR TRAVAILLE', 'MT JOURNALIER',
          'JR TRAVAILLE', 'MT JOURNALIER',
          'JR TRAVAILLE', 'MT JOURNALIER',
          'JR TRAVAILLE', 'MONTANT', null, null
        ]
      ];

      deptWorkers.forEach((w, idx) => {
        const row = [idx + 1, w.name];
        for (let d = 0; d < 7; d++) {
          const day = w.dailyAttendance[d];
          row.push(day ? day.jrTravaille : 0, day ? day.mtJournalier : 0);
        }
        row.push(w.totalWorkDays, w.totalBasePay, 0, w.totalBasePay);
        deptRows.push(row);
      });

      const wsDept = XLSX.utils.aoa_to_sheet(deptRows);
      wsDept['!cols'] = [
        { wch: 6 }, { wch: 30 },
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
        { wch: 14 }, { wch: 18 }
      ];
      wsDept['!merges'] = [
        { s: { r: 1, c: 1 }, e: { r: 1, c: 19 } },
        { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
        { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
        { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } },
        { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } },
        { s: { r: 3, c: 6 }, e: { r: 3, c: 7 } },
        { s: { r: 3, c: 8 }, e: { r: 3, c: 9 } },
        { s: { r: 3, c: 10 }, e: { r: 3, c: 11 } },
        { s: { r: 3, c: 12 }, e: { r: 3, c: 13 } },
        { s: { r: 3, c: 14 }, e: { r: 3, c: 15 } },
        { s: { r: 3, c: 16 }, e: { r: 3, c: 17 } },
        { s: { r: 3, c: 18 }, e: { r: 4, c: 18 } },
        { s: { r: 3, c: 19 }, e: { r: 4, c: 19 } }
      ];

      const sheetTitle = deptName.slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, wsDept, sheetTitle);
    });

    // 4. Sheet: HEURES SUP
    const hsRows = [
      [],
      [`FICHE D'EMARGEMENT DES HEURES SUP / SEMAINE DU ${dateRangeStr.toUpperCase()}`],
      [],
      [
        'S/N', 'NOM ET PRENOMS',
        daysHeader[0]?.toUpperCase() || 'VENDREDI', null,
        daysHeader[1]?.toUpperCase() || 'SAMEDI', null,
        daysHeader[2]?.toUpperCase() || 'DIMANCHE', null,
        daysHeader[3]?.toUpperCase() || 'LUNDI', null,
        daysHeader[4]?.toUpperCase() || 'MARDI', null,
        daysHeader[5]?.toUpperCase() || 'MERCREDI', null,
        daysHeader[6]?.toUpperCase() || 'JEUDI', null,
        'TOTAL', null, 'RETENUE EPI', 'NET A PAYER'
      ],
      [
        null, null,
        'JR TRAVAILLE', 'MT JOURNALIER',
        'JR TRAVAILLE', 'MT JOURNALIER',
        'JR TRAVAILLE', 'MT JOURNALIER',
        'JR TRAVAILLE', 'MT JOURNALIER',
        'JR TRAVAILLE', 'MT JOURNALIER',
        'JR TRAVAILLE', 'MT JOURNALIER',
        'JR TRAVAILLE', 'MT JOURNALIER',
        'JR TRAVAILLE', 'MONTANT', null, null
      ]
    ];

    overtimeWorkers.forEach((w, idx) => {
      const row = [idx + 1, w.name];
      for (let d = 0; d < 7; d++) {
        const day = w.dailyAttendance[d];
        row.push(day ? day.otHours : 0, day ? day.otAmount : 0);
      }
      row.push(w.totalOTHours, w.totalOTAmount, 0, w.totalOTAmount);
      hsRows.push(row);
    });

    const wsHS = XLSX.utils.aoa_to_sheet(hsRows);
    wsHS['!cols'] = [
      { wch: 6 }, { wch: 30 },
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
      { wch: 14 }, { wch: 18 }
    ];
    wsHS['!merges'] = [
      { s: { r: 1, c: 1 }, e: { r: 1, c: 19 } },
      { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
      { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
      { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } },
      { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } },
      { s: { r: 3, c: 6 }, e: { r: 3, c: 7 } },
      { s: { r: 3, c: 8 }, e: { r: 3, c: 9 } },
      { s: { r: 3, c: 10 }, e: { r: 3, c: 11 } },
      { s: { r: 3, c: 12 }, e: { r: 3, c: 13 } },
      { s: { r: 3, c: 14 }, e: { r: 3, c: 15 } },
      { s: { r: 3, c: 16 }, e: { r: 3, c: 17 } },
      { s: { r: 3, c: 18 }, e: { r: 4, c: 18 } },
      { s: { r: 3, c: 19 }, e: { r: 4, c: 19 } }
    ];
    XLSX.utils.book_append_sheet(workbook, wsHS, 'HEURES SUP');

    workbook.SheetNames.forEach((name) => {
      const ws = workbook.Sheets[name];
      if (!ws || !ws['!ref']) return;
      const range = XLSX.utils.decode_range(ws['!ref']);
      
      const a1 = XLSX.utils.encode_cell({ r: 0, c: 0 });
      if (ws[a1] && typeof ws[a1].v === 'string' && ws[a1].v.length > 3) {
        ws[a1].s = {
          font: { name: 'Arial', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1565C0' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
        if (!ws['!rows']) ws['!rows'] = [];
        ws['!rows'][0] = { hpt: 32 };
      }

      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellRef];
          if (!cell) continue;

          if (R === 0 && C === 0) continue;
          if (R === 0) {
            cell.s = {
              font: { name: 'Arial', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: '1565C0' } },
              alignment: { horizontal: 'center', vertical: 'center' }
            };
            continue;
          }

          const isHeaderRow = (name === 'Instruction' && R === 0) ||
                              (name !== 'Instruction' && (R === 2 || R === 3 || (name === 'HEURES SUP' && R === 4)));

          if (isHeaderRow) {
            cell.s = {
              font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: '1E293B' } },
              alignment: { horizontal: typeof cell.v === 'number' ? 'right' : 'center', vertical: 'center' },
              border: {
                top: { style: 'medium', color: { rgb: '0F172A' } },
                bottom: { style: 'medium', color: { rgb: '0F172A' } },
                left: { style: 'thin', color: { rgb: '475569' } },
                right: { style: 'thin', color: { rgb: '475569' } }
              }
            };
          } else {
            if (typeof cell.v === 'number' && !/N°|JOUR|MOY|EFFECTIF/i.test(String(cell.v))) {
              cell.z = '#,##0';
            }
            const isTotalRow = typeof cell.v === 'string' && /TOTAL|SOMME|EFFECTIF/i.test(cell.v);
            cell.s = {
              font: { name: 'Arial', sz: 9, bold: Boolean(isTotalRow), color: { rgb: isTotalRow ? '065F46' : '1E293B' } },
              fill: { fgColor: { rgb: isTotalRow ? 'D1FAE5' : (R % 2 === 0 ? 'FFFFFF' : 'F8FAFC') } },
              alignment: { horizontal: typeof cell.v === 'number' ? 'right' : 'left', vertical: 'center' },
              border: {
                top: { style: isTotalRow ? 'medium' : 'thin', color: { rgb: 'E2E8F0' } },
                bottom: { style: isTotalRow ? 'double' : 'thin', color: { rgb: isTotalRow ? '065F46' : 'E2E8F0' } },
                left: { style: 'thin', color: { rgb: 'E2E8F0' } },
                right: { style: 'thin', color: { rgb: 'E2E8F0' } }
              }
            };
          }
        }
      }
    });

    const safeSite = siteName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDate = dateRangeStr.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(workbook, `Fichier_de_suivi_de_la_main_d'oeuvre_${safeDate}_${safeSite}.xlsx`);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white p-8 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
              <FileSpreadsheet className="text-amber-300" size={28} />
            </div>
            <span className="px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-semibold rounded-full uppercase tracking-wider">
              Traitement & Conversion ZKTeco
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Conversion de Pointage & Suivi
          </h1>
          <p className="text-blue-100 mt-2 max-w-2xl text-sm md:text-base leading-relaxed">
            Convertissez instantanément vos fichiers bruts de pointage biométrique (<code className="bg-white/10 px-1.5 py-0.5 rounded text-amber-200">pointage_brute.xls</code>) en classeur Excel de paie net complet avec récapitulatifs, heures supplémentaires et fiches par département.
          </p>
        </div>

        {workers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => processFile(file)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 text-sm"
              title="Recalculer les données"
            >
              <RefreshCw size={18} />
              Recalculer
            </button>
            <button
              onClick={exportToTargetExcel}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2.5 transform active:scale-95 transition-all duration-200"
            >
              <Download size={20} className="animate-bounce" />
              Télécharger Fichier Net (Excel)
            </button>
            <button
              onClick={handleSaveToDatabase}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2.5 transform active:scale-95 transition-all duration-200"
            >
              <Sparkles size={20} />
              Continuer vers l'Import & Détection
            </button>
          </div>
        )}
      </div>

      {/* Settings & Parameters Bar */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center gap-2 text-gray-900 font-bold text-lg mb-4">
          <Settings className="text-indigo-600" size={22} />
          <h2>Légende & Paramètres de Calcul (NormalShift)</h2>
          {normalShiftData && (
            <span className="ml-auto text-xs font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              Horaires lus: {normalShiftData.start1}-{normalShiftData.end1} / {normalShiftData.start2}-{normalShiftData.end2} ({dailyHours}h)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <DollarSign size={14} className="text-amber-500" />
              Salaire Journalier de base
            </label>
            <div className="relative">
              <input
                type="number"
                value={dailyWage}
                onChange={(e) => setDailyWage(e.target.value)}
                className="w-full pl-3 pr-12 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              <span className="absolute right-3 top-2.5 text-xs font-bold text-gray-400">FCFA/jr</span>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-semibold text-gray-600 flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-700">
                <Users size={14} className="text-amber-500" />
                Salaires Spéciaux
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                {customRates.length}
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              className="w-full py-2 px-3 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-300 rounded-xl text-xs font-extrabold text-amber-900 flex items-center justify-between shadow-sm transition-all"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Sparkles size={14} className="text-amber-600 flex-shrink-0" />
                <span className="truncate">Taux / Ouvrier</span>
              </span>
              <span className="bg-amber-600 text-white rounded-full px-2 py-0.5 text-[10px] ml-1 flex-shrink-0">
                {customRates.length > 0 ? `${customRates.length}` : '+ Spécial'}
              </span>
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Clock size={14} className="text-blue-500" />
              Heures Shift Normal / Jour
            </label>
            <div className="relative">
              <input
                type="number"
                value={dailyHours}
                onChange={(e) => setDailyHours(e.target.value)}
                className="w-full pl-3 pr-12 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              <span className="absolute right-3 top-2.5 text-xs font-bold text-gray-400">heures</span>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <TrendingUp size={14} className="text-purple-500" />
              Règle Heures Supplémentaires
            </label>
            <select
              value={otCalculationMode}
              onChange={(e) => setOtCalculationMode(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
            >
              <option value="rule_2h">1h HS comptée après 2h du temps dépassées</option>
              <option value="proportional_15">Calcul proportionnel ZKTeco (+15% / heure)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Briefcase size={14} className="text-emerald-500" />
                Chantier / Site Détecté
              </span>
              <button
                type="button"
                onClick={() => {
                  const custom = window.prompt("Entrez le nom d'un autre site (ex: JACQUEVILLE, ABOBO, COCODY...) :");
                  if (custom && custom.trim()) {
                    const cleanSite = custom.trim().toUpperCase();
                    setSiteName(cleanSite);
                    try {
                      const saved = JSON.parse(localStorage.getItem('easypaie_settings') || '{}');
                      if (!saved.epi_limits) saved.epi_limits = { 'Bingerville': 12000, 'Songon': 9000 };
                      if (!saved.epi_limits[cleanSite] && !saved.epi_limits[custom.trim()]) {
                        saved.epi_limits[cleanSite] = 9000;
                        localStorage.setItem('easypaie_settings', JSON.stringify(saved));
                      }
                    } catch (e) {}
                  }
                }}
                className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 transition-all"
              >
                ➕ Autre...
              </button>
            </label>
            <select
              value={siteName}
              onChange={(e) => {
                if (e.target.value === 'ADD_NEW') {
                  const custom = window.prompt("Entrez le nom d'un nouveau site (ex: JACQUEVILLE, ABOBO, COCODY...) :");
                  if (custom && custom.trim()) {
                    const cleanSite = custom.trim().toUpperCase();
                    setSiteName(cleanSite);
                    try {
                      const saved = JSON.parse(localStorage.getItem('easypaie_settings') || '{}');
                      if (!saved.epi_limits) saved.epi_limits = { 'Bingerville': 12000, 'Songon': 9000 };
                      if (!saved.epi_limits[cleanSite]) {
                        saved.epi_limits[cleanSite] = 9000;
                        localStorage.setItem('easypaie_settings', JSON.stringify(saved));
                      }
                    } catch (e) {}
                  }
                } else {
                  setSiteName(e.target.value);
                }
              }}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-emerald-950 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all uppercase"
            >
              {getKnownSites().map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
              {!getKnownSites().includes(siteName.toUpperCase()) && (
                <option value={siteName.toUpperCase()}>{siteName.toUpperCase()}</option>
              )}
              <option value="ADD_NEW" className="font-bold text-indigo-600">➕ + NOUVEAU CHANTIER...</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <Calendar size={14} className="text-red-500" />
              Période (Semaine)
            </label>
            <input
              type="text"
              value={dateRangeStr}
              onChange={(e) => setDateRangeStr(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5 font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
            <Sparkles size={14} /> Règle active: Base standard de <strong>{Number(dailyWage).toLocaleString()} FCFA/jr</strong> (AIDE CHANTIER: <strong>4 500 FCFA/jr</strong>) {customRates.length > 0 && <span className="underline decoration-amber-500 font-extrabold">({customRates.length} tarif(s) spécial(aux))</span>}. Shift de <strong>{dailyHours}h/jr</strong>.
          </span>
          {otCalculationMode === 'rule_2h' ? (
            <span className="text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md font-medium">
              Heures Sup: 1h créditée dès que le travail dépasse {otThresholdHours}h après la fin du shift normal (18h).
            </span>
          ) : (
            <span className="text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md font-medium">
              Heures Sup: Calculé par heure et majoré à +15% (Formule : (Salaire de base / {dailyHours}h) * 1.15 = {Math.round((dailyWage / dailyHours) * 1.15)} FCFA/h par défaut).
            </span>
          )}
        </div>
      </div>

      {/* Upload & Summary KPI Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Upload Box */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-900 font-bold text-base mb-4">
              <Upload className="text-indigo-600" size={20} />
              <h3>Importer Pointage Brut</h3>
            </div>

            <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer transition-all duration-200 group">
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <div className="w-14 h-14 bg-white rounded-full shadow-sm border border-indigo-100 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  {loading ? (
                    <Loader2 className="animate-spin text-indigo-600" size={28} />
                  ) : (
                    <FileSpreadsheet className="text-indigo-600" size={28} />
                  )}
                </div>
                <p className="text-sm font-bold text-gray-800 mb-1">
                  {file ? file.name : 'Sélectionner le fichier Excel'}
                </p>
                <p className="text-xs text-gray-500">
                  {file ? `${(file.size / 1024).toFixed(1)} KB sélectionné` : 'Formats .xls ou .xlsx ZKTeco'}
                </p>
              </label>
            </div>

            {error && (
              <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-800 text-xs">
                <AlertCircle className="flex-shrink-0 mt-0.5 text-red-600" size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {file && !loading && (
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Statut du fichier:</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={14} /> Lu & Traité
              </span>
            </div>
          )}
        </div>

        {/* KPI Summary Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl p-5 shadow-lg shadow-indigo-500/10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">Effectif Total</span>
              <div className="p-2 bg-white/10 rounded-lg">
                <Users size={20} />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold">{stats.workerCount}</div>
              <p className="text-xs text-blue-100 mt-1">{allDepartments.length} départements actifs</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-5 shadow-lg shadow-emerald-500/10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100">Jours de Présence</span>
              <div className="p-2 bg-white/10 rounded-lg">
                <Calendar size={20} />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold">{stats.totalPresence.toLocaleString()} <span className="text-lg font-normal">jrs</span></div>
              <p className="text-xs text-emerald-100 mt-1">Payés à {Number(dailyWage).toLocaleString()} F/jr</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-5 shadow-lg shadow-amber-500/10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-100">Heures Sup (HS)</span>
              <div className="p-2 bg-white/10 rounded-lg">
                <Clock size={20} />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold">{stats.totalOTPay.toLocaleString()} <span className="text-sm font-normal">F</span></div>
              <p className="text-xs text-amber-100 mt-1">{overtimeWorkers.length} ouvriers ont fait des HS ({stats.totalOTHours}h)</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-violet-700 text-white rounded-2xl p-5 shadow-lg shadow-purple-500/10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-100">Net À Payer Total</span>
              <div className="p-2 bg-white/10 rounded-lg">
                <DollarSign size={20} />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold">{stats.grandTotalPay.toLocaleString()} <span className="text-sm font-normal">FCFA</span></div>
              <p className="text-xs text-purple-100 mt-1">Base ({stats.totalBase.toLocaleString()}) + HS</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Results Table Dashboard */}
      {workers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Navigation Tabs Bar */}
          <div className="border-b border-gray-200 bg-gray-50/80 px-6 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => { setActiveTab('recap'); setSelectedDept('ALL'); }}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-sm flex items-center gap-2 transition-all ${
                  activeTab === 'recap'
                    ? 'bg-white text-indigo-600 border-t-2 border-x border-t-indigo-600 border-x-gray-200 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <Layers size={18} />
                Suivi Hebdomadaire (Récapitulatif)
              </button>

              <button
                onClick={() => setActiveTab('heures_sup')}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-sm flex items-center gap-2 transition-all ${
                  activeTab === 'heures_sup'
                    ? 'bg-white text-amber-600 border-t-2 border-x border-t-amber-600 border-x-gray-200 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <Clock size={18} />
                Heures Supplémentaires ({overtimeWorkers.length})
              </button>

              <button
                onClick={() => setActiveTab('departments')}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-sm flex items-center gap-2 transition-all ${
                  activeTab === 'departments'
                    ? 'bg-white text-purple-600 border-t-2 border-x border-t-purple-600 border-x-gray-200 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <Users size={18} />
                Édition & Modifications
              </button>

              <button
                onClick={() => setActiveTab('salaires_speciaux')}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-sm flex items-center gap-2 transition-all ${
                  activeTab === 'salaires_speciaux'
                    ? 'bg-white text-amber-600 border-t-2 border-x border-t-amber-600 border-x-gray-200 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <Sparkles size={18} />
                Salaires Spéciaux ({customRates.length})
              </button>

              {normalShiftData && (
                <button
                  onClick={() => setActiveTab('legend')}
                  className={`px-4 py-2.5 rounded-t-xl font-bold text-sm flex items-center gap-2 transition-all ${
                    activeTab === 'legend'
                      ? 'bg-white text-emerald-600 border-t-2 border-x border-t-emerald-600 border-x-gray-200 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                  }`}
                >
                  <Info size={18} />
                  Légende NormalShift
                </button>
              )}
            </div>

            {/* Department selector & Search bar when on departments tab */}
            {activeTab === 'departments' && (
              <div className="flex items-center gap-3 pb-3 md:pb-0">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 shadow-sm focus:border-indigo-500"
                >
                  <option value="ALL">Tous les départements ({workers.length})</option>
                  {allDepartments.map(d => (
                    <option key={d} value={d}>
                      {d} ({(departmentGroups.get(d) || []).length})
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Chercher ouvrier / ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 shadow-sm focus:border-indigo-500 w-44 sm:w-56"
                  />
                </div>
              </div>
            )}
          </div>

          {/* TAB CONTENT 1: SUIVI HEBDOMADAIRE (RECAP) */}
          {activeTab === 'recap' && (
            <div className="p-6 overflow-x-auto">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-xl text-gray-900">
                    SUIVI HEBDOMADAIRE DE LA PAIE DE LA MAIN D'ŒUVRE / SEMAINE DU {dateRangeStr.toUpperCase()}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Tous les ouvriers sont rémunérés au tarif unique de <strong>{Number(dailyWage).toLocaleString()} FCFA/jr</strong>.
                  </p>
                </div>
                <button
                  onClick={exportToTargetExcel}
                  className="self-start sm:self-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow transition-all"
                >
                  <Download size={14} /> Exporter cette feuille en Excel
                </button>
              </div>

              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
                    <th className="py-3 px-3 text-left border-r border-gray-200">N°</th>
                    <th className="py-3 px-4 text-left border-r border-gray-200">DESIGNATION</th>
                    <th className="py-3 px-3 text-right border-r border-gray-200">SALAIRE UNIT.</th>
                    {daysHeader.map((dayName, idx) => (
                      <th key={idx} colSpan={2} className="py-2 px-2 text-center border-r border-gray-200 bg-gray-50 font-extrabold text-gray-800">
                        {dayName.toUpperCase()}
                      </th>
                    ))}
                    <th className="py-3 px-3 text-right border-r border-gray-200 bg-indigo-50/80 text-indigo-900">MONTANT TOTAL BRUT</th>
                    <th className="py-3 px-3 text-right border-r border-gray-200">RETENUE EPI</th>
                    <th className="py-3 px-4 text-right bg-emerald-50 text-emerald-900 font-extrabold">NET A PAYER</th>
                  </tr>
                  <tr className="bg-gray-50 text-gray-600 font-semibold border-b-2 border-gray-300 text-[11px]">
                    <th className="py-1.5 px-3 border-r border-gray-200"></th>
                    <th className="py-1.5 px-4 border-r border-gray-200"></th>
                    <th className="py-1.5 px-3 border-r border-gray-200"></th>
                    {daysHeader.map((_, idx) => (
                      <Fragment key={idx}>
                        <th className="py-1.5 px-2 text-center border-r border-gray-200 text-gray-500 font-normal">EFFECTIF</th>
                        <th className="py-1.5 px-2 text-right border-r border-gray-200 font-semibold">MONTANT</th>
                      </Fragment>
                    ))}
                    <th className="py-1.5 px-3 border-r border-gray-200 bg-indigo-50/80"></th>
                    <th className="py-1.5 px-3 border-r border-gray-200"></th>
                    <th className="py-1.5 px-4 bg-emerald-50"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="bg-amber-50/60 font-extrabold text-amber-900">
                    <td colSpan={3 + daysHeader.length * 2 + 3} className="py-2.5 px-4 tracking-wider uppercase text-xs">
                      JOURNAMIERS / OUVRIERS DE CHANTIER
                    </td>
                  </tr>

                  {(() => {
                    let deptIdx = 1;
                    const deptsToReport = Array.from(new Set([...STANDARD_DEPARTMENTS, ...allDepartments]));

                    return deptsToReport.map((deptName) => {
                      const deptWorkers = departmentGroups.get(deptName) || [];
                      if (deptWorkers.length === 0 && !STANDARD_DEPARTMENTS.includes(deptName)) return null;

                      let deptTotalGross = 0;

                      return (
                        <tr key={deptName} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3 font-semibold text-gray-500 border-r border-gray-100">{deptIdx++}</td>
                          <td className="py-3 px-4 font-bold text-gray-900 border-r border-gray-100">{deptName}</td>
                          <td className="py-3 px-3 text-right font-medium text-gray-600 border-r border-gray-100">
                            {(() => {
                              const firstRate = deptWorkers[0]?.baseRate || (String(deptName || '').toUpperCase().includes('AIDE') ? 4500 : Number(dailyWage));
                              const isUniform = deptWorkers.every(w => w.baseRate === firstRate);
                              return isUniform ? firstRate.toLocaleString() : <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[11px]">Taux Spéciaux</span>;
                            })()}
                          </td>

                          {daysHeader.map((_, d) => {
                            let dayEffectif = 0;
                            let dayAmount = 0;
                            deptWorkers.forEach(w => {
                              const day = w.dailyAttendance[d];
                              if (day) {
                                dayEffectif += day.jrTravaille;
                                dayAmount += day.mtJournalier;
                              }
                            });
                            deptTotalGross += dayAmount;

                            return (
                              <Fragment key={d}>
                                <td className="py-3 px-2 text-center font-medium text-gray-700 border-r border-gray-100">
                                  {dayEffectif > 0 ? dayEffectif : '-'}
                                </td>
                                <td className="py-3 px-2 text-right font-semibold text-gray-900 border-r border-gray-100">
                                  {dayAmount > 0 ? dayAmount.toLocaleString() : '-'}
                                </td>
                              </Fragment>
                            );
                          })}

                          <td className="py-3 px-3 text-right font-bold text-indigo-900 bg-indigo-50/40 border-r border-gray-100">
                            {deptTotalGross > 0 ? deptTotalGross.toLocaleString() : '-'}
                          </td>
                          <td className="py-3 px-3 text-right text-gray-400 border-r border-gray-100">-</td>
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-700 bg-emerald-50/60 text-sm">
                            {deptTotalGross > 0 ? deptTotalGross.toLocaleString() : '-'}
                          </td>
                        </tr>
                      );
                    });
                  })()}

                  {/* HEURES SUPPLEMENTAIRES ROW */}
                  <tr className="bg-amber-50/80 font-bold text-amber-950 border-t-2 border-amber-200">
                    <td className="py-3.5 px-3 border-r border-amber-200">#</td>
                    <td className="py-3.5 px-4 border-r border-amber-200 flex items-center gap-2">
                      <Clock size={16} className="text-amber-600" />
                      HEURES SUPPLEMENTAIRES
                    </td>
                    <td className="py-3.5 px-3 text-right border-r border-amber-200 text-amber-800 font-semibold">
                      {(() => {
                        const firstHSRate = overtimeWorkers[0] ? Math.round((overtimeWorkers[0].baseRate / (Number(dailyHours) || 8)) * 1.15) : Math.round((Number(dailyWage) / (Number(dailyHours) || 8)) * 1.15);
                        const isHSUniform = overtimeWorkers.every(w => Math.round((w.baseRate / (Number(dailyHours) || 8)) * 1.15) === firstHSRate);
                        return isHSUniform ? `${firstHSRate.toLocaleString()}/h` : <span className="text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">Taux Variables</span>;
                      })()}
                    </td>

                    {(() => {
                      let totalHSGross = 0;
                      return daysHeader.map((_, d) => {
                        let dayHSHours = 0;
                        let dayHSAmount = 0;
                        overtimeWorkers.forEach(w => {
                          const day = w.dailyAttendance[d];
                          if (day) {
                            dayHSHours += day.otHours;
                            dayHSAmount += day.otAmount;
                          }
                        });
                        totalHSGross += dayHSAmount;

                        return (
                          <Fragment key={d}>
                            <td className="py-3.5 px-2 text-center text-amber-900 border-r border-amber-200">
                              {dayHSHours > 0 ? `${dayHSHours}h` : '-'}
                            </td>
                            <td className="py-3.5 px-2 text-right font-extrabold text-amber-950 border-r border-amber-200">
                              {dayHSAmount > 0 ? dayHSAmount.toLocaleString() : '-'}
                            </td>
                          </Fragment>
                        );
                      });
                    })()}

                    <td className="py-3.5 px-3 text-right font-extrabold text-indigo-950 bg-indigo-100/60 border-r border-amber-200 text-sm">
                      {stats.totalOTPay > 0 ? stats.totalOTPay.toLocaleString() : '-'}
                    </td>
                    <td className="py-3.5 px-3 text-right text-gray-400 border-r border-amber-200">-</td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-emerald-800 bg-emerald-100/60 text-sm">
                      {stats.totalOTPay > 0 ? stats.totalOTPay.toLocaleString() : '-'}
                    </td>
                  </tr>

                  {/* GRAND TOTAL ROW */}
                  <tr className="bg-gray-900 text-white font-extrabold text-sm">
                    <td colSpan={3} className="py-4 px-4 text-left uppercase tracking-wider">
                      TOTAL GENERAL A PAYER
                    </td>
                    {daysHeader.map((_, d) => {
                      let dayEffectifTotal = 0;
                      let dayAmountTotal = 0;
                      updatedWorkers.forEach(w => {
                        const day = w.dailyAttendance[d];
                        if (day) {
                          dayEffectifTotal += day.jrTravaille;
                          dayAmountTotal += day.mtJournalier + day.otAmount;
                        }
                      });
                      return (
                        <Fragment key={d}>
                          <td className="py-4 px-2 text-center text-blue-200 font-normal">
                            {dayEffectifTotal > 0 ? dayEffectifTotal : '-'}
                          </td>
                          <td className="py-4 px-2 text-right text-amber-300">
                            {dayAmountTotal > 0 ? dayAmountTotal.toLocaleString() : '-'}
                          </td>
                        </Fragment>
                      );
                    })}
                    <td className="py-4 px-3 text-right text-indigo-300 font-black text-base">
                      {stats.grandTotalPay.toLocaleString()}
                    </td>
                    <td className="py-4 px-3 text-right text-gray-400">0</td>
                    <td className="py-4 px-4 text-right text-emerald-400 font-black text-base">
                      {stats.grandTotalPay.toLocaleString()} FCFA
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB CONTENT 2: HEURES SUPPLEMENTAIRES */}
          {activeTab === 'heures_sup' && (
            <div className="p-6 overflow-x-auto">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-xl text-gray-900 flex items-center gap-2">
                    <Clock className="text-amber-600" size={24} />
                    FICHE D'EMARGEMENT DES HEURES SUP / SEMAINE DU {dateRangeStr.toUpperCase()}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Liste des <strong>{overtimeWorkers.length} ouvriers</strong> ayant réalisé des heures supplémentaires au-delà de leur shift normal.
                  </p>
                </div>
              </div>

              {overtimeWorkers.length === 0 ? (
                <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl">
                  <Clock size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="font-semibold">Aucune heure supplémentaire enregistrée pour cette semaine.</p>
                  <p className="text-xs mt-1">Vérifiez les heures de sortie de votre pointage biométrique ou modifiez le seuil dans les paramètres ci-dessus.</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-amber-100/80 text-amber-950 font-bold border-b border-amber-300">
                      <th className="py-3 px-3 text-left border-r border-amber-200">S/N</th>
                      <th className="py-3 px-4 text-left border-r border-amber-200">NOM ET PRENOMS</th>
                      {daysHeader.map((dayName, idx) => (
                        <th key={idx} colSpan={2} className="py-2 px-2 text-center border-r border-amber-200">
                          {dayName.toUpperCase()}
                        </th>
                      ))}
                      <th colSpan={2} className="py-3 px-3 text-center border-r border-amber-200 bg-amber-200/60">TOTAL HS</th>
                      <th className="py-3 px-4 text-right bg-emerald-600 text-white font-extrabold">NET A PAYER</th>
                    </tr>
                    <tr className="bg-amber-50/90 text-amber-900 font-semibold border-b-2 border-amber-300 text-[11px]">
                      <th className="py-1.5 px-3 border-r border-amber-200"></th>
                      <th className="py-1.5 px-4 border-r border-amber-200"></th>
                      {daysHeader.map((_, idx) => (
                        <Fragment key={idx}>
                          <th className="py-1.5 px-2 text-center border-r border-amber-200 font-normal">HEURES</th>
                          <th className="py-1.5 px-2 text-right border-r border-amber-200">MONTANT</th>
                        </Fragment>
                      ))}
                      <th className="py-1.5 px-2 text-center border-r border-amber-200 font-semibold bg-amber-100/50">HEURES</th>
                      <th className="py-1.5 px-3 text-right border-r border-amber-200 font-semibold bg-amber-100/50">MONTANT</th>
                      <th className="py-1.5 px-4 bg-emerald-500 text-white"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {overtimeWorkers.map((w, idx) => (
                      <tr key={w.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-3 px-3 font-semibold text-gray-500 border-r border-gray-100">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-gray-900 border-r border-gray-100 flex items-center justify-between">
                          <span>{w.name}</span>
                          <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-normal">{w.dept}</span>
                        </td>

                        {daysHeader.map((_, d) => {
                          const day = w.dailyAttendance[d];
                          const otH = day ? day.otHours : 0;
                          const otA = day ? day.otAmount : 0;
                          return (
                            <Fragment key={d}>
                              <td className="py-3 px-2 text-center font-medium text-gray-600 border-r border-gray-100">
                                {otH > 0 ? `${otH}h` : '-'}
                              </td>
                              <td className="py-3 px-2 text-right font-semibold text-amber-900 border-r border-gray-100">
                                {otA > 0 ? otA.toLocaleString() : '-'}
                              </td>
                            </Fragment>
                          );
                        })}

                        <td className="py-3 px-2 text-center font-bold text-amber-950 bg-amber-50/50 border-r border-gray-100">
                          {w.totalOTHours}h
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-amber-950 bg-amber-50/50 border-r border-gray-100">
                          {w.totalOTAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-700 bg-emerald-50 text-sm">
                          {w.totalOTAmount.toLocaleString()} FCFA
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-gray-900 text-white font-extrabold text-xs">
                      <td colSpan={2} className="py-3.5 px-4 text-left uppercase tracking-wider">
                        TOTAL HEURES SUPPLEMENTAIRES
                      </td>
                      {daysHeader.map((_, d) => {
                        let dayHSHours = 0;
                        let dayHSAmount = 0;
                        overtimeWorkers.forEach(w => {
                          const day = w.dailyAttendance[d];
                          if (day) {
                            dayHSHours += day.otHours;
                            dayHSAmount += day.otAmount;
                          }
                        });
                        return (
                          <Fragment key={d}>
                            <td className="py-3.5 px-2 text-center text-amber-200 font-normal">
                              {dayHSHours > 0 ? `${dayHSHours}h` : '-'}
                            </td>
                            <td className="py-3.5 px-2 text-right text-amber-400">
                              {dayHSAmount > 0 ? dayHSAmount.toLocaleString() : '-'}
                            </td>
                          </Fragment>
                        );
                      })}
                      <td className="py-3.5 px-2 text-center text-amber-300 font-bold">
                        {stats.totalOTHours}h
                      </td>
                      <td className="py-3.5 px-3 text-right text-amber-400 font-black text-sm">
                        {stats.totalOTPay.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-400 font-black text-sm">
                        {stats.totalOTPay.toLocaleString()} FCFA
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB CONTENT 3: DEPARTMENTS DETAIL */}
          {activeTab === 'departments' && (
            <div className="p-6 overflow-x-auto">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-xl text-gray-900">
                    FICHE D'EMARGEMENT : {selectedDept === 'ALL' ? 'TOUS LES DEPARTEMENTS' : selectedDept}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Affichage de <strong>{filteredWorkers.length} ouvriers</strong> {selectedDept !== 'ALL' && `pour le département ${selectedDept}`}.
                  </p>
                </div>
              </div>

              {filteredWorkers.length === 0 ? (
                <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl">
                  <Users size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="font-semibold">Aucun ouvrier ne correspond à cette recherche ou département.</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-purple-100/80 text-purple-950 font-bold border-b border-purple-300">
                      <th className="py-3 px-3 text-left border-r border-purple-200">S/N</th>
                      <th className="py-3 px-4 text-left border-r border-purple-200">NOM ET PRENOMS</th>
                      {daysHeader.map((dayName, idx) => (
                        <th key={idx} colSpan={2} className="py-2 px-2 text-center border-r border-purple-200">
                          {dayName.toUpperCase()}
                        </th>
                      ))}
                      <th colSpan={3} className="py-3 px-3 text-center border-r border-purple-200 bg-purple-200/60">TOTAL BASE</th>
                      <th className="py-3 px-4 text-right bg-emerald-600 text-white font-extrabold">NET A PAYER</th>
                    </tr>
                    <tr className="bg-purple-50/90 text-purple-900 font-semibold border-b-2 border-purple-300 text-[11px]">
                      <th className="py-1.5 px-3 border-r border-purple-200"></th>
                      <th className="py-1.5 px-4 border-r border-purple-200"></th>
                      {daysHeader.map((_, idx) => (
                        <Fragment key={idx}>
                          <th className="py-1.5 px-2 text-center border-r border-purple-200 font-normal">JR</th>
                          <th className="py-1.5 px-2 text-right border-r border-purple-200">MONTANT</th>
                        </Fragment>
                      ))}
                      <th className="py-1.5 px-2 text-center border-r border-purple-200 font-semibold bg-purple-100/50">JRS</th>
                      <th className="py-1.5 px-3 text-right border-r border-purple-200 font-semibold bg-purple-100/50">TAUX/JR</th>
                      <th className="py-1.5 px-3 text-right border-r border-purple-200 font-semibold bg-purple-100/50">MONTANT</th>
                      <th className="py-1.5 px-4 bg-emerald-500 text-white"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredWorkers.map((w, idx) => (
                      <tr key={w.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="py-3 px-3 font-semibold text-gray-500 border-r border-gray-100">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-gray-900 border-r border-gray-100">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{w.name}</span>
                              {w.hasCustomRate && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5 shadow-sm" title="Salaire journalier personnalisé">
                                  ⭐ {w.baseRate.toLocaleString()} F/jr
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-normal flex-shrink-0">{w.dept}</span>
                          </div>
                        </td>

                        {daysHeader.map((_, d) => {
                          const day = w.dailyAttendance[d];
                          const jr = day ? day.jrTravaille : 0;
                          const mt = day ? day.mtJournalier : 0;
                          return (
                            <Fragment key={d}>
                              <td className="py-2 px-1 text-center bg-white border-r border-gray-100">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  className="w-10 px-0.5 py-0.5 text-center text-[10px] font-bold text-gray-700 border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 shadow-inner"
                                  value={jr}
                                  onChange={(e) => handleManualOverride(w.id, 'jrTravaille', e.target.value, d)}
                                />
                              </td>
                              <td className="py-2 px-1 text-right bg-white border-r border-gray-100">
                                <input
                                  type="number"
                                  min="0"
                                  step="500"
                                  className="w-14 px-0.5 py-0.5 text-right text-[10px] font-bold text-gray-900 border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 shadow-inner"
                                  value={mt}
                                  onChange={(e) => handleManualOverride(w.id, 'mtJournalier', e.target.value, d)}
                                />
                              </td>
                            </Fragment>
                          );
                        })}

                        <td className="py-2 px-2 text-center bg-purple-50/50 border-r border-gray-100">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            className="w-14 px-1 py-1 text-center text-xs font-bold text-purple-950 bg-white border border-purple-300 rounded focus:ring-1 focus:ring-purple-500 shadow-inner"
                            value={w.totalWorkDays}
                            onChange={(e) => handleManualOverride(w.id, 'totalWorkDays', e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-2 text-right bg-purple-50/50 border-r border-gray-100">
                          <input
                            type="number"
                            min="0"
                            step="500"
                            className="w-20 px-1 py-1 text-right text-xs font-bold text-purple-950 bg-white border border-purple-300 rounded focus:ring-1 focus:ring-purple-500 shadow-inner"
                            value={w.baseRate}
                            onChange={(e) => handleManualOverride(w.id, 'baseRate', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-purple-950 bg-purple-50/50 border-r border-gray-100">
                          {w.totalBasePay.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-emerald-700 bg-emerald-50 text-sm">
                          {w.netPay.toLocaleString()} FCFA
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB CONTENT 4: LEGEND NORMALSHIFT */}
          {activeTab === 'legend' && normalShiftData && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-extrabold text-xl text-gray-900 mb-2">
                  Paramètres des Horaires & Légende (<code className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">NormalShift</code>)
                </h3>
                <p className="text-sm text-gray-600">
                  Ces horaires sont directement lus depuis l'onglet <strong className="text-gray-900">NormalShift</strong> de votre fichier biométrique brut. Ils définissent les tranches de travail et le début du comptage des heures supplémentaires.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-blue-50/60 rounded-2xl border border-blue-200">
                  <span className="text-xs font-bold uppercase text-blue-700 tracking-wider">Tranche Matin (First)</span>
                  <div className="mt-3 flex items-baseline gap-2 text-2xl font-black text-blue-950">
                    {normalShiftData.start1} <span className="text-sm font-normal text-blue-700">à</span> {normalShiftData.end1}
                  </div>
                  <p className="text-xs text-blue-800 mt-2">Durée standard de la matinée avant la pause déjeuner.</p>
                </div>

                <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-200">
                  <span className="text-xs font-bold uppercase text-indigo-700 tracking-wider">Tranche Après-midi (Second)</span>
                  <div className="mt-3 flex items-baseline gap-2 text-2xl font-black text-indigo-950">
                    {normalShiftData.start2} <span className="text-sm font-normal text-indigo-700">à</span> {normalShiftData.end2}
                  </div>
                  <p className="text-xs text-indigo-800 mt-2">Reprise après pause jusqu'à la fin de la journée normale ({dailyHours}h au total).</p>
                </div>

                <div className="p-5 bg-amber-50/80 rounded-2xl border border-amber-300">
                  <span className="text-xs font-bold uppercase text-amber-800 tracking-wider">Heures Supplémentaires (Over)</span>
                  <div className="mt-3 flex items-baseline gap-2 text-2xl font-black text-amber-950">
                    {normalShiftData.overStart} <span className="text-sm font-normal text-amber-800">à</span> {normalShiftData.overEnd}
                  </div>
                  <p className="text-xs text-amber-900 mt-2">
                    {otCalculationMode === 'rule_2h' 
                      ? `1 heure supplémentaire est créditée lorsque le temps écoulé dépasse ${otThresholdHours}h après ${normalShiftData.overStart}.`
                      : `Chaque heure après ${normalShiftData.overStart} est facturée à l'heure et majorée à +15% (Formule : (Salaire de base / ${dailyHours}h) * 1.15).`}
                  </p>
                </div>
              </div>

              {normalShiftData.rawRows && normalShiftData.rawRows.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-bold text-gray-800 mb-3">Extrait Brut de la feuille NormalShift :</h4>
                  <div className="bg-gray-900 text-gray-200 rounded-xl p-4 overflow-x-auto text-xs font-mono">
                    {normalShiftData.rawRows.slice(0, 15).map((r, idx) => (
                      <div key={idx} className="py-1 border-b border-gray-800 last:border-0">
                        {JSON.stringify(r)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 5: SALAIRES SPECIAUX / TARIFS PERSONNALISES */}
          {activeTab === 'salaires_speciaux' && (
            <div className="p-6 space-y-8">
              <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border border-amber-200/80 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-xl text-amber-950 flex items-center gap-2">
                    <Sparkles className="text-amber-600" size={24} />
                    GESTION DES SALAIRES JOURNALIERS SPÉCIAUX
                  </h3>
                  <p className="text-sm text-gray-700 mt-1 max-w-2xl">
                    Définissez ici le salaire journalier spécifique pour les ouvriers qui ont un tarif différent du salaire standard (<strong>{Number(dailyWage).toLocaleString()} FCFA/jr</strong>). 
                    Lors du calcul, ces tarifs prioritaires s'appliqueront automatiquement à leur pointage.
                  </p>
                </div>
                <div className="bg-white/90 backdrop-blur border border-amber-300 rounded-xl px-4 py-3 text-center shadow-sm flex-shrink-0">
                  <span className="text-xs font-bold text-gray-500 uppercase block">Ouvriers Spéciaux</span>
                  <span className="text-2xl font-black text-amber-600">{customRates.length}</span>
                </div>
              </div>

              {/* Formulaire d'ajout rapide */}
              <form onSubmit={handleAddOrUpdateCustomRate} className="bg-white border-2 border-amber-200/80 rounded-2xl p-5 shadow-sm">
                <h4 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
                  <Plus size={16} className="text-amber-600" /> Ajouter ou modifier un tarif journalier personnalisé
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">
                      Nom et Prénom de l'ouvrier
                    </label>
                    <input
                      type="text"
                      list="workers-suggestions"
                      placeholder="Ex: KOUASSI JEAN..."
                      value={newCustomName}
                      onChange={(e) => setNewCustomName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all uppercase"
                    />
                    <datalist id="workers-suggestions">
                      {workers.map((w, i) => (
                        <option key={i} value={w.name} />
                      ))}
                    </datalist>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">
                      Site Chantier
                    </label>
                    <select
                      value={newCustomSite}
                      onChange={(e) => setNewCustomSite(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:border-amber-500 uppercase"
                    >
                      <option value="TOUS">Tous les sites</option>
                      {sitesList.map((s, idx) => (
                        <option key={idx} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">
                      Département
                    </label>
                    <select
                      value={newCustomDept}
                      onChange={(e) => setNewCustomDept(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:border-amber-500 uppercase"
                    >
                      <option value="TOUS">Tous (Par défaut)</option>
                      {availableDepartments.map((d, idx) => (
                        <option key={idx} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">
                      Date / Jour du shift
                    </label>
                    {newCustomDate === 'CUSTOM_INPUT' ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="Ex: 04/07/2026..."
                          value={customDateInput}
                          onChange={(e) => setCustomDateInput(e.target.value)}
                          className="w-full px-2.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-amber-500 uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => setNewCustomDate('TOUS')}
                          className="px-2 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-xl text-xs font-bold"
                          title="Retour aux jours de la semaine"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        value={newCustomDate}
                        onChange={(e) => setNewCustomDate(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:border-amber-500 uppercase"
                      >
                        <option value="TOUS">Tous les jours</option>
                        {daysHeader.map((dName, idx) => (
                          <option key={idx} value={dName}>Jour {idx + 1} : {dName}</option>
                        ))}
                        <option value="CUSTOM_INPUT">📅 Saisir une date précise...</option>
                      </select>
                    )}
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">
                      Salaire Spécial
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Ex: 10000"
                        value={newCustomWage}
                        onChange={(e) => setNewCustomWage(e.target.value)}
                        className="w-full pl-3 pr-12 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-amber-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all"
                      />
                      <span className="absolute right-2.5 top-3 text-[10px] font-extrabold text-gray-400">FCFA</span>
                    </div>
                  </div>

                  <div className="sm:col-span-1">
                    <button
                      type="submit"
                      disabled={!newCustomName.trim() || !newCustomWage || Number(newCustomWage) <= 0}
                      className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1"
                    >
                      <Plus size={16} /> OK
                    </button>
                  </div>
                </div>
              </form>

              {/* Liste des tarifs spéciaux */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h4 className="font-extrabold text-gray-800 text-sm flex items-center gap-2">
                    <Users size={18} className="text-amber-600" />
                    Liste des ouvriers à salaire spécial conférés ({customRates.length})
                  </h4>
                  {customRates.length > 0 && (
                    <span className="text-xs text-gray-500 font-medium">Les modifications s'appliquent immédiatement au calcul.</span>
                  )}
                </div>

                {customRates.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Sparkles size={40} className="mx-auto text-amber-300 mb-3" />
                    <p className="font-bold text-gray-700">Aucun tarif spécial défini.</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Tous les ouvriers sont actuellement calculés au tarif standard de <strong>{Number(dailyWage).toLocaleString()} FCFA/jr</strong>.
                    </p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-amber-50 text-amber-950 font-bold border-b border-amber-200 text-left">
                        <th className="py-3 px-4 w-12 text-center">S/N</th>
                        <th className="py-3 px-4">NOM ET PRÉNOMS DE L'OUVRIER</th>
                        <th className="py-3 px-3 text-center">SITE</th>
                        <th className="py-3 px-3 text-center">DÉPARTEMENT</th>
                        <th className="py-3 px-3 text-center">JOUR / DATE</th>
                        <th className="py-3 px-4 text-right">SALAIRE JOURNALIER SPÉCIAL</th>
                        <th className="py-3 px-4 text-center">DIFFÉRENCE VS STANDARD</th>
                        <th className="py-3 px-4">STATUT SUR CE CHANTIER</th>
                        <th className="py-3 px-4 text-center w-24">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customRates.map((c, idx) => {
                        const matchedWorker = updatedWorkers.find(w => w.name && w.name.toLowerCase().trim() === c.nom.toLowerCase().trim());
                        const diff = Number(c.salaire) - Number(dailyWage);
                        const isDaySpecific = c.date && c.date !== 'TOUS' && c.date !== 'ALL';
                        return (
                          <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                            <td className="py-3.5 px-4 text-center font-bold text-gray-400">{idx + 1}</td>
                            <td className="py-3.5 px-4 font-extrabold text-gray-900 uppercase">
                              <div className="flex items-center gap-2">
                                <span>{c.nom}</span>
                                {matchedWorker && (
                                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                                    <UserCheck size={12} /> {matchedWorker.dept}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center font-bold">
                              <span className="bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-extrabold uppercase">
                                {c.site && c.site !== 'TOUS' && c.site !== 'ALL' ? c.site : 'Global / Tous'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center font-bold">
                              <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-extrabold uppercase">
                                {c.dept && c.dept !== 'TOUS' && c.dept !== 'ALL' ? c.dept : 'Par défaut'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center font-bold">
                              {isDaySpecific ? (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md text-[11px] font-black uppercase inline-flex items-center gap-1 shadow-sm">
                                  <Calendar size={13} className="text-amber-600" /> {c.date} (Jour unique)
                                </span>
                              ) : (
                                <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase">
                                  Tous les jours
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-amber-600 text-sm">
                              {Number(c.salaire).toLocaleString()} FCFA/jr
                            </td>
                            <td className="py-3.5 px-4 text-center font-semibold">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                                diff > 0 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold' 
                                  : diff < 0 
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold' 
                                    : 'bg-gray-100 text-gray-600'
                              }`}>
                                {diff > 0 ? `+${diff.toLocaleString()} F` : diff < 0 ? `${diff.toLocaleString()} F` : 'Identique'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {matchedWorker ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-xs">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  Présent ({matchedWorker.totalWorkDays} jours travaillés)
                                </span>
                              ) : (
                                <span className="text-gray-400 font-medium italic">
                                  Non détecté dans ce fichier
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomRate(idx)}
                                title="Supprimer ce tarif spécial"
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state prompt */}
      {!file && (
        <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border-2 border-dashed border-indigo-200 rounded-3xl p-12 text-center">
          <FileSpreadsheet className="mx-auto text-indigo-400 mb-4 animate-pulse" size={64} />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Prêt à convertir votre pointage brut ?</h3>
          <p className="text-gray-600 max-w-md mx-auto text-sm mb-6">
            Sélectionnez votre fichier <code className="bg-white px-2 py-0.5 rounded border text-indigo-600 font-semibold">pointage_brute.xls</code> issu de votre pointeuse biométrique ZKTeco pour générer instantanément le suivi de main d'œuvre aux normes Gebat.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <label htmlFor="file-upload" className="btn btn-primary cursor-pointer px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg inline-flex items-center gap-2">
              <Upload size={18} /> Sélectionner le fichier Excel
            </label>
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              className="px-5 py-3 bg-white hover:bg-amber-50 text-amber-800 font-bold rounded-xl border border-amber-300 shadow-sm inline-flex items-center gap-2 transition-all text-sm"
            >
              <Sparkles size={18} className="text-amber-600" /> Tarifs Spéciaux / Ouvrier ({customRates.length})
            </button>
          </div>
        </div>
      )}

      {/* MODALE GESTION SALAIRES SPECIAUX */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="px-6 py-5 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg">Salaires Journaliers Personnalisés</h3>
                  <p className="text-xs text-amber-100">Définissez des taux distincts pour certains ouvriers (Chefs d'équipe, etc.)</p>
                </div>
              </div>
              <button
                onClick={() => setShowCustomModal(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Formulaire dans modale */}
              <form onSubmit={handleAddOrUpdateCustomRate} className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 shadow-sm">
                <h4 className="font-bold text-xs uppercase text-amber-900 mb-3 flex items-center gap-1.5">
                  <Plus size={14} className="text-amber-600" /> Ajouter / Mettre à jour le salaire d'un ouvrier
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-bold text-gray-600 block flex justify-between">
                      Nom Prénom exact
                      {newCustomName && (
                        <span className="text-[9px] text-amber-600 truncate max-w-[120px]" title="Détection automatique">
                          {(() => {
                            const target = newCustomName.toUpperCase().trim();
                            const fileMatches = workers.filter(w => w.name && w.name.toUpperCase().trim() === target);
                            const sites = new Set();
                            const depts = new Set();
                            fileMatches.forEach(w => { sites.add(siteName); if (w.dept) depts.add(w.dept); });
                            
                            if (sites.size > 0 || depts.size > 0) {
                              return `${Array.from(sites).join(', ')} | ${Array.from(depts).join(', ')}`;
                            }
                            return '';
                          })()}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      list="workers-modal-list"
                      placeholder="Ex: KOUASSI JEAN..."
                      value={newCustomName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewCustomName(val);
                        // Autofill logic
                        if (val) {
                          const target = val.toUpperCase().trim();
                          const fileMatch = workers.find(w => w.name && w.name.toUpperCase().trim() === target);
                          
                          if (fileMatch) {
                            if (siteName) setNewCustomSite(siteName.toUpperCase());
                            if (fileMatch.dept) setNewCustomDept(fileMatch.dept.toUpperCase());
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-amber-500 uppercase"
                    />
                    <datalist id="workers-modal-list">
                      {workers.map((w, i) => (
                        <option key={i} value={w.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-gray-600 block">Site Chantier</label>
                    <select
                      value={newCustomSite}
                      onChange={(e) => setNewCustomSite(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:border-amber-500 uppercase"
                    >
                      <option value="TOUS">Tous</option>
                      {sitesList.map((s, idx) => (
                        <option key={idx} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-gray-600 block">Département</label>
                    <select
                      value={newCustomDept}
                      onChange={(e) => setNewCustomDept(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:border-amber-500 uppercase"
                    >
                      <option value="TOUS">Par défaut</option>
                      {availableDepartments.map((d, idx) => (
                        <option key={idx} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-gray-600 block">Date / Jour</label>
                    {newCustomDate === 'CUSTOM_INPUT' ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="Ex: 04/07..."
                          value={customDateInput}
                          onChange={(e) => setCustomDateInput(e.target.value)}
                          className="w-full px-2 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-amber-500 uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => setNewCustomDate('TOUS')}
                          className="px-1.5 py-2 bg-gray-200 text-gray-600 rounded-xl text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        value={newCustomDate}
                        onChange={(e) => setNewCustomDate(e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:border-amber-500 uppercase"
                      >
                        <option value="TOUS">Tous</option>
                        {daysHeader.map((dName, idx) => (
                          <option key={idx} value={dName}>J{idx + 1} : {dName}</option>
                        ))}
                        <option value="CUSTOM_INPUT">📅 Saisir...</option>
                      </select>
                    )}
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-gray-600 block">Salaire Spécial</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Ex: 10000"
                        value={newCustomWage}
                        onChange={(e) => setNewCustomWage(e.target.value)}
                        className="w-full pl-2.5 pr-10 py-2 bg-white border border-gray-300 rounded-xl text-xs font-black text-amber-900 focus:border-amber-500"
                      />
                      <span className="absolute right-2 top-2.5 text-[10px] font-bold text-gray-400">FCFA</span>
                    </div>
                  </div>
                  <div className="sm:col-span-1">
                    <button
                      type="submit"
                      disabled={!newCustomName.trim() || !newCustomWage || Number(newCustomWage) <= 0}
                      className="w-full py-2 px-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1"
                    >
                      <Plus size={16} /> OK
                    </button>
                  </div>
                </div>
              </form>

              {/* Tableau modale */}
              <div>
                <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider mb-2">
                  Liste configurée ({customRates.length})
                </h4>
                <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                  {customRates.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs">
                      Aucun salaire personnalisé enregistré.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Ouvrier</th>
                          <th className="py-2.5 px-2 text-center">Site</th>
                          <th className="py-2.5 px-2 text-center">Dépt.</th>
                          <th className="py-2.5 px-2 text-center">Jour / Date</th>
                          <th className="py-2.5 px-3 text-right">Salaire Spécial</th>
                          <th className="py-2.5 px-3 text-center">Présent dans ce fichier ?</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {customRates.map((c, i) => {
                          const matched = updatedWorkers.find(w => w.name && w.name.toLowerCase().trim() === c.nom.toLowerCase().trim());
                          const isDaySpecific = c.date && c.date !== 'TOUS' && c.date !== 'ALL';
                          return (
                            <tr key={i} className="hover:bg-amber-50/30">
                              <td className="py-2.5 px-3 font-bold text-gray-900 uppercase">{c.nom}</td>
                              <td className="py-2.5 px-2 text-center font-bold">
                                <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase">
                                  {c.site && c.site !== 'TOUS' && c.site !== 'ALL' ? c.site : 'Global'}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold">
                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase">
                                  {c.dept && c.dept !== 'TOUS' && c.dept !== 'ALL' ? c.dept : 'Par défaut'}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold">
                                {isDaySpecific ? (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] font-black uppercase inline-flex items-center gap-1">
                                    <Calendar size={11} className="text-amber-600" /> {c.date}
                                  </span>
                                ) : (
                                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                    Tous
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-amber-600">{Number(c.salaire).toLocaleString()} FCFA</td>
                              <td className="py-2.5 px-3 text-center">
                                {matched ? (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                                    Oui ({matched.totalWorkDays} jrs - {matched.dept})
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic">Non</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomRate(i)}
                                  className="text-gray-400 hover:text-rose-600 p-1"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
              >
                Fermer et Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
