import { apiFetch } from '../lib/api';
import { useState, useEffect } from 'react';
import { 
  Search, Calendar, Download, FileText, History, DollarSign, 
  CheckCircle, AlertCircle, RefreshCw, Filter, ShieldAlert, 
  Building2, Users, Layers, ArrowUpRight, CheckCircle2, Clock
} from 'lucide-react';
import { formatCurrency, formatCurrencySigned, formatDate, formatWeekLabel, getWeekDateRange } from '../lib/utils';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import gebatLogo from '../assets/logo_gebat.png';

export default function Historique() {
  const [paies, setPaies] = useState([]);
  const [ouvriers, setOuvriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [filteredPaies, setFilteredPaies] = useState([]);
  const [datePaiement, setDatePaiement] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [departementFilter, setDepartementFilter] = useState('');

  useEffect(() => {
    fetchPaies();
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      const range = getWeekDateRange(selectedWeek, paies);
      if (range.start && range.end) {
        setDateDebut(range.start);
        setDateFin(range.end);
      }
    } else {
      setDateDebut('');
      setDateFin('');
    }
  }, [selectedWeek, paies]);

  useEffect(() => {
    filterPaies();
  }, [paies, searchTerm, selectedWeek, datePaiement, dateDebut, dateFin, siteFilter, departementFilter]);

  const fetchPaies = async () => {
    setLoading(true);
    try {
      const [paiesRes, ouvriersRes, ponctionsRes] = await Promise.all([
        apiFetch('/api/paies'),
        apiFetch('/api/ouvriers'),
        apiFetch('/api/ponctions')
      ]);
      const paiesData = await paiesRes.json();
      const ouvriersData = await ouvriersRes.json();
      const ponctionsData = await ponctionsRes.json();

      const enrichedPaies = paiesData.map(paie => {
        const ouvrier = ouvriersData.find(o => 
          (o.id && paie.ouvrier_id && Number(o.id) === Number(paie.ouvrier_id)) ||
          (o.id && paie.ouvrier_id && String(o.id).trim() === String(paie.ouvrier_id).trim()) ||
          (o.matricule && paie.matricule && String(o.matricule).trim() === String(paie.matricule).trim()) ||
          (o.nom && paie.nom && String(o.nom).trim().toLowerCase() === String(paie.nom).trim().toLowerCase() && String(o.prenom || '').trim().toLowerCase() === String(paie.prenom || '').trim().toLowerCase())
        ) || {};
        const targetId = ouvrier.id || paie.ouvrier_id;
        const ouvrierPonctions = ponctionsData.filter(p => Number(p.ouvrier_id) === Number(targetId) || String(p.ouvrier_id) === String(targetId));
        const montantCollecte = ouvrierPonctions.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
        
        return {
          ...paie,
          site: paie.site || ouvrier.site || 'Non assigné',
          qualification: paie.qualification || ouvrier.qualification || 'Non spécifié',
          epi_departure_option: ouvrier.epi_departure_option,
          epi_settled: ouvrier.epi_settled,
          statut: ouvrier.statut,
          montant_collecte: montantCollecte
        };
      });

      setOuvriers(ouvriersData);
      setPaies(enrichedPaies);
    } catch (error) {
      console.error('Error fetching paies:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEpiReturnedLabel = (option) => {
    if (option === 'epi_complet') return 'Oui';
    if (option === 'epi_perdu') return 'Oui (Partiel)';
    if (option === 'epi_non_retourne') return 'Non';
    return 'Non';
  };

  const getEpiRefundedLabel = (option, settled) => {
    if (settled) {
      if (option === 'epi_complet') return 'Oui';
      if (option === 'epi_perdu') return 'Oui (Partiel)';
    }
    return 'Non';
  };

  const renderEpiLabel = (label, isGrayed) => {
    if (isGrayed) {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold text-gray-400 bg-gray-100">-</span>;
    }
    if (label.startsWith('Oui') && !label.includes('Partiel')) {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-200">{label}</span>;
    } else if (label.includes('Partiel')) {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold text-amber-800 bg-amber-100 border border-amber-200">{label}</span>;
    } else {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold text-red-800 bg-red-100 border border-red-200">{label}</span>;
    }
  };

  const filterPaies = () => {
    let filtered = [...paies];

    if (searchTerm) {
      filtered = filtered.filter((paie) =>
        paie.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paie.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paie.qualification?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paie.site?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedWeek || (dateDebut && dateFin)) {
      filtered = filtered.filter((paie) => {
        if (selectedWeek && paie.semaine === selectedWeek) return true;
        if (dateDebut && dateFin) {
          const paieDate = new Date(paie.date);
          const debut = new Date(dateDebut);
          const fin = new Date(dateFin);
          return !isNaN(paieDate.getTime()) && paieDate >= debut && paieDate <= fin;
        }
        return false;
      });
    }

    if (datePaiement) {
      filtered = filtered.filter((paie) => {
        const paieDate = new Date(paie.date).toISOString().split('T')[0];
        return paieDate === datePaiement;
      });
    }

    if (siteFilter) {
      const sFilt = siteFilter.trim().toLowerCase();
      filtered = filtered.filter((paie) =>
        String(paie.site || '').trim().toLowerCase() === sFilt
      );
    }

    if (departementFilter) {
      const dFilt = departementFilter.trim().toLowerCase();
      filtered = filtered.filter((paie) =>
        String(paie.qualification || paie.departement || '').trim().toLowerCase() === dFilt
      );
    }

    setFilteredPaies(filtered);
  };

  const getUniqueSites = () => {
    const allSites = [...paies.map(p => String(p.site || '').trim()), ...ouvriers.map(o => String(o.site || '').trim())].filter(s => s && s !== 'Non assigné');
    return allSites.filter((site, index, self) => index === self.findIndex(s => s.toLowerCase() === site.toLowerCase())).sort();
  };

  const getUniqueDepartements = () => {
    const allQuals = [...paies.map(p => String(p.qualification || p.departement || '').trim()), ...ouvriers.map(o => String(o.qualification || o.departement || '').trim())].filter(q => q && q !== 'Non spécifié');
    return allQuals.filter((qual, index, self) => index === self.findIndex(q => q.toLowerCase() === qual.toLowerCase())).sort();
  };

  const hasActiveFilters = !!(searchTerm || selectedWeek || datePaiement || dateDebut || dateFin || siteFilter || departementFilter);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedWeek('');
    setDatePaiement('');
    setDateDebut('');
    setDateFin('');
    setSiteFilter('');
    setDepartementFilter('');
  };

  const getUniqueWeekOptions = () => {
    const weeks = [...new Set(paies.map((p) => p.semaine))].filter(Boolean);
    const sorted = weeks.sort().reverse();
    return sorted.map((weekVal) => ({
      value: weekVal,
      label: formatWeekLabel(weekVal, paies)
    }));
  };

  const handleExport = () => {
    const titleRow = ['HISTORIQUE DES PAIES & RÈGLEMENTS - GEBAT EASYPAIE'];
    const subtitleRow = [`Semaine : ${selectedWeek || 'Toutes'} | Site : ${siteFilter || 'Tous'} | Département : ${departementFilter || 'Tous'} | Date Paiement : ${datePaiement ? formatDate(datePaiement) : 'Toutes'} | Généré le ${new Date().toLocaleDateString('fr-FR')}`];
    const emptyRow = [];
    const headerRow = [
      'Nom', 'Prénom', 'Qualification', 'Semaine', 'Date Paiement',
      'Salaire Brut (FCFA)', 'Ponctions EPI (Hebdo)', 'Loyer (FCFA)', 'Remboursement EPI',
      'Déduction EPI (Départ)', 'Net à Payer (FCFA)', 'Statut Paiement',
      'Opérateur MM', 'Numéro Mobile Money', 'Téléphone Contact',
      'Caution Collectée', 'Statut Retour EPI', 'Statut Remboursement'
    ];

    const dataRows = filteredPaies.map((paie) => [
      paie.nom,
      paie.prenom || '',
      paie.qualification || '-',
      paie.semaine || '-',
      paie.date ? formatDate(paie.date) : '-',
      Number(paie.salaire_brut) || 0,
      Number(paie.ponction) || 0,
      Number(paie.loyer) || 0,
      Number(paie.epi_remboursement) || 0,
      Number(paie.epi_deduction) || 0,
      Number(paie.net_a_payer) || 0,
      paie.paye ? 'Payé' : 'Non Payé',
      paie.operateur || '-',
      paie.numero_mobile_money || paie.telephone || '-',
      paie.telephone || '-',
      Number(paie.montant_collecte) || 0,
      getEpiReturnedLabel(paie.epi_departure_option),
      getEpiRefundedLabel(paie.epi_departure_option, paie.epi_settled)
    ]);

    const totBrut = filteredPaies.reduce((sum, p) => sum + (Number(p.salaire_brut) || 0), 0);
    const totPonction = filteredPaies.reduce((sum, p) => sum + (Number(p.ponction) || 0), 0);
    const totLoyer = filteredPaies.reduce((sum, p) => sum + (Number(p.loyer) || 0), 0);
    const totRemb = filteredPaies.reduce((sum, p) => sum + (Number(p.epi_remboursement) || 0), 0);
    const totDed = filteredPaies.reduce((sum, p) => sum + (Number(p.epi_deduction) || 0), 0);
    const totNet = filteredPaies.reduce((sum, p) => sum + (Number(p.net_a_payer) || 0), 0);

    const totalRow = [
      'TOTAL FILTRÉ', '', '', '', '',
      totBrut, totPonction, totLoyer, totRemb, totDed, totNet,
      '', '', '', '', '', '', ''
    ];

    const aoa = [titleRow, subtitleRow, emptyRow, headerRow, ...dataRows, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 17 } }
    ];

    ws['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 16 },
      { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 22 },
      { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 18 },
      { wch: 18 }, { wch: 24 }, { wch: 24 }
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
          alignment: { horizontal: (c >= 5 && c <= 10) || c === 15 ? 'right' : 'center', vertical: 'center' },
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
          const isNumCol = (c >= 5 && c <= 10) || c === 15;
          if (isNumCol && typeof ws[cellAddress].v === 'number') {
            ws[cellAddress].z = '#,##0';
          }
          ws[cellAddress].s = {
            font: { name: 'Arial', sz: 9.5, color: { rgb: '1E293B' } },
            fill: { fgColor: { rgb: r % 2 === 0 ? 'FFFFFF' : 'F8FAFC' } },
            alignment: { horizontal: isNumCol ? 'right' : (c === 11 || c === 12 ? 'center' : 'left'), vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
              left: { style: 'thin', color: { rgb: 'E2E8F0' } },
              right: { style: 'thin', color: { rgb: 'E2E8F0' } }
            }
          };
          if (c === 10) {
            ws[cellAddress].s.font.bold = true;
            ws[cellAddress].s.font.color = { rgb: '065F46' };
          }
        }
      }
    }

    const totalRowIndex = 4 + dataRows.length;
    for (let c = 0; c <= 17; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: totalRowIndex, c: c });
      if (ws[cellAddress]) {
        const isNumCol = (c >= 5 && c <= 10) || c === 15;
        if (isNumCol && typeof ws[cellAddress].v === 'number') {
          ws[cellAddress].z = '#,##0';
        }
        ws[cellAddress].s = {
          font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: c === 10 ? '065F46' : '0F172A' } },
          fill: { fgColor: { rgb: c === 10 ? 'D1FAE5' : 'E2E8F0' } },
          alignment: { horizontal: isNumCol ? 'right' : 'left', vertical: 'center' },
          border: {
            top: { style: 'double', color: { rgb: '475569' } },
            bottom: { style: 'medium', color: { rgb: '0F172A' } }
          }
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historique Paies');
    XLSX.writeFile(wb, `Historique_Paies_${selectedWeek || 'Toutes'}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
    const subtitle = `Filtres : ${siteFilter ? 'Site: ' + siteFilter + ' | ' : ''}${departementFilter ? 'Dép: ' + departementFilter + ' | ' : ''}${selectedWeek ? 'Semaine: ' + selectedWeek + ' | ' : ''}${datePaiement ? 'Date: ' + formatDate(datePaiement) : ''} ${dateDebut && dateFin ? 'Du ' + formatDate(dateDebut) + ' au ' + formatDate(dateFin) : ''}`.replace(/\|\s*$/, '').trim() || 'Tous les enregistrements';
    
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
    doc.text('Historique des Paies', 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(subtitle, 14, 27);
    doc.setFontSize(8);
    doc.setTextColor(180, 200, 240);
    doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, 14, 37);
    doc.setTextColor(0, 0, 0);

    const rows = filteredPaies.map((p) => [
      p.semaine || '-',
      formatDate(p.date),
      p.nom,
      p.prenom || '-',
      p.qualification || '-',
      fmtPdf(p.salaire_brut),
      p.ponction > 0 ? fmtPdf(p.ponction) : '-',
      p.loyer > 0 ? fmtPdf(p.loyer) : '-',
      fmtPdfSigned(p.epi_remboursement),
      p.epi_deduction > 0 ? '-' + fmtPdf(p.epi_deduction) : '-',
      fmtPdf(p.net_a_payer),
      p.paye ? 'Payé' : 'Non Payé'
    ]);

    autoTable(doc, {
      headStyles: {
        fillColor: [21, 101, 192],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      bodyStyles: { fontSize: 8, cellPadding: 2.5 },
      rowPageBreak: 'auto',
      margin: { top: 52, left: 14, right: 14 },
      startY: 52,
      head: [[
        'Sem.', 'Date Paiement', 'Nom', 'Prénom', 'Qualification',
        'Sal. Brut', 'Ponction', 'Loyer',
        'Remb. EPI', 'Déd. EPI', 'Net à Payer', 'Paiement'
      ]],
      body: rows,
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right', textColor: [180, 60, 0] },
        7: { halign: 'right', textColor: [100, 0, 150] },
        8: { halign: 'right', textColor: [0, 120, 0] },
        9: { halign: 'right', textColor: [180, 0, 0] },
        10: { halign: 'right', fontStyle: 'bold', textColor: [0, 100, 0] },
        11: { halign: 'center' }
      },
    });

    const y = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(240, 244, 255);
    doc.roundedRect(14, y, pageW - 28, 30, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(21, 101, 192);
    doc.text(`Total Salaire Brut : ${fmtPdf(totalBrut)}`, 20, y + 8);
    doc.setTextColor(180, 60, 0);
    doc.text(`Total Ponctions EPI : ${fmtPdf(totalPonctions)}`, 20, y + 17);
    doc.setTextColor(100, 0, 150);
    doc.text(`Total Loyers : ${fmtPdf(totalLoyers)}`, 20, y + 26);
    doc.setTextColor(0, 120, 0);
    doc.text(`Total Net a Payer : ${fmtPdf(totalNet)}`, pageW / 2, y + 17, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    const suffix = selectedWeek ? `Semaine_${selectedWeek}` : datePaiement ? `Date_${datePaiement}` : dateDebut && dateFin ? `Periode_${dateDebut}_${dateFin}` : 'Tous';
    doc.save(`Historique_Paies_${suffix}.pdf`);
  };

  const totalBrut = filteredPaies.reduce((sum, p) => sum + (Number(p.salaire_brut) || 0), 0);
  const totalPonctions = filteredPaies.reduce((sum, p) => sum + (Number(p.ponction) || 0), 0);
  const totalLoyers = filteredPaies.reduce((sum, p) => sum + (Number(p.loyer) || 0), 0);
  const totalRembEpi = filteredPaies.reduce((sum, p) => sum + (Number(p.epi_remboursement) || 0), 0);
  const totalDedEpi = filteredPaies.reduce((sum, p) => sum + (Number(p.epi_deduction) || 0), 0);
  const totalNet = filteredPaies.reduce((sum, p) => sum + (Number(p.net_a_payer) || 0), 0);

  return (
    <div className="space-y-8 pb-16">
      {/* Premium Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-blue-900 to-slate-950 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <History className="text-amber-400" size={30} />
              </div>
              <span className="px-3.5 py-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold rounded-full uppercase tracking-wider shadow-sm">
                Traçabilité & Archives GEBAT
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
              Historique des Paies
            </h1>
            <p className="text-indigo-100 mt-2 max-w-2xl text-sm md:text-base leading-relaxed font-normal">
              Retrouvez l'intégralité des règlements de salaire archivés par semaine et chantier. Exportez vos fiches comptables et auditez chaque retenue ou remboursement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchPaies}
              className="p-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl transition-all shadow-md"
              title="Rafraîchir l'historique"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
            {filteredPaies.length > 0 && (
              <>
                <button
                  onClick={handleExport}
                  className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center gap-2 text-xs transition-all transform active:scale-95"
                >
                  <Download size={16} strokeWidth={2.5} /> Exporter Excel (.xlsx)
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-5 py-3 bg-red-500 hover:bg-red-600 text-white font-extrabold rounded-2xl shadow-lg shadow-red-500/25 flex items-center gap-2 text-xs transition-all transform active:scale-95"
                >
                  <FileText size={16} strokeWidth={2.5} /> Exporter PDF (.pdf)
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
            <Filter className="text-indigo-600" size={20} />
            Filtres &amp; Recherche Avancée
          </h3>
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-extrabold text-xs rounded-xl border border-red-200 transition-all"
              >
                <RefreshCw size={13} /> Réinitialiser
              </button>
            )}
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
              <span>Affichage de <strong className="text-indigo-600">{filteredPaies.length}</strong> bulletins sur {paies.length} total</span>
            </div>
          </div>
        </div>

        {/* Row 1 : Search + Semaine + Date */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Recherche Ouvrier</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Nom, prénom, qualification, site..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-600" /> Semaine
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-indigo-500"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            >
              <option value="">Toutes les semaines</option>
              {getUniqueWeekOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-teal-600" /> Date du Paiement
            </label>
            <input
              type="date"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-indigo-500"
              value={datePaiement}
              onChange={(e) => setDatePaiement(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center justify-between">
              <span>Période : Date de Début</span>
              <span className="text-[10px] text-indigo-600 font-semibold uppercase bg-indigo-50 px-1.5 py-0.5 rounded">Auto</span>
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
              <span>Période : Date de Fin</span>
              <span className="text-[10px] text-indigo-600 font-semibold uppercase bg-indigo-50 px-1.5 py-0.5 rounded">Auto</span>
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

        {/* Row 2 : Site + Département */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1 border-t border-gray-100">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Building2 size={14} className="text-indigo-600" /> Filtrer par Chantier (Site)
            </label>
            <select
              className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-indigo-500 transition-colors ${
                siteFilter ? 'border-indigo-400 bg-indigo-50/40 text-indigo-900' : 'border-gray-200'
              }`}
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
            >
              <option value="">Tous les chantiers</option>
              {getUniqueSites().map((site) => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
            {siteFilter && (
              <p className="text-[10px] font-bold text-indigo-600 mt-1 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Filtré sur : {siteFilter}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Users size={14} className="text-purple-600" /> Filtrer par Département (Qualification)
            </label>
            <select
              className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-indigo-500 transition-colors ${
                departementFilter ? 'border-purple-400 bg-purple-50/40 text-purple-900' : 'border-gray-200'
              }`}
              value={departementFilter}
              onChange={(e) => setDepartementFilter(e.target.value)}
            >
              <option value="">Tous les départements</option>
              {getUniqueDepartements().map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            {departementFilter && (
              <p className="text-[10px] font-bold text-purple-600 mt-1 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                Filtré sur : {departementFilter}
              </p>
            )}
          </div>
        </div>

        {/* Active filter badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2">
            {siteFilter && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-800 text-[11px] font-extrabold rounded-full border border-indigo-200">
                <Building2 size={11} /> {siteFilter}
                <button onClick={() => setSiteFilter('')} className="ml-1 hover:text-indigo-600">×</button>
              </span>
            )}
            {departementFilter && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-800 text-[11px] font-extrabold rounded-full border border-purple-200">
                <Users size={11} /> {departementFilter}
                <button onClick={() => setDepartementFilter('')} className="ml-1 hover:text-purple-600">×</button>
              </span>
            )}
            {selectedWeek && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-100 text-teal-800 text-[11px] font-extrabold rounded-full border border-teal-200">
                <Calendar size={11} /> {selectedWeek}
                <button onClick={() => setSelectedWeek('')} className="ml-1 hover:text-teal-600">×</button>
              </span>
            )}
            {datePaiement && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 text-[11px] font-extrabold rounded-full border border-blue-200">
                <Calendar size={11} /> Date : {formatDate(datePaiement)}
                <button onClick={() => setDatePaiement('')} className="ml-1 hover:text-blue-600">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 6 Summary KPI Cards */}
      {filteredPaies.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Salaire Brut</span>
            <div className="text-lg font-black text-gray-900 mt-2 font-mono">{formatCurrency(totalBrut)}</div>
            <span className="text-[10px] font-semibold text-blue-600 mt-1">Cumul brut filtré</span>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Retenues EPI</span>
            <div className="text-lg font-black text-amber-600 mt-2 font-mono">{formatCurrency(totalPonctions)}</div>
            <span className="text-[10px] font-semibold text-amber-700 mt-1">Cautions prélevées</span>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Retenues Loyers</span>
            <div className="text-lg font-black text-purple-600 mt-2 font-mono">{formatCurrency(totalLoyers)}</div>
            <span className="text-[10px] font-semibold text-purple-700 mt-1">Hébergement déduit</span>
          </div>

          <div className="bg-emerald-50/70 rounded-2xl p-5 border border-emerald-200 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Remboursement EPI</span>
            <div className="text-lg font-black text-emerald-700 mt-2 font-mono">{formatCurrency(totalRembEpi)}</div>
            <span className="text-[10px] font-semibold text-emerald-600 mt-1">Restitutions départ</span>
          </div>

          <div className="bg-red-50/70 rounded-2xl p-5 border border-red-200 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-800">Déductions EPI</span>
            <div className="text-lg font-black text-red-700 mt-2 font-mono">{formatCurrency(totalDedEpi)}</div>
            <span className="text-[10px] font-semibold text-red-600 mt-1">Équipements perdus</span>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-slate-950 text-white rounded-2xl p-5 shadow-lg flex flex-col justify-between border border-indigo-800">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">Total Net à Payer</span>
            <div className="text-xl font-black text-white mt-2 font-mono drop-shadow-sm">{formatCurrency(totalNet)}</div>
            <span className="text-[10px] font-bold text-emerald-300 mt-1">Total viré / payé</span>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
            <Layers className="text-indigo-600" size={20} />
            Registre Général des Paiements Archivés
          </h3>
          <span className="text-xs font-bold text-gray-400">
            {filteredPaies.length} fiches répertoriées
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                <th className="py-4 px-4 text-center">Semaine</th>
                <th className="py-4 px-4">Date Règlement</th>
                <th className="py-4 px-4">Ouvrier &amp; Qualification</th>
                <th className="py-4 px-4">Site / Chantier</th>
                <th className="py-4 px-4 text-right">Salaire Brut</th>
                <th className="py-4 px-4 text-right">Ponction EPI</th>
                <th className="py-4 px-4 text-right">Loyer</th>
                <th className="py-4 px-4 text-right">Remb. EPI</th>
                <th className="py-4 px-4 text-right">Déd. EPI</th>
                <th className="py-4 px-5 text-right font-black text-indigo-950 bg-indigo-50/50">Net à Payer</th>
                <th className="py-4 px-4 text-right text-blue-700">Cumul EPI</th>
                <th className="py-4 px-4 text-center">EPI Retourné</th>
                <th className="py-4 px-4 text-center">EPI Remboursé</th>
                <th className="py-4 px-4">Coordonnées</th>
                <th className="py-4 px-4 text-center">Paiement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPaies.map((paie) => (
                <tr key={paie.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-extrabold rounded-lg text-xs">
                      {paie.semaine || '-'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-gray-700">
                    {formatDate(paie.date)}
                  </td>
                  <td className="py-3.5 px-4 font-black text-gray-900 text-sm">
                    {paie.nom} {paie.prenom}
                    <span className="block text-xs font-semibold text-indigo-600 mt-0.5">{paie.qualification || '-'}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    {paie.site ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 font-extrabold rounded-lg text-[11px] border border-indigo-100">
                        <Building2 size={11} /> {paie.site}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-700">
                    {formatCurrency(paie.salaire_brut)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-mono font-bold ${paie.ponction > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {formatCurrency(paie.ponction)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-mono font-bold ${paie.loyer > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                    {formatCurrency(paie.loyer)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-mono font-bold ${paie.epi_remboursement > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {formatCurrencySigned(paie.epi_remboursement)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-mono font-bold ${paie.epi_deduction > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {paie.epi_deduction > 0 ? '-' + formatCurrency(paie.epi_deduction) : '-'}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono font-black text-emerald-700 text-sm bg-indigo-50/30">
                    {formatCurrency(paie.net_a_payer)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-600">
                    {formatCurrency(paie.montant_collecte || 0)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {renderEpiLabel(getEpiReturnedLabel(paie.epi_departure_option), paie.statut === 'actif')}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {renderEpiLabel(getEpiRefundedLabel(paie.epi_departure_option, paie.epi_settled), paie.statut === 'actif')}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-gray-800">{paie.telephone || '-'}</div>
                    {paie.operateur && (
                      <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                        {paie.operateur} : {paie.numero_mobile_money || paie.telephone}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                      paie.paye ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {paie.paye ? (
                        <><CheckCircle2 size={12} strokeWidth={3} /> Payé</>
                      ) : (
                        <><Clock size={12} /> Non réglé</>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPaies.length === 0 && (
            <div className="text-center py-16 text-gray-400 flex flex-col items-center justify-center gap-3">
              <AlertCircle size={40} className="text-gray-300" />
              <span className="font-bold text-sm">Aucun historique de paie ne correspond à vos filtres.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
