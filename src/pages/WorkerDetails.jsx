import { apiFetch } from '../lib/api';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Calendar, Phone, MapPin, Briefcase, CreditCard, 
  Home, Clock, DollarSign, FileText, AlertCircle, CheckCircle2, 
  XCircle, Award, Shield, UserCheck, ShieldAlert, Sparkles, TrendingUp, Info, RefreshCw,
  Download, Printer, Layers, History, Activity, ExternalLink, ChevronRight, X, HardHat
} from 'lucide-react';
import { formatCurrency, formatCurrencySigned, formatDate } from '../lib/utils';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import gebatLogo from '../assets/logo_gebat.png';
import { startOfWeek, endOfWeek, addWeeks, format, getISOWeek, getISOWeekYear } from 'date-fns';

export default function WorkerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [worker, setWorker] = useState(null);
  const [ponctions, setPonctions] = useState([]);
  const [loyers, setLoyers] = useState([]);
  const [paiementsLoyer, setPaiementsLoyer] = useState([]);
  const [paies, setPaies] = useState([]);
  const [pointages, setPointages] = useState([]);
  const [epiProgrammes, setEpiProgrammes] = useState([]);
  const [epiFournis, setEpiFournis] = useState([]);
  const [newEpiFourni, setNewEpiFourni] = useState({ equipement: '', prix: '', date_remise: new Date().toISOString().split('T')[0] });
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [newProgramme, setNewProgramme] = useState({ semaine: '', montant: '' });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'paies' | 'epi' | 'programme_epi' | 'loyer' | 'pointages'

  useEffect(() => {
    fetchWorkerData();
  }, [id]);

  const fetchWorkerData = async () => {
    setLoading(true);
    try {
      const [workerRes, ponctionsRes, loyersRes, paiementsRes, paiesRes, pointagesRes, epiProgRes, epiFournisRes] = await Promise.all([
        apiFetch(`/api/ouvriers/${id}`).catch(() => null),
        apiFetch(`/api/ponctions`).catch(() => null),
        apiFetch(`/api/loyers`).catch(() => null),
        apiFetch(`/api/paiements-loyer`).catch(() => null),
        apiFetch(`/api/paies`).catch(() => null),
        apiFetch(`/api/pointages`).catch(() => null),
        apiFetch(`/api/epi-programmes`).catch(() => null),
        apiFetch(`/api/epi-fournis`).catch(() => null),
      ]);

      if (workerRes && workerRes.ok) {
        const workerData = await workerRes.json().catch(() => null);
        if (workerData && !workerData.error) {
          setWorker(workerData);
        } else {
          setWorker(null);
        }
      } else {
        setWorker(null);
      }

      if (ponctionsRes && ponctionsRes.ok) {
        const ponctionsData = await ponctionsRes.json().catch(() => []);
        setPonctions(Array.isArray(ponctionsData) ? ponctionsData.filter(p => Number(p?.ouvrier_id) === Number(id)) : []);
      } else {
        setPonctions([]);
      }

      if (loyersRes && loyersRes.ok) {
        const loyersData = await loyersRes.json().catch(() => []);
        setLoyers(Array.isArray(loyersData) ? loyersData.filter(l => Number(l?.ouvrier_id) === Number(id)) : []);
      } else {
        setLoyers([]);
      }

      if (paiementsRes && paiementsRes.ok) {
        const paiementsData = await paiementsRes.json().catch(() => []);
        setPaiementsLoyer(Array.isArray(paiementsData) ? paiementsData.filter(p => Number(p?.ouvrier_id) === Number(id)) : []);
      } else {
        setPaiementsLoyer([]);
      }

      if (paiesRes && paiesRes.ok) {
        const paiesData = await paiesRes.json().catch(() => []);
        setPaies(Array.isArray(paiesData) ? paiesData.filter(p => Number(p?.ouvrier_id) === Number(id)) : []);
      } else {
        setPaies([]);
      }

      if (pointagesRes && pointagesRes.ok) {
        const pointagesData = await pointagesRes.json().catch(() => []);
        setPointages(Array.isArray(pointagesData) ? pointagesData.filter(p => Number(p?.ouvrier_id) === Number(id)) : []);
      } else {
        setPointages([]);
      }

      if (epiProgRes && epiProgRes.ok) {
        const epiData = await epiProgRes.json().catch(() => []);
        setEpiProgrammes(Array.isArray(epiData) ? epiData.filter(e => Number(e?.ouvrier_id) === Number(id)) : []);
      } else {
        setEpiProgrammes([]);
      }

      if (epiFournisRes && epiFournisRes.ok) {
        const epiFournisData = await epiFournisRes.json().catch(() => []);
        setEpiFournis(Array.isArray(epiFournisData) ? epiFournisData.filter(e => Number(e?.ouvrier_id) === Number(id)) : []);
      } else {
        setEpiFournis([]);
      }
    } catch (error) {
      console.error('Error fetching worker data:', error);
      setWorker(null);
    } finally {
      setLoading(false);
    }
  };

  const getEpiLimit = () => {
    const siteStr = String(worker?.site || '').toLowerCase();
    
    let hasBotteSecurite = false;
    if (epiFournis.length > 0) {
      hasBotteSecurite = epiFournis.some(e => String(e.equipement || '').trim().toLowerCase() === 'botte de sécurité' || String(e.equipement || '').trim().toLowerCase() === 'botte de securité');
    }

    if (siteStr.includes('bingerville') || siteStr.includes('bengerville')) {
      return hasBotteSecurite ? 12000 : 9000;
    }

    try {
      const savedSettings = localStorage.getItem('easypaie_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed?.epi_limits && worker?.site) {
          if (siteStr.includes('songon')) return Number(parsed.epi_limits['Songon']) || 9000;
          return Number(parsed.epi_limits[worker.site]) || 9000;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return 9000;
  };

  const getTotalPonctions = () => {
    return (ponctions || []).reduce((sum, p) => sum + (Number(p?.montant) || 0), 0);
  };

  const getTotalLoyers = () => {
    return (loyers || []).reduce((sum, l) => sum + (Number(l?.montant_mensuel) || 0), 0);
  };

  const getTotalPaiementsLoyer = () => {
    return (paiementsLoyer || []).reduce((sum, p) => sum + (Number(p?.montant) || 0), 0);
  };

  const getTotalPaies = () => {
    return (paies || []).reduce((sum, p) => sum + (Number(p?.net_a_payer) || 0), 0);
  };

  const getLastPonctionDate = () => {
    if (!ponctions || ponctions.length === 0) return null;
    const sorted = [...ponctions].sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));
    return sorted[0]?.date || null;
  };

  const getLastPaiementLoyerDate = () => {
    if (!paiementsLoyer || paiementsLoyer.length === 0) return null;
    const sorted = [...paiementsLoyer].sort((a, b) => new Date(b?.date_paiement || b?.date || 0) - new Date(a?.date_paiement || a?.date || 0));
    return sorted[0]?.date_paiement || sorted[0]?.date || null;
  };

  const getLastPaieDate = () => {
    if (!paies || paies.length === 0) return null;
    const sorted = [...paies].sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));
    return sorted[0]?.date || null;
  };

  const getEPIStatus = (limit) => {
    const total = getTotalPonctions();
    if (worker?.statut === 'parti') {
      const option = worker.epi_departure_option;
      const settled = !!worker.epi_settled;
      
      if (option === 'epi_complet') {
        return settled
          ? { status: 'Caution Remboursée', color: 'emerald', desc: 'EPI complets retournés et caution remboursée' }
          : { status: 'Remboursement En Attente', color: 'amber', desc: 'EPI retournés au complet. Caution à restituer' };
      } else if (option === 'epi_perdu') {
        return settled
          ? { status: 'Remboursé Partiellement', color: 'indigo', desc: 'EPI perdus/endommagés déduits de la caution' }
          : { status: 'Remboursement Partiel Attendu', color: 'amber', desc: 'EPI rendus partiellement. Remboursement partiel calculé' };
      } else if (option === 'epi_non_retourne') {
        return { status: 'Non Remboursé', color: 'rose', desc: 'EPI non retournés. Caution conservée/déduite' };
      }
      return { status: 'Non Remboursé', color: 'gray', desc: 'Aucune caution restituée' };
    }
    if (total >= limit) return { status: 'Caution EPI Soldée', color: 'emerald', desc: 'Plafond EPI atteint' };
    return { status: 'Caution EPI en cours', color: 'indigo', desc: 'Retenue hebdomadaire active' };
  };

  const getEpiReturnedLabel = () => {
    const option = worker?.epi_departure_option;
    if (option === 'epi_complet') return 'Oui, complets';
    if (option === 'epi_perdu') return 'Oui, partiels';
    if (option === 'epi_non_retourne') return 'Non, perdus';
    return 'Non';
  };

  const renderEpiStatusBadge = (label = '') => {
    let classes = 'px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ';
    if (String(label).startsWith('Oui') && !String(label).includes('partiel')) {
      classes += 'text-emerald-800 bg-emerald-100 border-emerald-200';
    } else if (String(label).includes('partiel') || String(label).includes('Partiel')) {
      classes += 'text-amber-800 bg-amber-100 border-amber-200';
    } else {
      classes += 'text-red-800 bg-red-100 border-red-200';
    }
    return <span className={classes}>{label}</span>;
  };

  const getLoyerStatus = () => {
    try {
      const currentMonth = new Date().toLocaleString('fr-FR', { month: 'long' }).toLowerCase();
      const currentYear = new Date().getFullYear();
      const currentPayment = (paiementsLoyer || []).find(
        p => String(p?.mois || '').toLowerCase() === currentMonth && Number(p?.annee) === currentYear
      );
      if (currentPayment) return { status: 'Payé', color: 'emerald' };
    } catch (e) {
      console.error(e);
    }
    return { status: 'Non payé / Retenu sur paie', color: 'amber' };
  };

  const getWorkerInitials = () => {
    if (!worker || !worker.nom) return '?';
    try {
      const cleanNom = String(worker.nom).trim().replace(/\s+/g, ' ');
      const parts = cleanNom.split(' ');
      if (parts.length >= 2) {
        const first = parts[0] ? parts[0][0] : '';
        const second = parts[1] ? parts[1][0] : '';
        return (first + second).toUpperCase() || '?';
      }
      return parts[0] ? parts[0].substring(0, 2).toUpperCase() : '?';
    } catch (e) {
      return '?';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 gap-3 bg-white rounded-3xl p-12 border border-gray-100 shadow-sm">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
        <span className="font-extrabold text-sm uppercase tracking-wider">Chargement des détails de l'ouvrier...</span>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 gap-3 bg-white rounded-3xl p-12 border border-gray-100 shadow-sm">
        <XCircle className="text-red-500" size={48} />
        <span className="font-black text-lg text-gray-800">Ouvrier introuvable (ID: {id})</span>
        <p className="text-xs text-gray-400 text-center max-w-md">Cet ouvrier n'existe pas dans le registre ou la connexion au serveur a rencontré un problème.</p>
        <button onClick={() => navigate('/ouvriers')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow mt-2 flex items-center gap-2">
          <ArrowLeft size={16} /> Retour au Registre des Ouvriers
        </button>
      </div>
    );
  }

  const limitEpi = getEpiLimit();
  const epiStatus = getEPIStatus(limitEpi);
  const loyerStatus = getLoyerStatus();
  const epiPercentage = limitEpi > 0 ? Math.min(100, Math.round((getTotalPonctions() / limitEpi) * 100)) : 0;

  const handleExportExcel = () => {
    if (!worker) return;
    const limitE = getEpiLimit();
    const totPaies = getTotalPaies();
    const totBrut = (paies || []).reduce((s, p) => s + (Number(p?.salaire_brut) || 0), 0);
    const totPonc = getTotalPonctions();
    const totLoy = getTotalLoyers();
    const totLoyPay = getTotalPaiementsLoyer();

    const titleRow = [`DOSSIER INDIVIDUEL COLLABORATEUR - GEBAT EASYPAIE`];
    const subtitleRow = [`Ouvrier : ${worker.nom} ${worker.prenom || ''} (Matricule : ${worker.matricule || 'N/A'}) | Chantier : ${worker.site || '-'} | Qualification : ${worker.qualification || '-'} | Édité le ${new Date().toLocaleDateString('fr-FR')}`];
    
    // Section 1: Infos
    const sec1Header = ['INFORMATIONS GÉNÉRALES DU COLLABORATEUR'];
    const infoRows = [
      ['Matricule', worker.matricule || 'N/A', 'Statut', worker.statut ? worker.statut.toUpperCase() : 'ACTIF'],
      ['Nom & Prénom', `${worker.nom || ''} ${worker.prenom || ''}`.trim(), 'Date Intégration', worker.date_entree ? formatDate(worker.date_entree) : '-'],
      ['Chantier (Site)', worker.site || '-', 'Téléphone Contact', worker.telephone || '-'],
      ['Qualification', worker.qualification || '-', 'Opérateur & N° MM', `${worker.operateur || '-'} (${worker.numero_mobile_money || worker.telephone || '-'})`]
    ];

    // Section 2: Synthèse financière
    const sec2Header = ['SYNTHÈSE COMPTABLE & FINANCIÈRE GLOBALE'];
    const synthRows = [
      ['Total Salaires Bruts', formatCurrency(totBrut), 'Total Salaires Nets Perçus', formatCurrency(totPaies)],
      ['Caution EPI Prélevée', `${formatCurrency(totPonc)} / ${formatCurrency(limitE)}`, 'Progression Caution EPI', `${limitE > 0 ? Math.min(100, Math.round((totPonc / limitE) * 100)) : 0}%`],
      ['Total Loyers Mensuels', formatCurrency(totLoy), 'Loyers Payés / Retenus', formatCurrency(totLoyPay)],
      ['Nombre de Bulletins de Paie', `${paies.length} semaine(s)`, 'Nombre de Pointages', `${pointages.length} jour(s)`]
    ];

    // Section 3: Historique des paies
    const sec3Header = ['HISTORIQUE DES RÈGLEMENTS DE SALAIRE (PAIES)'];
    const paiesCols = [
      'Semaine', 'Date Règlement', 'Période Travaillée', 'Salaire Brut (FCFA)', 
      'Retenue EPI (FCFA)', 'Loyer (FCFA)', 'Remb. EPI (FCFA)', 'Déd. EPI (FCFA)', 'Net Payé (FCFA)'
    ];
    const paiesRows = paies.map(p => [
      p.semaine || '-', formatDate(p.date),
      p.date_debut && p.date_fin ? `${formatDate(p.date_debut)} au ${formatDate(p.date_fin)}` : '-',
      Number(p.salaire_brut) || 0, Number(p.ponction) || 0, Number(p.loyer) || 0,
      Number(p.epi_remboursement) || 0, Number(p.epi_deduction) || 0, Number(p.net_a_payer) || 0
    ]);

    // Section 4: Historique Ponctions EPI
    const sec4Header = ['HISTORIQUE DES PRÉLÈVEMENTS DE CAUTION EPI'];
    const poncCols = ['Date Prélèvement', 'Montant Prélevé (FCFA)', 'Désignation / Motif', 'Cumul Caution (FCFA)'];
    const poncRows = ponctions.map(p => [
      formatDate(p.date), Number(p.montant) || 0, p.motif || 'Retenue EPI hebdomadaire', Number(p.cumul || p.montant) || 0
    ]);

    // Section 5: Historique Loyers
    const sec5Header = ['HISTORIQUE DES RETENUES DE LOYER'];
    const loyCols = ['Date Règlement', 'Mois de loyer', 'Année', 'Montant déduit (FCFA)'];
    const loyRows = paiementsLoyer.map(pl => [
      formatDate(pl.date_paiement || pl.date), pl.mois || '-', pl.annee || '-', Number(pl.montant) || 0
    ]);

    const wsData = [
      titleRow, subtitleRow, [],
      sec1Header, ...infoRows, [],
      sec2Header, ...synthRows, [],
      sec3Header, paiesCols, ...paiesRows, [],
      sec4Header, poncCols, ...poncRows, [],
      sec5Header, loyCols, ...loyRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 26 }, { wch: 28 }, { wch: 26 }, { wch: 28 },
      { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }
    ];

    // Style helper for all rows
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        
        // Title Row
        if (r === 0) {
          ws[addr].s = {
            font: { name: 'Arial', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '1565C0' } },
            alignment: { horizontal: 'left', vertical: 'center' }
          };
        } else if (r === 1) {
          ws[addr].s = {
            font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '1E293B' } },
            fill: { fgColor: { rgb: 'F4BD0B' } },
            alignment: { horizontal: 'left', vertical: 'center' }
          };
        } else if (ws[addr].v && typeof ws[addr].v === 'string' && (ws[addr].v.startsWith('INFORMATIONS') || ws[addr].v.startsWith('SYNTHÈSE') || ws[addr].v.startsWith('HISTORIQUE'))) {
          ws[addr].s = {
            font: { name: 'Arial', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '334155' } },
            alignment: { horizontal: 'left', vertical: 'center' }
          };
        } else if (typeof ws[addr].v === 'number') {
          ws[addr].z = '#,##0';
          ws[addr].s = {
            font: { name: 'Arial', sz: 10, color: { rgb: '0F172A' } },
            alignment: { horizontal: 'right', vertical: 'center' }
          };
        } else {
          ws[addr].s = {
            font: { name: 'Arial', sz: 10, color: { rgb: '1E293B' } },
            alignment: { horizontal: 'left', vertical: 'center' }
          };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fiche Ouvrier');
    XLSX.writeFile(wb, `Fiche_Ouvrier_${(worker.nom || 'Ouvrier').replace(/\s+/g, '_')}_${id}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!worker) return;
    const doc = new jsPDF({ orientation: 'portrait' });
    const pageW = doc.internal.pageSize.getWidth();

    // Banner
    doc.setFillColor(21, 101, 192);
    doc.rect(0, 0, pageW, 36, 'F');
    doc.setFillColor(244, 189, 11);
    doc.rect(0, 36, pageW, 3, 'F');
    try {
      doc.addImage(gebatLogo, 'PNG', pageW - 38, 3, 30, 30);
    } catch (e) {}

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(`Fiche Dossier Individuel : ${worker.nom || ''} ${worker.prenom || ''}`.trim(), 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(`Matricule : ${worker.matricule || 'N/A'} | Chantier : ${worker.site || '-'} | Qualification : ${worker.qualification || '-'}`, 14, 26);
    doc.setTextColor(0, 0, 0);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 45, pageW - 28, 34, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('Synthèse Totale & Coordonnées du Collaborateur', 18, 53);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Téléphone : ${worker.telephone || '-'}`, 18, 61);
    doc.text(`Opérateur MM : ${worker.operateur || '-'} (${worker.numero_mobile_money || worker.telephone || '-'})`, 18, 68);
    doc.text(`Date d'intégration : ${worker.date_entree ? formatDate(worker.date_entree) : '-'}`, 18, 75);

    const totBrut = (paies || []).reduce((s, p) => s + (Number(p?.salaire_brut) || 0), 0);
    doc.text(`Total Salaires Bruts : ${formatCurrency(totBrut)}`, pageW / 2, 61);
    doc.text(`Total Salaires Nets Payés : ${formatCurrency(getTotalPaies())}`, pageW / 2, 68);
    doc.text(`Caution EPI Prél. : ${formatCurrency(getTotalPonctions())} / ${formatCurrency(getEpiLimit())}`, pageW / 2, 75);

    // AutoTable Paies
    const paiesRows = paies.map(p => [
      p.semaine || '-', formatDate(p.date),
      formatCurrency(p.salaire_brut), formatCurrency(p.ponction), formatCurrency(p.loyer), formatCurrency(p.net_a_payer)
    ]);

    autoTable(doc, {
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      startY: 85,
      margin: { left: 14, right: 14 },
      head: [['Semaine', 'Date Règlement', 'Salaire Brut', 'Retenue EPI', 'Retenue Loyer', 'Net Payé']],
      body: paiesRows.length > 0 ? paiesRows : [['-', 'Aucun règlement de salaire enregistré', '-', '-', '-', '-']],
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } }
    });

    // AutoTable Ponctions
    const poncRows = ponctions.map(p => [
      formatDate(p.date), formatCurrency(p.montant), p.motif || 'Retenue EPI hebdomadaire', formatCurrency(p.cumul || p.montant)
    ]);

    autoTable(doc, {
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      startY: doc.lastAutoTable.finalY + 10,
      margin: { left: 14, right: 14 },
      head: [['Date Prélèvement', 'Montant Prélevé', 'Motif / Désignation', 'Cumul Caution']],
      body: poncRows.length > 0 ? poncRows : [['-', 'Aucune retenue EPI enregistrée', '-', '-']],
      columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } }
    });

    const finalY = doc.lastAutoTable.finalY + 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('GEBAT EASYPAIE — Direction Financière & Ressources Humaines', 14, finalY);
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, pageW - 14, finalY, { align: 'right' });

    doc.save(`Fiche_Ouvrier_${(worker.nom || 'Ouvrier').replace(/\s+/g, '_')}_${id}.pdf`);
  };

  const handleAddEpiProgramme = async (e) => {
    e.preventDefault();
    if (!newProgramme.semaine || !newProgramme.montant) {
      alert('Veuillez remplir tous les champs (Semaine et Montant).');
      return;
    }
    try {
      const response = await fetch('/api/epi-programmes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ouvrier_id: worker.id,
          semaine: newProgramme.semaine,
          montant: newProgramme.montant
        })
      });
      if (response.ok) {
        setNewProgramme({ semaine: '', montant: '' });
        fetchWorkerData();
        alert("Programmation enregistrée avec succès !");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la programmation.");
    }
  };

  const handleDeleteEpiProgramme = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette programmation ?")) return;
    try {
      const res = await apiFetch(`/api/epi-programmes/${id}`, { method: 'DELETE' });
      if (res.ok) fetchWorkerData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddEpiFourni = async (e) => {
    e.preventDefault();
    if (!newEpiFourni.equipement || !newEpiFourni.prix || !newEpiFourni.date_remise) {
      alert("Veuillez renseigner l'équipement, le prix et la date.");
      return;
    }
    
    try {
      const res = await apiFetch('/api/epi-fournis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ouvrier_id: worker.id,
          equipement: newEpiFourni.equipement,
          prix: newEpiFourni.prix,
          date_remise: newEpiFourni.date_remise
        })
      });
      if (res.ok) {
        setNewEpiFourni({ equipement: '', prix: '', date_remise: new Date().toISOString().split('T')[0] });
        fetchWorkerData();
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 3000);
      } else {
        const errorData = await res.json();
        alert(`Erreur serveur : ${errorData.error || 'Erreur inconnue'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion au serveur. Assurez-vous d'avoir redémarré le serveur backend.");
    }
  };

  const handleDeleteEpiFourni = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cet équipement ?")) return;
    try {
      const res = await apiFetch(`/api/epi-fournis/${id}`, { method: 'DELETE' });
      if (res.ok) fetchWorkerData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 gap-3 bg-white rounded-3xl p-12 border border-gray-100 shadow-sm">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
        <span className="font-extrabold text-sm uppercase tracking-wider">Chargement des détails de l'ouvrier...</span>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 gap-3 bg-white rounded-3xl p-12 border border-gray-100 shadow-sm">
        <XCircle className="text-red-500" size={48} />
        <span className="font-black text-lg text-gray-800">Ouvrier introuvable (ID: {id})</span>
        <p className="text-xs text-gray-400 text-center max-w-md">Cet ouvrier n'existe pas dans le registre ou la connexion au serveur a rencontré un problème.</p>
        <button onClick={() => navigate('/ouvriers')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow mt-2 flex items-center gap-2">
          <ArrowLeft size={16} /> Retour au Registre des Ouvriers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 animate-fadeIn">
      {/* Header back button & Executive Exports */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/ouvriers')}
          className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-extrabold rounded-xl border border-gray-200 flex items-center gap-2 text-xs transition-all shadow-sm hover:shadow active:scale-95"
        >
          <ArrowLeft size={16} />
          Retour à la liste des ouvriers
        </button>
        
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 text-xs transition-all active:scale-95"
            title="Télécharger la fiche complète et historique en Excel"
          >
            <Download size={15} /> Exporter Dossier Excel (.xlsx)
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl shadow-md shadow-red-600/20 flex items-center gap-2 text-xs transition-all active:scale-95"
            title="Télécharger la fiche complète et historique en PDF"
          >
            <FileText size={15} /> Exporter Dossier PDF (.pdf)
          </button>
        </div>
      </div>

      {/* Premium Profile Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Initials Circle */}
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl tracking-wide shadow-xl border border-white/20 flex-shrink-0">
              {getWorkerInitials()}
            </div>
            
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <span className="px-3 py-1 bg-white/10 text-indigo-200 border border-white/15 text-[10px] font-black rounded-full uppercase tracking-wider shadow-inner">
                  {worker.qualification || 'Ouvrier'}
                </span>
                <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-wider border ${
                  worker.statut === 'actif' 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}>
                  {worker.statut === 'actif' ? 'Actif en poste' : 'Départ enregistré'}
                </span>
              </div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white flex items-center gap-2.5">
                {worker.nom || ''} {worker.prenom || ''}
              </h1>
              <p className="text-indigo-200 text-xs md:text-sm font-semibold flex items-center gap-1.5 mt-1.5 opacity-90">
                <MapPin size={14} className="text-amber-400" /> Chantier : <strong className="text-white">{worker.site || '-'}</strong>
                {worker.matricule && (
                  <span className="ml-3 px-2 py-0.5 bg-black/25 text-[10px] rounded font-mono text-gray-300">
                    Matricule: {worker.matricule}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick summary stats in hero */}
          <div className="flex flex-wrap gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
            <div className="bg-black/20 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/5">
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">Net Accumulé</span>
              <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">{formatCurrency(getTotalPaies())}</span>
            </div>
            <div className="bg-black/20 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/5">
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">Caution EPI</span>
              <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">{formatCurrency(getTotalPonctions())}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Salaires */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Salaires Versés</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={16} /></div>
            </div>
            <div className="text-2xl font-black text-gray-900 font-mono">{formatCurrency(getTotalPaies())}</div>
          </div>
          {getLastPaieDate() && (
            <p className="text-[10px] font-bold text-gray-500 mt-3 pt-2 border-t border-gray-50 flex items-center gap-1">
              <Calendar size={12} className="text-gray-400" /> Dernier versement: {formatDate(getLastPaieDate())}
            </p>
          )}
        </div>

        {/* Card 2: Caution EPI progress */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Caution EPI Prélevée</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Shield size={16} /></div>
            </div>
            <div className="text-2xl font-black text-indigo-950 font-mono">
              {formatCurrency(getTotalPonctions())}
              <span className="text-xs text-gray-400 font-semibold ml-1">/ {formatCurrency(limitEpi)}</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-100 h-2 rounded-full mt-3 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${epiPercentage}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] font-bold text-gray-500 mt-2 flex items-center justify-between">
            <span>Progression: {epiPercentage}%</span>
            {getLastPonctionDate() && <span>Prélevé le: {formatDate(getLastPonctionDate())}</span>}
          </div>
        </div>

        {/* Card 3: Loyers Dûs */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Loyers Mensuels</span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Home size={16} /></div>
            </div>
            <div className="text-2xl font-black text-purple-950 font-mono">{formatCurrency(getTotalLoyers())}</div>
          </div>
          <p className="text-[10px] font-bold text-gray-500 mt-3 pt-2 border-t border-gray-50 flex items-center gap-1">
            <Info size={12} className="text-purple-500" /> Taux hébergement mensuel
          </p>
        </div>

        {/* Card 4: Loyers Payés */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Loyers Payés / Retenus</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Home size={16} /></div>
            </div>
            <div className="text-2xl font-black text-amber-950 font-mono">{formatCurrency(getTotalPaiementsLoyer())}</div>
          </div>
          {getLastPaiementLoyerDate() && (
            <p className="text-[10px] font-bold text-gray-500 mt-3 pt-2 border-t border-gray-50 flex items-center gap-1">
              <Calendar size={12} className="text-gray-400" /> Dernier loyer réglé: {formatDate(getLastPaiementLoyerDate())}
            </p>
          )}
        </div>
      </div>

      {/* Tab Navigation System */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Navigation Tab Header */}
        <div className="flex flex-wrap border-b border-gray-100 bg-gray-50/70 p-2 gap-1.5">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black tracking-wide uppercase transition-all ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <User size={15} /> Profil &amp; Statuts
          </button>
          
          <button
            onClick={() => setActiveTab('paies')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black tracking-wide uppercase transition-all ${
              activeTab === 'paies'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <FileText size={15} /> Règlements de Paie ({paies.length})
          </button>
          
          <button
            onClick={() => setActiveTab('epi')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black tracking-wide uppercase transition-all ${
              activeTab === 'epi'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Shield size={15} /> Caution &amp; EPI ({ponctions.length})
          </button>

          <button
            onClick={() => setActiveTab('programme_epi')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black tracking-wide uppercase transition-all ${
              activeTab === 'programme_epi'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Calendar size={15} /> Programme EPI
          </button>
          
          <button
            onClick={() => setActiveTab('loyer')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black tracking-wide uppercase transition-all ${
              activeTab === 'loyer'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Home size={15} /> Hébergement &amp; Loyers ({paiementsLoyer.length})
          </button>
          
          <button
            onClick={() => setActiveTab('pointages')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black tracking-wide uppercase transition-all ${
              activeTab === 'pointages'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Clock size={15} /> Pointages ({pointages.length})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-8">
          {/* TAB 1: Profile & Status Details */}
          {activeTab === 'profile' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Departure settlement alert if inactive */}
              {worker.statut === 'parti' && (
                <div className="p-6 bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-200 rounded-2xl shadow-sm">
                  <h3 className="font-black text-sm uppercase tracking-wider text-rose-950 flex items-center gap-2 mb-3">
                    <ShieldAlert className="text-rose-600" size={20} />
                    Solde de Tout Compte — Caution EPI &amp; Départ
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-xs font-bold text-rose-900">
                    <div className="bg-white/60 p-3.5 rounded-xl border border-rose-100/50">
                      <span className="text-gray-500 font-semibold block mb-1">EPI Restitués</span>
                      {renderEpiStatusBadge(getEpiReturnedLabel())}
                    </div>
                    <div className="bg-white/60 p-3.5 rounded-xl border border-rose-100/50">
                      <span className="text-gray-500 font-semibold block mb-1">Remboursement Validé</span>
                      <span className="text-sm text-emerald-700 font-black">{formatCurrency(worker.epi_remboursement || 0)}</span>
                    </div>
                    <div className="bg-white/60 p-3.5 rounded-xl border border-rose-100/50">
                      <span className="text-gray-500 font-semibold block mb-1">Déduction pour perte</span>
                      <span className="text-sm text-rose-700 font-black">{formatCurrency(worker.epi_deduction || 0)}</span>
                    </div>
                    <div className="bg-white/60 p-3.5 rounded-xl border border-rose-100/50">
                      <span className="text-gray-500 font-semibold block mb-1">Statut Règlement</span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-block border ${
                        worker.epi_settled 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {worker.epi_settled ? 'Règlement Clôturé' : 'À régler lors de la paie'}
                      </span>
                    </div>
                  </div>
                  {worker.epi_observations && (
                    <div className="mt-4 p-3 bg-white/40 rounded-xl text-xs font-medium text-gray-700 border border-gray-100">
                      <strong>Observations de départ :</strong> {worker.epi_observations}
                    </div>
                  )}
                </div>
              )}

              {/* Personal Info Card */}
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2 mb-4">
                  <User className="text-indigo-600" size={18} />
                  Informations Générales
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Matricule Ouvrier</span>
                    <span className="font-black text-sm text-gray-900 font-mono">{worker.matricule || 'Non renseigné'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Nom Complet</span>
                    <span className="font-black text-sm text-gray-900">{worker.nom || ''} {worker.prenom || ''}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Chantier / Site</span>
                    <span className="font-black text-sm text-indigo-700 flex items-center gap-1"><MapPin size={14} />{worker.site || '-'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Qualification</span>
                    <span className="font-black text-sm text-gray-900 flex items-center gap-1"><Award size={14} className="text-amber-500" />{worker.qualification || '-'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Date d'intégration</span>
                    <span className="font-bold text-sm text-gray-800 flex items-center gap-1"><Calendar size={14} />{worker.date_entree ? formatDate(worker.date_entree) : '-'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Numéro Mobile de Contact</span>
                    <span className="font-bold text-sm text-gray-800 flex items-center gap-1"><Phone size={14} />{worker.telephone || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Payment details Card */}
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2 mb-4">
                  <CreditCard className="text-indigo-600" size={18} />
                  Coordonnées de Règlement Mobile Money
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Opérateur Partenaire</span>
                    <span className="font-black text-sm text-gray-900 uppercase tracking-wide inline-flex items-center gap-1.5">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                        String(worker.operateur || '').toLowerCase().includes('wave') ? 'bg-cyan-500' : 'bg-orange-500'
                      }`} />
                      {worker.operateur || 'Non configuré'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Numéro de Transfert</span>
                </div>
              </div>

              {/* Bilan & Synthèse Comptable Totale */}
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2 mb-4">
                  <Activity className="text-emerald-600" size={18} />
                  Bilan &amp; Synthèse Comptable Globale (Informations Totales)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/50 p-5 rounded-2xl border border-indigo-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block mb-1">Cumul Salaires Bruts</span>
                      <span className="text-xl font-black text-indigo-950 font-mono">
                        {formatCurrency((paies || []).reduce((s, p) => s + (Number(p?.salaire_brut) || 0), 0))}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-600 mt-2 block">Somme totale des gains bruts</span>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-5 rounded-2xl border border-emerald-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">Cumul Net Payé</span>
                      <span className="text-xl font-black text-emerald-900 font-mono">{formatCurrency(getTotalPaies())}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 mt-2 block">Montant net perçu via Mobile Money</span>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/50 p-5 rounded-2xl border border-amber-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-1">Reste Caution EPI</span>
                      <span className="text-xl font-black text-amber-950 font-mono">
                        {formatCurrency(Math.max(0, limitEpi - getTotalPonctions()))}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-700 mt-2 block">
                      Prélevé : {formatCurrency(getTotalPonctions())} ({epiPercentage}%)
                    </span>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/50 p-5 rounded-2xl border border-purple-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block mb-1">Assiduité &amp; Retenues Loyer</span>
                      <span className="text-xl font-black text-purple-950 font-mono">{formatCurrency(getTotalPaiementsLoyer())}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-purple-700 mt-2 block">
                      {paies.length} bulletin(s) • {pointages.length} pointage(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Aperçu rapide des 5 derniers règlements de salaire */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <History className="text-indigo-600" size={18} />
                    Aperçu des 5 derniers bulletins &amp; règlements
                  </h3>
                  {paies.length > 5 && (
                    <button
                      onClick={() => setActiveTab('paies')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                    >
                      Voir tous les {paies.length} bulletins <ChevronRight size={14} />
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                        <th className="py-3 px-4">Semaine</th>
                        <th className="py-3 px-4">Date Paiement</th>
                        <th className="py-3 px-4 text-right">Brut</th>
                        <th className="py-3 px-4 text-right">Retenue EPI</th>
                        <th className="py-3 px-4 text-right">Loyer</th>
                        <th className="py-3 px-5 text-right font-black text-emerald-900 bg-emerald-50/40">Net Payé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                      {paies.slice(0, 5).map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-black rounded text-[11px]">{p.semaine || '-'}</span></td>
                          <td className="py-3 px-4 text-gray-600 font-bold">{formatDate(p.date)}</td>
                          <td className="py-3 px-4 text-right font-mono text-gray-700">{formatCurrency(p.salaire_brut)}</td>
                          <td className="py-3 px-4 text-right font-mono text-amber-600">{Number(p.ponction) > 0 ? formatCurrency(p.ponction) : '-'}</td>
                          <td className="py-3 px-4 text-right font-mono text-purple-600">{Number(p.loyer) > 0 ? formatCurrency(p.loyer) : '-'}</td>
                          <td className="py-3 px-5 text-right font-mono font-black text-sm text-emerald-700 bg-emerald-50/30">{formatCurrency(p.net_a_payer)}</td>
                        </tr>
                      ))}
                      {paies.length === 0 && (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-gray-400 font-medium">Aucun bulletin ou règlement enregistré pour l'instant.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* TAB 2: Payroll History */}
          {activeTab === 'paies' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2">
                  <FileText className="text-indigo-600" size={18} />
                  Bulletins &amp; Règlements de Salaire
                </h3>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{paies.length} paies</span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                      <th className="py-3 px-4">Semaine</th>
                      <th className="py-3 px-4">Date Règlement</th>
                      <th className="py-3 px-4">Période Travaillée</th>
                      <th className="py-3 px-4 text-right">Salaire Brut</th>
                      <th className="py-3 px-4 text-right">Retenue EPI</th>
                      <th className="py-3 px-4 text-right">Loyer</th>
                      <th className="py-3 px-4 text-right">Remb. EPI</th>
                      <th className="py-3 px-4 text-right">Déd. EPI</th>
                      <th className="py-3 px-5 text-right font-black text-emerald-950 bg-emerald-50/30">Net payé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paies.length > 0 ? (
                      paies.map((paie) => (
                        <tr key={paie.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-black rounded text-[11px]">
                              {paie.semaine || '-'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-600 font-bold">{formatDate(paie.date)}</td>
                          <td className="py-3.5 px-4 text-gray-500 font-medium">
                            {paie.date_debut && paie.date_fin ? (
                              <span>{formatDate(paie.date_debut)} au {formatDate(paie.date_fin)}</span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-700">{formatCurrency(paie.salaire_brut)}</td>
                          <td className={`py-3.5 px-4 text-right font-mono font-bold ${Number(paie.ponction) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {formatCurrency(paie.ponction)}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-mono font-bold ${Number(paie.loyer) > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                            {formatCurrency(paie.loyer)}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-mono font-bold ${Number(paie.epi_remboursement) > 0 ? 'text-emerald-600 font-black' : 'text-gray-400'}`}>
                            {Number(paie.epi_remboursement) > 0 ? `+${formatCurrency(paie.epi_remboursement)}` : '-'}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-mono font-bold ${Number(paie.epi_deduction) > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                            {Number(paie.epi_deduction) > 0 ? `-${formatCurrency(paie.epi_deduction)}` : '-'}
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono font-black text-sm text-emerald-700 bg-emerald-50/30">
                            {formatCurrency(paie.net_a_payer)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="text-center py-12 text-gray-400 font-semibold">
                          Aucun règlement de salaire enregistré pour cet ouvrier.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: EPI & Caution deposit */}
          {activeTab === 'epi' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header stats & alert */}
              <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase block tracking-wider">État cautionnement EPI</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-indigo-950">{epiStatus.status}</span>
                    <span className="text-xs bg-indigo-200 text-indigo-800 px-2.5 py-0.5 rounded-full font-black font-mono">
                      {formatCurrency(getTotalPonctions())} / {formatCurrency(limitEpi)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">{epiStatus.desc}</p>
                </div>
                <div className="w-full md:w-48">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                    <span>Progression</span>
                    <span>{epiPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden border border-gray-100">
                    <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${epiPercentage}%` }} />
                  </div>
                </div>
              </div>

              {/* Table of deposits */}
              <div className="space-y-4">
                <h4 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2">
                  <Shield className="text-indigo-600" size={18} />
                  Historique détaillé des prélèvements de caution
                </h4>
                
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                        <th className="py-3 px-4">Date de prélèvement</th>
                        <th className="py-3 px-4">Montant prélevé</th>
                        <th className="py-3 px-4">Désignation / Motif</th>
                        <th className="py-3 px-4 text-right">Cumul caution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                      {ponctions.length > 0 ? (
                        ponctions.map((ponction) => (
                          <tr key={ponction.id} className="hover:bg-indigo-50/20 transition-colors">
                            <td className="py-3 px-4 font-mono">{formatDate(ponction.date)}</td>
                            <td className="py-3 px-4 text-amber-600 font-black">{formatCurrency(ponction.montant)}</td>
                            <td className="py-3 px-4 font-medium text-gray-500">{ponction.motif || 'Retenue EPI hebdomadaire'}</td>
                            <td className="py-3 px-4 text-right font-black font-mono text-indigo-900">{formatCurrency(ponction.cumul || ponction.montant)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center py-12 text-gray-400">
                            Aucune retenue de caution enregistrée.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION: Équipements EPI Fournis */}
              <div className="space-y-4 pt-6 border-t border-gray-100 mt-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <Shield className="text-purple-600" size={18} />
                    Suivi des équipements remis
                  </h4>
                </div>
                
                {/* Formulaire d'ajout */}
                <form onSubmit={handleAddEpiFourni} className="flex flex-wrap items-end gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Équipement</label>
                    <select
                      required
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white"
                      value={newEpiFourni.equipement}
                      onChange={e => {
                        const val = e.target.value;
                        let px = newEpiFourni.prix;
                        if (val === 'Casque') px = '3000';
                        else if (val === 'Gilet') px = '3000';
                        else if (val === 'Botte Ordinaire') px = '3000';
                        else if (val === 'Botte de Sécurité') px = '6000';
                        else if (val === 'Gant') px = '';
                        
                        setNewEpiFourni({...newEpiFourni, equipement: val, prix: px});
                      }}
                    >
                      <option value="">Sélectionnez un équipement...</option>
                      <option value="Casque">Casque</option>
                      <option value="Gilet">Gilet</option>
                      <option value="Botte Ordinaire">Botte Ordinaire</option>
                      <option value="Botte de Sécurité">Botte de Sécurité</option>
                      <option value="Gant">Gant</option>
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Prix unitaire</label>
                    <input
                      type="number"
                      required
                      placeholder="Ex: 5000"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      value={newEpiFourni.prix}
                      onChange={e => setNewEpiFourni({...newEpiFourni, prix: e.target.value})}
                    />
                  </div>
                  <div className="w-40">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Date de remise</label>
                    <input
                      type="date"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                      value={newEpiFourni.date_remise}
                      onChange={e => setNewEpiFourni({...newEpiFourni, date_remise: e.target.value})}
                    />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors whitespace-nowrap">
                    Enregistrer
                  </button>
                </form>

                {/* Tableau */}
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Équipement</th>
                        <th className="py-3 px-4 text-right">Prix</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                      {epiFournis.length > 0 ? (
                        epiFournis.map((item) => (
                          <tr key={item.id} className="hover:bg-purple-50/20 transition-colors">
                            <td className="py-3 px-4 font-mono text-gray-500">{formatDate(item.date_remise)}</td>
                            <td className="py-3 px-4 text-gray-900 font-bold">{item.equipement}</td>
                            <td className="py-3 px-4 text-right font-black font-mono text-purple-700">{formatCurrency(item.prix)}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleDeleteEpiFourni(item.id)}
                                className="text-red-400 hover:text-red-600 p-1 bg-red-50 hover:bg-red-100 rounded transition-colors inline-flex"
                                title="Supprimer"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center py-8 text-gray-400">
                            Aucun équipement enregistré.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {epiFournis.length > 0 && (
                      <tfoot className="bg-purple-50 border-t-2 border-purple-100">
                        <tr>
                          <td colSpan="2" className="py-3 px-4 text-right font-extrabold text-purple-900 uppercase tracking-wider">
                            Total Équipements Fournis :
                          </td>
                          <td className="py-3 px-4 text-right font-black font-mono text-purple-900 text-sm">
                            {formatCurrency(epiFournis.reduce((sum, item) => sum + Number(item.prix), 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3.5: Programme EPI */}
          {activeTab === 'programme_epi' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 bg-sky-50/50 border border-sky-100 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-sky-500 uppercase block tracking-wider">Programmation des Prélèvements EPI</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-sky-950">Déductions futures automatisées</span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">Définissez des montants à prélever automatiquement selon la semaine lors du calcul de la paie.</p>
                </div>
                <form onSubmit={handleAddEpiProgramme} className="flex flex-wrap gap-2 w-full md:w-auto items-end justify-end">
                  <div className="flex gap-2 w-full md:w-auto">
                    <select
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1 md:w-64 disabled:bg-gray-100 disabled:text-gray-400"
                      value={newProgramme.semaine}
                      onChange={e => setNewProgramme({...newProgramme, semaine: e.target.value})}
                      disabled={epiProgrammes.length > 0}
                    >
                      <option value="">Sélectionnez la semaine</option>
                      {(() => {
                        try {
                          const options = [];
                          const today = new Date();
                          for (let i = -4; i < 48; i++) {
                            const targetDate = addWeeks(today, i);
                            const weekNumber = getISOWeek(targetDate);
                            const year = getISOWeekYear(targetDate);
                            const weekVal = `${year}-S${String(weekNumber).padStart(2, '0')}`;
                            const start = startOfWeek(targetDate, { weekStartsOn: 1 });
                            const end = endOfWeek(targetDate, { weekStartsOn: 1 });
                            const label = `${weekVal} (${format(start, 'yyyy/MM/dd')} - ${format(end, 'yyyy/MM/dd')})`;
                            options.push(<option key={weekVal} value={weekVal}>{label}</option>);
                          }
                          return options;
                        } catch (e) {
                          // Fallback if formatting fails
                          return Array.from({length: 52}, (_, i) => (
                            <option key={i+1} value={`SEMAINE ${i+1}`}>SEMAINE {i+1}</option>
                          ));
                        }
                      })()}
                    </select>
                    <input
                      type="number"
                      placeholder="Montant (ex: 2000)"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-32 disabled:bg-gray-100 disabled:text-gray-400"
                      value={newProgramme.montant}
                      onChange={e => setNewProgramme({...newProgramme, montant: e.target.value})}
                      disabled={epiProgrammes.length > 0}
                    />
                    <button 
                      type="submit" 
                      disabled={epiProgrammes.length > 0}
                      className={`px-4 py-2 text-white rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${epiProgrammes.length > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700'}`}
                    >
                      Planifier
                    </button>
                    {epiProgrammes.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => handleDeleteEpiProgramme(epiProgrammes[0].id)}
                        className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-100 whitespace-nowrap transition-colors"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="space-y-4">
                <h4 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2">
                  <Calendar className="text-sky-600" size={18} />
                  Liste des prélèvements EPI programmés
                </h4>
                
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                        <th className="py-3 px-4">Date de Création</th>
                        <th className="py-3 px-4">Semaine</th>
                        <th className="py-3 px-4 text-right">Montant à prélever</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                      {epiProgrammes.length > 0 ? (
                        epiProgrammes.map((prog) => (
                          <tr key={prog.id} className="hover:bg-sky-50/20 transition-colors">
                            <td className="py-3 px-4 font-mono">{formatDate(prog.created_at)}</td>
                            <td className="py-3 px-4">{prog.semaine}</td>
                            <td className="py-3 px-4 text-right text-sky-700">{formatCurrency(prog.montant)}</td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleDeleteEpiProgramme(prog.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Supprimer"
                              >
                                <XCircle size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center py-12 text-gray-400">
                            Aucune programmation EPI pour cet ouvrier.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Rent payments */}
          {activeTab === 'loyer' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header card */}
              <div className="p-6 bg-purple-50/50 border border-purple-100 rounded-2xl flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-purple-600 uppercase block tracking-wider">Statut hébergement du mois</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-purple-950 flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${loyerStatus.color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {loyerStatus.status}
                    </span>
                  </div>
                </div>
                {loyers.length > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase">Loyer mensuel contractuel</span>
                    <span className="text-xl font-black text-purple-950 font-mono">{formatCurrency(loyers[0]?.montant_mensuel)}</span>
                  </div>
                )}
              </div>

              {/* Table of payments */}
              <div className="space-y-4">
                <h4 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2">
                  <Home className="text-purple-600" size={18} />
                  Registre de prélèvement du loyer
                </h4>
                
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                        <th className="py-3 px-4">Date Règlement</th>
                        <th className="py-3 px-4">Mois de loyer</th>
                        <th className="py-3 px-4">Année</th>
                        <th className="py-3 px-4 text-right">Montant déduit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                      {paiementsLoyer.length > 0 ? (
                        paiementsLoyer.map((paiement) => (
                          <tr key={paiement.id} className="hover:bg-purple-50/10 transition-colors">
                            <td className="py-3 px-4 font-mono">{formatDate(paiement.date_paiement || paiement.date)}</td>
                            <td className="py-3 px-4 capitalize font-bold text-purple-900">{paiement.mois || '-'}</td>
                            <td className="py-3 px-4 font-mono text-gray-500">{paiement.annee || '-'}</td>
                            <td className="py-3 px-4 text-right font-black font-mono text-gray-900">{formatCurrency(paiement.montant)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center py-12 text-gray-400">
                            Aucune retenue de loyer enregistrée.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Pointage registry */}
          {activeTab === 'pointages' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2">
                  <Clock className="text-indigo-600" size={18} />
                  Journal individuel des pointages importés
                </h3>
                <span className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">{pointages.length} fiches</span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                      <th className="py-3 px-4">Date de présence</th>
                      <th className="py-3 px-4 text-right">Salaire Brut Cumulé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                    {pointages.length > 0 ? (
                      pointages.map((pointage) => (
                        <tr key={pointage.id} className="hover:bg-indigo-50/10 transition-colors">
                          <td className="py-3 px-4 font-mono">{formatDate(pointage.date)}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-700 font-mono">{formatCurrency(pointage.salaire_brut)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className="text-center py-12 text-gray-400">
                          Aucun pointage importé pour cet ouvrier.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Popup */}
          {showSuccessPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 animate-bounce-in max-w-sm w-full mx-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={32} />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-black text-gray-900 mb-2">Enregistré !</h3>
                  <p className="text-sm text-gray-500 font-medium">L'équipement EPI a bien été ajouté au dossier de l'ouvrier.</p>
                </div>
                <button
                  onClick={() => setShowSuccessPopup(false)}
                  className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
