import { apiFetch } from '../lib/api';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Calculator, Download, AlertCircle, CheckCircle, FileText, 
  Calendar, Building2, Users, DollarSign, ArrowRight, CheckCircle2, 
  RefreshCw, Layers, ShieldAlert, Sparkles, Filter, Check, Clock, Smartphone
} from 'lucide-react';
import { formatCurrency, formatCurrencySigned, formatDate, formatWeekLabel, formatShortDate, getWeekDateRange } from '../lib/utils';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import gebatLogo from '../assets/logo_gebat.png';

export default function CalculPaie() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pointages, setPointages] = useState([]);
  const [ponctions, setPonctions] = useState([]);
  const [epiProgrammes, setEpiProgrammes] = useState([]);
  const [epiFournis, setEpiFournis] = useState([]);
  const [loyers, setLoyers] = useState([]);
  const [paiementsLoyer, setPaiementsLoyer] = useState([]);
  const [ouvriers, setOuvriers] = useState([]);
  const [paies, setPaies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [calculatedPaie, setCalculatedPaie] = useState([]);
  const [semaine, setSemaine] = useState('');
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());
  const [datePaie, setDatePaie] = useState(new Date().toISOString().split('T')[0]);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [qualificationFilter, setQualificationFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('tous');
  const [strictImportedWorkers, setStrictImportedWorkers] = useState([]);
  const [settings, setSettings] = useState({
    epi_limits: {
      'Bingerville': 12000,
      'Songon': 9000,
    },
    epi_weekly_deduction: 3000,
  });

  const getEpiLimit = (site, ouvrierId) => {
    const siteLow = String(site || '').toLowerCase();
    
    let hasBotteSecurite = false;
    if (ouvrierId && epiFournis.length > 0) {
      const ouvrierEpis = epiFournis.filter(e => Number(e.ouvrier_id) === Number(ouvrierId));
      hasBotteSecurite = ouvrierEpis.some(e => String(e.equipement || '').trim().toLowerCase() === 'botte de securité');
    }

    if (siteLow.includes('bingerville') || siteLow.includes('bengerville')) {
      return hasBotteSecurite ? 12000 : 9000;
    }
    
    if (!settings || !settings.epi_limits) return 9000;
    if (siteLow.includes('songon')) return Number(settings.epi_limits['Songon']) || 9000;
    return Number(settings.epi_limits[site]) || 9000;
  };

  const getIntervaleSemaine = (semaineStr, datePointage, dateDebutStr, dateFinStr) => {
    const wNum = semaineStr && typeof semaineStr === 'string' && semaineStr.includes('-S')
      ? semaineStr.split('-S')[1]
      : (semaineStr || '');

    if (dateDebutStr && dateFinStr) {
      if (wNum) return `Sem ${wNum} (${formatShortDate(dateDebutStr)} au ${formatShortDate(dateFinStr)})`;
      return `${formatShortDate(dateDebutStr)} au ${formatShortDate(dateFinStr)}`;
    }
    if (semaineStr && typeof semaineStr === 'string' && semaineStr.includes('-S')) {
      return formatWeekLabel(semaineStr, [...pointages, ...paies, ...calculatedPaie]);
    }
    if (datePointage) {
      const d = new Date(datePointage);
      if (!isNaN(d.getTime())) {
        const day = d.getDay();
        const diffToFriday = day >= 5 ? (5 - day) : (-2 - day);
        const friday = new Date(new Date(d).setDate(d.getDate() + diffToFriday));
        const thursday = new Date(new Date(friday).setDate(friday.getDate() + 6));
        if (wNum) return `Sem ${wNum} (${formatShortDate(friday)} au ${formatShortDate(thursday)})`;
        return `${formatShortDate(friday)} au ${formatShortDate(thursday)}`;
      }
    }
    return wNum ? `Sem ${wNum}` : '-';
  };

  const getUniqueYears = () => {
    const allRecords = [...pointages, ...paies, ...calculatedPaie];
    const years = new Set();
    allRecords.forEach(r => {
      if (r.date_pointage) years.add(r.date_pointage.substring(0, 4));
      else if (r.date) years.add(r.date.substring(0, 4));
      else if (r.semaine && r.semaine.includes('-S')) years.add(r.semaine.split('-S')[0]);
    });
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear);
    if (annee) years.add(annee);
    return Array.from(years).sort().reverse();
  };

  const getUniqueWeekOptions = () => {
    const allRecords = [...pointages, ...paies, ...calculatedPaie];
    let uniqueWeeks = [...new Set([
      ...allRecords.map(r => r.semaine),
      semaine
    ].filter(Boolean))];
    
    // Filter by selected year
    if (annee) {
      uniqueWeeks = uniqueWeeks.filter(w => {
        if (w.match(/^\d{4}-S\d+$/)) {
          return w.startsWith(annee + '-');
        }
        return w.includes(annee);
      });
    }
    
    uniqueWeeks = uniqueWeeks.sort().reverse();

    return uniqueWeeks.map((weekVal) => ({
      value: weekVal,
      label: formatWeekLabel(weekVal, allRecords)
    }));
  };

  const syncWithLastImport = () => {
    try {
      let savedMeta = null;
      const savedMetaStr = localStorage.getItem('gebat_last_import_meta');
      if (savedMetaStr) {
        savedMeta = JSON.parse(savedMetaStr);
      }

      if (location.state && location.state.fromImport) {
        if (location.state.semaine) setSemaine(location.state.semaine);
        if (location.state.site) setSiteFilter(location.state.site);
        if (savedMeta && savedMeta.workerIds) setStrictImportedWorkers(savedMeta.workerIds);
        
        // Nettoyer l'état de l'historique pour éviter qu'un rafraîchissement force toujours ce filtre
        window.history.replaceState({}, document.title);
        return true;
      }

      if (savedMeta) {
        if (savedMeta.semaine) setSemaine(savedMeta.semaine);
        if (savedMeta.dateDebut && savedMeta.dateFin) {
          setDateDebut(savedMeta.dateDebut);
          setDateFin(savedMeta.dateFin);
        }
        if (savedMeta.site) setSiteFilter(savedMeta.site);
        return true;
      }
    } catch (e) {}
    return false;
  };

  useEffect(() => {
    fetchData();
    if (!syncWithLastImport()) {
      setSemaine(getWeekNumber(new Date()));
    }

    const handleImportEvent = () => {
      fetchData();
      syncWithLastImport();
    };
    window.addEventListener('gebat_import_updated', handleImportEvent);

    try {
      const savedSettings = localStorage.getItem('easypaie_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.epi_limit && !parsed.epi_limits) {
          parsed.epi_limits = {
            'Bingerville': 12000,
            'Songon': 9000,
          };
          delete parsed.epi_limit;
        }
        setSettings(parsed);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }

    return () => {
      window.removeEventListener('gebat_import_updated', handleImportEvent);
    };
  }, []);

  useEffect(() => {
    if (semaine) {
      try {
        const savedMetaStr = localStorage.getItem('gebat_last_import_meta');
        if (savedMetaStr) {
          const savedMeta = JSON.parse(savedMetaStr);
          if (savedMeta.semaine === semaine && savedMeta.dateDebut && savedMeta.dateFin) {
            setDateDebut(savedMeta.dateDebut);
            setDateFin(savedMeta.dateFin);
            return;
          }
        }
      } catch (e) {}

      const allRecords = [...pointages, ...paies];
      const range = getWeekDateRange(semaine, allRecords);
      if (range.start && range.end) {
        setDateDebut(range.start);
        setDateFin(range.end);
      }
    } else {
      setDateDebut('');
      setDateFin('');
    }
  }, [semaine, pointages, paies]);

  const getWeekNumber = (date) => {
    const dObj = new Date(date);
    const day = dObj.getDay();
    const diffToFriday = day >= 5 ? (5 - day) : (-2 - day);
    const friday = new Date(new Date(dObj).setDate(dObj.getDate() + diffToFriday));
    const thursday = new Date(new Date(friday).setDate(friday.getDate() + 6));
    const d = new Date(Date.UTC(thursday.getFullYear(), thursday.getMonth(), thursday.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-S${weekNo}`;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pointagesRes, ponctionsRes, loyersRes, paiementsRes, ouvriersRes, paiesRes, epiProgRes, epiFournisRes] = await Promise.all([
        apiFetch('/api/pointages'),
        apiFetch('/api/ponctions'),
        apiFetch('/api/loyers'),
        apiFetch('/api/paiements-loyer'),
        apiFetch('/api/ouvriers'),
        apiFetch('/api/paies'),
        apiFetch('/api/epi-programmes'),
        apiFetch('/api/epi-fournis').catch(() => null),
      ]);
      const pts = await pointagesRes.json();
      setPointages(pts);
      setPonctions(await ponctionsRes.json());
      setLoyers(await loyersRes.json());
      setPaiementsLoyer(await paiementsRes.json());
      setOuvriers(await ouvriersRes.json());
      setPaies(await paiesRes.json());
      setEpiProgrammes(await epiProgRes.json().catch(() => []));
      setEpiFournis(epiFournisRes ? await epiFournisRes.json().catch(() => []) : []);

      if (!syncWithLastImport() && pts && pts.length > 0) {
        const sortedPts = [...pts].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
        const latestPt = sortedPts[0];
        if (latestPt.semaine) setSemaine(latestPt.semaine);
        if (latestPt.date_debut && latestPt.date_fin) {
          setDateDebut(latestPt.date_debut);
          setDateFin(latestPt.date_fin);
        }
        if (latestPt.site) setSiteFilter(latestPt.site);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fonction helper robuste pour vérifier si un pointage ou une paie appartient à la semaine/période ciblée
  const isRecordInCurrentSelection = (p, targetSem = semaine) => {
    if (!p) return false;
    const pSem = String(p.semaine || '').trim().toLowerCase();
    const selSem = String(targetSem || '').trim().toLowerCase();
    const extractParts = (str) => {
      const parts = str.split('-');
      if (parts.length > 1) return { year: parts[0], week: parts[1] };
      return { year: null, week: parts[0] };
    };
    const pParts = extractParts(pSem);
    const selParts = extractParts(selSem);
    
    // Si les deux ont un numéro de semaine
    if (selParts.week && pParts.week) {
      if (pParts.week === selParts.week) {
        if (pParts.year && selParts.year) return pParts.year === selParts.year;
        return true;
      } else {
        // Ils ont des semaines différentes explicitly définies (ex: S27 vs S30), donc ce n'est PAS la même sélection
        return false;
      }
    }
    
    // Si on n'a pas pu matcher par semaine (l'un d'eux n'a pas de semaine définie), on fallback sur les dates
    if (dateDebut && dateFin && p.date) {
      const dStr = String(p.date).split('T')[0];
      if (dStr >= String(dateDebut).split('T')[0] && dStr <= String(dateFin).split('T')[0]) return true;
    }
    if (dateDebut && dateFin && p.date_debut && p.date_fin) {
      const dStart = String(p.date_debut).split('T')[0];
      const dEnd = String(p.date_fin).split('T')[0];
      if (dStart === String(dateDebut).split('T')[0] && dEnd === String(dateFin).split('T')[0]) return true;
    }
    return false;
  };

  const calculateLoyer = (ouvrierId) => {
    const payDate = datePaie ? new Date(datePaie) : new Date();
    const currentMonth = payDate.toLocaleString('fr-FR', { month: 'long' }).toLowerCase();
    const currentYear = payDate.getFullYear();

    const loyer = loyers.find(
      l => Number(l.ouvrier_id) === Number(ouvrierId) &&
           (l.type === 'long_terme' || (l.mois?.toLowerCase() === currentMonth && Number(l.annee) === currentYear))
    );
    if (!loyer) return 0;
    
    // Récupérer tous les paiements du mois en cours
    const paymentsThisMonth = paiementsLoyer.filter(
      p => Number(p.ouvrier_id) === Number(ouvrierId) && 
           p.mois?.toLowerCase() === currentMonth && 
           Number(p.annee) === currentYear
    );
    
    const totalPaid = paymentsThisMonth.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
    const montantMensuel = Number(loyer.montant_mensuel) || 0;
    const nombreTranches = Number(loyer.nombre_tranches) || 1;
    
    if (totalPaid >= montantMensuel) return 0;
    
    const resteAPayer = montantMensuel - totalPaid;
    const montantTranche = Math.ceil(montantMensuel / nombreTranches);
    
    return Math.min(montantTranche, resteAPayer);
  };

  const calculatePonction = (ouvrierId, salaireBrut = 0, pointageDate = null) => {
    const worker = ouvriers.find(o => Number(o.id) === Number(ouvrierId));
    const site = worker?.site || '';
    const epiLimit = getEpiLimit(site, ouvrierId);
    const workerPonctions = ponctions.filter(p => Number(p.ouvrier_id) === Number(ouvrierId) && !p.motif?.includes('Complément caution (Départ') && !p.motif?.includes('EPI non retournés') && !p.motif?.includes('EPI perdus'));
    const totalPaid = workerPonctions.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);

    if (worker && worker.statut === 'parti') {
      return { montant: 0, has_existing: false, existing_id: null, totalPaid, epiLimit };
    }

    // 1. Vérifier si une ponction a DÉJÀ été saisie/prélevée sur la page Ponctions pour cette période/date précise
    const existingPeriodPonction = ponctions.find(p => {
      if (Number(p.ouvrier_id) !== Number(ouvrierId)) return false;
      const pDate = String(p.date || '').split('T')[0];
      if (pointageDate && pDate === String(pointageDate).split('T')[0]) return true;
      if (dateDebut && dateFin) {
        const pD = new Date(pDate);
        return pD >= new Date(dateDebut) && pD <= new Date(dateFin);
      }
      return false;
    });

    if (existingPeriodPonction && existingPeriodPonction.montant !== undefined) {
      const montantExistant = Number(existingPeriodPonction.montant) || 0;
      const totalPaidBefore = totalPaid - montantExistant;
      
      // Auto-correction : Si c'est une ponction générée automatiquement et que l'ouvrier avait DÉJÀ soldé avant cette période
      if (totalPaidBefore >= epiLimit && existingPeriodPonction.motif === 'Retenue hebdomadaire EPI') {
        return { montant: 0, has_existing: true, existing_id: existingPeriodPonction.id, totalPaid: totalPaidBefore, epiLimit };
      }
      
      // Auto-correction 2 : S'il devait payer moins que ce qui a été prélevé automatiquement
      if (totalPaidBefore < epiLimit && (totalPaidBefore + montantExistant) > epiLimit && existingPeriodPonction.motif === 'Retenue hebdomadaire EPI') {
        const montantCorrige = epiLimit - totalPaidBefore;
        return { montant: montantCorrige, has_existing: true, existing_id: existingPeriodPonction.id, totalPaid: totalPaidBefore + montantCorrige, epiLimit };
      }

      return { montant: montantExistant, has_existing: true, existing_id: existingPeriodPonction.id, totalPaid, epiLimit };
    }

    if (totalPaid >= epiLimit) {
      return { montant: 0, has_existing: false, existing_id: null, totalPaid, epiLimit, fromProgram: false, programId: null };
    }

    // Si on a déjà commencé à payer, on déduit automatiquement le reste
    if (totalPaid > 0) {
      return { montant: epiLimit - totalPaid, has_existing: false, existing_id: null, totalPaid, epiLimit, fromProgram: false, programId: null };
    }

    // Si c'est la 1ère fois (totalPaid === 0)
    const workerProgram = epiProgrammes.find(e => Number(e.ouvrier_id) === Number(ouvrierId));

    if (workerProgram) {
      // Il est programmé. On déduit uniquement si c'est la bonne semaine
      if (String(workerProgram.semaine).trim().toUpperCase() === String(semaine).trim().toUpperCase()) {
        return { 
          montant: Number(workerProgram.montant) || 5000, 
          has_existing: false, 
          existing_id: null, 
          totalPaid, 
          epiLimit, 
          fromProgram: true,
          programId: workerProgram.id 
        };
      }
      // Sinon on ne déduit rien en attendant sa semaine
      return { montant: 0, has_existing: false, existing_id: null, totalPaid, epiLimit, fromProgram: false, programId: null };
    }

    // Pas programmé du tout et jamais ponctionné (totalPaid === 0).
    // Désormais, la déduction n'est PLUS automatique la première fois.
    // Elle le deviendra uniquement après une première saisie manuelle (qui rendra totalPaid > 0).
    return { montant: 0, has_existing: false, existing_id: null, totalPaid, epiLimit, fromProgram: false, programId: null };
  };

  const handleCalcul = () => {
    setCalculating(true);
    
    let savedMeta = null;
    try {
      const savedMetaStr = localStorage.getItem('gebat_last_import_meta');
      if (savedMetaStr) savedMeta = JSON.parse(savedMetaStr);
    } catch (e) {}

    // Vérifier s'il y a des données enregistrées pour la semaine ou période sélectionnée
    const hasWeekData = pointages.some(p => isRecordInCurrentSelection(p)) ||
                        paies.some(p => isRecordInCurrentSelection(p));

    // On part de la liste de tous les ouvriers de la base, filtrés par site et qualification
    let targetOuvriers = ouvriers.filter(o => {
      // Si on vient juste d'importer, on limite STRICTEMENT aux ouvriers du dernier import
      if (strictImportedWorkers && strictImportedWorkers.length > 0) {
        if (!strictImportedWorkers.includes(Number(o.id))) {
          return false;
        }
      }

      if (o.statut === 'parti' && o.epi_settled) return false;
      
      // Si on n'est PAS en mode strict import, on applique les filtres habituels
      if (!strictImportedWorkers || strictImportedWorkers.length === 0) {
        if (siteFilter) {
          const oSite = String(o.site || '').trim().toLowerCase();
          const sFilter = String(siteFilter).trim().toLowerCase();
          const hasPointageOnSiteThisWeek = pointages.some(p => Number(p.ouvrier_id) === Number(o.id) && isRecordInCurrentSelection(p) && String(p.site || '').trim().toLowerCase() === sFilter);
          if (oSite !== sFilter && !hasPointageOnSiteThisWeek) {
            return false;
          }
        }
        if (qualificationFilter && String(o.qualification || '').trim().toLowerCase() !== String(qualificationFilter).trim().toLowerCase()) return false;
        
        // Si la semaine sélectionnée a des pointages ou paies, on affiche UNIQUEMENT les ouvriers de cette sélection !
        if (semaine && hasWeekData) {
          const hasPointageThisWeek = pointages.some(p => Number(p.ouvrier_id) === Number(o.id) && isRecordInCurrentSelection(p));
          const hasPaieThisWeek = paies.some(p => Number(p.ouvrier_id) === Number(o.id) && isRecordInCurrentSelection(p));
          if (!hasPointageThisWeek && !hasPaieThisWeek) {
            return false;
          }
        }
      }
      return true;
    });

    const paieCalculations = targetOuvriers.map((ouvrier) => {
      // 1. Chercher si le pointage spécifique à la semaine existe
      const currentWeekPointage = pointages.find(p => 
        Number(p.ouvrier_id) === Number(ouvrier.id) && isRecordInCurrentSelection(p)
      );

      // 2. Chercher si cet ouvrier a DÉJÀ été payé SUR CETTE SEMAINE précise (ou intervalle de dates)
      const existingPaie = paies.find(p => 
        Number(p.ouvrier_id) === Number(ouvrier.id) && isRecordInCurrentSelection(p)
      );
      const isPaidLocked = Boolean(existingPaie && (
        existingPaie.paye === true || 
        existingPaie.paye == 1 || 
        existingPaie.paye === '1' || 
        existingPaie.paye === 'true' ||
        (existingPaie.paye && existingPaie.paye.type === 'Buffer' && existingPaie.paye.data && existingPaie.paye.data[0] === 1)
      ));
      const isDejaPaye = isPaidLocked;

      // 3. Déterminer le salaire brut de la semaine ('étant donné qu'il y'a déjà des noms dans la base avec un montant, pour chaque semaine il doit avoir un nouveau montant à payer')
      let salaireBrut = 0;
      if (currentWeekPointage && currentWeekPointage.salaire_brut !== undefined) {
        salaireBrut = Number(currentWeekPointage.salaire_brut);
      } else if (isPaidLocked && existingPaie.salaire_brut !== undefined) {
        salaireBrut = Number(existingPaie.salaire_brut);
      }

      let pointageId = currentWeekPointage ? currentWeekPointage.id : null;
      let datePointage = currentWeekPointage ? currentWeekPointage.date : (dateFin || datePaie || new Date().toISOString().split('T')[0]);

      if (!isPaidLocked && salaireBrut === 0 && !hasWeekData) {
        // Prendre le montant le plus récent enregistré pour cet ouvrier dans les pointages
        const latestPointage = pointages
          .filter(p => Number(p.ouvrier_id) === Number(ouvrier.id) && Number(p.salaire_brut) > 0)
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
          
        if (latestPointage) {
          salaireBrut = Number(latestPointage.salaire_brut) || 0;
          pointageId = latestPointage.id;
        } else if (Number(ouvrier.salaire_base) > 0) {
          salaireBrut = Number(ouvrier.salaire_base);
        } else {
          // Ou par défaut selon la qualification
          const qualUpper = String(ouvrier?.qualification || '').trim().toUpperCase();
          const isAide = qualUpper.includes('AIDE');
          salaireBrut = isAide ? 27000 : 45000;
        }
      }

      // DEBUG: LOG FOR MASSIE ARSENE
      if (ouvrier.nom.includes('MASSIE')) {
        console.log('[DEBUG_CALCUL_PAIE] MASSIE ARSENE ->', {
          currentWeekPointage,
          existingPaie,
          isPaidLocked,
          salaireBrut,
          semaine
        });
      }

      // 4. Calcul de la ponction pour cette semaine
      const fullCalc = calculatePonction(ouvrier.id, salaireBrut, datePointage);
      let calcPonctionResult;
      if (isPaidLocked) {
        calcPonctionResult = { 
          montant: Number(existingPaie.ponction || 0), 
          has_existing: true, 
          existing_id: existingPaie.existing_ponction_id || null,
          totalPaid: existingPaie.total_cotisations_epi !== undefined ? Number(existingPaie.total_cotisations_epi) : (fullCalc.totalPaid || 0),
          epiLimit: existingPaie.epi_limit !== undefined ? Number(existingPaie.epi_limit) : (fullCalc.epiLimit || 0)
        };
      } else if (existingPaie && existingPaie.is_custom_ponction && existingPaie.ponction !== undefined) {
        calcPonctionResult = { 
          montant: Number(existingPaie.ponction || 0), 
          has_existing: Boolean(existingPaie.has_existing_ponction), 
          existing_id: existingPaie.existing_ponction_id || null,
          totalPaid: existingPaie.total_cotisations_epi !== undefined ? Number(existingPaie.total_cotisations_epi) : (fullCalc.totalPaid || 0),
          epiLimit: existingPaie.epi_limit !== undefined ? Number(existingPaie.epi_limit) : (fullCalc.epiLimit || 0)
        };
      } else {
        calcPonctionResult = fullCalc;
      }
      const ponctionAmount = calcPonctionResult.montant;
      const loyerAmount = isPaidLocked && existingPaie.loyer !== undefined ? Number(existingPaie.loyer) : calculateLoyer(ouvrier.id);
      
      let epiRemboursement = 0;
      let epiDeduction = 0;
      let epiDepartureOption = '';
      let isDepartureWeek = false;
      if (ouvrier.statut === 'parti' && ouvrier.date_depart) {
        const dDate = String(ouvrier.date_depart).split('T')[0];
        if (dateDebut && dateFin) {
           isDepartureWeek = dDate >= String(dateDebut).split('T')[0] && dDate <= String(dateFin).split('T')[0];
        } else if (semaine) {
           const d = new Date(dDate);
           d.setHours(0,0,0,0);
           d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
           const week1 = new Date(d.getFullYear(), 0, 4);
           const w = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
           const depSem = `${d.getFullYear()}-W${w.toString().padStart(2, '0')}`;
           isDepartureWeek = String(semaine).toUpperCase() === depSem;
        } else {
           isDepartureWeek = true; // default if no filter
        }
      }
      
      if (isPaidLocked) {
        epiRemboursement = Number(existingPaie?.epi_remboursement || 0);
        epiDeduction = Number(existingPaie?.epi_deduction || 0);
        epiDepartureOption = existingPaie?.epi_departure_option || ouvrier.epi_departure_option || '';
        if (epiDepartureOption === 'epi_non_retourne') {
          epiRemboursement = 0;
          epiDeduction = 0;
        }
      } else if (ouvrier.statut === 'parti' && !ouvrier.epi_settled && isDepartureWeek) {
        epiDepartureOption = ouvrier.epi_departure_option || existingPaie?.epi_departure_option || '';
        if (epiDepartureOption === 'epi_non_retourne') {
          epiRemboursement = 0;
          epiDeduction = 0;
        } else {
          // Calculate total EPI paid by the worker
          const workerPonctionsList = ponctions.filter(p => Number(p.ouvrier_id) === Number(ouvrier.id) && !p.motif?.includes('Complément caution (Départ') && !p.motif?.includes('EPI non retournés') && !p.motif?.includes('EPI perdus'));
          const regTotal = workerPonctionsList.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
          
          if (epiDepartureOption === 'epi_complet') {
            epiRemboursement = regTotal;
            epiDeduction = 0;
          } else if (epiDepartureOption === 'epi_perdu') {
            const lost = Number(ouvrier.epi_lost_amount) || 0;
            epiRemboursement = Math.max(0, regTotal - lost);
            epiDeduction = 0; // Aucune déduction supplémentaire demandée
          } else {
            epiRemboursement = Number(ouvrier.epi_remboursement) || Number(existingPaie?.epi_remboursement) || 0;
            epiDeduction = Number(ouvrier.epi_deduction) || Number(existingPaie?.epi_deduction) || 0;
          }
        }
      } else if (existingPaie && (Number(existingPaie.epi_deduction) > 0 || Number(existingPaie.epi_remboursement) > 0 || existingPaie.epi_departure_option === 'epi_non_retourne')) {
        epiDepartureOption = existingPaie.epi_departure_option || ouvrier.epi_departure_option || '';
        if (epiDepartureOption === 'epi_non_retourne') {
          epiRemboursement = 0;
          epiDeduction = 0;
        } else {
          epiRemboursement = Number(existingPaie.epi_remboursement || 0);
          epiDeduction = Number(existingPaie.epi_deduction || 0);
        }
      }
      
      const heuresSup = (currentWeekPointage && currentWeekPointage.heures_sup !== undefined) 
        ? currentWeekPointage.heures_sup 
        : ((isDejaPaye && existingPaie.heures_sup !== undefined) ? existingPaie.heures_sup : 0);

      const netAPayer = (isPaidLocked && (!currentWeekPointage || currentWeekPointage.salaire_brut === undefined) && existingPaie.net_a_payer !== undefined)
        ? Number(existingPaie.net_a_payer) 
        : (Number(salaireBrut) || 0) + (Number(heuresSup) || 0) - (Number(ponctionAmount) || 0) - (Number(loyerAmount) || 0) + (Number(epiRemboursement) || 0) - (Number(epiDeduction) || 0);

      return {
        ouvrier_id: ouvrier.id,
        pointage_id: pointageId,
        date_pointage: datePointage,
        nom: ouvrier.nom || '',
        prenom: ouvrier.prenom || '',
        telephone: ouvrier.telephone || '',
        operateur: ouvrier.operateur || '',
        numero_mobile_money: ouvrier.numero_mobile_money || '',
        qualification: ouvrier.qualification || '',
        // Priorité absolue au site du pointage fraîchement importé
        site: (currentWeekPointage && currentWeekPointage.site) ? currentWeekPointage.site : ((isDejaPaye && existingPaie.site) ? existingPaie.site : (ouvrier.site || '')),
        date: isDejaPaye && existingPaie.date ? existingPaie.date : (dateFin || datePaie || datePointage),
        semaine: isDejaPaye && existingPaie.semaine ? existingPaie.semaine : semaine,
        date_debut: dateDebut || null,
        date_fin: dateFin || null,
        salaire_brut: salaireBrut,
        heures_sup: heuresSup,
        ponction: ponctionAmount,
        total_cotisations_epi: (Number(calcPonctionResult.totalPaid) || 0) + (calcPonctionResult.has_existing ? 0 : Number(ponctionAmount || 0)),
        epi_limit: Number(calcPonctionResult.epiLimit) || 0,
        has_existing_ponction: calcPonctionResult.has_existing,
        existing_ponction_id: calcPonctionResult.existing_id,
        fromProgram: calcPonctionResult.fromProgram,
        programId: calcPonctionResult.programId,
        is_custom_ponction: false,
        loyer: loyerAmount,
        epi_remboursement: epiRemboursement,
        epi_deduction: epiDeduction,
        epi_departure_option: epiDepartureOption,
        net_a_payer: netAPayer,
        paye: isDejaPaye ? true : false,
        deja_paye: isDejaPaye,
      };
    });

    setCalculatedPaie(paieCalculations);
    setCalculating(false);
  };

  useEffect(() => {
    if (pointages.length > 0) {
      handleCalcul();
    }
  }, [pointages, ponctions, loyers, paiementsLoyer, ouvriers, paies, siteFilter, qualificationFilter, dateDebut, dateFin, datePaie, semaine]);

  const getDynamicWeeklyDeduction = (ouvrierId) => {
    const worker = ouvriers.find(o => Number(o.id) === Number(ouvrierId));
    const site = worker?.site || '';
    const epiLimit = getEpiLimit(site, ouvrierId);
    const workerPonctions = ponctions.filter(p => Number(p.ouvrier_id) === Number(ouvrierId) && !p.motif?.includes('Complément caution (Départ') && !p.motif?.includes('EPI non retournés') && !p.motif?.includes('EPI perdus'));
    const totalPaid = workerPonctions.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
    
    if (totalPaid < epiLimit) {
      // Si aucune déduction n'a jamais été faite (totalPaid === 0), on ne fait RIEN automatiquement (0).
      // L'utilisateur doit le faire manuellement la première fois.
      // Ensuite, le système déduira automatiquement le RESTE (epiLimit - totalPaid).
      return totalPaid === 0 ? 0 : (epiLimit - totalPaid);
    }
    return 0;
  };

  const handlePonctionChange = (index, newAmount) => {
    setCalculatedPaie(prev => prev.map((paie, idx) => {
      if (idx !== index || paie.deja_paye) return paie;
      const val = Math.max(0, Number(newAmount) || 0);
      const net = (Number(paie.salaire_brut) || 0) - val - (Number(paie.loyer) || 0) + (Number(paie.epi_remboursement) || 0) - (Number(paie.epi_deduction) || 0);
      
      // Calculate the previous paid amount excluding this week's current ponction
      const alreadyPaid = paie.has_existing_ponction 
        ? (Number(paie.total_cotisations_epi) || 0) - (Number(paie.ponction) || 0)
        : (Number(paie.total_cotisations_epi) || 0) - (Number(paie.ponction) || 0);
        
      return {
        ...paie,
        ponction: val,
        total_cotisations_epi: alreadyPaid + val,
        net_a_payer: net,
        is_custom_ponction: true,
      };
    }));
  };

  const handlePaiementIndividuel = (index) => {
    setCalculatedPaie(prev => prev.map((paie, idx) => 
      (idx === index && !paie.deja_paye) ? { ...paie, paye: !paie.paye } : paie
    ));
  };

  const handlePaiementGroupe = () => {
    setCalculatedPaie(prev => prev.map(paie => paie.deja_paye ? paie : ({ ...paie, paye: true })));
  };

  const handleSave = async () => {
    const paiesToSave = calculatedPaie.filter(p => !p.deja_paye);
    if (paiesToSave.length === 0) {
      alert('Toutes les paies sélectionnées ont déjà été réglées et enregistrées !');
      return;
    }

    try {
      for (const paie of paiesToSave) {
        await apiFetch('/api/paies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ouvrier_id: paie.ouvrier_id,
            pointage_id: paie.pointage_id,
            date_pointage: paie.date_pointage || dateFin || datePaie || new Date().toISOString().split('T')[0],
            date: paie.date || dateFin || datePaie || new Date().toISOString().split('T')[0],
            semaine: paie.semaine || semaine,
            date_debut: paie.date_debut || dateDebut || null,
            date_fin: paie.date_fin || dateFin || null,
            salaire_brut: paie.salaire_brut,
            ponction: paie.ponction,
            loyer: paie.loyer,
            net_a_payer: paie.net_a_payer,
            epi_remboursement: paie.epi_remboursement || 0,
            epi_deduction: paie.epi_deduction || 0,
            total_cotisations_epi: paie.total_cotisations_epi || 0,
            epi_limit: paie.epi_limit || 0,
            epi_departure_option: paie.epi_departure_option || '',
            paye: true,
          }),
        });
      }

      for (const paie of paiesToSave) {
        if (paie.ponction > 0) {
          if (paie.existing_ponction_id && paie.is_custom_ponction) {
            // Mettre à jour la ponction existante si modifiée manuellement dans le tableau
            await apiFetch(`/api/ponctions/${paie.existing_ponction_id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ouvrier_id: paie.ouvrier_id,
                date: paie.date,
                montant: paie.ponction,
                motif: 'Retenue hebdomadaire EPI (Ajustée manuellement)',
              }),
            });
          } else if (!paie.has_existing_ponction || (paie.is_custom_ponction && !paie.existing_ponction_id)) {
            // Créer la ponction uniquement si elle n'existe pas déjà pour cette période
            await apiFetch('/api/ponctions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ouvrier_id: paie.ouvrier_id,
                date: paie.date,
                montant: paie.ponction,
                motif: paie.fromProgram ? `[PROG EPI N°${paie.programId}] Prélèvement automatique` : 'Retenue hebdomadaire EPI',
              }),
            });
          }
        }

        if (paie.loyer > 0) {
          const payDate = new Date(paie.date);
          await apiFetch('/api/paiements-loyer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ouvrier_id: paie.ouvrier_id,
              mois: payDate.toLocaleString('fr-FR', { month: 'long' }),
              annee: payDate.getFullYear(),
              montant: paie.loyer,
            }),
          });
        }

        if (paie.epi_departure_option) {
          if (paie.epi_remboursement > 0) {
            await apiFetch('/api/ponctions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ouvrier_id: paie.ouvrier_id,
                date: paie.date,
                montant: -paie.epi_remboursement,
                motif: `Remboursement caution (Départ - ${paie.epi_departure_option === 'epi_complet' ? 'EPI complet' : 'EPI perdu'})`,
              }),
            });
          }
          if (paie.epi_deduction > 0) {
            await apiFetch('/api/ponctions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ouvrier_id: paie.ouvrier_id,
                date: paie.date,
                montant: paie.epi_deduction,
                motif: `Complément caution (Départ - ${paie.epi_departure_option === 'epi_non_retourne' ? 'EPI non retournés' : 'EPI perdu'})`,
              }),
            });
          }

          const worker = ouvriers.find(o => o.id === paie.ouvrier_id);
          if (worker) {
            await apiFetch(`/api/ouvriers/${worker.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...worker,
                epi_settled: true,
                epi_refunded: paie.epi_remboursement > 0,
              }),
            });
          }
        }
      }

      // Update local state instead of clearing it
      setCalculatedPaie(prev => prev.map(paie => {
        if (paiesToSave.some(p => p.ouvrier_id === paie.ouvrier_id)) {
          return { ...paie, deja_paye: true, paye: true };
        }
        return paie;
      }));

      // Auto export Wave file
      handleExportWave(paiesToSave);

      alert(`Paie de ${paiesToSave.length} ouvrier(s) enregistrée et marquée payée avec succès !`);

      // Mettre à jour les données depuis le serveur pour refléter la BD
      await fetchData();

    } catch (error) {
      console.error('Error saving paie:', error);
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const displayedPaie = calculatedPaie.filter(p => {
    if (statutFilter === 'en_attente') return !p.deja_paye;
    if (statutFilter === 'regles') return p.deja_paye;
    return true; // 'tous'
  });

  const handleExportExcel = () => {
    const titleRow = ['CALCUL DE LA PAIE & VIREMENTS - GEBAT EASYPAIE'];
    const subtitleRow = [`Semaine : ${semaine || '-'} | Date Paiement : ${datePaie ? formatDate(datePaie) : '-'} | Période : du ${dateDebut ? formatDate(dateDebut) : '-'} au ${dateFin ? formatDate(dateFin) : '-'} | Généré le ${new Date().toLocaleDateString('fr-FR')}`];
    const emptyRow = [];
    const headerRow = [
      'Nom', 'Prénom', 'Qualification', 'Site', 'Date Pointage', 'Période (Intervalle)', 'Statut Virement',
      'Salaire Brut (FCFA)', 'Ponctions EPI (Total Cotisé)', 'Plafond EPI',
      'Loyer (FCFA)', 'Remboursement EPI', 'Déd. EPI (FCFA)', 'Détail Type Déduction',
      'Net à Payer (FCFA)', 'Opérateur MM', 'Numéro Transfert MM'
    ];

    const dataRows = displayedPaie.map((paie) => [
      paie.nom,
      paie.prenom || '',
      paie.qualification || '-',
      paie.site || '-',
      formatDate(paie.date_pointage || paie.date),
      getIntervaleSemaine(paie.semaine, paie.date_pointage || paie.date, paie.date_debut, paie.date_fin),
      paie.deja_paye ? 'Déjà Réglé & Enregistré' : (paie.paye ? 'Prêt à enregistrer' : 'En attente / Non effectué'),
      Number(paie.salaire_brut) || 0,
      Number(paie.total_cotisations_epi) || 0,
      Number(paie.epi_limit) || 0,
      Number(paie.loyer) || 0,
      Number(paie.epi_remboursement) || 0,
      (Number(paie.epi_deduction) > 0 || Number(paie.ponction) > 0) ? -((Number(paie.epi_deduction) > 0 ? Number(paie.epi_deduction) : Number(paie.ponction)) || 0) : 0,
      Number(paie.epi_deduction) > 0 ? 'Départ / Perte' : (Number(paie.ponction) > 0 ? 'Retenue Hebdo' : 'Aucune'),
      Number(paie.net_a_payer) || 0,
      paie.operateur || '-',
      paie.numero_mobile_money || '-'
    ]);

    const totBrut = displayedPaie.reduce((sum, p) => sum + (Number(p.salaire_brut) || 0), 0);
    const totCotise = displayedPaie.reduce((sum, p) => sum + (Number(p.total_cotisations_epi) || 0), 0);
    const totPlafond = displayedPaie.reduce((sum, p) => sum + (Number(p.epi_limit) || 0), 0);
    const totLoyer = displayedPaie.reduce((sum, p) => sum + (Number(p.loyer) || 0), 0);
    const totRemb = displayedPaie.reduce((sum, p) => sum + (Number(p.epi_remboursement) || 0), 0);
    const totDed = displayedPaie.reduce((sum, p) => sum + ((Number(p.epi_deduction) > 0 ? Number(p.epi_deduction) : Number(p.ponction)) || 0), 0);
    const totNet = displayedPaie.reduce((sum, p) => sum + (Number(p.net_a_payer) || 0), 0);

    const totalRow = [
      'TOTAL GÉNÉRAL', '', '', '', '', '', '',
      totBrut, totCotise, totPlafond,
      totLoyer, totRemb, totDed, '',
      totNet, '', '', ''
    ];

    const aoa = [titleRow, subtitleRow, emptyRow, headerRow, ...dataRows, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 17 } }
    ];

    ws['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 26 }, { wch: 22 },
      { wch: 20 }, { wch: 26 }, { wch: 16 }, { wch: 16 },
      { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 20 },
      { wch: 16 }, { wch: 22 }, { wch: 18 }
    ];

    ws['!rows'] = [
      { hpt: 36 },
      { hpt: 24 },
      { hpt: 10 },
      { hpt: 28 },
    ];

    const titleCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (ws[titleCell]) {
      ws[titleCell].s = {
        font: { name: 'Arial', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1565C0' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    const subCell = XLSX.utils.encode_cell({ r: 1, c: 0 });
    if (ws[subCell]) {
      ws[subCell].s = {
        font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '1E3A8A' } },
        fill: { fgColor: { rgb: 'F4BD0B' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    for (let c = 0; c <= 17; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 3, c: c });
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1E293B' } },
          alignment: { horizontal: (c >= 7 && c <= 12) || c === 14 ? 'right' : 'center', vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: '0F172A' } },
            bottom: { style: 'medium', color: { rgb: '0F172A' } },
            left: { style: 'thin', color: { rgb: '475569' } },
            right: { style: 'thin', color: { rgb: '475569' } }
          }
        };
      }
    }

    for (let r = 4; r < 4 + dataRows.length; r++) {
      for (let c = 0; c <= 17; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: r, c: c });
        if (ws[cellAddress]) {
          const isNumCol = (c >= 7 && c <= 12) || c === 14;
          if (isNumCol && typeof ws[cellAddress].v === 'number') {
            ws[cellAddress].z = '#,##0';
          }
          ws[cellAddress].s = {
            font: { name: 'Arial', sz: 9.5, color: { rgb: '1E293B' } },
            fill: { fgColor: { rgb: r % 2 === 0 ? 'FFFFFF' : 'F8FAFC' } },
            alignment: { horizontal: isNumCol ? 'right' : (c === 15 ? 'center' : 'left'), vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
              left: { style: 'thin', color: { rgb: 'E2E8F0' } },
              right: { style: 'thin', color: { rgb: 'E2E8F0' } }
            }
          };
          if (c === 14) {
            ws[cellAddress].s.font.bold = true;
            ws[cellAddress].s.font.color = { rgb: '065F46' };
            ws[cellAddress].s.fill = { fgColor: { rgb: 'ECFDF5' } };
          }
        }
      }
    }

    const totalRowIndex = 4 + dataRows.length;
    for (let c = 0; c <= 17; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: totalRowIndex, c: c });
      if (ws[cellAddress]) {
        const isNumCol = (c >= 7 && c <= 12) || c === 14;
        if (isNumCol && typeof ws[cellAddress].v === 'number') {
          ws[cellAddress].z = '#,##0';
        }
        ws[cellAddress].s = {
          font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: c === 14 ? '065F46' : '0F172A' } },
          fill: { fgColor: { rgb: c === 14 ? 'D1FAE5' : 'E2E8F0' } },
          alignment: { horizontal: isNumCol ? 'right' : 'left', vertical: 'center' },
          border: {
            top: { style: 'double', color: { rgb: '475569' } },
            bottom: { style: 'medium', color: { rgb: '0F172A' } }
          }
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Paie & Virements');
    XLSX.writeFile(wb, `Calcul_Paie_${semaine || 'Semaine'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const fmtPdf = (amount) => {
    const num = Math.round(Number(amount) || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' FCFA';
  };

  const fmtPdfSigned = (amount) => {
    const num = Math.round(Number(amount) || 0);
    if (num === 0) return '-';
    const s = Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (num > 0 ? '+' : '-') + s + ' FCFA';
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const subtitle = `Semaine : ${semaine || '-'} | Date Paiement : ${datePaie ? formatDate(datePaie) : '-'} ${dateDebut && dateFin ? `| Période : du ${formatDate(dateDebut)} au ${formatDate(dateFin)}` : ''}`;
    
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(21, 101, 192);
    doc.rect(0, 0, pageW, 42, 'F');
    doc.setFillColor(244, 189, 11);
    doc.rect(0, 42, pageW, 3, 'F');
    try {
      doc.addImage(gebatLogo, 'PNG', pageW - 46, 2, 34, 34);
    } catch (e) {}
    doc.setFillColor(244, 189, 11);
    doc.rect(pageW - 50, 4, 1, 30, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text('Calcul de la Paie & Virements', 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(subtitle, 14, 27);
    doc.setFontSize(8);
    doc.setTextColor(180, 200, 240);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} | EasyPaie GEBAT`, 14, 37);
    doc.setTextColor(0, 0, 0);

    const rows = displayedPaie.map((p) => {
      const ponctionText = p.total_cotisations_epi > 0
        ? `${fmtPdf(p.total_cotisations_epi)}${p.epi_limit > 0 ? `\nsur ${fmtPdf(p.epi_limit)}` : ''}`
        : '-';

      const dedEpiText = p.epi_deduction > 0
        ? `-${fmtPdf(p.epi_deduction)}\n(Départ)`
        : (p.ponction > 0 ? `-${fmtPdf(p.ponction)}` : '-');

      const mmText = `${p.operateur ? `[${p.operateur.toUpperCase()}] ` : 'MM : '}${p.numero_mobile_money || '-'}`;

      return [
        `${p.nom} ${p.prenom || ''}`.trim(),
        `${p.qualification || '-'}\n${p.site || '-'}`,
        `${formatDate(p.date_pointage || p.date)}\n${getIntervaleSemaine(p.semaine, p.date_pointage || p.date, p.date_debut, p.date_fin)}`,
        fmtPdf(p.salaire_brut),
        ponctionText,
        p.loyer > 0 ? fmtPdf(p.loyer) : '-',
        fmtPdfSigned(p.epi_remboursement),
        dedEpiText,
        fmtPdf(p.net_a_payer),
        mmText
      ];
    });

    autoTable(doc, {
      headStyles: {
        fillColor: [21, 101, 192],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      rowPageBreak: 'auto',
      margin: { top: 50, left: 6, right: 6 },
      startY: 50,
      head: [[
        'Ouvrier', 'Qualif / Site', 'Date & Période', 'Sal. Brut',
        'Ponctions EPI', 'Loyer', 'Remb. EPI',
        'Déd. EPI', 'Net à Payer', 'Transfert Mobile Money'
      ]],
      body: rows,
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 28 },
        2: { cellWidth: 34 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 26, textColor: [70, 70, 150] },
        5: { halign: 'right', cellWidth: 22, textColor: [100, 0, 150] },
        6: { halign: 'right', cellWidth: 22, textColor: [0, 120, 0] },
        7: { halign: 'right', cellWidth: 24, fontStyle: 'bold', textColor: [180, 40, 0] },
        8: { halign: 'right', cellWidth: 26, fontStyle: 'bold', textColor: [0, 130, 60] },
        9: { cellWidth: 44, fontStyle: 'bold', textColor: [20, 40, 80] }
      },
    });

    const totBrut = displayedPaie.reduce((sum, p) => sum + (Number(p.salaire_brut) || 0), 0);
    const totPonctionsHebdo = displayedPaie.reduce((sum, p) => sum + (Number(p.ponction) || 0), 0);
    const totDedDepart = displayedPaie.reduce((sum, p) => sum + (Number(p.epi_deduction) || 0), 0);
    const totLoyers = displayedPaie.reduce((sum, p) => sum + (Number(p.loyer) || 0), 0);
    const totRemb = displayedPaie.reduce((sum, p) => sum + (Number(p.epi_remboursement) || 0), 0);
    const totNet = displayedPaie.reduce((sum, p) => sum + (Number(p.net_a_payer) || 0), 0);

    const y = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(240, 244, 255);
    doc.roundedRect(10, y, pageW - 20, 32, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(21, 101, 192);
    doc.text(`Total Salaire Brut : ${fmtPdf(totBrut)}`, 16, y + 9);
    doc.setTextColor(180, 60, 0);
    doc.text(`Total Retenues Hebdo EPI : ${fmtPdf(totPonctionsHebdo)}${totDedDepart > 0 ? ` | Déd. Départ : -${fmtPdf(totDedDepart)}` : ''}`, 16, y + 18);
    doc.setTextColor(100, 0, 150);
    doc.text(`Total Loyers : ${fmtPdf(totLoyers)}${totRemb > 0 ? ` | Remb. EPI : +${fmtPdf(totRemb)}` : ''}`, 16, y + 27);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 130, 60);
    doc.text(`Total Net à Payer : ${fmtPdf(totNet)}`, pageW - 16, y + 18, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    doc.save(`Calcul_Paie_${semaine || 'Semaine'}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportWave = (dataToExport = displayedPaie) => {
    const listToExport = Array.isArray(dataToExport) ? dataToExport : displayedPaie;
    const waveRows = listToExport
      .filter(p => Number(p.net_a_payer) > 0)
      .map(paie => {
        const fullName = `${paie.nom || ''} ${paie.prenom || ''}`.trim();
        const rawPhone = paie.numero_mobile_money || '';
        const phoneStr = String(rawPhone).trim().replace(/\s+/g, '');
        const amount = Number(paie.net_a_payer) || 0;
        const qualification = paie.qualification || 'Ouvrier';
        const site = paie.site || 'Chantier';
        const reason = `Travaux - ${qualification} - ${site}`;
        
        return [fullName, phoneStr, amount, reason];
      });

    if (waveRows.length === 0) {
      alert("Aucun salaire avec un montant Net > 0 à exporter pour Wave dans l'affichage actuel.");
      return;
    }

    const headerRow = ['Customer Name', 'Telephone Number', 'Amount', 'Reason for Payment'];
    const aoa = [headerRow, ...waveRows];
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // S'assurer que Telephone Number (colonne B / index 1) est formaté en texte brut ('@') afin de préserver le zéro initial
    for (let r = 1; r <= waveRows.length; r++) {
      const cellAddress = XLSX.utils.encode_cell({ r: r, c: 1 });
      if (ws[cellAddress]) {
        ws[cellAddress].t = 's';
        ws[cellAddress].z = '@';
      }
      const amtAddress = XLSX.utils.encode_cell({ r: r, c: 2 });
      if (ws[amtAddress]) {
        ws[amtAddress].t = 'n';
      }
    }

    ws['!cols'] = [
      { wch: 30 }, // Customer Name
      { wch: 20 }, // Telephone Number
      { wch: 16 }, // Amount
      { wch: 55 }  // Reason for Payment
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Result_26');

    const fileName = `IMPORT_WAVE_${semaine || 'Semaine'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const getWeeksPendingSummaries = () => {
    const allRecords = [...pointages, ...paies, ...calculatedPaie];
    let uniqueWeeks = [...new Set([
      ...allRecords.map(r => r.semaine),
      semaine
    ].filter(Boolean))];

    if (annee) {
      uniqueWeeks = uniqueWeeks.filter(w => {
        if (w.match(/^\d{4}-S\d+$/)) {
          return w.startsWith(annee + '-');
        }
        return w.includes(annee);
      });
    }

    uniqueWeeks = uniqueWeeks.sort().reverse();

    return uniqueWeeks.map(weekVal => {
      let pendingAmount = 0;
      let pendingWorkersCount = 0;
      let totalWorkersCount = 0;
      const sitesSet = new Set();

      // Verify calculatedPaie belongs to the current week to avoid stale state race conditions
      if (weekVal === semaine && calculatedPaie.length > 0 && calculatedPaie.some(p => p.semaine === weekVal)) {
        calculatedPaie.forEach(p => {
          totalWorkersCount++;
          if (!p.deja_paye) {
            pendingAmount += (Number(p.net_a_payer) || 0);
            pendingWorkersCount++;
            if (p.site) sitesSet.add(p.site);
          }
        });
      } else {
        const paiesForWeek = paies.filter(p => isRecordInCurrentSelection(p, weekVal));
        const pointagesForWeek = pointages.filter(p => isRecordInCurrentSelection(p, weekVal));
        
        const workerIdsInWeek = [...new Set([
          ...paiesForWeek.map(p => Number(p.ouvrier_id)),
          ...pointagesForWeek.map(p => Number(p.ouvrier_id))
        ])];

        workerIdsInWeek.forEach(oId => {
          const worker = ouvriers.find(o => Number(o.id) === oId);
          if (siteFilter) {
            const wSite = (worker?.site || '').trim().toLowerCase();
            const sFilt = siteFilter.trim().toLowerCase();
            const ptSite = (pointagesForWeek.find(pt => Number(pt.ouvrier_id) === oId)?.site || '').trim().toLowerCase();
            const pSite = (paiesForWeek.find(p => Number(p.ouvrier_id) === oId)?.site || '').trim().toLowerCase();
            if (wSite !== sFilt && ptSite !== sFilt && pSite !== sFilt) return;
          }

          totalWorkersCount++;
          const pRecord = paiesForWeek.find(p => Number(p.ouvrier_id) === oId);
          if (pRecord) {
            const isRecPaid = pRecord.paye === true || pRecord.paye === 1 || pRecord.paye === '1' || pRecord.deja_paye === true;
            if (!isRecPaid) {
              pendingAmount += (Number(pRecord.net_a_payer) || 0);
              pendingWorkersCount++;
              if (pRecord.site || worker?.site) sitesSet.add(pRecord.site || worker?.site);
            }
          } else {
            const ptRecord = pointagesForWeek.find(p => Number(p.ouvrier_id) === oId);
            if (ptRecord) {
              const brut = Number(ptRecord.salaire_brut) || Number(worker?.salaire_base) || 45000;
              const netApprox = Math.max(0, brut);
              pendingAmount += netApprox;
              pendingWorkersCount++;
              if (ptRecord.site || worker?.site) sitesSet.add(ptRecord.site || worker?.site);
            }
          }
        });
      }

      return {
        semaine: weekVal,
        label: formatWeekLabel(weekVal, allRecords),
        intervalle: getIntervaleSemaine(weekVal, null, null, null),
        pendingAmount,
        pendingWorkersCount,
        totalWorkersCount,
        sites: Array.from(sitesSet).filter(Boolean),
        isSelected: weekVal === semaine
      };
    });
  };

  const allWeeksSummaries = getWeeksPendingSummaries().filter(summary => summary.totalWorkersCount > 0);
  const pendingWeeks = allWeeksSummaries.filter(w => w.pendingWorkersCount > 0);
  const settledWeeks = allWeeksSummaries.filter(w => w.pendingWorkersCount === 0);

  const globalTotalPendingAmount = pendingWeeks.reduce((sum, w) => sum + (Number(w.pendingAmount) || 0), 0);
  const globalTotalPendingWorkers = pendingWeeks.reduce((sum, w) => sum + (Number(w.pendingWorkersCount) || 0), 0);

  const totalBrut = displayedPaie.reduce((sum, p) => sum + (Number(p.salaire_brut) || 0), 0);
  const totalPonctions = displayedPaie.reduce((sum, p) => sum + (Number(p.ponction) || 0), 0);
  const totalLoyers = displayedPaie.reduce((sum, p) => sum + (Number(p.loyer) || 0), 0);
  const totalRembEpi = displayedPaie.reduce((sum, p) => sum + (Number(p.epi_remboursement) || 0), 0);
  const totalDedEpi = displayedPaie.reduce((sum, p) => {
    const directDed = Number(p.epi_deduction) || 0;
    const nonRetourneGain = p.epi_departure_option === 'epi_non_retourne' ? (Number(p.total_cotisations_epi) || 0) : 0;
    return sum + directDed + nonRetourneGain;
  }, 0);
  const totalNet = displayedPaie.reduce((sum, p) => sum + (Number(p.net_a_payer) || 0), 0);

  return (
    <div className="space-y-8 pb-16">
      {/* Premium Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-cyan-950 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <Calculator className="text-amber-400" size={30} />
              </div>
              <span className="px-3.5 py-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold rounded-full uppercase tracking-wider shadow-sm">
                Automatisation & Net à Payer
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
              Calcul de la Paie
            </h1>
            <p className="text-emerald-100 mt-2 max-w-2xl text-sm md:text-base leading-relaxed font-normal">
              Agrégez instantanément vos pointages bruts avec les retenues hebdomadaires EPI et les loyers d'hébergement. Générez vos virements et bulletins au centime près.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl transition-all shadow-md"
              title="Rafraîchir les données de base"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Parameters Card */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
            <Filter className="text-emerald-600" size={20} />
            Paramètres de la Période & Filtrage Chantier
          </h3>
          <span className="text-xs font-bold text-gray-400">
            {pointages.length} fiches brut disponibles en base
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-emerald-600" /> Année
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:bg-white focus:border-emerald-500"
              value={annee}
              onChange={(e) => {
                setAnnee(e.target.value);
                setSemaine(''); // Reset week when year changes
              }}
            >
              {getUniqueYears().map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-emerald-600" /> Numéro de Semaine
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:bg-white focus:border-emerald-500"
              value={semaine}
              onChange={(e) => setSemaine(e.target.value)}
            >
              <option value="">Sélectionner une semaine...</option>
              {getUniqueWeekOptions()
                .filter(opt => {
                  // Toujours afficher la semaine actuellement sélectionnée
                  if (opt.value === semaine) return true;
                  
                  // Calculer l'état de paiement global de la semaine (ignorer les filtres locaux comme siteFilter)
                  const paiesForWeek = paies.filter(p => p.semaine === opt.value);
                  const pointagesForWeek = pointages.filter(p => p.semaine === opt.value);
                  
                  const workerIdsInWeek = [...new Set([
                    ...paiesForWeek.map(p => Number(p.ouvrier_id)),
                    ...pointagesForWeek.map(p => Number(p.ouvrier_id))
                  ])];

                  if (workerIdsInWeek.length === 0) return true; // S'il n'y a personne, on la garde par sécurité (cas rare)

                  // Vérifier s'il reste au moins un ouvrier non payé dans TOUTE la semaine (tous chantiers confondus)
                  let hasPending = false;
                  for (const oId of workerIdsInWeek) {
                    const pRecord = paiesForWeek.find(p => Number(p.ouvrier_id) === oId);
                    if (pRecord) {
                      const isRecPaid = pRecord.paye === true || pRecord.paye === 1 || pRecord.paye === '1' || pRecord.deja_paye === true;
                      if (!isRecPaid) {
                        hasPending = true;
                        break;
                      }
                    } else {
                      // S'il a un pointage mais pas de paie, il est forcément en attente
                      hasPending = true;
                      break;
                    }
                  }

                  return hasPending;
                })
                .map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-teal-600" /> Date du Règlement
            </label>
            <input
              type="date"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-emerald-500"
              value={datePaie}
              onChange={(e) => setDatePaie(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center justify-between">
              <span>Date de Début (Optionnel)</span>
              <span className="text-[10px] text-emerald-600 font-semibold uppercase bg-emerald-50 px-1.5 py-0.5 rounded">Auto</span>
            </label>
            <input
              type="date"
              disabled={true}
              className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 cursor-not-allowed select-none"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center justify-between">
              <span>Date de Fin (Optionnel)</span>
              <span className="text-[10px] text-emerald-600 font-semibold uppercase bg-emerald-50 px-1.5 py-0.5 rounded">Auto</span>
            </label>
            <input
              type="date"
              disabled={true}
              className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 cursor-not-allowed select-none"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Building2 size={14} className="text-indigo-600" /> Filtrer par Chantier
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-emerald-500"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
            >
              <option value="">Tous les chantiers (Bingerville, Songon...)</option>
              {Array.from(new Set(ouvriers.map(o => String(o.site || '').trim()).filter(Boolean)))
                .filter((site, index, self) => index === self.findIndex(s => s.toLowerCase() === site.toLowerCase()))
                .map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Users size={14} className="text-purple-600" /> Filtrer par Qualification
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-emerald-500"
              value={qualificationFilter}
              onChange={(e) => setQualificationFilter(e.target.value)}
            >
              <option value="">Toutes les qualifications (Maçons, Ferrailleurs...)</option>
              {Array.from(new Set(ouvriers.map(o => String(o.qualification || '').trim()).filter(Boolean)))
                .filter((qual, index, self) => index === self.findIndex(q => q.toLowerCase() === qual.toLowerCase()))
                .map(qualification => (
                <option key={qualification} value={qualification}>{qualification}</option>
              ))}
            </select>
          </div>
        </div>

        {strictImportedWorkers && strictImportedWorkers.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
              <ShieldAlert size={16} />
              Affichage verrouillé sur les ouvriers du dernier import uniquement.
            </div>
            <button 
              onClick={() => setStrictImportedWorkers([])}
              className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors"
            >
              Voir tous les ouvriers
            </button>
          </div>
        )}

        {/* Action Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
          <button
            onClick={handleCalcul}
            disabled={calculating || pointages.length === 0}
            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center gap-3 transform active:scale-95 transition-all text-sm disabled:opacity-50"
          >
            <Calculator size={20} className="stroke-[2.5]" />
            {calculating ? 'Calcul en cours...' : 'Lancer le calcul de la paie nette'}
          </button>

          {calculatedPaie.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">

              {calculatedPaie.every(p => p.deja_paye) ? (
                <button
                  disabled
                  className="px-6 py-3 bg-gray-100 text-gray-400 font-black rounded-xl border border-gray-200 flex items-center gap-2 text-xs cursor-not-allowed"
                >
                  <CheckCircle size={16} className="text-gray-400" />
                  Toutes les paies sont déjà réglées ({calculatedPaie.length}/{calculatedPaie.length})
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-gray-950 font-black rounded-xl shadow-lg shadow-orange-500/25 flex items-center gap-2 text-xs transition-all hover:scale-105"
                >
                  <CheckCircle size={16} className="stroke-[3]" />
                  Enregistrer les paies ({calculatedPaie.filter(p => !p.deja_paye).length} nouvelle{calculatedPaie.filter(p => !p.deja_paye).length > 1 ? 's' : ''})
                </button>
              )}
              <button
                onClick={handleExportExcel}
                className="px-5 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 flex items-center gap-2 text-xs transition-all"
              >
                <Download size={16} /> Export Excel (.xlsx)
              </button>
              <button
                onClick={handleExportWave}
                className="px-5 py-3 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 font-black rounded-xl border-2 border-cyan-300 flex items-center gap-2 text-xs transition-all shadow-sm hover:shadow-md hover:scale-105"
                title="Générer un fichier compatible au modèle d'importation Wave pour décaissement de masse"
              >
                <Smartphone size={16} className="text-cyan-700 stroke-[2.5]" /> Export Wave (.xlsx)
              </button>
              <button
                onClick={handleExportPDF}
                className="px-5 py-3 bg-red-50 hover:bg-red-100 text-red-800 font-extrabold rounded-xl border border-red-200 flex items-center gap-2 text-xs transition-all"
              >
                <FileText size={16} /> Export PDF (.pdf)
              </button>
            </div>
          )}
        </div>

        {pointages.length === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 text-xs font-extrabold animate-pulse">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
            <span>Aucune donnée de pointage brute n'est présente en base. Veuillez d'abord charger votre fichier dans l'onglet « Import Pointage ».</span>
          </div>
        )}
      </div>

      {/* Calculated Payroll Summary Dashboard & Table */}
      {calculatedPaie.length > 0 && (
        <div className="space-y-6 animate-fadeIn">
          {/* 6 Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Salaire Brut</span>
              <div className="text-lg font-black text-gray-900 mt-2 font-mono">{formatCurrency(totalBrut)}</div>
              <span className="text-[10px] font-semibold text-blue-600 mt-1">Pointage cumulé</span>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Retenues EPI</span>
              <div className="text-lg font-black text-red-600 mt-2 font-mono">{totalPonctions > 0 ? `-${formatCurrency(totalPonctions)}` : formatCurrency(0)}</div>
              <span className="text-[10px] font-semibold text-red-700 mt-1">Caution hebdo</span>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Retenues Loyers</span>
              <div className="text-lg font-black text-purple-600 mt-2 font-mono">{formatCurrency(totalLoyers)}</div>
              <span className="text-[10px] font-semibold text-purple-700 mt-1">Hébergement</span>
            </div>

            <div className="bg-emerald-50/70 rounded-2xl p-5 border border-emerald-200 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Remboursement EPI</span>
              <div className="text-lg font-black text-emerald-700 mt-2 font-mono">{formatCurrency(totalRembEpi)}</div>
              <span className="text-[10px] font-semibold text-emerald-600 mt-1">Ouvriers partis</span>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-cyan-50/80 rounded-2xl p-5 border border-teal-200 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-900">Déductions EPI (Gain)</span>
                {totalDedEpi > 0 && <span className="bg-teal-200/80 text-teal-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded">Gain</span>}
              </div>
              <div className="text-lg font-black text-teal-800 mt-2 font-mono">{totalDedEpi > 0 ? `+ ${formatCurrency(totalDedEpi)}` : formatCurrency(0)}</div>
              <span className="text-[10px] font-semibold text-teal-700 mt-1">EPI non retournés / perdus</span>
            </div>

            <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white rounded-2xl p-5 shadow-lg flex flex-col justify-between border border-emerald-700">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">Total Net à Payer</span>
              <div className="text-xl font-black text-white mt-2 font-mono drop-shadow-sm">{formatCurrency(totalNet)}</div>
              <span className="text-[10px] font-bold text-emerald-300 mt-1">Virement global</span>
            </div>
          </div>

          {/* Section Paiements en Attente / Non effectués & Filtrage */}
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-400/40 rounded-3xl p-6 shadow-md">
            {pendingWeeks.length > 0 && (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md flex-shrink-0">
                  <Clock size={26} className="stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-amber-950 flex items-center gap-2">
                    Virements & Paiements Non Effectués (En Attente)
                  </h4>
                  <p className="text-xs text-amber-900 font-semibold mt-0.5">
                    Consultation directe des montants, dates et périodes des salaires calculés restants à verser ou à valider.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 bg-white/95 backdrop-blur-sm px-6 py-3.5 rounded-2xl border-2 border-amber-400/80 shadow-md">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1 block">
                    <Sparkles size={11} className="text-amber-600" /> Total En Attente (Toutes Semaines)
                  </span>
                  <span className="text-xl font-black font-mono text-amber-600">
                    {formatCurrency(globalTotalPendingAmount)}
                  </span>
                  <span className="text-[10px] font-bold text-amber-700/80 block mt-0.5">
                    Cumul global sur toutes les périodes
                  </span>
                </div>
                <div className="h-10 w-px bg-amber-300/60" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                    Ouvriers en attente (Total)
                  </span>
                  <span className="text-xl font-black text-gray-900">
                    {globalTotalPendingWorkers} <span className="text-xs font-extrabold text-amber-700">ouvriers</span>
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 block mt-0.5">
                    Sur {pendingWeeks.filter(w => w.pendingWorkersCount > 0).length} semaine(s) à régler
                  </span>
                </div>
              </div>
            </div>

              </>
            )}

            {/* Grille des Cartes par Semaine : Montants en Attente (Lié aux filtres) */}
            <div className="mt-6 pt-5 border-t border-amber-300/60">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                  <Clock size={16} className="text-amber-600" />
                  Détail du Total en Attente par Semaine :
                </h5>
                <span className="text-xs font-bold text-amber-800 bg-amber-200/60 px-2.5 py-0.5 rounded-full">
                  {pendingWeeks.length} semaine(s) concernée(s)
                </span>
              </div>

              {pendingWeeks.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pendingWeeks.map(weekSummary => (
                      <div
                        key={weekSummary.semaine}
                        onClick={() => {
                          setSemaine(weekSummary.semaine);
                          setStatutFilter('en_attente');
                        }}
                        className={`relative overflow-hidden rounded-2xl p-5 min-h-[180px] transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border-2 shadow-md flex flex-col justify-between group ${
                          weekSummary.isSelected
                            ? 'bg-gradient-to-br from-amber-600 via-orange-500 to-amber-700 text-white border-amber-300 shadow-orange-500/25 scale-[1.02] ring-4 ring-amber-400/30'
                            : 'bg-white/95 hover:bg-white text-gray-900 border-amber-300/80 shadow-amber-500/5 hover:border-amber-500 hover:shadow-lg'
                        }`}
                      >
                      {/* Top Badge & Week Title */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                            weekSummary.isSelected
                              ? 'bg-white/20 text-white border border-white/30'
                              : 'bg-amber-100 text-amber-900 border border-amber-200 font-mono'
                          }`}>
                            {weekSummary.semaine}
                          </span>
                          {weekSummary.isSelected ? (
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full text-amber-100">
                              <Sparkles size={11} className="animate-pulse text-amber-300" /> Semaine affichée
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Cliquer pour voir
                            </span>
                          )}
                        </div>

                        <h6 className={`font-black text-sm leading-snug mt-2 ${
                          weekSummary.isSelected ? 'text-white' : 'text-gray-900'
                        }`}>
                          {weekSummary.intervalle || weekSummary.label}
                        </h6>

                        {weekSummary.sites.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {weekSummary.sites.map(s => (
                              <span key={s} className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 uppercase ${
                                weekSummary.isSelected ? 'bg-amber-900/40 text-amber-100' : 'bg-gray-100 text-gray-700 border border-gray-200'
                              }`}>
                                <Building2 size={10} /> {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Main Amount & Worker Count */}
                      <div className="mt-4 pt-3 border-t border-current/15 flex items-end justify-between gap-2">
                        <div>
                          <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-0.5 ${
                            weekSummary.isSelected ? 'text-amber-100' : 'text-amber-800'
                          }`}>
                            Montant en Attente
                          </span>
                          <span className={`text-lg font-black font-mono tracking-tight ${
                            weekSummary.isSelected ? 'text-white' : 'text-amber-600 group-hover:text-amber-700'
                          }`}>
                            {formatCurrency(weekSummary.pendingAmount)}
                          </span>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-0.5 ${
                            weekSummary.isSelected ? 'text-amber-100' : 'text-gray-500'
                          }`}>
                            En Attente
                          </span>
                          <span className={`text-xs font-black px-2.5 py-1 rounded-xl block ${
                            weekSummary.pendingWorkersCount > 0
                              ? weekSummary.isSelected
                                ? 'bg-white text-amber-600 shadow-sm'
                                : 'bg-amber-100 text-amber-950 group-hover:bg-amber-200'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {weekSummary.pendingWorkersCount} <span className="text-[10px] font-semibold opacity-75">/ {weekSummary.totalWorkersCount} ouv.</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-amber-300/40">
              <span className="text-xs font-black text-amber-950 mr-2 flex items-center gap-1">
                <Filter size={14} className="text-amber-600" /> Affichage du tableau :
              </span>
              <button
                onClick={() => setStatutFilter('en_attente')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-xs ${
                  statutFilter === 'en_attente'
                    ? 'bg-amber-600 text-white shadow-md scale-105 ring-2 ring-amber-400'
                    : 'bg-white/90 text-amber-900 hover:bg-amber-100 border border-amber-300'
                }`}
              >
                <Clock size={14} /> ⏳ En attente / Non effectués ({calculatedPaie.filter(p => !p.deja_paye).length})
              </button>

              <button
                onClick={() => setStatutFilter('tous')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-xs ${
                  statutFilter === 'tous'
                    ? 'bg-gray-900 text-white shadow-md scale-105 ring-2 ring-gray-400'
                    : 'bg-white/90 text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                📑 Tous les salaires ({calculatedPaie.length})
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                <FileText className="text-emerald-600" size={20} />
                Synthèse détaillée des salaires — Semaine {semaine} ({displayedPaie.length} affichés sur {calculatedPaie.length})
              </h3>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-extrabold rounded-full text-xs">
                {statutFilter === 'en_attente' ? '⏳ Paiements en attente' : statutFilter === 'regles' ? '✅ Paiements réglés' : 'Prêt pour versement'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                    <th className="py-4 px-3">Ouvrier</th>
                    <th className="py-4 px-3">Qualification / Site</th>
                    <th className="py-4 px-3 text-center">Date</th>
                    <th className="py-4 px-3 text-center">Période (Intervalle)</th>
                    <th className="py-4 px-3 text-right">Salaire Brut</th>
                    <th className="py-4 px-3 text-right text-amber-700 bg-amber-50/50">Heures Sup</th>
                    <th className="py-4 px-3 text-right" title="Montant total des cotisations / ponctions EPI accumulées">Caution EPI (Cumul)</th>
                    <th className="py-4 px-3 text-right">Loyer</th>
                    <th className="py-4 px-3 text-right">Remb. EPI</th>
                    <th className="py-4 px-3 text-right" title="Retenue EPI de la semaine">Retenue Semaine</th>
                    <th className="py-4 px-4 text-right font-black text-emerald-900">Net à Payer</th>
                    <th className="py-4 px-3">Transfert Mobile Money</th>
                    <th className="py-4 px-3 text-center">Statut Virement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedPaie.length === 0 ? (
                    <tr>
                      <td colSpan="14" className="py-12 text-center text-gray-400 font-bold text-sm">
                        Aucun paiement trouvé pour le filtre sélectionné ({statutFilter === 'en_attente' ? 'Aucun paiement en attente / non effectué' : 'Aucune donnée'}).
                      </td>
                    </tr>
                  ) : (
                    displayedPaie.map((paie) => {
                      const origIndex = calculatedPaie.indexOf(paie);
                      return (
                    <tr key={paie.pointage_id || paie.ouvrier_id || origIndex} className={`transition-colors border-b border-gray-100 ${paie.deja_paye ? 'bg-emerald-50/30 hover:bg-emerald-100/50' : 'bg-red-50/40 hover:bg-red-100/60'}`}>
                      <td className="py-3.5 px-3 font-black text-gray-900 text-sm">
                        {paie.nom} {paie.prenom}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-gray-600">
                        <span className="text-indigo-600 block">{paie.qualification || '-'}</span>
                        <span className="text-[11px] text-gray-400 uppercase">{paie.site || '-'}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-gray-800 font-mono text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                          <Calendar size={12} className="text-emerald-600" />
                          {formatDate(paie.date_pointage || paie.date)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-gray-700 text-[11px] whitespace-nowrap">
                        <span className="bg-amber-50/80 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-200 font-extrabold block">
                          {getIntervaleSemaine(paie.semaine, paie.date_pointage || paie.date, paie.date_debut, paie.date_fin)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-gray-700">
                        {formatCurrency(paie.salaire_brut)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-black text-amber-700 bg-amber-50/30">
                        {paie.heures_sup > 0 ? `+${formatCurrency(paie.heures_sup)}` : <span className="text-gray-400 font-normal">-</span>}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold">
                        {paie.total_cotisations_epi > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className={Number(paie.total_cotisations_epi) >= Number(paie.epi_limit) && Number(paie.epi_limit) > 0 ? "text-emerald-700 font-black text-xs" : "text-amber-700 font-black text-xs"}>
                              {formatCurrency(paie.total_cotisations_epi)}
                            </span>
                            {paie.epi_limit > 0 && (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black mt-1 ${
                                Number(paie.total_cotisations_epi) >= Number(paie.epi_limit)
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}>
                                {Number(paie.total_cotisations_epi) >= Number(paie.epi_limit) ? '✓ Soldé' : '⏳ En cours'} ({formatCurrency(paie.epi_limit)})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className={`py-3.5 px-3 text-right font-mono font-bold ${paie.loyer > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {paie.loyer > 0 ? `-${formatCurrency(paie.loyer)}` : '-'}
                      </td>
                      <td className={`py-3.5 px-3 text-right font-mono font-bold ${paie.epi_remboursement > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {paie.epi_remboursement > 0 ? `+${formatCurrency(paie.epi_remboursement)}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {paie.epi_deduction > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="text-red-600 font-black text-sm">
                              -{formatCurrency(paie.epi_deduction)}
                            </span>
                            <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-extrabold mt-0.5" title="Déduction sur EPI (Départ, perte ou non retourné)">
                              Départ / Perte
                            </span>
                          </div>
                        ) : paie.ponction > 0 ? (
                          paie.deja_paye ? (
                            <div className="flex flex-col items-end">
                              <span className="text-red-600 font-black text-sm">
                                -{formatCurrency(paie.ponction)}
                              </span>
                              <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-extrabold mt-0.5" title="Retenue hebdomadaire sur caution EPI">
                                Retenue Hebdo
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-red-600 font-black text-sm">-</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="500"
                                  value={paie.ponction}
                                  onChange={(e) => handlePonctionChange(origIndex, e.target.value)}
                                  className="w-20 px-2 py-1 bg-red-50 border border-red-300 rounded-lg text-right font-mono font-black text-red-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 shadow-inner text-xs"
                                  title="Déduction / Retenue modifiable manuellement"
                                />
                              </div>
                              {paie.has_existing_ponction && !paie.is_custom_ponction ? (
                                <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-extrabold" title="Retenue issue des saisies sur la page Ponctions">
                                  Saisi
                                </span>
                              ) : (
                                <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-extrabold" title="Retenue hebdomadaire sur caution EPI">
                                  Retenue Hebdo
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <span
                            className="text-gray-400 font-bold cursor-pointer hover:text-red-600 transition-colors inline-block py-1 px-2"
                            title={!paie.deja_paye ? "Cliquez pour ajouter manuellement une déduction EPI" : "Aucune déduction EPI"}
                            onClick={() => !paie.deja_paye && handlePonctionChange(origIndex, getDynamicWeeklyDeduction(paie.ouvrier_id))}
                          >
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 text-sm bg-emerald-50/40">
                        {formatCurrency(paie.net_a_payer)}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-xs border ${
                          paie.operateur?.toLowerCase().includes('wave') ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          paie.operateur?.toLowerCase().includes('orange') ? 'bg-orange-50 text-orange-800 border-orange-200' :
                          paie.operateur?.toLowerCase().includes('mtn') ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-indigo-50 text-indigo-800 border-indigo-200'
                        }`} title="Numéro sur lequel effectuer le transfert de la paie">
                          <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-white shadow-2xs">
                            {paie.operateur || 'MM'}
                          </span>
                          <span className="tracking-wider text-sm font-black">
                            {paie.numero_mobile_money || 'Non renseigné'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {paie.deja_paye ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-sm" title="Paie déjà clôturée et enregistrée en base">
                            <CheckCircle2 size={13} className="text-emerald-700" strokeWidth={3} /> Déjà Réglé & Enregistré
                          </span>
                        ) : paie.paye ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                            <Check size={13} strokeWidth={3} /> Prêt à enregistrer
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock size={13} /> Non réglé
                          </span>
                        )}
                      </td>
                    </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
