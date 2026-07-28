import { apiFetch } from '../lib/api';
import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, History, AlertCircle, CheckCircle2, XCircle, Trash2, 
  AlertTriangle, Shield, UserCheck, Users, Calendar, DollarSign, 
  ArrowRight, X, Sparkles, RefreshCw, Check, HardHat, CreditCard,
  Filter, Building2, Lock, Unlock, Download, FileText, FileSpreadsheet
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import gebatLogo from '../assets/logo_gebat.png';
import { useAuth } from '../contexts/AuthContext';
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: '#fee' }}>
          <h2>Something went wrong in Ponctions.jsx.</h2>
          <pre>{this.state.error && this.state.error.toString()}</pre>
          <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function PonctionsContent() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Administrateur';
  const [ponctions, setPonctions] = useState([]);
  const [ouvriers, setOuvriers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerPonctions, setWorkerPonctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEpiFournisModal, setShowEpiFournisModal] = useState(false);
  const [epiFournis, setEpiFournis] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [cautionStatusFilter, setCautionStatusFilter] = useState('non_soldes');
  const [workerStatusFilter, setWorkerStatusFilter] = useState('actif');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('worker'); // 'worker' | 'journal'

  const [formData, setFormData] = useState({
    ouvrier_id: '',
    date: new Date().toISOString().split('T')[0],
    montant: '',
    motif: '',
  });

  const [workerStatus, setWorkerStatus] = useState('actif');
  // departure option: 'epi_complet' | 'epi_non_retourne' | 'epi_perdu'
  const [epiDepartureOption, setEpiDepartureOption] = useState('');
  const [epiLostAmount, setEpiLostAmount] = useState('');
  const [epiObservations, setEpiObservations] = useState('');
  const [epiDepartureDate, setEpiDepartureDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDepartedUnlocked, setIsDepartedUnlocked] = useState(false);
  const [isSavingWorker, setIsSavingWorker] = useState(false);
  const [settings, setSettings] = useState({
    epi_limits: {
      'Bingerville': 12000,
      'Songon': 9000,
    },
    epi_weekly_deduction: 3000,
  });

  const getEpiLimit = (site, ouvrierId) => {
    try {
      const siteLow = String(site || '').toLowerCase();
      
      let hasBotteSecurite = false;
      if (ouvrierId && epiFournis.length > 0) {
        const workerEpis = epiFournis.filter(e => Number(e.ouvrier_id) === Number(ouvrierId));
        hasBotteSecurite = workerEpis.some(e => String(e.equipement || '').trim().toLowerCase() === 'botte de sécurité' || String(e.equipement || '').trim().toLowerCase() === 'botte de securité');
      }

      if (siteLow.includes('bingerville') || siteLow.includes('bengerville')) {
        return hasBotteSecurite ? 12000 : 9000;
      }

      if (!settings || !settings.epi_limits) return 9000;
      if (siteLow.includes('songon')) return Number(settings.epi_limits['Songon']) || 9000;
      return Number(settings.epi_limits[site]) || 9000;
    } catch (error) {
      console.error('Error getting EPI limit:', error);
      return 9000;
    }
  };

  useEffect(() => {
    fetchData();
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
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ponctionsRes, ouvriersRes, epiFournisRes] = await Promise.all([
        apiFetch('/api/ponctions'),
        apiFetch('/api/ouvriers'),
        apiFetch('/api/epi-fournis').catch(() => null),
      ]);
      if (ponctionsRes.ok && ouvriersRes.ok) {
        setPonctions(await ponctionsRes.json());
        setOuvriers(await ouvriersRes.json());
      } else {
        setPonctions([]);
        setOuvriers([]);
      }
      
      if (epiFournisRes && epiFournisRes.ok) {
        setEpiFournis(await epiFournisRes.json());
      } else {
        setEpiFournis([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerSelect = async (workerId) => {
    setSelectedWorker(workerId);
    setIsDepartedUnlocked(false);
    setViewMode('worker');
    try {
      const response = await apiFetch(`/api/ponctions/ouvrier/${workerId}`);
      if (response.ok) {
        setWorkerPonctions(await response.json());
      } else {
        setWorkerPonctions([]);
      }
      
      const worker = ouvriers.find(o => o.id === workerId);
      if (worker) {
        setWorkerStatus(worker.statut || 'actif');
        setEpiDepartureOption(worker.epi_departure_option || '');
        setEpiLostAmount(worker.epi_lost_amount || '');
        setEpiObservations(worker.epi_observations || '');
        setEpiDepartureDate(worker.date_depart || worker.epi_departure_date || new Date().toISOString().split('T')[0]);
      }
    } catch (error) {
      console.error('Error fetching worker ponctions:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const targetWorker = ouvriers.find(o => Number(o.id) === Number(formData.ouvrier_id));
    if (targetWorker && targetWorker.statut === 'parti' && Boolean(targetWorker.epi_departure_option) && !isAdmin) {
      alert("⚠️ Action impossible : Cet ouvrier a été enregistré en statut PARTI. Son compte de caution EPI est clôturé et verrouillé. Vous ne pouvez plus modifier ni ajouter de prélèvements.");
      return;
    }
    try {
      // Vérification anti-doublon de période : une ponction existe-t-elle déjà sur la même semaine / période (< 6 jours) pour cet ouvrier ?
      const targetDate = new Date(formData.date);
      const existingPonction = ponctions.find(p => {
        if (Number(p.ouvrier_id) !== Number(formData.ouvrier_id)) return false;
        if (!p.date) return false;
        const pDate = new Date(p.date);
        const diffDays = Math.abs(targetDate - pDate) / (1000 * 60 * 60 * 24);
        return diffDays < 6;
      });

      if (existingPonction && existingPonction.id) {
        const confirmReplace = window.confirm(
          `⚠️ ATTENTION : Une ponction existe déjà pour cet ouvrier sur cette même période (${formatDate(existingPonction.date)} : ${formatCurrency(existingPonction.montant)}).\n\nVoulez-vous METTRE À JOUR / REMPLACER cette ponction existante au lieu d'ajouter une déduction double ?`
        );
        if (!confirmReplace) return;

        const response = await apiFetch(`/api/ponctions/${existingPonction.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            motif: formData.motif || existingPonction.motif || 'Retenue EPI hebdomadaire (Ajustée)',
          }),
        });
        if (!response.ok) throw new Error('Erreur serveur lors de la mise à jour de la ponction');
      } else {
        const response = await apiFetch('/api/ponctions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error('Erreur serveur lors de la création de la ponction');
      }

      setShowModal(false);
      setFormData({
        ouvrier_id: '',
        date: new Date().toISOString().split('T')[0],
        montant: '',
        motif: '',
      });
      await fetchData();
      if (selectedWorker) {
        handleWorkerSelect(selectedWorker);
      }
    } catch (error) {
      console.error('Error saving ponction:', error);
      alert('Erreur lors de l\'enregistrement de la ponction');
    }
  };

  const handleDeletePonction = async (e, ponctionId) => {
    e.stopPropagation(); // Évite de déclencher la sélection de l'ouvrier
    const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer cette ponction/retenue ? Cette action est irréversible.");
    if (!confirmDelete) return;

    try {
      const response = await apiFetch(`/api/ponctions/${ponctionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erreur serveur lors de la suppression');
      
      await fetchData();
      if (selectedWorker) {
        handleWorkerSelect(selectedWorker);
      }
    } catch (error) {
      console.error('Error deleting ponction:', error);
      alert('Erreur lors de la suppression de la ponction');
    }
  };

  const computeEpiResult = (option, total, lostAmount, limit = 9000) => {
    const lost = Number(lostAmount) || 0;
    switch (option) {
      case 'epi_complet':
        return { remboursement: total, deduction: 0, valeurRetenue: 0, toRefund: total, toDeduct: 0 };
      case 'epi_non_retourne':
        return { 
          remboursement: 0, 
          deduction: 0,
          valeurRetenue: total,
          toRefund: 0,
          toDeduct: 0
        };
      case 'epi_perdu': {
        const remb = Math.max(0, total - lost);
        const ded = 0; // Modification demandée : pas de déduction supplémentaire en cas de perte
        return {
          remboursement: remb,
          deduction: ded,
          valeurRetenue: lost,
          toRefund: remb,
          toDeduct: ded
        };
      }
      default:
        return { remboursement: 0, deduction: 0, valeurRetenue: 0, toRefund: 0, toDeduct: 0 };
    }
  };

  const getRegularTotalPonctions = (workerId, list = ponctions) => {
    const workerPonctionsList = list.filter(p => Number(p.ouvrier_id) === Number(workerId) && !p.motif?.includes('Complément caution (Départ') && !p.motif?.includes('EPI non retournés') && !p.motif?.includes('EPI perdus'));
    return workerPonctionsList.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  };

  const getTotalPonctions = (workerId) => {
    const workerPonctionsList = ponctions.filter(p => Number(p.ouvrier_id) === Number(workerId));
    return workerPonctionsList.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  };

  const handleSaveWorkerStatus = async () => {
    setIsSavingWorker(true);
    try {
      const selectedWorkerData = ouvriers.find(o => Number(o.id) === Number(selectedWorker));
      const regularTotal = getRegularTotalPonctions(selectedWorker);
      const limit = getEpiLimit(selectedWorkerData?.site, selectedWorkerData?.id);
      const { remboursement, deduction, valeurRetenue } = computeEpiResult(
        workerStatus === 'parti' ? epiDepartureOption : '',
        regularTotal,
        epiLostAmount,
        limit
      );

      const response = await apiFetch(`/api/ouvriers/${selectedWorker}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedWorkerData,
          statut: workerStatus,
          date_depart: workerStatus === 'parti' ? epiDepartureDate : (selectedWorkerData.date_depart || ''),
          epi_departure_date: workerStatus === 'parti' ? epiDepartureDate : (selectedWorkerData.epi_departure_date || ''),
          epi_departure_option: workerStatus === 'parti' ? epiDepartureOption : '',
          epi_lost_amount: epiLostAmount,
          epi_observations: epiObservations,
          epi_remboursement: remboursement,
          epi_deduction: deduction,
          epi_valeur_retenue: valeurRetenue !== undefined ? valeurRetenue : deduction,
        }),
      });

      if (!response.ok) throw new Error('Erreur serveur');

      // Application immédiate de la déduction de départ dans l'historique des ponctions (sans doublon sur la même période)
      const existingDepPonction = ponctions.find(p => 
        Number(p.ouvrier_id) === Number(selectedWorker) && 
        (p.motif?.includes('Complément caution (Départ') || p.motif?.includes('EPI non retournés') || p.motif?.includes('EPI perdus'))
      );

      if (workerStatus === 'parti' && deduction > 0) {
        const motifStr = `Complément caution (Départ - ${epiDepartureOption === 'epi_non_retourne' ? 'EPI non retournés' : 'EPI perdus / endommagés'})`;
        if (existingDepPonction) {
          await apiFetch(`/api/ponctions/${existingDepPonction.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ouvrier_id: selectedWorker,
              date: epiDepartureDate || existingDepPonction.date || new Date().toISOString().split('T')[0],
              montant: deduction,
              motif: motifStr,
            }),
          });
        } else {
          await apiFetch('/api/ponctions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ouvrier_id: selectedWorker,
              date: epiDepartureDate || new Date().toISOString().split('T')[0],
              montant: deduction,
              motif: motifStr,
            }),
          });
        }
      } else if (existingDepPonction && (workerStatus !== 'parti' || deduction === 0)) {
        await apiFetch(`/api/ponctions/${existingDepPonction.id}`, {
          method: 'DELETE',
        });
      }

      await fetchData();
      handleWorkerSelect(selectedWorker);
      alert('Statut et déductions de départ EPI appliqués et enregistrés avec succès !');
    } catch (error) {
      console.error('Error saving worker status:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setIsSavingWorker(false);
    }
  };

  const getLastDeductionDate = (workerId) => {
    const workerPonctionsList = ponctions.filter(p => p.ouvrier_id === workerId);
    if (workerPonctionsList.length === 0) return null;
    const sorted = workerPonctionsList.sort((a, b) => new Date(b.date) - new Date(a.date));
    return sorted[0].date;
  };

  const getNextDeduction = (workerId) => {
    const worker = ouvriers.find(o => o.id === workerId);
    const site = worker?.site || '';
    const epiLimit = getEpiLimit(site, workerId);
    const total = getTotalPonctions(workerId);
    const weeklyDeduction = total === 0 ? 5000 : 4000;
    if (total < epiLimit) {
      return Math.min(weeklyDeduction, epiLimit - total);
    }
    return 0;
  };

  const sitesList = useMemo(() => {
    const set = new Set(ouvriers.map(o => o.site || 'Non assigné').filter(Boolean));
    return Array.from(set).sort();
  }, [ouvriers]);

  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    ponctions.forEach(p => {
      if (p.date) {
        const m = p.date.substring(0, 7);
        monthsSet.add(m);
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [ponctions]);

  const filteredOuvriers = useMemo(() => {
    return ouvriers.filter((ouvrier) => {
      // 1. Search term
      const matchesSearch = !searchTerm || (
        ouvrier.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ouvrier.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ouvrier.matricule?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ouvrier.site?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ouvrier.qualification?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // 2. Site filter
      const matchesSite = siteFilter === 'ALL' || (ouvrier.site || 'Non assigné') === siteFilter;

      // 3. Worker Status filter
      const matchesWorkerStatus = workerStatusFilter === 'ALL' || (ouvrier.statut || 'actif') === workerStatusFilter;

      // 4. Caution Status filter
      const total = getTotalPonctions(ouvrier.id);
      const limit = getEpiLimit(ouvrier.site, ouvrier.id);
      let matchesCaution = true;
      if (cautionStatusFilter === 'non_soldes') {
        matchesCaution = total < limit && !(ouvrier.statut === 'parti' && Boolean(ouvrier.epi_departure_option));
      } else if (cautionStatusFilter === 'paid_off') {
        matchesCaution = total >= limit && total > 0;
      } else if (cautionStatusFilter === 'in_progress') {
        matchesCaution = total > 0 && total < limit;
      } else if (cautionStatusFilter === 'zero') {
        matchesCaution = total === 0;
      }

      // 5. Month Filter & Date Filter
      let matchesDate = true;
      if (monthFilter !== 'ALL' || dateFilter !== '') {
        const workerPonctionsList = ponctions.filter(p => p.ouvrier_id === ouvrier.id);
        if (dateFilter !== '') {
          matchesDate = workerPonctionsList.some(p => p.date === dateFilter) || ouvrier.date_depart === dateFilter || ouvrier.epi_departure_date === dateFilter;
        } else if (monthFilter !== 'ALL') {
          matchesDate = workerPonctionsList.some(p => p.date && p.date.startsWith(monthFilter)) || (ouvrier.date_depart && ouvrier.date_depart.startsWith(monthFilter)) || (ouvrier.epi_departure_date && ouvrier.epi_departure_date.startsWith(monthFilter));
        }
      }

      return matchesSearch && matchesSite && matchesWorkerStatus && matchesCaution && matchesDate;
    });
  }, [ouvriers, searchTerm, siteFilter, cautionStatusFilter, workerStatusFilter, monthFilter, dateFilter, ponctions, settings]);

  const filteredWorkerPonctions = useMemo(() => {
    return workerPonctions.filter(p => {
      if (dateFilter !== '') return p.date === dateFilter;
      if (monthFilter !== 'ALL') return p.date && p.date.startsWith(monthFilter);
      return true;
    });
  }, [workerPonctions, dateFilter, monthFilter]);

  const filteredAllPonctions = useMemo(() => {
    return ponctions.filter(p => {
      let matchesDate = true;
      if (dateFilter !== '') {
        matchesDate = p.date === dateFilter;
      } else if (monthFilter !== 'ALL') {
        matchesDate = p.date && p.date.startsWith(monthFilter);
      }
      let matchesSite = true;
      if (siteFilter !== 'ALL') {
        const worker = ouvriers.find(o => o.id === p.ouvrier_id);
        matchesSite = (worker?.site || 'Non assigné') === siteFilter;
      }
      let matchesSearch = true;
      if (searchTerm) {
        const worker = ouvriers.find(o => o.id === p.ouvrier_id);
        const name = `${worker?.nom || ''} ${worker?.prenom || ''}`.toLowerCase();
        matchesSearch = name.includes(searchTerm.toLowerCase()) || (p.motif && p.motif.toLowerCase().includes(searchTerm.toLowerCase()));
      }
      return matchesDate && matchesSite && matchesSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [ponctions, dateFilter, monthFilter, siteFilter, searchTerm, ouvriers]);

  // Overall Stats
  const stats = useMemo(() => {
    let totalCollected = 0;
    let paidOffCount = 0;
    let inProgressCount = 0;

    ouvriers.forEach(o => {
      const total = getTotalPonctions(o.id);
      totalCollected += total;
      const limit = getEpiLimit(o.site, o.id);
      if (total >= limit && total > 0) {
        paidOffCount++;
      } else if (total > 0 && total < limit) {
        inProgressCount++;
      }
    });

    return { totalCollected, paidOffCount, inProgressCount };
  }, [ouvriers, ponctions, settings]);

  const selectedWorkerData = ouvriers.find(o => Number(o.id) === Number(selectedWorker));
  const workerTotal = selectedWorkerData ? workerPonctions.reduce((sum, p) => sum + (Number(p.montant) || 0), 0) : 0;
  const regularWorkerTotal = selectedWorkerData ? getRegularTotalPonctions(selectedWorker, workerPonctions) : 0;
  const workerSite = selectedWorkerData?.site || '';
  const workerEpiLimit = getEpiLimit(workerSite, selectedWorkerData?.id);
  const isPaidOff = workerTotal >= workerEpiLimit;
  const isWorkerAlreadyDeparted = Boolean(selectedWorkerData && selectedWorkerData.statut === 'parti' && Boolean(selectedWorkerData.epi_departure_option || selectedWorkerData.date_depart || selectedWorkerData.epi_departure_date));
  const isDepartedLocked = isWorkerAlreadyDeparted && !isAdmin;
  const epiResult = computeEpiResult(workerStatus === 'parti' ? epiDepartureOption : '', regularWorkerTotal, epiLostAmount, workerEpiLimit);
  
  const handleExportExcel = () => {
    try {
      const isJournal = viewMode === 'journal';
      const titleRow = ['GESTION DES PONCTIONS EPI & CAUTIONS - GEBAT EASYPAIE'];
      const subtitleRow = [`Vue : ${isJournal ? 'Journal Global des Prélèvements' : 'Par Ouvrier'} | Site : ${siteFilter === 'ALL' ? 'Tous' : siteFilter} | Statut : ${cautionStatusFilter === 'ALL' ? 'Tous' : cautionStatusFilter} | Généré le ${new Date().toLocaleDateString('fr-FR')}`];
      const emptyRow = [];

      const headerRow = isJournal 
        ? ['Date Prélèvement', 'Ouvrier', 'Qualification', 'Site', 'Motif', 'Montant Retenue (FCFA)']
        : ['Nom', 'Prénom', 'Qualification', 'Site', 'Statut Poste', 'Plafond EPI (FCFA)', 'Total Cotisé (FCFA)', 'Reste à Cotiser (FCFA)', 'Statut Caution', 'Déd. Départ/Perte (FCFA)', 'Remboursement EPI (FCFA)'];

      const dataRows = isJournal 
        ? filteredAllPonctions.map(p => {
            const w = ouvriers.find(o => o.id === p.ouvrier_id);
            return [
              p.date ? formatDate(p.date) : '-',
              w ? `${w.nom} ${w.prenom || ''}`.trim() : `Ouvrier #${p.ouvrier_id}`,
              w?.qualification || '-',
              w?.site || '-',
              p.motif || 'Retenue EPI',
              Number(p.montant) || 0
            ];
          })
        : filteredOuvriers.map(o => {
            const total = getTotalPonctions(o.id);
            const limit = getEpiLimit(o.site, o.id);
            const reste = Math.max(0, limit - total);
            const statut = total >= limit && total > 0 ? 'Soldée' : (total > 0 ? 'En cours' : 'Aucune');
            
            const wPonctions = ponctions.filter(p => p.ouvrier_id === o.id);
            const regTotal = getRegularTotalPonctions(o.id, wPonctions);
            const lostAmt = Number(o.epi_lost_amount) || 0;
            const res = computeEpiResult(o.epi_departure_option || '', regTotal, lostAmt, limit);

            return [
              o.nom || '-',
              o.prenom || '-',
              o.qualification || '-',
              o.site || '-',
              o.statut === 'actif' ? 'Actif' : 'Départ',
              limit,
              total,
              reste,
              statut,
              res ? res.toDeduct : 0,
              res ? res.toRefund : 0
            ];
          });

      const totalRowIdx = dataRows.length + 4;
      const totalRow = isJournal 
        ? [
            'TOTAL GÉNÉRAL', '', '', '', '',
            filteredAllPonctions.reduce((sum, p) => sum + (Number(p.montant) || 0), 0)
          ]
        : [
            'TOTAL GÉNÉRAL', '', '', '', '',
            filteredOuvriers.reduce((sum, o) => sum + getEpiLimit(o.site, o.id), 0),
            filteredOuvriers.reduce((sum, o) => sum + getTotalPonctions(o.id), 0),
            filteredOuvriers.reduce((sum, o) => sum + Math.max(0, getEpiLimit(o.site, o.id) - getTotalPonctions(o.id)), 0),
            '',
            filteredOuvriers.reduce((sum, o) => {
              const wP = ponctions.filter(p => p.ouvrier_id === o.id);
              const reg = getRegularTotalPonctions(o.id, wP);
              const res = computeEpiResult(o.epi_departure_option || '', reg, Number(o.epi_lost_amount) || 0, getEpiLimit(o.site, o.id));
              return sum + (res ? res.toDeduct : 0);
            }, 0),
            filteredOuvriers.reduce((sum, o) => {
              const wP = ponctions.filter(p => p.ouvrier_id === o.id);
              const reg = getRegularTotalPonctions(o.id, wP);
              const res = computeEpiResult(o.epi_departure_option || '', reg, Number(o.epi_lost_amount) || 0, getEpiLimit(o.site, o.id));
              return sum + (res ? res.toRefund : 0);
            }, 0)
          ];

      const aoa = [titleRow, subtitleRow, emptyRow, headerRow, ...dataRows, totalRow];
      const sheet = XLSX.utils.aoa_to_sheet(aoa);

      const numCols = headerRow.length;
      const numRows = aoa.length;

      for (let R = 0; R < numRows; R++) {
        for (let C = 0; C < numCols; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!sheet[cellAddress]) continue;

          if (R === 0) {
            sheet[cellAddress].s = {
              font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: '1565C0' } },
              alignment: { horizontal: 'center', vertical: 'center' }
            };
          } else if (R === 1) {
            sheet[cellAddress].s = {
              font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '1E3A8A' } },
              fill: { fgColor: { rgb: 'F4BD0B' } },
              alignment: { horizontal: 'center', vertical: 'center' }
            };
          } else if (R === 3) {
            sheet[cellAddress].s = {
              font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: '1E293B' } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: {
                top: { style: 'medium', color: { rgb: '0F172A' } },
                bottom: { style: 'medium', color: { rgb: '0F172A' } },
                left: { style: 'thin', color: { rgb: '334155' } },
                right: { style: 'thin', color: { rgb: '334155' } }
              }
            };
          } else if (R === numRows - 1) {
            const isAmount = typeof sheet[cellAddress].v === 'number';
            sheet[cellAddress].s = {
              font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F172A' } },
              fill: { fgColor: { rgb: 'E2E8F0' } },
              alignment: { horizontal: isAmount ? 'right' : 'left', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: '64748B' } },
                bottom: { style: 'double', color: { rgb: '0F172A' } }
              }
            };
            if (isAmount) sheet[cellAddress].z = '#,##0';
          } else if (R > 3) {
            const isAmount = typeof sheet[cellAddress].v === 'number';
            const isEven = (R % 2 === 0);
            sheet[cellAddress].s = {
              font: { name: 'Calibri', sz: 10, color: { rgb: '1E293B' } },
              fill: { fgColor: { rgb: isEven ? 'F8FAFC' : 'FFFFFF' } },
              alignment: { horizontal: isAmount ? 'right' : 'left', vertical: 'center' },
              border: {
                bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                left: { style: 'thin', color: { rgb: 'F1F5F9' } },
                right: { style: 'thin', color: { rgb: 'F1F5F9' } }
              }
            };
            if (isAmount) sheet[cellAddress].z = '#,##0';
          }
        }
      }

      sheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }
      ];

      const colWidths = isJournal 
        ? [{ wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 22 }]
        : [{ wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 22 }];
      sheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, isJournal ? 'Journal Ponctions' : 'Ponctions Ouvriers');
      XLSX.writeFile(workbook, `Ponctions_EPI_GEBAT_${isJournal ? 'Journal' : 'Ouvriers'}_${formatDate(new Date())}.xlsx`);
    } catch (error) {
      console.error('Erreur export Excel Ponctions:', error);
      alert('Erreur lors de l\'exportation Excel');
    }
  };

  const handleExportPDF = () => {
    try {
      const isJournal = viewMode === 'journal';
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(21, 101, 192);
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('GESTION DES PONCTIONS EPI & CAUTIONS - GEBAT EASYPAIE', 14, 13);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Vue : ${isJournal ? 'Journal Global' : 'Par Ouvrier'} | Site : ${siteFilter === 'ALL' ? 'Tous' : siteFilter} | Statut : ${cautionStatusFilter === 'ALL' ? 'Tous' : cautionStatusFilter} | Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 21);

      const head = isJournal
        ? [['Date Prélève.', 'Ouvrier', 'Qualification', 'Site', 'Motif', 'Montant Retenue']]
        : [['Ouvrier', 'Qualification', 'Site', 'Statut', 'Plafond', 'Cotisé', 'Reste', 'Statut Caut.', 'Déd. Départ', 'Remb. EPI']];

      const body = isJournal
        ? filteredAllPonctions.map(p => {
            const w = ouvriers.find(o => o.id === p.ouvrier_id);
            return [
              p.date ? formatDate(p.date) : '-',
              w ? `${w.nom} ${w.prenom || ''}`.trim() : `Ouvrier #${p.ouvrier_id}`,
              w?.qualification || '-',
              w?.site || '-',
              p.motif || 'Retenue EPI',
              formatCurrency(Number(p.montant) || 0)
            ];
          })
        : filteredOuvriers.map(o => {
            const total = getTotalPonctions(o.id);
            const limit = getEpiLimit(o.site, o.id);
            const reste = Math.max(0, limit - total);
            const statut = total >= limit && total > 0 ? 'Soldée' : (total > 0 ? 'En cours' : 'Aucune');
            const wPonctions = ponctions.filter(p => p.ouvrier_id === o.id);
            const regTotal = getRegularTotalPonctions(o.id, wPonctions);
            const res = computeEpiResult(o.epi_departure_option || '', regTotal, Number(o.epi_lost_amount) || 0, limit);

            return [
              `${o.nom} ${o.prenom || ''}`.trim(),
              o.qualification || '-',
              o.site || '-',
              o.statut === 'actif' ? 'Actif' : 'Départ',
              formatCurrency(limit),
              formatCurrency(total),
              formatCurrency(reste),
              statut,
              formatCurrency(res ? res.toDeduct : 0),
              formatCurrency(res ? res.toRefund : 0)
            ];
          });

      autoTable(doc, {
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 34, left: 10, right: 10 },
        startY: 34,
        head,
        body
      });

      doc.save(`Ponctions_EPI_GEBAT_${isJournal ? 'Journal' : 'Ouvriers'}_${formatDate(new Date())}.pdf`);
    } catch (error) {
      console.error('Erreur export PDF Ponctions:', error);
      alert('Erreur lors de l\'exportation PDF');
    }
  };

  const exportEpiFournisPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138); // indigo-900
      doc.text("GEBAT - Registre des Équipements EPI Fournis", pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Date d'édition : ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 28, { align: 'center' });
      
      const tableColumn = ["Date de remise", "Ouvrier", "Équipement", "Prix Unitaire"];
      const tableRows = [];
      
      let total = 0;
      epiFournis.forEach(item => {
        const worker = ouvriers.find(o => o.id === item.ouvrier_id);
        const workerName = worker ? `${worker.nom} ${worker.prenom || ''}` : `Ouvrier #${item.ouvrier_id}`;
        const rowData = [
          formatDate(item.date_remise),
          workerName,
          item.equipement,
          formatCurrency(item.prix)
        ];
        tableRows.push(rowData);
        total += Number(item.prix);
      });
      
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [147, 51, 234], textColor: [255, 255, 255] },
        styles: { fontSize: 9 },
        columnStyles: {
          3: { halign: 'right' }
        }
      });
      
      const finalY = doc.lastAutoTable.finalY || 35;
      doc.setFontSize(12);
      doc.setTextColor(147, 51, 234);
      doc.text(`Total Global : ${formatCurrency(total)}`, pageWidth - 14, finalY + 10, { align: 'right' });
      
      doc.save(`EPI_Fournis_GEBAT_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Une erreur est survenue lors de la génération du PDF.');
    }
  };

  const exportEpiFournisExcel = () => {
    try {
      const dataToExport = epiFournis.map(item => {
        const worker = ouvriers.find(o => o.id === item.ouvrier_id);
        const workerName = worker ? `${worker.nom} ${worker.prenom || ''}` : `Ouvrier #${item.ouvrier_id}`;
        return {
          'Date de remise': formatDate(item.date_remise),
          'Ouvrier': workerName,
          'Équipement': item.equipement,
          'Prix Unitaire': Number(item.prix)
        };
      });
      
      const total = epiFournis.reduce((sum, item) => sum + Number(item.prix), 0);
      dataToExport.push({
        'Date de remise': '',
        'Ouvrier': '',
        'Équipement': 'TOTAL',
        'Prix Unitaire': total
      });
      
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "EPI Fournis");
      XLSX.writeFile(wb, `EPI_Fournis_GEBAT_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Erreur lors de l\'export Excel:', error);
      alert('Une erreur est survenue lors de la génération du fichier Excel.');
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Premium Hero Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <Shield className="text-amber-400" size={30} />
              </div>
              <span className="px-3.5 py-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold rounded-full uppercase tracking-wider shadow-sm">
                Sécurité & Cautions EPI
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
              Gestion des Ponctions EPI
            </h1>
            <p className="text-purple-100 mt-2 max-w-2xl text-sm md:text-base leading-relaxed font-normal">
              Suivez les prélèvements hebdomadaires de caution (casques, gants, bottes de sécurité) par chantier et calculez automatiquement les remboursements en cas de départ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="px-5 py-3.5 bg-emerald-600/90 hover:bg-emerald-600 text-white font-extrabold rounded-2xl transition-all shadow-lg flex items-center gap-2.5 text-sm border border-emerald-400/50 backdrop-blur-md"
              title="Exporter l'état des ponctions en Excel (.xlsx)"
            >
              <Download size={18} />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="px-5 py-3.5 bg-red-600/90 hover:bg-red-600 text-white font-extrabold rounded-2xl transition-all shadow-lg flex items-center gap-2.5 text-sm border border-red-400/50 backdrop-blur-md"
              title="Exporter l'état des ponctions au format PDF (.pdf)"
            >
              <FileText size={18} />
              <span>Export PDF</span>
            </button>
            <button
              onClick={fetchData}
              className="p-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl transition-all shadow-md"
              title="Rafraîchir"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowEpiFournisModal(true)}
              className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold rounded-xl text-sm shadow-sm transition-all flex items-center gap-2"
            >
              <HardHat size={18} /> Liste Équipements
            </button>
            <button
              onClick={() => {
                setFormData({
                  ouvrier_id: selectedWorker || '',
                  date: new Date().toISOString().split('T')[0],
                  montant: selectedWorker ? getNextDeduction(selectedWorker) : 5000,
                  motif: 'Retenue EPI hebdomadaire',
                });
                setShowModal(true);
              }}
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2.5 transform active:scale-95 transition-all text-sm whitespace-nowrap"
            >
              <Plus size={20} className="stroke-[3]" />
              Ajouter une ponction
            </button>
          </div>
        </div>
      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Collecté</span>
            <div className="text-2xl lg:text-3xl font-black text-gray-900 mt-1">{formatCurrency(stats.totalCollected)}</div>
            <p className="text-xs text-purple-600 font-semibold mt-1 flex items-center gap-1">
              <Shield size={12} /> Cautions EPI GEBAT
            </p>
          </div>
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <DollarSign size={26} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Cautions Soldées</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{stats.paidOffCount}</div>
            <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> Objectif 100% atteint
            </p>
          </div>
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={26} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">En Cours de Ponction</span>
            <div className="text-3xl font-black text-indigo-600 mt-1">{stats.inProgressCount}</div>
            <p className="text-xs text-indigo-700 font-semibold mt-1 flex items-center gap-1">
              <History size={12} /> Prélèvements réguliers
            </p>
          </div>
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <HardHat size={26} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Retenue Hebdo Type</span>
            <div className="text-2xl font-black text-amber-600 mt-1">5 000 / Reste</div>
            <p className="text-xs text-amber-700 font-semibold mt-1 flex items-center gap-1">
              <Calendar size={12} /> 1ère sem. / Max 4 000
            </p>
          </div>
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <CreditCard size={26} />
          </div>
        </div>
      </div>

      {/* Main Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Workers List (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex flex-col max-h-[760px]">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
            <h2 className="font-extrabold text-lg text-gray-900 flex items-center gap-2">
              <Users className="text-purple-600" size={22} />
              Liste ({filteredOuvriers.length}/{ouvriers.length})
            </h2>
            {(siteFilter !== 'ALL' || cautionStatusFilter !== 'non_soldes' || workerStatusFilter !== 'ALL' || monthFilter !== 'ALL' || dateFilter !== '' || searchTerm) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSiteFilter('ALL');
                  setCautionStatusFilter('non_soldes');
                  setWorkerStatusFilter('ALL');
                  setMonthFilter('ALL');
                  setDateFilter('');
                }}
                className="text-[11px] font-extrabold text-red-600 hover:text-red-700 bg-red-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                title="Réinitialiser tous les filtres"
              >
                <X size={13} /> Effacer filtres
              </button>
            )}
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par nom, chantier, matricule..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Dynamic Multi-Filter Bar */}
          <div className="bg-purple-50/60 border border-purple-100 p-3 rounded-2xl mb-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-black text-purple-900 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Filter size={14} className="text-purple-600" /> Filtres & Tri avancés
              </span>
              <span className="text-[10px] bg-purple-200/80 text-purple-800 px-2.5 py-0.5 rounded-full font-bold">
                {filteredOuvriers.length} affiché(s)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Site Filter */}
              <div>
                <label className="block text-[10px] font-extrabold text-gray-600 mb-1 flex items-center gap-1">
                  <Building2 size={11} className="text-amber-600" /> Chantier
                </label>
                <select
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-purple-200/80 rounded-xl text-xs font-bold text-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-100 shadow-sm"
                >
                  <option value="ALL">🏢 Tous ({sitesList.length})</option>
                  {sitesList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Caution Status Filter */}
              <div>
                <label className="block text-[10px] font-extrabold text-gray-600 mb-1 flex items-center gap-1">
                  <Shield size={11} className="text-purple-600" /> Caution EPI
                </label>
                <select
                  value={cautionStatusFilter}
                  onChange={(e) => setCautionStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-purple-200/80 rounded-xl text-xs font-bold text-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-100 shadow-sm"
                >
                  <option value="non_soldes">🔥 Non soldés (À ponctionner)</option>
                  <option value="ALL">⚡ Tous statuts</option>
                  <option value="in_progress">⏳ En cours</option>
                  <option value="paid_off">✅ Soldé 100%</option>
                  <option value="zero">⚪ 0 FCFA (Jamais)</option>
                </select>
              </div>

              {/* Worker Status Filter */}
              <div>
                <label className="block text-[10px] font-extrabold text-gray-600 mb-1 flex items-center gap-1">
                  <UserCheck size={11} className="text-emerald-600" /> Présence
                </label>
                <select
                  value={workerStatusFilter}
                  onChange={(e) => setWorkerStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-purple-200/80 rounded-xl text-xs font-bold text-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-100 shadow-sm"
                >
                  <option value="ALL">👥 Actifs & Partis</option>
                  <option value="actif">🟢 Actifs ({ouvriers.filter(o => o.statut === 'actif').length})</option>
                  <option value="parti">🔴 Partis ({ouvriers.filter(o => o.statut === 'parti').length})</option>
                </select>
              </div>

              {/* Month Filter */}
              <div>
                <label className="block text-[10px] font-extrabold text-gray-600 mb-1 flex items-center gap-1">
                  <Calendar size={11} className="text-blue-600" /> Mois prélèvement
                </label>
                <select
                  value={monthFilter}
                  onChange={(e) => {
                    setMonthFilter(e.target.value);
                    if (e.target.value !== 'ALL') setDateFilter('');
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-purple-200/80 rounded-xl text-xs font-bold text-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-100 shadow-sm"
                >
                  <option value="ALL">📅 Tous les mois</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-extrabold text-gray-600 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1"><History size={11} className="text-indigo-600" /> Date précise</span>
                  {dateFilter && (
                    <button
                      type="button"
                      onClick={() => setDateFilter('')}
                      className="text-[9px] text-red-600 hover:text-red-800 font-extrabold underline"
                    >
                      effacer date
                    </button>
                  )}
                </label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    if (e.target.value) setMonthFilter('ALL');
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-purple-200/80 rounded-xl text-xs font-bold text-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-100 shadow-sm"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
              <p className="text-xs font-bold text-gray-500">Chargement des ouvriers...</p>
            </div>
          ) : filteredOuvriers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <AlertCircle size={32} className="mb-2 text-gray-300" />
              <p className="text-sm font-bold">Aucun ouvrier trouvé</p>
            </div>
          ) : (
            <div className="overflow-y-auto space-y-2.5 pr-2 flex-1">
              {filteredOuvriers.map((ouvrier) => {
                const total = getTotalPonctions(ouvrier.id);
                const nextDeduction = getNextDeduction(ouvrier.id);
                const lastDeductionDate = getLastDeductionDate(ouvrier.id);
                const workerSite = ouvrier.site || 'Chantier';
                const workerEpiLimit = getEpiLimit(workerSite, ouvrier.id);
                const isWorkerPaidOff = total >= workerEpiLimit && total > 0;
                const isSelected = selectedWorker === ouvrier.id;

                return (
                  <div
                    key={ouvrier.id}
                    onClick={() => handleWorkerSelect(ouvrier.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-50/90 border-2 border-purple-600 shadow-md transform scale-[1.01]'
                        : 'bg-white hover:bg-gray-50 border-gray-200/80 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">
                          {ouvrier.nom} {ouvrier.prenom || ''}
                        </div>
                        <div className="text-xs font-semibold text-purple-700 mt-0.5">
                          {ouvrier.qualification || 'Journalier'} • <span className="text-gray-500 font-normal">{workerSite}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-black text-gray-900 text-sm">{formatCurrency(total)}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Sur {formatCurrency(workerEpiLimit)}</div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                      {ouvrier.statut === 'parti' ? (
                        <div className="flex items-center gap-1.5 w-full justify-between">
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[11px] rounded-md font-extrabold uppercase">
                            🔴 Parti
                          </span>
                          {ouvrier.epi_departure_option === 'epi_complet' && (
                            <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                              ✓ Remboursé : {formatCurrency(total)}
                            </span>
                          )}
                          {ouvrier.epi_departure_option === 'epi_non_retourne' && (
                            <span className="text-gray-600 font-bold text-[11px]">
                              ✗ EPI non retourné (Pas de remboursement)
                            </span>
                          )}
                          {ouvrier.epi_departure_option === 'epi_perdu' && (
                            <span className="text-orange-700 font-bold text-[11px]">
                              Partiel : {formatCurrency(Math.max(0, total - (Number(ouvrier.epi_lost_amount) || 0)))}
                            </span>
                          )}
                        </div>
                      ) : isWorkerPaidOff ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] rounded-full font-extrabold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Caution Soldée
                          </span>
                          {lastDeductionDate && (
                            <span className="text-[11px] text-gray-400 font-mono">
                              Fin : {formatDate(lastDeductionDate)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[11px] rounded-full font-extrabold">
                            Prochaine : {formatCurrency(nextDeduction)}
                          </span>
                          <span className="text-[11px] text-purple-600 font-bold">En cours...</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Worker Details & Departure (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Top View Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200/80 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setViewMode('worker')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  viewMode === 'worker'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <UserCheck size={15} />
                Détail par Ouvrier {selectedWorkerData ? `(${selectedWorkerData.nom})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('journal')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  viewMode === 'journal'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <History size={15} />
                Journal Global des Prélèvements ({filteredAllPonctions.length})
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(dateFilter || monthFilter !== 'ALL') && (
                <div className="flex items-center gap-1.5 text-xs font-black bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl border border-blue-200">
                  <Calendar size={13} className="text-blue-600" />
                  <span>Filtré : {dateFilter ? formatDate(dateFilter) : monthFilter}</span>
                </div>
              )}
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 flex items-center gap-1.5 text-xs transition-all shadow-2xs"
              >
                <Download size={14} /> Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 font-extrabold rounded-xl border border-red-200 flex items-center gap-1.5 text-xs transition-all shadow-2xs"
              >
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>

          {viewMode === 'journal' ? (
            /* Global Journal Table */
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 animate-fadeIn space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                <div>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-black rounded-lg uppercase tracking-wider">
                    Vue Synthétique
                  </span>
                  <h3 className="text-2xl font-black text-gray-900 mt-2 flex items-center gap-2">
                    <History className="text-blue-600" size={24} />
                    Journal Général des Prélèvements
                  </h3>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">
                    Affichage de toutes les retenues EPI selon les filtres (Date, Mois, Chantier, Recherche)
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportExcel}
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 flex items-center gap-1.5 text-xs transition-all shadow-2xs"
                    >
                      <Download size={14} /> Excel
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-800 font-extrabold rounded-xl border border-red-200 flex items-center gap-1.5 text-xs transition-all shadow-2xs"
                    >
                      <FileText size={14} /> PDF
                    </button>
                  </div>
                  <div className="text-right bg-blue-50/80 p-3.5 rounded-2xl border border-blue-100">
                    <span className="text-[11px] font-extrabold text-blue-600 uppercase block">Total Retenu (Filtré)</span>
                    <span className="text-xl font-black text-blue-900 font-mono">
                      {formatCurrency(filteredAllPonctions.reduce((sum, p) => sum + (Number(p.montant) || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                {filteredAllPonctions.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Ouvrier</th>
                        <th className="py-3.5 px-4">Chantier / Qualif.</th>
                        <th className="py-3.5 px-4">Motif / Désignation</th>
                        <th className="py-3.5 px-4 text-right">Montant Retenu</th>
                        <th className="py-3.5 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredAllPonctions.map((ponction) => {
                        const worker = ouvriers.find(o => o.id === ponction.ouvrier_id);
                        return (
                          <tr 
                            key={ponction.id} 
                            onClick={() => handleWorkerSelect(ponction.ouvrier_id)}
                            className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                            title="Cliquez pour voir la fiche de cet ouvrier"
                          >
                            <td className="py-3 px-4 font-mono font-bold text-gray-800">{formatDate(ponction.date)}</td>
                            <td className="py-3 px-4 font-extrabold text-gray-900">
                              {worker ? `${worker.nom} ${worker.prenom || ''}` : `ID: ${ponction.ouvrier_id}`}
                            </td>
                            <td className="py-3 px-4 text-gray-600 font-medium">
                              {worker ? `${worker.site || 'N/A'} • ${worker.qualification || ''}` : '-'}
                            </td>
                            <td className="py-3 px-4 text-gray-700 font-medium">{ponction.motif || 'Retenue EPI'}</td>
                            <td className="py-3 px-4 text-right font-black text-red-600 font-mono">{formatCurrency(ponction.montant)}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={(e) => handleDeletePonction(e, ponction.id)}
                                className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Supprimer cette ponction"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-16 text-gray-400">
                    <History className="mx-auto mb-3 text-gray-300" size={36} />
                    <p className="text-sm font-bold">Aucune ponction trouvée pour ces critères</p>
                    <p className="text-xs text-gray-400 mt-1">Essayez de modifier ou d'effacer le filtre de date ou de chantier.</p>
                  </div>
                )}
              </div>
            </div>
          ) : selectedWorkerData ? (
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 animate-fadeIn space-y-8">
              {/* Header Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-black rounded-lg uppercase tracking-wider">
                      Fiche Caution EPI
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                      selectedWorkerData.statut === 'actif' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedWorkerData.statut === 'actif' ? '🟢 Actif en poste' : '🔴 Parti / Départ'}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mt-2">
                    {selectedWorkerData.nom} {selectedWorkerData.prenom}
                  </h3>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">
                    {selectedWorkerData.qualification || 'Qualification non spécifiée'} • Chantier : <strong className="text-gray-800">{workerSite}</strong>
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (isDepartedLocked) {
                      alert("⚠️ Action impossible : Cet ouvrier est en statut PARTI et son compte de caution EPI est clôturé. Vous ne pouvez plus ajouter de retenues.");
                      return;
                    }
                    setFormData({
                      ouvrier_id: selectedWorkerData.id,
                      date: new Date().toISOString().split('T')[0],
                      montant: getNextDeduction(selectedWorkerData.id) || (getTotalPonctions(selectedWorkerData.id) === 0 ? 5000 : 4000),
                      motif: 'Retenue EPI hebdomadaire',
                    });
                    setShowModal(true);
                  }}
                  disabled={isDepartedLocked}
                  className={`px-4 py-2.5 font-extrabold text-xs rounded-xl transition-all flex items-center gap-2 self-start sm:self-auto ${
                    isDepartedLocked
                      ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none'
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-700 shadow-sm'
                  }`}
                  title={isDepartedLocked ? "Ouvrier parti et compte clôturé. Prélèvement impossible." : "Prélever une ponction sur cet ouvrier"}
                >
                  {isDepartedLocked ? <Lock size={16} className="text-gray-400" /> : <Plus size={16} />} Prélever ponction
                </button>
              </div>

              {/* Progress Gauge */}
              <div className="bg-gradient-to-br from-gray-50 to-purple-50/40 p-6 rounded-2xl border border-purple-100">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <span className="text-xs font-extrabold uppercase text-gray-400 block">Total Ponctionné / Caution</span>
                    <span className="text-3xl font-black text-purple-900 mt-1 block">
                      {formatCurrency(workerTotal)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-gray-400 block">Objectif Chantier ({workerSite})</span>
                    <span className="text-xl font-black text-gray-700 mt-1 block">
                      {formatCurrency(workerEpiLimit)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className="bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((workerTotal / workerEpiLimit) * 100, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center mt-2 text-xs font-bold">
                  <span className="text-purple-700">
                    {Math.round(Math.min((workerTotal / workerEpiLimit) * 100, 100))}% de la caution collectée
                  </span>
                  {isPaidOff ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-black">
                      <CheckCircle2 size={15} /> Caution 100% Soldée
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      Reste à prélever : {formatCurrency(Math.max(0, workerEpiLimit - workerTotal))}
                    </span>
                  )}
                </div>
              </div>

              {/* Status & Departure Section */}
              {isDepartedLocked ? (
                <div className="p-6 border-2 border-red-300 rounded-2xl bg-red-50/60 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-red-100 text-red-700 rounded-xl">
                        <Lock size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm uppercase tracking-wider text-red-950">
                          Compte EPI Clôturé et Verrouillé (Statut Parti)
                        </h4>
                        <p className="text-xs font-semibold text-red-800">
                          Le départ et le règlement de la caution ont été définitivement enregistrés. Ce dossier ne peut plus être modifié.
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 bg-red-100 text-red-800 font-extrabold text-xs rounded-xl border border-red-300 flex items-center gap-1.5 self-start sm:self-auto">
                      <Lock size={14} /> Clôturé & Définitif
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="p-3.5 bg-white/80 rounded-xl border border-red-100">
                      <span className="text-xs font-bold text-gray-500 block">Statut contractuel</span>
                      <span className="font-black text-red-700 text-sm mt-0.5 flex items-center gap-1.5">
                        🔴 Parti (Fin de contrat / Départ)
                      </span>
                    </div>
                    <div className="p-3.5 bg-white/80 rounded-xl border border-red-100">
                      <span className="text-xs font-bold text-gray-500 block">Date effective du départ</span>
                      <span className="font-black text-gray-900 text-sm mt-0.5 block">
                        {epiDepartureDate ? formatDate(epiDepartureDate) : 'Non spécifiée'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-red-200 space-y-2.5">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400 block">
                      Option retenue lors du départ
                    </span>
                    <div className="font-black text-sm text-gray-800">
                      {epiDepartureOption === 'epi_complet' && '✅ EPI retournés au complet et en bon état (Remboursement total)'}
                      {epiDepartureOption === 'epi_non_retourne' && '❌ EPI non retourné - Pas de remboursement (Aucune déduction sur salaire, retenues déjà collectées)'}
                      {epiDepartureOption === 'epi_perdu' && `⚠️ EPI perdus / endommagés (Déduction de ${formatCurrency(epiLostAmount || 0)})`}
                    </div>
                    {epiObservations && (
                      <div className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 font-medium">
                        <strong className="text-gray-800 font-bold">Observation : </strong> {epiObservations}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 border border-gray-200 rounded-2xl bg-gray-50/50 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/80 pb-3">
                    <h4 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2">
                      <UserCheck className="text-indigo-600" size={18} />
                      Statut sur Chantier & Gestion du Départ
                    </h4>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-purple-200 shadow-sm">
                      <Calendar size={14} className="text-purple-600 shrink-0" />
                      <span className="text-xs font-extrabold text-gray-700 whitespace-nowrap">Filtre Date du Départ :</span>
                      <input
                        type="date"
                        value={epiDepartureDate}
                        onChange={(e) => setEpiDepartureDate(e.target.value)}
                        className="text-xs font-black text-purple-900 bg-purple-50/80 px-2 py-1 rounded-lg border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                        title="Date de référence ou d'effet pour l'évaluation et l'enregistrement du départ"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Statut contractuel de l'ouvrier
                      </label>
                      <select
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-extrabold text-gray-900 focus:border-purple-500 shadow-sm"
                        value={workerStatus}
                        onChange={(e) => {
                          setWorkerStatus(e.target.value);
                          if (e.target.value === 'actif') {
                            setEpiDepartureOption('');
                            setEpiLostAmount('');
                          }
                        }}
                      >
                        <option value="actif">🟢 Actif (Présent sur le chantier)</option>
                        <option value="parti">🔴 Parti (Fin de contrat / Départ)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                        <Calendar size={13} className="text-purple-600" /> Date effective du statut / départ
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-extrabold text-gray-900 focus:border-purple-500 shadow-sm"
                        value={epiDepartureDate}
                        onChange={(e) => setEpiDepartureDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {workerStatus === 'parti' && (
                    <div className="p-5 bg-red-50/80 border border-red-200 rounded-2xl space-y-4 animate-fadeIn">
                      <p className="text-xs font-black text-red-900 uppercase tracking-wider">
                        État des EPI au départ (Impact sur la paie de l'ouvrier)
                      </p>

                      <div className="space-y-3">
                        {/* Option 1 */}
                        <label
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            epiDepartureOption === 'epi_complet'
                              ? 'border-emerald-500 bg-emerald-50/90 shadow-md'
                              : 'border-gray-200 bg-white hover:border-emerald-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="epiOption"
                            value="epi_complet"
                            checked={epiDepartureOption === 'epi_complet'}
                            onChange={(e) => {
                              setEpiDepartureOption(e.target.value);
                              setEpiLostAmount('');
                            }}
                            className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 font-black text-sm text-emerald-900">
                              <CheckCircle2 size={16} className="text-emerald-600" />
                              EPI retournés au complet et en bon état
                            </div>
                            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                              L'ouvrier a rendu son casque, ses bottes et son gilet. Remboursement total de sa caution de <strong>{formatCurrency(workerTotal)}</strong> sur sa prochaine paie.
                            </p>
                          </div>
                        </label>

                        {/* Option 2 */}
                        <label
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            epiDepartureOption === 'epi_non_retourne'
                              ? 'border-red-500 bg-red-50 shadow-md'
                              : 'border-gray-200 bg-white hover:border-red-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="epiOption"
                            value="epi_non_retourne"
                            checked={epiDepartureOption === 'epi_non_retourne'}
                            onChange={(e) => {
                              setEpiDepartureOption(e.target.value);
                              setEpiLostAmount('');
                            }}
                            className="mt-0.5 h-4 w-4 text-red-600 focus:ring-red-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 font-black text-sm text-red-900">
                              <XCircle size={16} className="text-red-600" />
                              EPI non retourné - Pas de remboursement
                            </div>
                            <p className="text-xs text-red-800 mt-1 leading-relaxed">
                              L'ouvrier est parti sans rendre ses équipements. Les retenues de caution déjà collectées (<strong>{formatCurrency(workerTotal)}</strong>) restent définitivement acquises à l'entreprise (aucune déduction à rajouter sur le salaire).
                            </p>
                          </div>
                        </label>

                        {/* Option 3 */}
                        <label
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            epiDepartureOption === 'epi_perdu'
                              ? 'border-amber-500 bg-amber-50 shadow-md'
                              : 'border-gray-200 bg-white hover:border-amber-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="epiOption"
                            value="epi_perdu"
                            checked={epiDepartureOption === 'epi_perdu'}
                            onChange={(e) => setEpiDepartureOption(e.target.value)}
                            className="mt-0.5 h-4 w-4 text-amber-600 focus:ring-amber-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 font-black text-sm text-amber-900">
                              <AlertTriangle size={16} className="text-amber-600" />
                              EPI perdus / endommagés (Déduction partielle)
                            </div>
                            <p className="text-xs text-amber-800 mt-1">
                              Certains équipements sont manquants. Indiquez la valeur exacte à déduire, le solde sera remboursé.
                            </p>

                            {epiDepartureOption === 'epi_perdu' && (
                              <div className="mt-3 space-y-2 p-3 bg-white rounded-xl border border-amber-200">
                                <div>
                                  <label className="text-xs font-extrabold text-amber-900 block mb-1">
                                    Montant à déduire pour les EPI perdus (FCFA) :
                                  </label>
                                  <input
                                    type="number"
                                    className="w-full sm:w-48 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm font-black text-gray-900 focus:border-amber-500"
                                    placeholder="Ex: 3000"
                                    value={epiLostAmount}
                                    onChange={(e) => setEpiLostAmount(e.target.value)}
                                    min="0"
                                    max={workerTotal}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </label>
                      </div>

                      {/* Summary Box */}
                      {epiDepartureOption && (
                        <div className="p-4 bg-white border border-red-200 rounded-xl shadow-inner mt-4 space-y-3">
                          <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                            Impact financier et calcul pour le bulletin de paie
                          </h5>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="p-2.5 bg-gray-50 rounded-xl">
                              <span className="text-[11px] text-gray-500 block font-semibold">Caution hebdomadaire</span>
                              <span className="font-black text-gray-900 text-sm mt-0.5 block">{formatCurrency(regularWorkerTotal)}</span>
                            </div>
                            <div className="p-2.5 bg-red-50/80 rounded-xl border border-red-100">
                              <span className="text-[11px] text-red-600 block font-semibold">Valeur EPI retenue</span>
                              <span className="font-black text-red-700 text-sm mt-0.5 block">{formatCurrency(epiResult.valeurRetenue !== undefined ? epiResult.valeurRetenue : epiResult.deduction)}</span>
                            </div>
                            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                              <span className="text-[11px] text-emerald-700 block font-bold">Remboursement Paie</span>
                              <span className="font-black text-emerald-700 text-base mt-0.5 block">{formatCurrency(epiResult.remboursement)}</span>
                            </div>
                          </div>
                          {(epiResult.deduction > 0 || epiResult.remboursement > 0 || (epiResult.valeurRetenue > 0 && epiResult.deduction === 0)) && (
                            <div className="p-2.5 bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-lg text-left text-xs text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-semibold">
                              <span>
                                {epiResult.deduction > 0
                                  ? `→ Complément à déduire sur la dernière paie (Net à payer) :`
                                  : epiResult.remboursement > 0
                                  ? `→ Remboursement à ajouter sur la dernière paie (Net à payer) :`
                                  : `→ La caution déjà prélevée (${formatCurrency(regularWorkerTotal)}) représente ${workerEpiLimit > 0 ? Math.round((regularWorkerTotal / workerEpiLimit) * 100) : 100}% du montant total de l'EPI (${formatCurrency(workerEpiLimit)}). Aucun prélèvement additionnel en paie.`}
                              </span>
                              <span className="font-black font-mono text-sm">
                                {epiResult.deduction > 0
                                  ? `-${formatCurrency(epiResult.deduction)}`
                                  : epiResult.remboursement > 0
                                  ? `+${formatCurrency(epiResult.remboursement)}`
                                  : `0 FCFA`}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Observations et remarques sur la caution / le départ
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-purple-500 shadow-sm"
                      placeholder="Ex: A rendu le casque mais a gardé ses chaussures de sécurité."
                      value={epiObservations}
                      onChange={(e) => setEpiObservations(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveWorkerStatus}
                      disabled={isSavingWorker || (workerStatus === 'parti' && !epiDepartureOption)}
                      className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
                    >
                      {isSavingWorker ? 'Enregistrement en cours...' : 'Enregistrer le statut & la caution'}
                    </button>
                  </div>
                </div>
              )}

              {/* History Table */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <h4 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <History className="text-purple-600" size={18} />
                    Historique détaillé des prélèvements de caution ({filteredWorkerPonctions.length}{filteredWorkerPonctions.length !== workerPonctions.length ? ` / ${workerPonctions.length}` : ''})
                  </h4>
                  <div className="flex items-center gap-2">
                    {(dateFilter || monthFilter !== 'ALL') && (
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full">
                        Filtré sur {dateFilter ? formatDate(dateFilter) : monthFilter}
                      </span>
                    )}
                    <button
                      onClick={handleExportExcel}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-lg border border-emerald-200 flex items-center gap-1 text-xs transition-all"
                    >
                      <Download size={13} /> Excel
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 font-extrabold rounded-lg border border-red-200 flex items-center gap-1 text-xs transition-all"
                    >
                      <FileText size={13} /> PDF
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  {filteredWorkerPonctions.length > 0 ? (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                          <th className="py-3 px-4">Date Prélèvement</th>
                          <th className="py-3 px-4">Montant Retenu</th>
                          <th className="py-3 px-4">Motif / Désignation</th>
                          <th className="py-3 px-4 text-right">Cumul Caution</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredWorkerPonctions.map((ponction) => (
                          <tr key={ponction.id} className="hover:bg-purple-50/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-gray-800">{formatDate(ponction.date)}</td>
                            <td className="py-3 px-4 font-black text-red-600">{formatCurrency(ponction.montant)}</td>
                            <td className="py-3 px-4 text-gray-700 font-medium">{ponction.motif || 'Retenue EPI'}</td>
                            <td className="py-3 px-4 text-right font-black text-purple-900 font-mono">{formatCurrency(ponction.cumul)}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={(e) => handleDeletePonction(e, ponction.id)}
                                className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Supprimer cette ponction"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <History className="mx-auto mb-2 text-gray-300" size={32} />
                      <p className="text-sm font-bold">
                        {dateFilter || monthFilter !== 'ALL'
                          ? 'Aucune ponction EPI pour cet ouvrier sur cette date / période'
                          : 'Aucune ponction EPI enregistrée pour cet ouvrier'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {dateFilter || monthFilter !== 'ALL'
                          ? 'Essayez de réinitialiser le filtre de date pour voir l\'historique complet.'
                          : 'Cliquez sur « + Prélever ponction » pour ajouter la première retenue.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-16 shadow-xl border border-gray-100 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-purple-50 text-purple-400 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                <Shield size={36} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Sélectionnez un ouvrier à gauche</h3>
              <p className="text-gray-500 text-sm max-w-md">
                Cliquez sur n'importe quel maçon, ferrailleur ou coffreur dans la liste pour consulter sa jauge d'objectif EPI, son historique de prélèvement et gérer ses options de départ.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modern Backdrop Blurred Modal for Adding Deduction */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Plus className="text-amber-300" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">Prélever une ponction EPI</h2>
                  <p className="text-xs text-purple-200 mt-0.5">Retenue de caution sur salaire</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-purple-200 hover:text-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Ouvrier *</label>
                <select
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-purple-500"
                  value={formData.ouvrier_id}
                  onChange={(e) => setFormData({ ...formData, ouvrier_id: e.target.value })}
                  required
                >
                  <option value="">Sélectionner un ouvrier</option>
                  {ouvriers
                    .slice()
                    .sort((a, b) => {
                      const totalA = getTotalPonctions(a.id);
                      const limitA = getEpiLimit(a.site, a.id);
                      const isPaidA = totalA >= limitA && totalA > 0;
                      const totalB = getTotalPonctions(b.id);
                      const limitB = getEpiLimit(b.site, b.id);
                      const isPaidB = totalB >= limitB && totalB > 0;
                      if (isPaidA !== isPaidB) return isPaidA ? 1 : -1;
                      return (a.nom || '').localeCompare(b.nom || '');
                    })
                    .map((ouvrier) => {
                      const total = getTotalPonctions(ouvrier.id);
                      const limit = getEpiLimit(ouvrier.site, ouvrier.id);
                      const reste = Math.max(0, limit - total);
                      const isSolded = total >= limit && total > 0;
                      const isParti = Boolean(ouvrier.statut === 'parti' && Boolean(ouvrier.epi_departure_option || ouvrier.date_depart || ouvrier.epi_departure_date)) && !isAdmin;
                      return (
                        <option key={ouvrier.id} value={ouvrier.id} disabled={isParti}>
                          {isParti ? '🔒 [Parti/Clôturé]' : (isSolded ? '✅ [Soldé]' : `🔥 [Reste : ${formatCurrency(reste)}]`)} — {ouvrier.nom} {ouvrier.prenom} ({ouvrier.qualification} - {ouvrier.site})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Date du prélèvement *</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-purple-500"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Montant à retenir (FCFA) *</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:bg-white focus:border-purple-500"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                  required
                  min="0"
                />
                <p className="text-[11px] text-purple-600 font-bold mt-1">
                  Standard : 5 000 FCFA (1ère fois), puis ajusté au Reste à payer (max 4 000 FCFA)
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Motif / Description</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:border-purple-500"
                  value={formData.motif}
                  onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
                  placeholder="Ex: Casque de chantier, bottes, gants..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm"
                >
                  Annuler
                </button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-purple-500/20 text-sm">
                  Enregistrer la ponction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Liste de tous les Équipements Fournis */}
      {showEpiFournisModal && (
        <div className="fixed inset-0 z-50 flex justify-center items-center p-4 sm:p-6 bg-gray-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp">
            
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-purple-50/50 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <HardHat size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">Registre des Équipements Fournis</h3>
                  <p className="text-sm text-gray-500 font-medium">Inventaire global des EPI physiquement remis aux ouvriers</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportEpiFournisPDF}
                  className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <FileText size={14} /> PDF
                </button>
                <button
                  onClick={exportEpiFournisExcel}
                  className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 border border-green-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <FileSpreadsheet size={14} /> Excel
                </button>
                <button
                  onClick={() => setShowEpiFournisModal(false)}
                  className="ml-4 text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {epiFournis.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider text-xs border-b border-gray-200">
                        <th className="py-3 px-4">Date de remise</th>
                        <th className="py-3 px-4">Ouvrier / Désignation</th>
                        <th className="py-3 px-4">Équipement</th>
                        <th className="py-3 px-4 text-right">Prix Unitaire</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                      {epiFournis.map((item) => {
                        const worker = ouvriers.find(o => o.id === item.ouvrier_id);
                        return (
                          <tr key={item.id} className="hover:bg-purple-50/20 transition-colors">
                            <td className="py-3 px-4 font-mono text-gray-500">{formatDate(item.date_remise)}</td>
                            <td className="py-3 px-4 text-gray-900">{worker ? `${worker.nom} ${worker.prenom || ''}` : `Ouvrier #${item.ouvrier_id}`}</td>
                            <td className="py-3 px-4 text-purple-900">{item.equipement}</td>
                            <td className="py-3 px-4 text-right font-black font-mono text-gray-800">{formatCurrency(item.prix)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-purple-50/50 border-t border-purple-100">
                      <tr>
                        <td colSpan="3" className="py-3 px-4 text-right font-extrabold text-purple-900 uppercase tracking-wider text-xs">
                          Total Global (Informatif) :
                        </td>
                        <td className="py-3 px-4 text-right font-black font-mono text-purple-700">
                          {formatCurrency(epiFournis.reduce((sum, item) => sum + Number(item.prix), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                  <HardHat className="text-gray-300 mb-4" size={48} />
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Aucun équipement enregistré</h3>
                  <p className="text-sm text-gray-500">
                    Les équipements enregistrés sur les fiches des ouvriers apparaîtront ici.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowEpiFournisModal(false)}
                className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}

export default function Ponctions() {
  return (
    <ErrorBoundary>
      <PonctionsContent />
    </ErrorBoundary>
  );
}

