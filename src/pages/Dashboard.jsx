import { apiFetch } from '../lib/api';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, FileText, Shield, Building2, Wallet, TrendingDown, 
  ArrowRight, Calendar, Clock, Activity, RefreshCw, Layers, 
  CheckCircle2, AlertCircle, TrendingUp, Sparkles, Award, HardHat,
  MapPin, ArrowUpRight, DollarSign, ShieldCheck, Filter, Search, X
} from 'lucide-react';
import { formatCurrency, formatDate, formatWeekLabel } from '../lib/utils';
import gebatLogo from '../assets/logo_gebat.png';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    ouvriers_actifs: 0,
    pointages_semaine: 0,
    ponctions_semaine: 0,
    loyers_mois: 0,
    total_a_payer: 0,
    total_retenues: 0,
  });
  const [ouvriers, setOuvriers] = useState([]);
  const [paies, setPaies] = useState([]);
  const [ponctions, setPonctions] = useState([]);
  const [pointages, setPointages] = useState([]);
  const [loyers, setLoyers] = useState([]);
  const [paiementsLoyer, setPaiementsLoyer] = useState([]);
  const [settings, setSettings] = useState({
    epi_limits: {
      'Bingerville': 12000,
      'Songon': 9000,
    },
    epi_weekly_deduction: 3000,
  });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedSite, setSelectedSite] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedQualification, setSelectedQualification] = useState('ALL');
  const [selectedSemaine, setSelectedSemaine] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAllDashboardData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAllDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, ouvriersRes, paiesRes, ponctionsRes, pointagesRes, loyersRes, paiementsRes] = await Promise.all([
        apiFetch('/api/stats'),
        apiFetch('/api/ouvriers'),
        apiFetch('/api/paies'),
        apiFetch('/api/ponctions'),
        apiFetch('/api/pointages'),
        apiFetch('/api/loyers'),
        apiFetch('/api/paiements-loyer'),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (ouvriersRes.ok) setOuvriers(await ouvriersRes.json());
      if (paiesRes.ok) setPaies(await paiesRes.json());
      if (ponctionsRes.ok) setPonctions(await ponctionsRes.json());
      if (pointagesRes.ok) {
        const pts = await pointagesRes.json();
        setPointages(pts);
        let synced = false;
        try {
          const savedMetaStr = localStorage.getItem('gebat_last_import_meta');
          if (savedMetaStr) {
            const savedMeta = JSON.parse(savedMetaStr);
            if (savedMeta.semaine) {
              setSelectedSemaine(savedMeta.semaine);
              synced = true;
            }
            if (savedMeta.site) {
              setSelectedSite(savedMeta.site);
            }
          }
        } catch (e) {}
        if (!synced && pts && pts.length > 0) {
          const sortedPts = [...pts].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
          if (sortedPts[0] && sortedPts[0].semaine) {
            setSelectedSemaine(sortedPts[0].semaine);
          }
        }
      }
      if (loyersRes.ok) setLoyers(await loyersRes.json());
      if (paiementsRes.ok) setPaiementsLoyer(await paiementsRes.json());

      try {
        const savedSettings = localStorage.getItem('easypaie_settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (parsed.epi_limit && !parsed.epi_limits) {
            parsed.epi_limits = { 'Bingerville': 12000, 'Songon': 9000 };
            delete parsed.epi_limit;
          }
          setSettings(parsed);
        }
      } catch (e) {}
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Analytics Computed from real data and filters
  const sitesList = useMemo(() => {
    const set = new Set(ouvriers.map(o => o.site || 'Non spécifié').filter(Boolean));
    return Array.from(set).sort();
  }, [ouvriers]);

  const qualificationsList = useMemo(() => {
    const set = new Set(ouvriers.map(o => o.qualification || 'Non spécifié').filter(Boolean));
    return Array.from(set).sort();
  }, [ouvriers]);

  const weeksList = useMemo(() => {
    const set = new Set([
      ...pointages.map(p => p.semaine),
      ...paies.map(p => p.semaine),
      ...ponctions.map(p => p.semaine)
    ].filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [pointages, paies, ponctions]);

  const filteredOuvriers = useMemo(() => {
    return ouvriers.filter(o => {
      const matchesSite = selectedSite === 'ALL' || (o.site || 'Non spécifié') === selectedSite;
      const matchesStatus = selectedStatus === 'ALL' || (o.statut || 'actif') === selectedStatus;
      const matchesQual = selectedQualification === 'ALL' || (o.qualification || 'Non spécifié') === selectedQualification;
      const matchesSearch = !searchTerm || (
        o.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.matricule?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.qualification?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return matchesSite && matchesStatus && matchesQual && matchesSearch;
    });
  }, [ouvriers, selectedSite, selectedStatus, selectedQualification, searchTerm]);

  const filteredPaies = useMemo(() => {
    return paies.filter(p => {
      const worker = ouvriers.find(o => o.id === p.ouvrier_id || o.id === p.id_ouvrier);
      const workerSite = p.site || worker?.site || 'Non spécifié';
      const workerStatus = worker?.statut || 'actif';
      const workerQual = p.qualification || worker?.qualification || 'Non spécifié';
      const matchesSite = selectedSite === 'ALL' || workerSite === selectedSite;
      const matchesStatus = selectedStatus === 'ALL' || workerStatus === selectedStatus;
      const matchesQual = selectedQualification === 'ALL' || workerQual === selectedQualification;
      const matchesWeek = !selectedSemaine || String(p.semaine || '').trim().toLowerCase() === String(selectedSemaine).trim().toLowerCase();
      const matchesSearch = !searchTerm || (
        worker?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        worker?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.prenom?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return matchesSite && matchesStatus && matchesQual && matchesWeek && matchesSearch;
    });
  }, [paies, ouvriers, selectedSite, selectedStatus, selectedQualification, selectedSemaine, searchTerm]);

  const filteredPonctions = useMemo(() => {
    return ponctions.filter(p => {
      const worker = ouvriers.find(o => o.id === p.ouvrier_id);
      const workerSite = worker?.site || 'Non spécifié';
      const workerStatus = worker?.statut || 'actif';
      const workerQual = worker?.qualification || 'Non spécifié';
      const matchesSite = selectedSite === 'ALL' || workerSite === selectedSite;
      const matchesStatus = selectedStatus === 'ALL' || workerStatus === selectedStatus;
      const matchesQual = selectedQualification === 'ALL' || workerQual === selectedQualification;
      const matchesWeek = !selectedSemaine || String(p.semaine || '').trim().toLowerCase() === String(selectedSemaine).trim().toLowerCase();
      const matchesSearch = !searchTerm || (
        worker?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        worker?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.motif?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return matchesSite && matchesStatus && matchesQual && matchesWeek && matchesSearch;
    });
  }, [ponctions, ouvriers, selectedSite, selectedStatus, selectedQualification, selectedSemaine, searchTerm]);

  const siteBreakdown = useMemo(() => {
    return filteredOuvriers.reduce((acc, o) => {
      const site = o.site || 'Non spécifié';
      acc[site] = (acc[site] || 0) + 1;
      return acc;
    }, {});
  }, [filteredOuvriers]);

  const qualificationBreakdown = useMemo(() => {
    return filteredOuvriers.reduce((acc, o) => {
      const qual = o.qualification || 'Autre';
      acc[qual] = (acc[qual] || 0) + 1;
      return acc;
    }, {});
  }, [filteredOuvriers]);

  const topQualifications = useMemo(() => {
    return Object.entries(qualificationBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [qualificationBreakdown]);

  const totalPonctionsCollected = useMemo(() => {
    return filteredPonctions.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  }, [filteredPonctions]);

  const getEpiLimit = (site) => {
    const siteLow = String(site || '').toLowerCase();
    if (!settings || !settings.epi_limits) return 9000;
    if (siteLow.includes('bingerville') || siteLow.includes('bengerville')) return Number(settings.epi_limits['Bingerville']) || 12000;
    if (siteLow.includes('songon')) return Number(settings.epi_limits['Songon']) || 9000;
    return Number(settings.epi_limits[site]) || 9000;
  };

  const calculateLoyer = (ouvrierId) => {
    const payDate = new Date();
    const currentMonth = payDate.toLocaleString('fr-FR', { month: 'long' }).toLowerCase();
    const currentYear = payDate.getFullYear();

    const loyer = loyers.find(
      l => Number(l.ouvrier_id) === Number(ouvrierId) &&
           l.mois?.toLowerCase() === currentMonth &&
           Number(l.annee) === currentYear
    );
    if (!loyer) return 0;
    
    const payment = paiementsLoyer.find(
      p => Number(p.ouvrier_id) === Number(ouvrierId) && 
           p.mois?.toLowerCase() === currentMonth && 
           Number(p.annee) === currentYear
    );
    return payment ? 0 : (Number(loyer.montant_mensuel) || 0);
  };

  const calculatePonction = (ouvrierId, salaireBrut = 0, pointageDate = null) => {
    const worker = ouvriers.find(o => Number(o.id) === Number(ouvrierId));
    const site = worker?.site || '';
    const epiLimit = getEpiLimit(site);
    const workerPonctions = ponctions.filter(p => Number(p.ouvrier_id) === Number(ouvrierId) && !p.motif?.includes('Complément caution (Départ') && !p.motif?.includes('EPI non retournés') && !p.motif?.includes('EPI perdus'));
    const totalPaid = workerPonctions.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);

    if (worker && worker.statut === 'parti') {
      return { montant: 0, has_existing: false, existing_id: null, totalPaid, epiLimit };
    }

    const existingPeriodPonction = ponctions.find(p => {
      if (Number(p.ouvrier_id) !== Number(ouvrierId)) return false;
      const pDate = String(p.date || '').split('T')[0];
      if (pointageDate && pDate === String(pointageDate).split('T')[0]) return true;
      return false;
    });

    if (existingPeriodPonction && existingPeriodPonction.montant !== undefined) {
      return { montant: Number(existingPeriodPonction.montant) || 0, has_existing: true, existing_id: existingPeriodPonction.id, totalPaid, epiLimit };
    }

    return { montant: 0, has_existing: false, existing_id: null, totalPaid, epiLimit };
  };

  const calculatedPaieList = useMemo(() => {
    let savedMeta = null;
    try {
      const savedMetaStr = localStorage.getItem('gebat_last_import_meta');
      if (savedMetaStr) savedMeta = JSON.parse(savedMetaStr);
    } catch (e) {}
    const importedWorkerIds = savedMeta && Array.isArray(savedMeta.workerIds) ? savedMeta.workerIds : null;

    const isRecordInCurrentSelection = (p) => {
      if (!p) return false;
      if (!selectedSemaine) return true;
      const pSem = String(p.semaine || '').trim().toLowerCase();
      const selSem = String(selectedSemaine || '').trim().toLowerCase();
      return pSem && (pSem === selSem || pSem.includes(selSem) || selSem.includes(pSem));
    };

    const hasWeekData = pointages.some(p => isRecordInCurrentSelection(p)) ||
                        paies.some(p => isRecordInCurrentSelection(p)) ||
                        Boolean(selectedSemaine && importedWorkerIds && importedWorkerIds.length > 0);

    const targetOuvriers = ouvriers.filter(o => {
      if (o.statut === 'parti' && o.epi_settled) return false;
      if (selectedSite && selectedSite !== 'ALL') {
        const oSite = String(o.site || '').trim().toLowerCase();
        const sFilter = String(selectedSite).trim().toLowerCase();
        const hasPointageOnSiteThisWeek = pointages.some(p => Number(p.ouvrier_id) === Number(o.id) && isRecordInCurrentSelection(p) && String(p.site || '').trim().toLowerCase() === sFilter);
        const isPartOfSiteImport = importedWorkerIds && importedWorkerIds.includes(Number(o.id)) && savedMeta && String(savedMeta.site || '').trim().toLowerCase() === sFilter;
        if (oSite !== sFilter && !hasPointageOnSiteThisWeek && !isPartOfSiteImport) {
          return false;
        }
      }
      if (selectedStatus && selectedStatus !== 'ALL' && o.statut !== selectedStatus) return false;
      if (selectedQualification && selectedQualification !== 'ALL' && String(o.qualification || '').trim().toLowerCase() !== String(selectedQualification).trim().toLowerCase()) return false;
      if (searchTerm) {
        const matchesSearch = o?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              o?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              o?.qualification?.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
      }
      
      if (selectedSemaine && hasWeekData) {
        const hasPointageThisWeek = pointages.some(p => Number(p.ouvrier_id) === Number(o.id) && isRecordInCurrentSelection(p));
        const hasPaieThisWeek = paies.some(p => Number(p.ouvrier_id) === Number(o.id) && isRecordInCurrentSelection(p));
        const isPartOfImport = importedWorkerIds && importedWorkerIds.includes(Number(o.id));
        if (!hasPointageThisWeek && !hasPaieThisWeek && !isPartOfImport) {
          return false;
        }
      }
      return true;
    });

    return targetOuvriers.map((ouvrier) => {
      const currentWeekPointage = pointages.find(p => 
        Number(p.ouvrier_id) === Number(ouvrier.id) && isRecordInCurrentSelection(p)
      );
      const existingPaie = paies.find(p => 
        Number(p.ouvrier_id) === Number(ouvrier.id) && isRecordInCurrentSelection(p)
      );
      const isPaidLocked = Boolean(existingPaie && existingPaie.paye === true);

      let salaireBrut = isPaidLocked && existingPaie.salaire_brut !== undefined 
        ? Number(existingPaie.salaire_brut) 
        : (currentWeekPointage ? (Number(currentWeekPointage.salaire_brut) || 0) : 0);

      if (!isPaidLocked && salaireBrut === 0 && !hasWeekData) {
        const latestPointage = pointages
          .filter(p => Number(p.ouvrier_id) === Number(ouvrier.id) && Number(p.salaire_brut) > 0)
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
          
        if (latestPointage) {
          salaireBrut = Number(latestPointage.salaire_brut) || 0;
        } else if (Number(ouvrier.salaire_base) > 0) {
          salaireBrut = Number(ouvrier.salaire_base);
        } else {
          const qualUpper = String(ouvrier?.qualification || '').trim().toUpperCase();
          const isAide = qualUpper.includes('AIDE');
          salaireBrut = isAide ? 27000 : 45000;
        }
      }


      const fullCalc = calculatePonction(ouvrier.id, salaireBrut, currentWeekPointage ? currentWeekPointage.date : null);
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
        if (calcPonctionResult.montant === 0 && existingPaie && Number(existingPaie.ponction) > 0) {
          calcPonctionResult = { 
            montant: Number(existingPaie.ponction), 
            has_existing: Boolean(existingPaie.has_existing_ponction), 
            existing_id: existingPaie.existing_ponction_id || null,
            totalPaid: fullCalc.totalPaid || Number(existingPaie.total_cotisations_epi) || 0,
            epiLimit: fullCalc.epiLimit || Number(existingPaie.epi_limit) || 0
          };
        }
      }
      const ponctionAmount = calcPonctionResult.montant;
      const loyerAmount = isPaidLocked && existingPaie.loyer !== undefined ? Number(existingPaie.loyer) : calculateLoyer(ouvrier.id);
      
      let epiRemboursement = 0;
      let epiDeduction = 0;
      let epiDepartureOption = '';
      
      if (isPaidLocked) {
        epiRemboursement = Number(existingPaie?.epi_remboursement || 0);
        epiDeduction = Number(existingPaie?.epi_deduction || 0);
        epiDepartureOption = existingPaie?.epi_departure_option || ouvrier.epi_departure_option || '';
        if (epiDepartureOption === 'epi_non_retourne') {
          epiRemboursement = 0;
          epiDeduction = 0;
        }
      } else if (ouvrier.statut === 'parti' && !ouvrier.epi_settled) {
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
      
      const netAPayer = isPaidLocked && existingPaie.net_a_payer !== undefined 
        ? Number(existingPaie.net_a_payer) 
        : (Number(salaireBrut) || 0) - (Number(ponctionAmount) || 0) - (Number(loyerAmount) || 0) + (Number(epiRemboursement) || 0) - (Number(epiDeduction) || 0);

      return {
        id: existingPaie ? existingPaie.id : `calc-${ouvrier.id}`,
        ouvrier_id: ouvrier.id,
        nom: ouvrier.nom || '',
        prenom: ouvrier.prenom || '',
        site: currentWeekPointage?.site || ouvrier.site || '',
        semaine: currentWeekPointage?.semaine || existingPaie?.semaine || selectedSemaine || '',
        date: currentWeekPointage?.date || existingPaie?.date || new Date().toISOString().split('T')[0],
        pointage_id: currentWeekPointage ? currentWeekPointage.id : null,
        salaire_brut: salaireBrut,
        ponction: ponctionAmount,
        loyer: loyerAmount,
        epi_remboursement: epiRemboursement,
        epi_deduction: epiDeduction,
        epi_departure_option: epiDepartureOption,
        net_a_payer: netAPayer,
        total_cotisations_epi: (Number(calcPonctionResult.totalPaid) || 0) + (calcPonctionResult.has_existing ? 0 : Number(ponctionAmount || 0)),
        is_paid: isPaidLocked,
        paye: isPaidLocked
      };
    });
  }, [ouvriers, pointages, paies, ponctions, loyers, paiementsLoyer, selectedSite, selectedStatus, selectedQualification, selectedSemaine, searchTerm, settings]);

  const recentPaies = useMemo(() => {
    const list = calculatedPaieList.length > 0 ? calculatedPaieList : filteredPaies;
    return [...list].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5);
  }, [calculatedPaieList, filteredPaies]);

  const totalPonctionsSemaine = useMemo(() => {
    return calculatedPaieList.reduce((sum, p) => sum + (Number(p.ponction) || 0), 0);
  }, [calculatedPaieList]);

  const totalLoyersSemaine = useMemo(() => {
    return calculatedPaieList.reduce((sum, p) => sum + (Number(p.loyer) || 0), 0);
  }, [calculatedPaieList]);

  const totalNetAPayerSemaine = useMemo(() => {
    return calculatedPaieList.reduce((sum, p) => sum + (Number(p.net_a_payer) || 0), 0);
  }, [calculatedPaieList]);

  const totalDedEpiGainVal = useMemo(() => {
    return calculatedPaieList.reduce((sum, p) => {
      let val = 0;
      if (p.epi_departure_option === 'epi_non_retourne') {
        val = Number(p.total_cotisations_epi || 0);
      } else if (Number(p.epi_deduction) > 0) {
        val = Number(p.epi_deduction);
      } else if (Number(p.ponction) > 0 && p.is_paid) {
        val = Number(p.ponction);
      }
      return sum + val;
    }, 0);
  }, [calculatedPaieList]);

  const hasActiveFilters = Boolean(
    selectedSemaine ||
    (selectedSite && selectedSite !== 'ALL') ||
    (selectedQualification && selectedQualification !== 'ALL') ||
    (selectedStatus && selectedStatus !== 'ALL') ||
    searchTerm
  );

  const statCards = [
    {
      title: 'Ouvriers Actifs',
      value: filteredOuvriers.filter(o => o.statut === 'actif').length,
      subtitle: `${filteredOuvriers.length} ouvriers au filtre (${ouvriers.length} total)`,
      icon: Users,
      gradient: 'from-blue-600 to-indigo-600',
      bgColor: 'bg-blue-50/70',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
    },
    {
      title: 'Pointages Semaine',
      value: calculatedPaieList.length,
      subtitle: selectedSemaine ? `Fiches calculées pour ${selectedSemaine}` : 'Fiches de présence traitées',
      icon: FileText,
      gradient: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-50/70',
      textColor: 'text-emerald-700',
      borderColor: 'border-emerald-200',
    },
    {
      title: 'Ponctions EPI (Semaine)',
      value: formatCurrency(totalPonctionsSemaine),
      subtitle: `Cumul global : ${formatCurrency(totalPonctionsCollected)}`,
      icon: Shield,
      gradient: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-50/70',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-200',
    },
    {
      title: 'Loyers (Mois en cours)',
      value: formatCurrency(totalLoyersSemaine),
      subtitle: 'Règlements d\'hébergement',
      icon: Building2,
      gradient: 'from-purple-600 to-indigo-600',
      bgColor: 'bg-purple-50/70',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-200',
    },
    {
      title: 'Total Net à Payer',
      value: formatCurrency(totalNetAPayerSemaine),
      subtitle: 'Encours de versement global',
      icon: Wallet,
      gradient: 'from-emerald-700 to-teal-900',
      bgColor: 'bg-gradient-to-br from-emerald-900 to-teal-950 text-white',
      textColor: 'text-white',
      borderColor: 'border-emerald-600',
      isMaster: true,
    },
    {
      title: 'Déductions EPI (Gain)',
      value: totalDedEpiGainVal > 0 ? `+ ${formatCurrency(totalDedEpiGainVal)}` : formatCurrency(0),
      subtitle: 'EPI non retournés / perdus',
      isGain: true,
      icon: ShieldCheck,
      gradient: 'from-teal-600 to-cyan-700',
      bgColor: 'bg-gradient-to-br from-teal-50 to-cyan-50/80',
      textColor: 'text-teal-800 font-mono font-black',
      borderColor: 'border-teal-200',
    },
  ];

  const quickActions = [
    {
      title: 'Convertir Fiche Pointage (.xls)',
      description: 'Lisez le pointage brut et exportez au format Songon',
      icon: RefreshCw,
      href: '/conversion',
      color: 'from-indigo-600 to-blue-600',
    },
    {
      title: 'Importer Pointage Chantier',
      description: 'Intégrez les présences de la semaine en base de données',
      icon: FileText,
      href: '/import-pointage',
      color: 'from-emerald-600 to-teal-600',
    },
    {
      title: 'Lancer le Calcul de Paie',
      description: 'Générez automatiquement le net à payer et les virements',
      icon: Wallet,
      href: '/calcul-paie',
      color: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Gestion des Ouvriers',
      description: 'Consultez les statuts, contrats et plafonds de caution',
      icon: Users,
      href: '/ouvriers',
      color: 'from-purple-600 to-indigo-600',
    },
    {
      title: 'Suivi & Ponctions EPI',
      description: 'Contrôlez les retenues hebdomadaires sur équipements',
      icon: Shield,
      href: '/ponctions',
      color: 'from-blue-600 to-cyan-600',
    },
    {
      title: 'Loyers d\'Hébergement',
      description: 'Enregistrez et suivez les quittances mensuelles',
      icon: Building2,
      href: '/loyers',
      color: 'from-rose-600 to-red-600',
    },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Executive Hero Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-950 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-indigo-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="hidden sm:block p-3.5 bg-transparent">
              <img src={gebatLogo} alt="GEBAT" className="w-20 h-20 object-contain drop-shadow-[0_2px_12px_rgba(255,255,255,0.6)]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2.5">
                <span className="px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[11px] font-black rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                  <Sparkles size={13} /> Cockpit & Direction Générale
                </span>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black rounded-full uppercase tracking-wider">
                  Système Connecté
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
                Tableau de Bord GEBAT
              </h1>
              <p className="text-indigo-100 mt-2 max-w-2xl text-sm md:text-base leading-relaxed font-normal">
                Supervision temps réel de la main-d'œuvre, des pointages chantiers et de l'automatisation financière des salaires.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex flex-col text-right pr-2">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 justify-end">
                <Calendar size={13} /> {formatDate(currentTime)}
              </span>
              <span className="text-lg font-black text-amber-400 font-mono flex items-center gap-1.5 justify-end mt-0.5">
                <Clock size={16} /> {currentTime.toLocaleTimeString('fr-FR')}
              </span>
            </div>
            <button
              onClick={fetchAllDashboardData}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs font-extrabold"
              title="Rafraîchir les statistiques en temps réel"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Executive Cockpit Filter & Search Bar - Amélioré comme la page Calcul Paie */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md flex-shrink-0">
              <Filter size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
                Paramètres de la Période & Filtrage Chantier / Cockpit
              </h3>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">
                Isolez et analysez instantanément les indicateurs, les coûts et la main-d'œuvre par chantier, métier ou semaine.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-full">
              {filteredOuvriers.length} ouvrier(s) sur {ouvriers.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {/* Numéro de Semaine */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" /> Semaine / Période
            </label>
            <select
              value={selectedSemaine}
              onChange={(e) => setSelectedSemaine(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all cursor-pointer"
            >
              <option value="">📅 Toutes les Semaines ({weeksList.length})</option>
              {weeksList.map((w) => (
                <option key={w} value={w}>{formatWeekLabel(w, paies)}</option>
              ))}
            </select>
          </div>

          {/* Site Filter Dropdown */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Building2 size={14} className="text-indigo-600" /> Filtrer par Chantier
            </label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-blue-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all cursor-pointer"
            >
              <option value="ALL">🏢 Tous les Chantiers ({sitesList.length})</option>
              {sitesList.map(site => (
                <option key={site} value={site}>📍 {site}</option>
              ))}
            </select>
          </div>

          {/* Qualification Filter */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <HardHat size={14} className="text-purple-600" /> Qualification / Métier
            </label>
            <select
              value={selectedQualification}
              onChange={(e) => setSelectedQualification(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-purple-950 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all cursor-pointer"
            >
              <option value="ALL">👷 Toutes Qualifications ({qualificationsList.length})</option>
              {qualificationsList.map(qual => (
                <option key={qual} value={qual}>{qual}</option>
              ))}
            </select>
          </div>

          {/* Status Filter Dropdown */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Users size={14} className="text-emerald-600" /> Statut Ouvrier
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-emerald-950 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all cursor-pointer"
            >
              <option value="ALL">👥 Tous Statuts ({ouvriers.length})</option>
              <option value="actif">🟢 Actifs ({ouvriers.filter(o => o.statut === 'actif').length})</option>
              <option value="parti">🔴 Sortis/Partis ({ouvriers.filter(o => o.statut === 'parti').length})</option>
            </select>
          </div>

          {/* Quick Search */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Search size={14} className="text-amber-600" /> Recherche Rapide
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Nom, matricule..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Active Filters Bar & Reset */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-gray-600 mr-1 flex items-center gap-1">
                <Filter size={13} className="text-blue-600" /> Filtres actifs :
              </span>
              {selectedSemaine && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-800 border border-blue-200">
                  Semaine: {selectedSemaine}
                  <button onClick={() => setSelectedSemaine('')} className="hover:text-red-600"><X size={13} /></button>
                </span>
              )}
              {selectedSite !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  Chantier: {selectedSite}
                  <button onClick={() => setSelectedSite('ALL')} className="hover:text-red-600"><X size={13} /></button>
                </span>
              )}
              {selectedQualification !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-purple-50 text-purple-800 border border-purple-200">
                  Qualif: {selectedQualification}
                  <button onClick={() => setSelectedQualification('ALL')} className="hover:text-red-600"><X size={13} /></button>
                </span>
              )}
              {selectedStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Statut: {selectedStatus.toUpperCase()}
                  <button onClick={() => setSelectedStatus('ALL')} className="hover:text-red-600"><X size={13} /></button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                  Recherche: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="hover:text-red-600"><X size={13} /></button>
                </span>
              )}
            </div>

            <button
              onClick={() => {
                setSelectedSemaine('');
                setSelectedSite('ALL');
                setSelectedQualification('ALL');
                setSelectedStatus('ALL');
                setSearchTerm('');
              }}
              className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors shadow-xs"
              title="Réinitialiser tous les filtres"
            >
              <X size={14} strokeWidth={3} /> Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* 6 Executive KPI Stat Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2.5">
            <Activity className="text-blue-600 stroke-[2.5]" size={22} />
            Indicateurs Clés de Performance {(selectedSite !== 'ALL' ? `(${selectedSite})` : '(Semaine & Mois)')}
          </h2>
          <span className="text-xs font-extrabold text-gray-400">
            Données actualisées en direct {selectedSite !== 'ALL' ? `- Filtre ${selectedSite}` : 'de la base SQL'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div 
                key={card.title} 
                className={`${card.bgColor} rounded-3xl p-6 border ${card.borderColor} shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col justify-between relative overflow-hidden group`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase tracking-wider ${card.isMaster ? 'text-amber-300' : (card.isGain ? 'text-teal-900' : 'text-gray-500')}`}>
                        {card.title}
                      </span>
                      {card.isGain && totalDedEpiGainVal > 0 && (
                        <span className="bg-teal-200/80 text-teal-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm">Gain</span>
                      )}
                    </div>
                    <div className={`text-3xl font-black mt-2 font-mono ${card.textColor}`}>
                      {card.value}
                    </div>
                  </div>
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${card.gradient} shadow-lg text-white group-hover:scale-110 transition-transform`}>
                    <Icon size={26} strokeWidth={2.5} />
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-200/50 flex items-center justify-between text-xs font-bold">
                  <span className={card.isMaster ? 'text-emerald-200' : (card.isGain ? 'text-teal-700' : 'text-gray-500')}>
                    {card.subtitle}
                  </span>
                  <ArrowUpRight size={16} className={card.isMaster ? 'text-amber-400' : (card.isGain ? 'text-teal-600' : 'text-gray-400')} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analytics Breakdown & Real-Time Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Répartition par Chantier */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                <MapPin className="text-indigo-600" size={18} />
                Répartition par Chantier
              </h3>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-extrabold rounded-lg text-xs">
                {Object.keys(siteBreakdown).length} sites
              </span>
            </div>

            <div className="space-y-4">
              {Object.entries(siteBreakdown).map(([site, count]) => {
                const percentage = Math.round((count / (filteredOuvriers.length || 1)) * 100);
                return (
                  <div key={site} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-extrabold">
                      <span className="text-gray-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span> {site}
                      </span>
                      <span className="text-gray-500">{count} ouvriers ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 rounded-full transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(siteBreakdown).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6 font-semibold">Aucun ouvrier correspondant au filtre.</p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">Effectif affiché</span>
            <span className="text-xs font-black text-indigo-600">{filteredOuvriers.length} collaborateurs</span>
          </div>
        </div>

        {/* Card 2: Top Qualifications & Métiers */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                <HardHat className="text-amber-600" size={18} />
                Qualifications & Métiers
              </h3>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-extrabold rounded-lg text-xs">
                Top 4 spécialités
              </span>
            </div>

            <div className="space-y-4">
              {topQualifications.map(([qual, count]) => {
                const percentage = Math.round((count / (filteredOuvriers.length || 1)) * 100);
                return (
                  <div key={qual} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-extrabold">
                      <span className="text-gray-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span> {qual}
                      </span>
                      <span className="text-gray-500">{count} ouvriers ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              {topQualifications.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6 font-semibold">Aucune qualification enregistrée.</p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">Taux d'activité</span>
            <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={14} /> {filteredOuvriers.length > 0 ? Math.round((filteredOuvriers.filter(o => o.statut === 'actif').length / filteredOuvriers.length) * 100) : 100}% opérationnels
            </span>
          </div>
        </div>

        {/* Card 3: Flux de Paie & Règlements Récents */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                <DollarSign className="text-emerald-600" size={18} />
                Dernières Paies Calculées
              </h3>
              <button 
                onClick={() => navigate('/historique')}
                className="text-xs font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                Tout voir <ArrowRight size={13} />
              </button>
            </div>

            <div className="space-y-3">
              {recentPaies.map((paie) => (
                <div key={paie.id} className="flex items-center justify-between p-3 bg-gray-50/80 rounded-xl border border-gray-100 hover:bg-emerald-50/40 transition-colors">
                  <div>
                    <div className="font-black text-xs text-gray-900">{paie.nom} {paie.prenom}</div>
                    <div className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">
                      Semaine {paie.semaine || '-'} • {formatDate(paie.date)} {paie.site ? `• ${paie.site}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-black text-xs text-emerald-600">{formatCurrency(paie.net_a_payer)}</div>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase mt-0.5 ${paie.paye ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {paie.paye ? '✓ Payé' : 'Non réglé'}
                    </span>
                  </div>
                </div>
              ))}
              {recentPaies.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8 font-semibold">Aucun bulletin pour cette sélection.</p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">Total bulletins affichés</span>
            <span className="text-xs font-black text-gray-700">{filteredPaies.length} fiches</span>
          </div>
        </div>
      </div>

      {/* Interactive Quick Actions Grid */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Layers className="text-blue-600" size={22} />
            Accès Rapide & Commandes de la Paie
          </h2>
          <span className="text-xs font-bold text-gray-400">
            Cliquez pour lancer une tâche
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                onClick={() => navigate(action.href)}
                className="group flex items-start gap-4 p-5 bg-gray-50/90 hover:bg-white rounded-2xl border border-gray-200 hover:border-blue-500/40 hover:shadow-xl transition-all duration-300 text-left transform hover:-translate-y-1"
              >
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${action.color} text-white shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all flex-shrink-0`}>
                  <Icon size={24} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-black text-sm text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                      {action.title}
                    </p>
                    <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0 ml-1" />
                  </div>
                  <p className="text-xs font-normal text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
