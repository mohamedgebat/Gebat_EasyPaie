import { apiFetch } from '../lib/api';
import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit, Trash2, CheckCircle, Clock, Home, 
  DollarSign, Users, Calendar, ArrowRight, X, Sparkles, 
  RefreshCw, Building2, CheckCircle2, AlertCircle, Filter,
  Download, FileText
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import gebatLogo from '../assets/logo_gebat.png';

export default function Loyers() {
  const [loyers, setLoyers] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [ouvriers, setOuvriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingLoyer, setEditingLoyer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [workerStatusFilter, setWorkerStatusFilter] = useState('ALL');
  const [formData, setFormData] = useState({
    ouvrier_id: '',
    site: '',
    qualification: '',
    montant_mensuel: '',
    type: 'long_terme',
    mois: new Date().toLocaleString('fr-FR', { month: 'long' }),
    annee: new Date().getFullYear(),
  });
  const [paymentFormData, setPaymentFormData] = useState({
    ouvrier_id: '',
    mois: new Date().toLocaleString('fr-FR', { month: 'long' }),
    annee: new Date().getFullYear(),
    montant: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loyersRes, paiementsRes, ouvriersRes] = await Promise.all([
        apiFetch('/api/loyers'),
        apiFetch('/api/paiements-loyer'),
        apiFetch('/api/ouvriers'),
      ]);
      setLoyers(await loyersRes.json());
      setPaiements(await paiementsRes.json());
      setOuvriers(await ouvriersRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const path = editingLoyer
        ? `/api/loyers/${editingLoyer.id}`
        : '/api/loyers';
      
      const method = editingLoyer ? 'PUT' : 'POST';
      
      await apiFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      setShowModal(false);
      setEditingLoyer(null);
      setFormData({
        ouvrier_id: '',
        site: '',
        qualification: '',
        montant_mensuel: '',
        type: 'long_terme',
        mois: new Date().toLocaleString('fr-FR', { month: 'long' }),
        annee: new Date().getFullYear(),
      });
      fetchData();
    } catch (error) {
      console.error('Error saving loyer:', error);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/paiements-loyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentFormData),
      });

      setShowPaymentModal(false);
      setPaymentFormData({
        ouvrier_id: '',
        mois: new Date().toLocaleString('fr-FR', { month: 'long' }),
        annee: new Date().getFullYear(),
        montant: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error saving payment:', error);
    }
  };

  const handleEdit = (loyer) => {
    setEditingLoyer(loyer);
    setFormData(loyer);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce loyer ?')) {
      try {
        await apiFetch(`/api/loyers/${id}`, {
          method: 'DELETE',
        });
        fetchData();
      } catch (error) {
        console.error('Error deleting loyer:', error);
      }
    }
  };

  const isPaidThisMonth = (ouvrierId, montantMensuel) => {
    const currentMonth = new Date().toLocaleString('fr-FR', { month: 'long' });
    const currentYear = new Date().getFullYear();
    
    const workerPaymentsThisMonth = paiements.filter(
      p => p.ouvrier_id === ouvrierId && 
           p.mois.toLowerCase() === currentMonth.toLowerCase() && 
           Number(p.annee) === currentYear
    );
    
    if (workerPaymentsThisMonth.length === 0) return null;
    
    const totalPaid = workerPaymentsThisMonth.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
    
    if (totalPaid >= Number(montantMensuel)) {
      return workerPaymentsThisMonth[0]; // Return the first payment object as a truthy status
    }
    
    return null;
  };

  const getLastPaymentDate = (ouvrierId) => {
    const workerPayments = paiements.filter(p => p.ouvrier_id === ouvrierId);
    if (workerPayments.length === 0) return null;
    
    const sorted = workerPayments.sort((a, b) => new Date(b.date_paiement) - new Date(a.date_paiement));
    return sorted[0].date_paiement;
  };

  const sitesList = useMemo(() => {
    const set = new Set(loyers.map(l => l.site || (ouvriers.find(o => o.id === l.ouvrier_id)?.site) || 'Non assigné').filter(Boolean));
    return Array.from(set).sort();
  }, [loyers, ouvriers]);

  const filteredLoyers = useMemo(() => {
    return loyers.filter((loyer) => {
      const ouvrier = ouvriers.find(o => o.id === loyer.ouvrier_id);
      const workerSite = loyer.site || ouvrier?.site || 'Non assigné';
      const workerStatus = ouvrier?.statut || 'actif';
      const payment = isPaidThisMonth(loyer.ouvrier_id, loyer.montant_mensuel);

      // 1. Search term
      const matchesSearch = !searchTerm || (
        ouvrier?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ouvrier?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workerSite?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loyer.qualification?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // 2. Site filter
      const matchesSite = siteFilter === 'ALL' || workerSite === siteFilter;

      // 3. Worker Status filter
      const matchesWorkerStatus = workerStatusFilter === 'ALL' || workerStatus === workerStatusFilter;

      // 4. Payment Status filter
      let matchesPayment = true;
      if (paymentStatusFilter === 'paid') {
        matchesPayment = !!payment;
      } else if (paymentStatusFilter === 'pending') {
        matchesPayment = !payment;
      }

      return matchesSearch && matchesSite && matchesWorkerStatus && matchesPayment;
    });
  }, [loyers, ouvriers, searchTerm, siteFilter, paymentStatusFilter, workerStatusFilter, paiements]);

  const stats = useMemo(() => {
    const totalMensuel = filteredLoyers.reduce((sum, l) => sum + (Number(l.montant_mensuel) || 0), 0);
    const ouvriersLoges = filteredLoyers.length;
    
    let payesCeMois = 0;
    let nonPayesCeMois = 0;
    
    filteredLoyers.forEach(l => {
      if (isPaidThisMonth(l.ouvrier_id, l.montant_mensuel)) {
        payesCeMois++;
      } else {
        nonPayesCeMois++;
      }
    });

    return { totalMensuel, ouvriersLoges, payesCeMois, nonPayesCeMois };
  }, [filteredLoyers, paiements]);

  const handleExportExcel = () => {
    try {
      const titleRow = ['GESTION DES LOYERS & HÉBERGEMENTS - GEBAT EASYPAIE'];
      const subtitleRow = [`Site : ${siteFilter === 'ALL' ? 'Tous' : siteFilter} | Statut Paiement : ${paymentStatusFilter === 'ALL' ? 'Tous' : paymentStatusFilter} | Généré le ${new Date().toLocaleDateString('fr-FR')}`];
      const emptyRow = [];
      const headerRow = [
        'Ouvrier', 'Qualification', 'Chantier / Site', 'Statut Poste',
        'Loyer Mensuel (FCFA)', 'Période (Mois/Année)', 'Statut Règlement Paie', 'Date Paiement'
      ];

      const dataRows = filteredLoyers.map(l => {
        const payment = getPaymentForCurrentMonth(l.ouvrier_id);
        const w = ouvriers.find(o => o.id === l.ouvrier_id);
        return [
          w ? `${w.nom} ${w.prenom || ''}`.trim() : `Ouvrier #${l.ouvrier_id}`,
          l.qualification || w?.qualification || '-',
          l.site || w?.site || '-',
          w?.statut === 'actif' ? 'Actif' : 'Sorti / Parti',
          Number(l.montant_mensuel) || 0,
          `${paymentFormData.mois} ${paymentFormData.annee}`,
          payment ? 'Payé sur paie' : 'En attente',
          payment?.date_paiement ? formatDate(payment.date_paiement) : '-'
        ];
      });

      const totalRowIdx = dataRows.length + 4;
      const totalRow = [
        'TOTAL GÉNÉRAL', '', '', '',
        filteredLoyers.reduce((sum, l) => sum + (Number(l.montant_mensuel) || 0), 0),
        '', '', ''
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
              fill: { fgColor: { rgb: '1E3A8A' } },
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

      sheet['!cols'] = [
        { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
        { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 18 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Loyers');
      XLSX.writeFile(workbook, `Gestion_Loyers_GEBAT_${formatDate(new Date())}.xlsx`);
    } catch (error) {
      console.error('Erreur export Excel Loyers:', error);
      alert('Erreur lors de l\'exportation Excel');
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(30, 58, 138);
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('GESTION DES LOYERS & HÉBERGEMENTS - GEBAT EASYPAIE', 14, 13);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Site : ${siteFilter === 'ALL' ? 'Tous' : siteFilter} | Statut Paiement : ${paymentStatusFilter === 'ALL' ? 'Tous' : paymentStatusFilter} | Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 21);

      const head = [['Ouvrier', 'Qualification', 'Chantier / Site', 'Statut', 'Loyer Mensuel', 'Période', 'Règlement Paie', 'Date Paiement']];
      const body = filteredLoyers.map(l => {
        const payment = getPaymentForCurrentMonth(l.ouvrier_id);
        const w = ouvriers.find(o => o.id === l.ouvrier_id);
        return [
          w ? `${w.nom} ${w.prenom || ''}`.trim() : `Ouvrier #${l.ouvrier_id}`,
          l.qualification || w?.qualification || '-',
          l.site || w?.site || '-',
          w?.statut === 'actif' ? 'Actif' : 'Sorti',
          formatCurrency(Number(l.montant_mensuel) || 0),
          `${paymentFormData.mois} ${paymentFormData.annee}`,
          payment ? 'Payé sur paie' : 'En attente',
          payment?.date_paiement ? formatDate(payment.date_paiement) : '-'
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

      doc.save(`Gestion_Loyers_GEBAT_${formatDate(new Date())}.pdf`);
    } catch (error) {
      console.error('Erreur export PDF Loyers:', error);
      alert('Erreur lors de l\'exportation PDF');
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Premium Hero Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-purple-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <Home className="text-amber-400" size={30} />
              </div>
              <span className="px-3.5 py-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold rounded-full uppercase tracking-wider shadow-sm">
                Logement & Hébergement GEBAT
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
              Gestion des Loyers
            </h1>
            <p className="text-blue-100 mt-2 max-w-2xl text-sm md:text-base leading-relaxed font-normal">
              Suivez les loyers mensuels des ouvriers logés par chantier et enregistrez en un clic les retenues ou règlements effectués sur leur paie.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="px-5 py-3.5 bg-emerald-600/90 hover:bg-emerald-600 text-white font-extrabold rounded-2xl transition-all shadow-lg flex items-center gap-2.5 text-sm border border-emerald-400/50 backdrop-blur-md"
              title="Exporter la gestion des loyers en Excel (.xlsx)"
            >
              <Download size={18} />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="px-5 py-3.5 bg-red-600/90 hover:bg-red-600 text-white font-extrabold rounded-2xl transition-all shadow-lg flex items-center gap-2.5 text-sm border border-red-400/50 backdrop-blur-md"
              title="Exporter la gestion des loyers au format PDF (.pdf)"
            >
              <FileText size={18} />
              <span>Export PDF</span>
            </button>
            <button
              onClick={fetchData}
              className="p-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl transition-all shadow-md"
              title="Rafraîchir les données"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => {
                setPaymentFormData({
                  ouvrier_id: '',
                  mois: new Date().toLocaleString('fr-FR', { month: 'long' }),
                  annee: new Date().getFullYear(),
                  montant: '',
                });
                setShowPaymentModal(true);
              }}
              className="px-5 py-3.5 bg-white/15 hover:bg-white/25 text-white font-extrabold rounded-2xl border border-white/25 shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all text-sm whitespace-nowrap"
            >
              <CheckCircle2 size={18} className="text-emerald-400" />
              Enregistrer un paiement
            </button>
            <button
              onClick={() => {
                setEditingLoyer(null);
                setFormData({
                  ouvrier_id: '',
                  site: '',
                  qualification: '',
                  montant_mensuel: '',
                  mois: new Date().toLocaleString('fr-FR', { month: 'long' }),
                  annee: new Date().getFullYear(),
                });
                setShowModal(true);
              }}
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2.5 transform active:scale-95 transition-all text-sm whitespace-nowrap"
            >
              <Plus size={20} className="stroke-[3]" />
              Programmer un loyer
            </button>
          </div>
        </div>
      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Mensuel Engagé</span>
            <div className="text-2xl lg:text-3xl font-black text-gray-900 mt-1">{formatCurrency(stats.totalMensuel)}</div>
            <p className="text-xs text-blue-600 font-semibold mt-1 flex items-center gap-1">
              <Building2 size={12} /> Tous chantiers confondus
            </p>
          </div>
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <DollarSign size={26} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Ouvriers Logés</span>
            <div className="text-3xl font-black text-indigo-600 mt-1">{stats.ouvriersLoges}</div>
            <p className="text-xs text-indigo-700 font-semibold mt-1 flex items-center gap-1">
              <Users size={12} /> Inscrits au registre
            </p>
          </div>
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Home size={26} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Réglés Ce Mois</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{stats.payesCeMois}</div>
            <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> Loyer à jour
            </p>
          </div>
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={26} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">En Attente / Retenue</span>
            <div className="text-3xl font-black text-amber-600 mt-1">{stats.nonPayesCeMois}</div>
            <p className="text-xs text-amber-700 font-semibold mt-1 flex items-center gap-1">
              <Clock size={12} /> À déduire sur paie
            </p>
          </div>
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Calendar size={26} />
          </div>
        </div>
      </div>

      {/* Advanced Multi-Filter & Search Bar */}
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl flex-shrink-0">
              <Filter size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-sm text-gray-900 flex items-center gap-2">
                Filtres & Recherche des Loyers
                {(siteFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || workerStatusFilter !== 'ALL' || searchTerm) && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
                    Actif ({filteredLoyers.length}/{loyers.length})
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400 font-semibold">
                Filtrez les hébergements par chantier, état du paiement ou statut du collaborateur.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {(siteFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || workerStatusFilter !== 'ALL' || searchTerm) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSiteFilter('ALL');
                  setPaymentStatusFilter('ALL');
                  setWorkerStatusFilter('ALL');
                }}
                className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-sm"
                title="Réinitialiser tous les filtres"
              >
                <X size={15} /> Effacer les filtres
              </button>
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
            <div className="text-xs font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-xl whitespace-nowrap">
              Affichage de <strong className="text-blue-600">{filteredLoyers.length}</strong> sur {loyers.length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Quick Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher nom, site, métier..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Site Filter */}
          <div>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-blue-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all cursor-pointer"
            >
              <option value="ALL">🏢 Tous les Chantiers ({sitesList.length})</option>
              {sitesList.map(s => (
                <option key={s} value={s}>📍 {s}</option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-gray-800 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all cursor-pointer"
            >
              <option value="ALL">⚡ Tous les états du loyer</option>
              <option value="paid">✅ Payé / À jour ce mois</option>
              <option value="pending">⏳ En attente de retenue</option>
            </select>
          </div>

          {/* Worker Status Filter */}
          <div>
            <select
              value={workerStatusFilter}
              onChange={(e) => setWorkerStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-gray-800 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-100 transition-all cursor-pointer"
            >
              <option value="ALL">👥 Actifs & Sortis</option>
              <option value="actif">🟢 Actifs uniquement</option>
              <option value="parti">🔴 Sortis / Quitté le dortoir</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loyers Table */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Home className="text-blue-600" size={22} />
            Registre des Ouvriers Logés & Quittances
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 flex items-center gap-1.5 text-xs transition-all shadow-2xs"
            >
              <Download size={15} /> Export Excel (.xlsx)
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-800 font-extrabold rounded-xl border border-red-200 flex items-center gap-1.5 text-xs transition-all shadow-2xs"
            >
              <FileText size={15} /> Export PDF (.pdf)
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <p className="text-xs font-bold text-gray-500">Chargement des loyers d'hébergement...</p>
          </div>
        ) : filteredLoyers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
            <Home size={40} className="mb-2 text-gray-300 stroke-[1.5]" />
            <p className="text-base font-bold text-gray-700">Aucun ouvrier programmé pour le loyer</p>
            <p className="text-xs text-gray-400 mt-1">Programmez un ouvrier en cliquant sur « + Programmer un loyer » ci-dessus.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  <th className="py-4 px-6">Ouvrier Logé</th>
                  <th className="py-4 px-6">Chantier / Site</th>
                  <th className="py-4 px-6">Qualification</th>
                  <th className="py-4 px-6 text-right">Loyer Total</th>
                  <th className="py-4 px-6 text-center">Tranches</th>
                  <th className="py-4 px-6 text-right">Montant/Semaine</th>
                  <th className="py-4 px-6">Début Hébergement</th>
                  <th className="py-4 px-6">Statut Ce Mois</th>
                  <th className="py-4 px-6">Dernier Paiement</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLoyers.map((loyer) => {
                  const ouvrier = ouvriers.find(o => o.id === loyer.ouvrier_id);
                  const payment = isPaidThisMonth(loyer.ouvrier_id, loyer.montant_mensuel);
                  const lastPaymentDate = getLastPaymentDate(loyer.ouvrier_id);
                  
                  const nombreTranches = Number(loyer.nombre_tranches) || 1;
                  const montantParSemaine = Math.ceil((Number(loyer.montant_mensuel) || 0) / nombreTranches);
                  
                  return (
                    <tr key={loyer.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-4 px-6 font-black text-gray-900 text-sm">
                        {ouvrier ? `${ouvrier.nom} ${ouvrier.prenom || ''}` : `Ouvrier #${loyer.ouvrier_id}`}
                      </td>
                      <td className="py-4 px-6 font-semibold text-gray-700">
                        <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs">
                          {loyer.site || ouvrier?.site || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-semibold text-indigo-600">
                        {loyer.qualification || ouvrier?.qualification || '-'}
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-black text-blue-900 text-sm">
                        {formatCurrency(loyer.montant_mensuel)}
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-gray-600">
                        {nombreTranches}
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-bold text-indigo-600 text-sm">
                        {formatCurrency(montantParSemaine)}
                      </td>
                      <td className="py-4 px-6 font-bold capitalize text-gray-700">
                        {loyer.type === 'long_terme' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-800 font-extrabold rounded-full text-xs shadow-sm">
                            <RefreshCw size={13} className="text-purple-600" />
                            Tous les mois
                          </span>
                        ) : (
                          <span>{loyer.mois} {loyer.annee}</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {payment ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 font-extrabold rounded-full text-xs shadow-sm">
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            Payé le {formatDate(payment.date_paiement || payment.date)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 font-extrabold rounded-full text-xs shadow-sm">
                            <Clock size={13} className="text-amber-600" />
                            En attente de retenue
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-mono text-gray-500 font-semibold">
                        {lastPaymentDate ? formatDate(lastPaymentDate) : <span className="text-gray-300 italic">Jamais</span>}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(loyer)}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 rounded-xl transition-colors"
                            title="Modifier ce loyer"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(loyer.id)}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-800 rounded-xl transition-colors"
                            title="Supprimer ce loyer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Loyer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Home className="text-amber-300" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">
                    {editingLoyer ? 'Modifier la programmation du loyer' : 'Programmer un loyer mensuel'}
                  </h2>
                  <p className="text-xs text-blue-200 mt-0.5">L'ouvrier sélectionné sera redevable de ce montant chaque mois</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingLoyer(null);
                }}
                className="p-1.5 text-blue-200 hover:text-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Ouvrier logé *</label>
                <select
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-extrabold text-gray-900 focus:bg-white focus:border-blue-500"
                  value={formData.ouvrier_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    const selectedOuvrier = ouvriers.find(o => o.id === parseInt(val));
                    if (selectedOuvrier) {
                      setFormData({
                        ...formData,
                        ouvrier_id: val,
                        site: selectedOuvrier.site || '',
                        qualification: selectedOuvrier.qualification || '',
                      });
                    } else {
                      setFormData({
                        ...formData,
                        ouvrier_id: val,
                        site: '',
                        qualification: '',
                      });
                    }
                  }}
                  required
                >
                  <option value="">Sélectionner un ouvrier dans la base</option>
                  {ouvriers.map((ouvrier) => (
                    <option key={ouvrier.id} value={ouvrier.id}>
                      {ouvrier.nom} {ouvrier.prenom} — {ouvrier.qualification || 'Journalier'} ({ouvrier.site})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Chantier / Site</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold uppercase"
                    value={formData.site}
                    onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Qualification</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold uppercase"
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Montant mensuel (FCFA) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-extrabold text-blue-600 focus:bg-white focus:border-blue-500"
                    value={formData.montant_mensuel}
                    onChange={(e) => setFormData({ ...formData, montant_mensuel: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de tranches *</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500"
                    value={formData.nombre_tranches || 1}
                    onChange={(e) => setFormData({ ...formData, nombre_tranches: e.target.value })}
                    required
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Ex: Saisissez 3 pour diviser sur 3 semaines
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Type d'hébergement *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'long_terme' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.type === 'long_terme'
                        ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1.5 rounded-lg ${formData.type === 'long_terme' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        <RefreshCw size={16} />
                      </div>
                      <span className={`font-bold text-sm ${formData.type === 'long_terme' ? 'text-blue-900' : 'text-gray-700'}`}>Long terme</span>
                    </div>
                    <p className="text-xs text-gray-500">Prélèvement automatique chaque mois</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'court_terme' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.type === 'court_terme'
                        ? 'border-orange-500 bg-orange-50 shadow-md shadow-orange-500/10'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1.5 rounded-lg ${formData.type === 'court_terme' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                        <Calendar size={16} />
                      </div>
                      <span className={`font-bold text-sm ${formData.type === 'court_terme' ? 'text-orange-900' : 'text-gray-700'}`}>Court terme</span>
                    </div>
                    <p className="text-xs text-gray-500">Prélèvement unique pour un mois précis</p>
                  </button>
                </div>
              </div>

              {formData.type === 'court_terme' && (
                <div className="grid grid-cols-2 gap-4 bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mois cible *</label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-orange-500"
                      value={formData.mois}
                      onChange={(e) => setFormData({ ...formData, mois: e.target.value })}
                      required
                    >
                      {['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].map(m => (
                        <option key={m} value={m} className="capitalize">{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Année *</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-orange-500"
                      value={formData.annee}
                      onChange={(e) => setFormData({ ...formData, annee: parseInt(e.target.value) || new Date().getFullYear() })}
                      required
                      min="2020"
                      max="2030"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingLoyer(null);
                  }}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm"
                >
                  Annuler
                </button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-blue-500/20 text-sm">
                  {editingLoyer ? 'Mettre à jour' : 'Enregistrer le loyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <CheckCircle2 className="text-amber-300" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">Enregistrer un règlement</h2>
                  <p className="text-xs text-emerald-200 mt-0.5">Paiement manuel de loyer d'hébergement</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 text-emerald-200 hover:text-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Ouvrier concerné *</label>
                <select
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-extrabold text-gray-900 focus:bg-white focus:border-emerald-500"
                  value={paymentFormData.ouvrier_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPaymentFormData({ ...paymentFormData, ouvrier_id: val });
                    const loyer = loyers.find(l => l.ouvrier_id === parseInt(val));
                    if (loyer) {
                      setPaymentFormData(prev => ({ ...prev, montant: loyer.montant_mensuel }));
                    }
                  }}
                  required
                >
                  <option value="">Sélectionner un ouvrier</option>
                  {ouvriers.map((ouvrier) => (
                    <option key={ouvrier.id} value={ouvrier.id}>
                      {ouvrier.nom} {ouvrier.prenom} — ({ouvrier.site})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Mois réglé *</label>
                  <select
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold capitalize"
                    value={paymentFormData.mois}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, mois: e.target.value })}
                    required
                  >
                    {['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].map(m => (
                      <option key={m} value={m} className="capitalize">{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Année *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold"
                    value={paymentFormData.annee}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, annee: e.target.value })}
                    required
                    min="2020"
                    max="2030"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Montant réglé (FCFA) *</label>
                <input
                  type="number"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-black text-emerald-800 focus:bg-white focus:border-emerald-500 font-mono"
                  value={paymentFormData.montant}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, montant: e.target.value })}
                  required
                  min="0"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm"
                >
                  Annuler
                </button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 text-sm">
                  Valider le paiement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
