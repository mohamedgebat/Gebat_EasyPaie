import { apiFetch } from '../lib/api';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Upload, Check, AlertCircle, Plus, FileText, FileSpreadsheet, 
  Loader2, Calendar, Users, ArrowRight, CheckCircle2, ShieldAlert, 
  RefreshCw, Layers, Database, Sparkles, X, Building2, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { formatCurrency, formatDate, extractWorkbookMetadata, extractSiteFromFilename } from '../lib/utils';

export default function ImportPointage() {
  const [file, setFile] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [unknownWorkers, setUnknownWorkers] = useState([]);
  const [existingWorkers, setExistingWorkers] = useState([]);
  const [importing, setImporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUnknownWorker, setSelectedUnknownWorker] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [sheetsData, setSheetsData] = useState({});
  const [extractedDates, setExtractedDates] = useState({ debut: '', fin: '' });
  const [detectedSite, setDetectedSite] = useState('SONGON');
  const [newWorkerData, setNewWorkerData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    site: '',
    qualification: '',
    operateur: '',
    numero_mobile_money: '',
    statut: 'actif',
  });

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customRates, setCustomRates] = useState([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomWage, setNewCustomWage] = useState('');
  const [newCustomSite, setNewCustomSite] = useState('TOUS');
  const [newCustomDept, setNewCustomDept] = useState('TOUS');
  const [newCustomDate, setNewCustomDate] = useState('TOUS');
  const [customDateInput, setCustomDateInput] = useState('');
  const [sitesList] = useState(['BINGERVILLE', 'SONGON', 'BOUAKE', 'SAN PEDRO', 'YAMOUSSOUKRO', 'JACQUEVILLE', 'ABOBO', 'COCODY', 'YOPOUGON']);
  const [availableDepartments] = useState(['AIDE CHANTIER', 'MACON', 'FERRAILLEUR', 'MENUISIER', 'PLOMBIER', 'ELECTRICIEN', 'PEINTRE', 'CARRELEUR', 'ETANCHEUR', 'STAFFEUR', 'SOUDEUR', 'CHAUFFEUR', 'MACHINISTE', 'MAGASINIER', 'GARDIEN', 'POINTEUR', 'CHEF D\'EQUIPE', 'CHEF CHANTIER']);
  const [daysHeader] = useState(['Vendredi', 'Samedi', 'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi']);

  useEffect(() => {
    try {
      const savedCustom = localStorage.getItem('easypaie_custom_worker_rates');
      if (savedCustom) setCustomRates(JSON.parse(savedCustom));
    } catch (e) {}
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

  const location = useLocation();

  useEffect(() => {
    if (location.state && location.state.importedData) {
      const { importedData, siteName, dateRangeStr } = location.state;
      
      const grouped = {};
      importedData.forEach(w => {
        const sheetName = w.dept || 'AIDE CHANTIER';
        if (!grouped[sheetName]) grouped[sheetName] = [];
        
        grouped[sheetName].push({
          id: Math.random().toString(36).substr(2, 9),
          nom: w.name,
          'NOM ET PRENOMS': w.name,
          qualification: sheetName,
          salaire_brut: w.netPay || w.totalRate,
          salaire: w.netPay || w.totalRate,
          'NET A PAYER': w.netPay || w.totalRate,
          jours: w.normalDays || 0,
          worker_id: null
        });
      });

      if (siteName) {
        setDetectedSite(siteName);
        setNewWorkerData(prev => ({ ...prev, site: siteName }));
      }

      if (dateRangeStr) {
        setExtractedDates(prev => ({ ...prev, semaine: dateRangeStr, label: dateRangeStr }));
        try {
          localStorage.setItem('gebat_last_import_meta', JSON.stringify({
            site: siteName || 'SONGON',
            semaine: dateRangeStr || '',
            dateDebut: '',
            dateFin: '',
            label: dateRangeStr || '',
            timestamp: Date.now()
          }));
        } catch (e) {}
      }

      setSheetsData(grouped);
      
      const firstSheet = Object.keys(grouped)[0];
      if (firstSheet) {
        setSelectedSheet(firstSheet);
        setPreviewData(grouped[firstSheet]);
        checkWorkers(grouped[firstSheet]);
      }
      
      // Clear location state to prevent re-triggering
      window.history.replaceState({}, document.title)
    }
  }, [location.state]);

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

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Extraction immédiate depuis le nom du fichier (avant ou pendant lecture du classeur)
      const metaFromName = extractWorkbookMetadata(null, selectedFile.name);
      const siteFromName = metaFromName.site || detectSiteFromWorkbookAndFilename(null, selectedFile.name);
      if (siteFromName) {
        setDetectedSite(siteFromName);
        setNewWorkerData(prev => ({ ...prev, site: siteFromName }));
      }
      if (metaFromName.period.start && metaFromName.period.end) {
        setExtractedDates({
          debut: metaFromName.period.start,
          fin: metaFromName.period.end,
          semaine: metaFromName.period.week || '',
          label: metaFromName.period.label || ''
        });
        try {
          localStorage.setItem('gebat_last_import_meta', JSON.stringify({
            site: siteFromName || 'SONGON',
            semaine: metaFromName.period.week || '',
            dateDebut: metaFromName.period.start || '',
            dateFin: metaFromName.period.end || '',
            label: metaFromName.period.label || '',
            timestamp: Date.now()
          }));
        } catch (err) {}
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Extraction complète du site et de la période depuis le titre et le contenu du fichier
        const meta = extractWorkbookMetadata(workbook, selectedFile.name, XLSX);
        const siteFound = meta.site || detectSiteFromWorkbookAndFilename(workbook, selectedFile.name);
        setDetectedSite(siteFound);
        setNewWorkerData(prev => ({ ...prev, site: siteFound }));

        if (meta.period.start && meta.period.end) {
          setExtractedDates({
            debut: meta.period.start,
            fin: meta.period.end,
            semaine: meta.period.week || '',
            label: meta.period.label || ''
          });
        }

        // Sauvegarder dans localStorage pour synchroniser immédiatement la date et le site avec la page Calcul de la Paie
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

        // Process all sheets
        const allSheetsData = {};
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          // Skip empty sheets or sheets without data
          if (jsonData.length > 5) {
            const processedData = processSheetData(jsonData, sheetName);
            if (processedData.length > 0) {
              allSheetsData[sheetName] = processedData;
            }
          }
        });
        
        setSheetsData(allSheetsData);
        
        // Select first sheet with data
        const firstSheet = Object.keys(allSheetsData)[0];
        if (firstSheet) {
          setSelectedSheet(firstSheet);
          setPreviewData(allSheetsData[firstSheet]);
          checkWorkers(allSheetsData[firstSheet]);
        }
        setFileLoading(false);
      };
      setFileLoading(true);
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const isZeroAmount = (val) => {
    if (val === undefined || val === null || val === '') return true;
    if (typeof val === 'number' && val === 0) return true;
    if (typeof val === 'string') {
      const str = val.trim().toLowerCase();
      if (str === '0' || str === '0 f cfa' || str === '0 fcfa' || str === '-' || str === '0,00' || str === '0.00' || str === 'néant') {
        return true;
      }
      const num = Number(str.replace(/[^0-9.-]+/g, ''));
      if (isNaN(num) || num === 0) return true;
    }
    return false;
  };

  const timeToMinutes = (timeStr) => {
    if (!timeStr || timeStr === '--:--' || typeof timeStr !== 'string') return null;
    const [h, m] = timeStr.split(':');
    if (h === undefined || m === undefined) return null;
    return parseInt(h) * 60 + parseInt(m);
  };

  const calculateHikCentralDays = (row, headers) => {
    const times = [];
    ['Entrée 1', 'Sortie 1', 'Entrée 2', 'Sortie 2', 'Entrée 3', 'Sortie 3'].forEach(col => {
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

  const processSheetData = (rawData, sheetName) => {
    // Check if it's ZKTeco or HikCentral format
    const isZktecoBase = rawData[0] && rawData[0].some(cell => cell && cell.toString() === "Nom et prénoms") && rawData[0].some(cell => cell && cell.toString() === "Statut");
    const isHikCentral = isZktecoBase && rawData[0].some(cell => cell && cell.toString() === "Entrée 1");
    const isZkteco = isZktecoBase && !isHikCentral;

    if (isHikCentral) {
      const workerMap = new Map();
      const headers = rawData[0];
      const nameIndex = headers.indexOf("Nom et prénoms");
      const deptIndex = headers.indexOf("Département");
      const statusIndex = headers.indexOf("Statut");
      const idIndex = headers.indexOf("ID");

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        const rawName = row[nameIndex];
        if (!rawName || rawName === '') continue;
        const name = rawName.toString().trim().toUpperCase();

        let worker = workerMap.get(name);
        if (!worker) {
          worker = {
            'NOM ET PRENOMS': name,
            'Qualification': row[deptIndex] || '',
            'S/N': row[idIndex] || '',
            'JOURS_TRAVAILLES': 0,
            'TOTAL': 0,
            'RETENUE EPI': 0,
            'NET A PAYER': 0,
            'isZkteco': true
          };
          workerMap.set(name, worker);
        }

        const days = calculateHikCentralDays(row, headers);
        if (days > 0) {
          worker['JOURS_TRAVAILLES'] += days;
        } else {
          // Fallback to basic presence if time calculation yields 0 but they are marked as present
          const status = row[statusIndex];
          if (status && typeof status === 'string' && (status.includes("Présent") || status.includes("Normal"))) {
             worker['JOURS_TRAVAILLES'] += 1;
          }
        }
      }

      const dataRows = Array.from(workerMap.values());
      const qualification = sheetName.replace(/FICHE D'EMARGEMENT DES /i, '').replace(/\/ SEMAINE.*/i, '').trim();
      dataRows.forEach(row => {
        if (!row.Qualification || row.Qualification.trim() === '') {
          row.Qualification = qualification;
        }
      });
      return dataRows.filter(row => row['JOURS_TRAVAILLES'] > 0);
    }

    if (isZkteco) {
      const workerMap = new Map();
      const headers = rawData[0];
      const nameIndex = headers.indexOf("Nom et prénoms");
      const deptIndex = headers.indexOf("Département");
      const statusIndex = headers.indexOf("Statut");
      const idIndex = headers.indexOf("ID");

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        const rawName = row[nameIndex];
        if (!rawName || rawName === '') continue;
        const name = rawName.toString().trim().toUpperCase();

        let worker = workerMap.get(name);
        if (!worker) {
          worker = {
            'NOM ET PRENOMS': name,
            'Qualification': row[deptIndex] || '',
            'S/N': row[idIndex] || '',
            'JOURS_TRAVAILLES': 0,
            'TOTAL': 0, // Will be calculated based on Taux Journalier
            'RETENUE EPI': 0,
            'NET A PAYER': 0,
            'isZkteco': true
          };
          workerMap.set(name, worker);
        }

        const status = row[statusIndex];
        // Count days present
        if (status === "Présent" || status === "Normal") {
          worker['JOURS_TRAVAILLES'] += 1;
        } else if (status && status.includes && (status.includes("Présent") || status.includes("Normal"))) {
          worker['JOURS_TRAVAILLES'] += 1;
        }
      }

      const dataRows = Array.from(workerMap.values());
      // Try to determine qualification from sheet name if not available
      const qualification = sheetName.replace(/FICHE D'EMARGEMENT DES /i, '').replace(/\/ SEMAINE.*/i, '').trim();
      dataRows.forEach(row => {
        if (!row.Qualification || row.Qualification.trim() === '') {
          row.Qualification = qualification;
        }
      });
      return dataRows.filter(row => row['JOURS_TRAVAILLES'] > 0);
    }

    // Original Format
    const headerRowIndex = rawData.findIndex(row => 
      row && row.some(cell => cell && cell.toString().toUpperCase().includes('NOM ET PRENOMS'))
    );
    
    if (headerRowIndex === -1) return [];
    
    // Extract qualification from sheet name or title
    const qualification = sheetName.replace(/FICHE D'EMARGEMENT DES /i, '').replace(/\/ SEMAINE.*/i, '').trim();
    
    // Process data rows (start after header + 1 row for sub-headers)
    const dataRows = [];
    for (let i = headerRowIndex + 2; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      
      // Skip empty rows or rows without a name
      const name = row[1];
      if (!name || name === '' || typeof name === 'number') continue;
      
      const netAPayerRaw = row[row.length - 1];
      const totalRaw = row[row.length - 3];

      // Exclude workers with 0 F CFA amount (or 0 total)
      if (isZeroAmount(netAPayerRaw) && isZeroAmount(totalRaw)) {
        continue;
      }
      if (isZeroAmount(netAPayerRaw) && !isZeroAmount(totalRaw)) {
        // If net is 0 F CFA explicitly, skip
        continue;
      }
      
      // Calculate total days including 0,5
      let totalDays = 0;
      for (let j = 2; j <= row.length - 4; j++) {
        const val = row[j];
        if (val === 1 || val === '1') {
          totalDays += 1;
        } else if (val === 0.5 || val === '0.5' || val === '0,5' || val === ',5' || val === '.5') {
          totalDays += 0.5;
        }
      }

      const processedRow = {
        'NOM ET PRENOMS': name,
        'Qualification': qualification,
        'S/N': row[0],
        'JOURS_TRAVAILLES': totalDays,
        'TOTAL': row[row.length - 3],
        'RETENUE EPI': row[row.length - 2],
        'NET A PAYER': row[row.length - 1],
      };
      
      dataRows.push(processedRow);
    }
    
    return dataRows;
  };

  const mergeWorkersAcrossSheets = (allSheetsData) => {
    const workerMap = new Map();
    
    Object.keys(allSheetsData).forEach(sheetName => {
      const sheetData = allSheetsData[sheetName];
      const isHeuresSup = sheetName === 'HEURES SUP';
      
      sheetData.forEach(row => {
        const rawWorkerName = row['NOM ET PRENOMS'];
        if (!rawWorkerName) return;
        const workerName = rawWorkerName.toString().trim().toUpperCase();
        
        if (workerMap.has(workerName)) {
          const existing = workerMap.get(workerName);
          if (isHeuresSup) {
            existing['NET A PAYER'] = (Number(existing['NET A PAYER']) || 0) + (Number(row['NET A PAYER']) || 0);
            existing['Qualification'] = existing['Qualification'] + ' + HEURES SUP';
          }
        } else {
          workerMap.set(workerName, { ...row, 'NOM ET PRENOMS': workerName });
        }
      });
    });
    
    return Array.from(workerMap.values()).filter(row => !isZeroAmount(row['NET A PAYER']));
  };

  const normalizeName = (name) => {
    if (!name) return '';
    return String(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
      .replace(/[^a-zA-Z0-9]/g, '') // Ne garder que les lettres et chiffres (enlève espaces, tirets, etc.)
      .toLowerCase();
  };

  const matchWorkerRobust = (workers, nameStr) => {
    if (!nameStr) return null;
    const targetNorm = normalizeName(nameStr);
    
    return workers.find((w) => {
      const nomNorm = normalizeName(w.nom);
      const prenomNorm = normalizeName(w.prenom);
      
      const full1Norm = normalizeName(`${w.nom || ''} ${w.prenom || ''}`);
      const full2Norm = normalizeName(`${w.prenom || ''} ${w.nom || ''}`);
      
      if (nomNorm === targetNorm || full1Norm === targetNorm || full2Norm === targetNorm) return true;
      return false;
    });
  };

  const checkWorkers = async (data) => {
    try {
      const response = await apiFetch('/api/ouvriers', { cache: 'no-store' });
      const workers = await response.json();
      
      const unknown = [];
      const existing = [];

      data.forEach((row) => {
        const netVal = row['NET A PAYER'] || row['Net à payer'] || row['Net a payer'] || row.salaire;
        if (isZeroAmount(netVal)) return;

        const workerName = row['NOM ET PRENOMS'] || row.Nom || row.nom || row.NOM;
        const worker = matchWorkerRobust(workers, workerName);

        if (worker) {
          existing.push({ ...row, workerId: worker.id, workerName: `${worker.nom} ${worker.prenom || ''}`.trim() });
        } else {
          unknown.push({ ...row, workerName });
        }
      });

      setUnknownWorkers(unknown);
      setExistingWorkers(existing);
    } catch (error) {
      console.error('Error checking workers:', error);
    }
  };

  const handleSheetChange = (sheetName) => {
    setSelectedSheet(sheetName);
    setPreviewData(sheetsData[sheetName]);
    checkWorkers(sheetsData[sheetName]);
  };

  const handleDeleteSheet = (e, sheetName) => {
    e.stopPropagation();
    if (!window.confirm(`Êtes-vous sûr de vouloir retirer "${sheetName}" de l'importation ?`)) return;

    const newSheetsData = { ...sheetsData };
    delete newSheetsData[sheetName];
    setSheetsData(newSheetsData);

    if (selectedSheet === sheetName) {
      const remainingSheets = Object.keys(newSheetsData);
      if (remainingSheets.length > 0) {
        handleSheetChange(remainingSheets[0]);
      } else {
        setSelectedSheet(null);
        setPreviewData([]);
        setUnknownWorkers([]);
        setExistingWorkers([]);
      }
    }
  };

  const addUnknownWorker = async (workerData) => {
    try {
      const response = await apiFetch('/api/ouvriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matricule: `OUV-${Date.now().toString().slice(-4)}`,
          nom: workerData.workerName,
          prenom: '',
          telephone: '',
          site: detectedSite || 'SONGON',
          qualification: 'AIDE CHANTIER',
          operateur: 'Wave',
          numero_mobile_money: '',
          date_entree: extractedDates.debut || new Date().toISOString().split('T')[0],
          statut: 'actif'
        }),
      });
      const newWorker = await response.json();
      setUnknownWorkers(unknownWorkers.filter(w => w.workerName !== workerData.workerName));
      setExistingWorkers([...existingWorkers, { ...workerData, workerId: newWorker.id }]);
    } catch (error) {
      console.error('Error adding worker:', error);
    }
  };

  const handleAddWorker = async () => {
    try {
      const response = await apiFetch('/api/ouvriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkerData),
      });

      if (response.ok) {
        const addedWorker = await response.json();
        
        setUnknownWorkers((prev) => 
          prev.filter((w) => w !== selectedUnknownWorker)
        );
        setExistingWorkers((prev) => [
          ...prev,
          { ...selectedUnknownWorker, workerId: addedWorker.id, workerName: addedWorker.nom },
        ]);

        setShowAddModal(false);
        setSelectedUnknownWorker(null);
        setNewWorkerData({
          nom: '',
          prenom: '',
          telephone: '',
          site: '',
          qualification: '',
          operateur: '',
          numero_mobile_money: '',
          statut: 'actif',
        });
      }
    } catch (error) {
      console.error('Error adding worker:', error);
    }
  };

  const handleSaveToDatabase = async () => {
    if (Object.keys(sheetsData).length === 0) {
      alert('Veuillez d\'abord importer un fichier Excel valide.');
      return;
    }

    setImporting(true);
    try {
      const mergedData = mergeWorkersAcrossSheets(sheetsData);
      const workerResponse = await apiFetch('/api/ouvriers');
      let workers = await workerResponse.json();
      
      const pointagesResponse = await apiFetch('/api/pointages');
      let dbPointages = await pointagesResponse.json();
      
      const importedWorkerIds = [];
      
      for (const row of mergedData) {
        const workerName = row['NOM ET PRENOMS'] || row.Nom || row.nom || row.NOM;
        let worker = matchWorkerRobust(workers, workerName);

        if (!worker && workerName) {
          const newWorkerRes = await apiFetch('/api/ouvriers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matricule: row.Matricule || row.matricule || `OUV-${Date.now().toString().slice(-4)}`,
              nom: workerName,
              prenom: '',
              telephone: row.Telephone || row.telephone || '',
              site: detectedSite || 'SONGON',
              qualification: row.Qualification || row.qualification || 'AIDE CHANTIER',
              operateur: 'Wave',
              numero_mobile_money: '',
              date_entree: extractedDates.debut || new Date().toISOString().split('T')[0],
              statut: 'actif'
            })
          });
          worker = await newWorkerRes.json();
          if (worker && worker.id) workers.push(worker);
        }

        if (worker && worker.id) {
          importedWorkerIds.push(worker.id);

          const parsedTotalDays = Number(row['JOURS_TRAVAILLES']) || 0;
          let baseHebdo = 45000;
          if (Number(worker.salaire_base) > 0) {
            baseHebdo = Number(worker.salaire_base);
          } else {
            const qualif = (worker.qualification || row.Qualification || '').toLowerCase();
            if (qualif.includes('aide')) {
              baseHebdo = 27000;
            }
          }
          const dailyRate = baseHebdo / 6;
          const calculatedBrut = parsedTotalDays > 0 ? (parsedTotalDays * dailyRate) : 0;
          
          const rawTotal = Number(row['TOTAL']) || Number(row['SALAIRE BRUT']) || Number(row['Salaire Brut']) || Number(row['NET A PAYER']) || Number(row['Net à payer']) || Number(row['Net a payer']) || Number(row.salaire) || 0;
          
          const finalBrut = calculatedBrut > 0 ? calculatedBrut : rawTotal;

          const semaineStr = extractedDates.semaine || '';
          const existingPointage = dbPointages.find(p => p.ouvrier_id === worker.id && p.semaine === semaineStr);

          if (existingPointage) {
            await apiFetch(`/api/pointages/${existingPointage.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                salaire_brut: finalBrut,
                site: detectedSite || worker.site || 'SONGON'
              }),
            });
          } else {
            await apiFetch('/api/pointages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ouvrier_id: worker.id,
                date: extractedDates.debut || new Date().toISOString().split('T')[0],
                date_debut: extractedDates.debut || null,
                date_fin: extractedDates.fin || null,
                semaine: semaineStr,
                salaire_brut: finalBrut,
                site: detectedSite || worker.site || 'SONGON'
              }),
            });
          }
        }
      }

      // Sauvegarder dans localStorage pour garantir la détection immédiate sur Calcul de la Paie
      try {
        localStorage.setItem('gebat_last_import_meta', JSON.stringify({
          site: detectedSite || 'SONGON',
          semaine: extractedDates.semaine || '',
          dateDebut: extractedDates.debut || '',
          dateFin: extractedDates.fin || '',
          label: extractedDates.label || '',
          workerIds: importedWorkerIds,
          timestamp: Date.now()
        }));
        window.dispatchEvent(new Event('gebat_import_updated'));
      } catch (e) {}

      alert('Import de l\'ensemble du pointage réussi ! Toutes les fiches ont été enregistrées en base.');
      setFile(null);
      setPreviewData([]);
      setUnknownWorkers([]);
      setExistingWorkers([]);
      setSheetsData({});
      setSelectedSheet(null);
      setExtractedDates({ debut: '', fin: '' });
    } catch (error) {
      console.error('Error importing:', error);
      alert('Erreur lors de l\'import en base de données.');
    } finally {
      setImporting(false);
    }
  };

  const openAddModal = (worker) => {
    setSelectedUnknownWorker(worker);
    setNewWorkerData({
      nom: worker.workerName || '',
      prenom: '',
      telephone: '',
      site: detectedSite || 'SONGON',
      qualification: worker.Qualification || worker.qualification || '',
      operateur: '',
      numero_mobile_money: '',
      statut: 'actif',
    });
    setShowAddModal(true);
  };

  return (
    <>
      <div className="space-y-8 pb-16">
        {/* Premium Hero Header */}
        <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-cyan-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <FileSpreadsheet className="text-emerald-400" size={30} />
              </div>
              <span className="px-3.5 py-1.5 bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-xs font-extrabold rounded-full uppercase tracking-wider shadow-sm">
                Importation & Analyse GEBAT
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-sm flex items-center gap-3">
              Conversion & Suivi <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full ml-2">v2.1</span>
            </h1>
            <p className="text-emerald-100 mt-2 max-w-2xl text-sm md:text-base leading-relaxed font-normal">
              Chargez vos classeurs de pointage hebdomadaire (*.xls, *.xlsx) ou fichiers bruts de badgeuse ZKTeco, vérifiez instantanément l'existence des ouvriers en base et générez la paie.
            </p>
          </div>

          {file && previewData.length > 0 && (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl flex flex-col sm:flex-row gap-6 items-center shadow-lg">
              <div className="text-center sm:text-left">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 block">Feuilles analysées</span>
                <span className="text-2xl font-black text-white">{Object.keys(sheetsData).length}</span>
              </div>
              <div className="h-8 w-px bg-white/20 hidden sm:block" />
              <div className="text-center sm:text-left">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 block">Ouvriers Détectés</span>
                <span className="text-2xl font-black text-white">{existingWorkers.length + unknownWorkers.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dropzone Upload Card */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
        <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 relative ${
          file ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-300 hover:border-emerald-400 bg-gray-50/50 hover:bg-emerald-50/10'
        }`}>
          {fileLoading ? (
            <div className="flex flex-col items-center justify-center gap-6 py-8">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-200 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-2xl shadow-lg">
                  <FileSpreadsheet className="text-white" size={48} />
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="text-emerald-600 animate-spin" size={26} />
                  <p className="text-emerald-800 font-extrabold text-xl">Analyse et extraction de vos feuilles Excel en cours...</p>
                </div>
                <p className="text-gray-500 text-sm font-medium">Détection des onglets, rapprochement des ouvriers et calcul des totaux</p>
              </div>
              
              <div className="w-full max-w-md mx-auto">
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-full animate-loading-bar"></div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner">
                <Upload size={40} className="stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {file ? `Fichier chargé : ${file.name}` : 'Glissez-déposez votre classeur de pointage ici'}
              </h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                Formats acceptés : fichiers Excel <strong>.xlsx</strong> ou <strong>.xls</strong> avec onglets par métier (Maçons, Ferrailleurs, Coffreurs, Heures Sup).
              </p>
              
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <div className="flex flex-wrap items-center justify-center gap-4">
                <label
                  htmlFor="file-upload"
                  className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-2xl shadow-xl shadow-emerald-500/25 cursor-pointer inline-flex items-center gap-2.5 transform active:scale-95 transition-all text-sm"
                >
                  <Upload size={18} />
                  {file ? 'Charger un autre fichier Excel' : 'Parcourir les fichiers du PC'}
                </label>
                
                {file && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Voulez-vous vraiment effacer le fichier en cours ? Toutes les données non validées seront perdues.')) {
                        setFile(null);
                        setPreviewData([]);
                        setExistingWorkers([]);
                        setUnknownWorkers([]);
                        setExtractedDates({ debut: null, fin: null, semaine: '' });
                        setDetectedSite('');
                        const fileInput = document.getElementById('file-upload');
                        if (fileInput) fileInput.value = '';
                      }
                    }}
                    className="px-6 py-4 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold rounded-2xl border border-red-200 shadow-sm inline-flex items-center gap-2.5 transition-all text-sm"
                  >
                    <Trash2 size={18} /> Effacer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowCustomModal(true)}
                  className="px-6 py-4 bg-white hover:bg-amber-50 text-amber-800 font-extrabold rounded-2xl border border-amber-300 shadow-sm inline-flex items-center gap-2.5 transition-all text-sm"
                >
                  <Sparkles size={18} className="text-amber-600" /> Tarifs Spéciaux ({customRates.length})
                </button>
              </div>
            </>
          )}
        </div>
      </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes loading-bar {
            0% { width: 0%; left: 0%; }
            50% { width: 70%; left: 0%; }
            100% { width: 0%; left: 100%; }
          }
          .animate-loading-bar {
            animation: loading-bar 2s ease-in-out infinite;
          }
        ` }} />

      {/* Extracted Period & Sheet Selector */}
      {previewData.length > 0 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Info Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-200 block">Site / Chantier Détecté</span>
                  <button
                    type="button"
                    onClick={() => {
                      const custom = window.prompt("Entrez le nom d'un autre site (ex: JACQUEVILLE, ABOBO, COCODY...) :");
                      if (custom && custom.trim()) {
                        const cleanSite = custom.trim().toUpperCase();
                        setDetectedSite(cleanSite);
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
                    className="text-[10px] bg-white/20 hover:bg-white/30 text-white font-black px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-sm"
                  >
                    ➕ Autre Chantier
                  </button>
                </div>
                <div className="text-2xl font-black mt-2 flex items-center gap-2">
                  <Building2 size={22} className="text-amber-300 flex-shrink-0" />
                  <span>{detectedSite || 'SONGON'}</span>
                </div>
              </div>
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {getKnownSites().slice(0, 5).map(siteName => (
                  <button
                    key={siteName}
                    type="button"
                    onClick={() => setDetectedSite(siteName)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${detectedSite === siteName ? 'bg-amber-400 text-purple-950 shadow-sm' : 'bg-white/15 text-white hover:bg-white/25'}`}
                  >
                    {siteName}
                  </button>
                ))}
              </div>
            </div>
            {extractedDates.debut && extractedDates.fin && (
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-200 block">Période extraite</span>
                  <div className="text-base font-black mt-1 flex items-center gap-2">
                    <Calendar size={18} className="text-amber-300" />
                    {formatDate(extractedDates.debut)} au {formatDate(extractedDates.fin)}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-100 block">Montant Total</span>
                <div className="text-2xl font-black mt-1 flex items-center gap-2">
                  {formatCurrency([...existingWorkers, ...unknownWorkers].reduce((sum, w) => sum + (Number(w['NET A PAYER'] || w['Net à payer'] || w['Net a payer'] || w.salaire) || 0), 0))}
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">Ouvriers Reconnus</span>
                <div className="text-3xl font-black text-emerald-900 mt-1 flex items-center gap-2">
                  <CheckCircle2 size={24} className="text-emerald-600" />
                  {existingWorkers.length}
                </div>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">Prêts pour l'import en paie</p>
              </div>
            </div>

            <div className={`p-6 rounded-2xl border flex items-center justify-between ${
              unknownWorkers.length > 0
                ? 'bg-amber-50 border-amber-300'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider block ${unknownWorkers.length > 0 ? 'text-amber-800' : 'text-gray-500'}`}>
                  Ouvriers Inconnus
                </span>
                <div className={`text-3xl font-black mt-1 flex items-center gap-2 ${unknownWorkers.length > 0 ? 'text-amber-900' : 'text-gray-700'}`}>
                  <ShieldAlert size={24} className={unknownWorkers.length > 0 ? 'text-amber-600' : 'text-gray-400'} />
                  {unknownWorkers.length}
                </div>
                <p className={`text-xs font-semibold mt-0.5 ${unknownWorkers.length > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                  {unknownWorkers.length > 0 ? 'Action requise avant import' : 'Tous les ouvriers sont reconnus !'}
                </p>
              </div>
            </div>
          </div>

          {/* Sheets Tabs Bar */}
          {Object.keys(sheetsData).length > 1 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Layers size={16} className="text-emerald-600" />
                Feuilles de pointage détectées dans le fichier ({Object.keys(sheetsData).length}) :
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {Object.keys(sheetsData).map((sheetName) => (
                  <div key={sheetName} className="flex items-center">
                    <button
                      onClick={() => handleSheetChange(sheetName)}
                      className={`px-4 py-2.5 rounded-l-xl font-bold text-xs flex items-center gap-2 transition-all ${
                        selectedSheet === sheetName
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <FileText size={15} className={selectedSheet === sheetName ? 'text-amber-300' : 'text-gray-400'} />
                      {sheetName} ({sheetsData[sheetName].length})
                    </button>
                    <button
                      onClick={(e) => handleDeleteSheet(e, sheetName)}
                      className={`px-2.5 py-2.5 rounded-r-xl transition-all border-l flex items-center justify-center ${
                        selectedSheet === sheetName 
                          ? 'bg-teal-600 border-teal-700 hover:bg-red-500 text-white' 
                          : 'bg-gray-100 border-white hover:bg-red-500 hover:text-white text-gray-400'
                      }`}
                      title="Retirer cette feuille"
                    >
                      <X size={15} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existants vs Inconnus Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Existing workers card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col max-h-[480px]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <h3 className="font-extrabold text-base text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-600" size={20} />
                  Ouvriers Existants en Base ({existingWorkers.length})
                </h3>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  Prêt à enregistrer
                </span>
              </div>
              
              <div className="overflow-y-auto space-y-2.5 pr-2 flex-1">
                {existingWorkers.map((worker, index) => (
                  <div key={index} className="p-3.5 bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between items-center transition-colors">
                    <div>
                      <p className="font-extrabold text-sm text-gray-900">{worker.workerName}</p>
                      <p className="text-xs text-emerald-800 font-semibold mt-0.5">
                        {worker.Qualification || worker.qualification}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-emerald-700 text-sm">
                        {formatCurrency(worker['NET A PAYER'] || worker['Net à payer'] || 0)}
                      </span>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">Net pointé</span>
                    </div>
                  </div>
                ))}
                {existingWorkers.length === 0 && (
                  <p className="text-center text-gray-400 py-10 text-sm italic">Aucun ouvrier existant dans cet onglet.</p>
                )}
              </div>
            </div>

            {/* Unknown workers card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col max-h-[480px]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <h3 className="font-extrabold text-base text-amber-900 flex items-center gap-2">
                  <AlertCircle className="text-amber-600" size={20} />
                  Ouvriers Inconnus à Créer ({unknownWorkers.length})
                </h3>
                {unknownWorkers.length > 0 && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                    Action requise
                  </span>
                )}
              </div>

              <div className="overflow-y-auto space-y-2.5 pr-2 flex-1">
                {unknownWorkers.map((worker, index) => (
                  <div key={index} className="p-3.5 bg-amber-50/70 hover:bg-amber-50 border border-amber-200/80 rounded-xl flex justify-between items-center transition-colors">
                    <div>
                      <p className="font-extrabold text-sm text-gray-900">{worker.workerName}</p>
                      <p className="text-xs text-amber-900 font-semibold mt-0.5">
                        {worker.Qualification || worker.qualification} • {formatCurrency(worker['NET A PAYER'] || worker['Net à payer'] || 0)}
                      </p>
                    </div>
                    <button
                      onClick={() => openAddModal(worker)}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center gap-1.5 transition-all flex-shrink-0"
                    >
                      <Plus size={15} className="stroke-[3]" />
                      Créer en base
                    </button>
                  </div>
                ))}
                {unknownWorkers.length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                    <p className="font-bold text-gray-800 text-sm">Parfait !</p>
                    <p className="text-gray-400 text-xs mt-1">Tous les ouvriers de cet onglet sont reconnus.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview Table for Selected Sheet */}
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
            <h3 className="font-extrabold text-base text-gray-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-600" size={20} />
                Aperçu des données - Feuille : <span className="text-emerald-700 underline">{selectedSheet}</span>
              </span>
              <span className="text-xs font-semibold text-gray-400">
                Affichage des 10 premières lignes sur {previewData.length}
              </span>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                    <th className="py-3 px-4 text-center font-extrabold">#</th>
                    <th className="py-3 px-4 font-extrabold">Ouvrier</th>
                    <th className="py-3 px-4 font-extrabold">Qualification</th>
                    <th className="py-3 px-4 font-extrabold text-center text-teal-700">Jours</th>
                    <th className="py-3 px-4 text-right font-extrabold text-blue-600" title="Renseigné automatiquement d'après la Base de données ou modifiable" >Taux Journalier</th>
                    <th className="py-3 px-4 text-right font-extrabold">Brut Excel</th>
                    <th className="py-3 px-4 text-right font-extrabold text-red-600">Ret. EPI</th>
                    <th className="py-3 px-4 text-right font-extrabold text-emerald-600">Net Excel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewData.slice(0, 10).map((row, index) => {
                    const isZkteco = row.isZkteco;
                    const baseHebdo = 27000; // Placeholder display fallback
                    const defaultDailyRate = baseHebdo / 6;

                    return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-center font-mono font-bold text-gray-400">{row['S/N'] || index + 1}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{row['NOM ET PRENOMS']}</td>
                      <td className="py-3 px-4 font-semibold text-indigo-600">{row.Qualification}</td>
                      <td className="py-3 px-4 text-center font-bold text-teal-600 bg-teal-50/50">{row['JOURS_TRAVAILLES'] > 0 ? `${row['JOURS_TRAVAILLES']} j` : '-'}</td>
                      <td className="py-3 px-4 text-right">
                        {isZkteco ? (
                          <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Auto</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-700">
                        {isZkteco ? formatCurrency(row['JOURS_TRAVAILLES'] * defaultDailyRate) : formatCurrency(row.TOTAL || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-red-600 font-semibold">{formatCurrency(row['RETENUE EPI'] || 0)}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                        {isZkteco ? formatCurrency(row['JOURS_TRAVAILLES'] * defaultDailyRate) : formatCurrency(row['NET A PAYER'] || 0)}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              {previewData.length > 10 && (
                <div className="bg-gray-50/80 p-3 text-center text-gray-500 text-xs font-semibold border-t border-gray-100">
                  ... et {previewData.length - 10} autres lignes dans l'onglet {selectedSheet}
                </div>
              )}
            </div>
          </div>

          {/* Action Import Button Card */}
          <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-950 text-white p-8 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-black flex items-center gap-2">
                <Database className="text-amber-400" size={24} />
                Prêt à importer le pointage en base de données ?
              </h3>
              <p className="text-sm text-emerald-200 mt-1 max-w-xl">
                Cette action enregistrera les salaires nets de vos ouvriers sur la date sélectionnée ({extractedDates.debut || formatDate(new Date())}) pour les {Object.keys(sheetsData).length} feuilles de calcul.
              </p>
            </div>

            <button
              onClick={handleSaveToDatabase}
              disabled={importing || unknownWorkers.length > 0}
              className={`px-8 py-4 rounded-2xl font-black text-base flex items-center gap-3 shadow-2xl transition-all transform active:scale-95 whitespace-nowrap ${
                unknownWorkers.length > 0
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-950 shadow-orange-500/30 hover:scale-105'
              }`}
            >
              {importing ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  Enregistrement en cours...
                </>
              ) : unknownWorkers.length > 0 ? (
                <>
                  <ShieldAlert size={22} />
                  Ajoutez d'abord les ouvriers inconnus
                </>
              ) : (
                <>
                  <CheckCircle2 size={22} className="text-gray-950 stroke-[3]" />
                  Importer le pointage complet ({Object.keys(sheetsData).length} feuilles)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modern Backdrop Blurred Modal for Add Unknown Worker */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-teal-900 to-emerald-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Plus className="text-amber-300" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">Ajouter l'ouvrier à la base</h2>
                  <p className="text-xs text-teal-200 mt-0.5">Rattachement rapide lors du pointage</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedUnknownWorker(null);
                }}
                className="p-1.5 text-teal-200 hover:text-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleAddWorker(); }} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nom Prénom *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold uppercase"
                  value={newWorkerData.nom}
                  onChange={(e) => setNewWorkerData({ ...newWorkerData, nom: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"
                    value={newWorkerData.telephone}
                    onChange={(e) => setNewWorkerData({ ...newWorkerData, telephone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Chantier / Site</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold uppercase"
                    value={newWorkerData.site}
                    onChange={(e) => setNewWorkerData({ ...newWorkerData, site: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Qualification</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold uppercase"
                  value={newWorkerData.qualification}
                  onChange={(e) => setNewWorkerData({ ...newWorkerData, qualification: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Opérateur Paiement</label>
                  <select
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"
                    value={newWorkerData.operateur}
                    onChange={(e) => setNewWorkerData({ ...newWorkerData, operateur: e.target.value })}
                  >
                    <option value="">Sélectionner</option>
                    <option value="Orange Money">Orange Money</option>
                    <option value="MTN">MTN</option>
                    <option value="Wave">Wave</option>
                    <option value="Banque">Banque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Numéro Mobile Money</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"
                    value={newWorkerData.numero_mobile_money}
                    onChange={(e) => setNewWorkerData({ ...newWorkerData, numero_mobile_money: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedUnknownWorker(null);
                  }}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm"
                >
                  Annuler
                </button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 text-sm">
                  Enregistrer l'ouvrier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

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
              <button onClick={() => setShowCustomModal(false)} className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <form onSubmit={handleAddOrUpdateCustomRate} className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 shadow-sm">
                <h4 className="font-bold text-xs uppercase text-amber-900 mb-3 flex items-center gap-1.5">
                  <Plus size={14} className="text-amber-600" /> Ajouter / Mettre à jour
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-bold text-gray-600 block flex justify-between">
                      Nom Prénom exact
                      {newCustomName && (
                        <span className="text-[9px] text-amber-600 truncate max-w-[120px]">
                          {(() => {
                            const target = newCustomName.toUpperCase().trim();
                            const allWorkers = [...existingWorkers, ...unknownWorkers];
                            const fileMatches = allWorkers.filter(w => (w.workerName || w.nom || '').toUpperCase().trim() === target);
                            const sites = new Set();
                            const depts = new Set();
                            fileMatches.forEach(w => { sites.add(detectedSite); if (w.dept || w.qualification) depts.add(w.dept || w.qualification); });
                            
                            if (sites.size > 0 || depts.size > 0) return `${Array.from(sites).join(', ')} | ${Array.from(depts).join(', ')}`;
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
                        if (val) {
                          const target = val.toUpperCase().trim();
                          const allWorkers = [...existingWorkers, ...unknownWorkers];
                          const fileMatch = allWorkers.find(w => (w.workerName || w.nom || '').toUpperCase().trim() === target);
                          if (fileMatch) {
                            if (detectedSite) setNewCustomSite(detectedSite.toUpperCase());
                            if (fileMatch.dept || fileMatch.qualification) setNewCustomDept((fileMatch.dept || fileMatch.qualification).toUpperCase());
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-amber-500 uppercase"
                    />
                    <datalist id="workers-modal-list">
                      {[...existingWorkers, ...unknownWorkers].map((w, i) => (
                        <option key={i} value={w.workerName || w.nom || ''} />
                      ))}
                    </datalist>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-gray-600 block">Site Chantier</label>
                    <select value={newCustomSite} onChange={(e) => setNewCustomSite(e.target.value)} className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:border-amber-500 uppercase">
                      <option value="TOUS">Tous</option>
                      {sitesList.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-gray-600 block">Département</label>
                    <select value={newCustomDept} onChange={(e) => setNewCustomDept(e.target.value)} className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:border-amber-500 uppercase">
                      <option value="TOUS">Par défaut</option>
                      {availableDepartments.map((d, idx) => <option key={idx} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-gray-600 block">Date / Jour</label>
                    {newCustomDate === 'CUSTOM_INPUT' ? (
                      <div className="flex gap-1">
                        <input type="text" placeholder="Ex: 04/07" value={customDateInput} onChange={(e) => setCustomDateInput(e.target.value)} className="w-full px-2 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:border-amber-500 uppercase" />
                        <button type="button" onClick={() => setNewCustomDate('TOUS')} className="px-1.5 py-2 bg-gray-200 text-gray-600 rounded-xl text-xs font-bold">✕</button>
                      </div>
                    ) : (
                      <select value={newCustomDate} onChange={(e) => setNewCustomDate(e.target.value)} className="w-full px-2 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:border-amber-500 uppercase">
                        <option value="TOUS">Tous</option>
                        {daysHeader.map((dName, idx) => <option key={idx} value={dName}>J{idx + 1} : {dName}</option>)}
                        <option value="CUSTOM_INPUT">📅 Saisir...</option>
                      </select>
                    )}
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-gray-600 block">Salaire Spécial</label>
                    <div className="relative">
                      <input type="number" placeholder="Ex: 10000" value={newCustomWage} onChange={(e) => setNewCustomWage(e.target.value)} className="w-full pl-2.5 pr-10 py-2 bg-white border border-gray-300 rounded-xl text-xs font-black text-amber-900 focus:border-amber-500" />
                      <span className="absolute right-2 top-2.5 text-[10px] font-bold text-gray-400">FCFA</span>
                    </div>
                  </div>
                  <div className="sm:col-span-1">
                    <button type="submit" disabled={!newCustomName.trim() || !newCustomWage || Number(newCustomWage) <= 0} className="w-full py-2 px-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1">
                      <Plus size={16} /> OK
                    </button>
                  </div>
                </div>
              </form>

              <div>
                <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider mb-2">Liste configurée ({customRates.length})</h4>
                <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                  {customRates.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs">Aucun salaire personnalisé enregistré.</div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Ouvrier</th>
                          <th className="py-2.5 px-2 text-center">Site</th>
                          <th className="py-2.5 px-2 text-center">Dépt.</th>
                          <th className="py-2.5 px-2 text-center">Jour / Date</th>
                          <th className="py-2.5 px-3 text-right">Salaire Spécial</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {customRates.map((c, i) => {
                          const isDaySpecific = c.date && c.date !== 'TOUS' && c.date !== 'ALL';
                          return (
                            <tr key={i} className="hover:bg-amber-50/30">
                              <td className="py-2.5 px-3 font-bold text-gray-900 uppercase">{c.nom}</td>
                              <td className="py-2.5 px-2 text-center font-bold">
                                <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase">{c.site && c.site !== 'TOUS' && c.site !== 'ALL' ? c.site : 'Global'}</span>
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold">
                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase">{c.dept && c.dept !== 'TOUS' && c.dept !== 'ALL' ? c.dept : 'Par défaut'}</span>
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold">
                                {isDaySpecific ? (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] font-black uppercase inline-flex items-center gap-1">
                                    <Calendar size={11} className="text-amber-600" /> {c.date}
                                  </span>
                                ) : (
                                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">Tous</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-amber-600">{Number(c.salaire).toLocaleString()} FCFA</td>
                              <td className="py-2.5 px-3 text-center">
                                <button type="button" onClick={() => handleRemoveCustomRate(i)} className="text-gray-400 hover:text-rose-600 p-1"><Trash2 size={15} /></button>
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
              <button type="button" onClick={() => setShowCustomModal(false)} className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
