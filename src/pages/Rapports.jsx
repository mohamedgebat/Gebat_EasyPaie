import { apiFetch } from '../lib/api';
import { useState, useEffect } from 'react';
import { 
  Download, FileText, Shield, Building2, Calendar, Search, 
  Filter, RefreshCw, Layers, CheckCircle2, AlertCircle, DollarSign, Users 
} from 'lucide-react';
import { formatCurrency, formatCurrencySigned, formatDate, formatWeekLabel, getWeekDateRange } from '../lib/utils';
import gebatLogo from '../assets/logo_gebat.png';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Rapports() {
  const [ponctions, setPonctions] = useState([]);
  const [loyers, setLoyers] = useState([]);
  const [paiementsLoyer, setPaiementsLoyer] = useState([]);
  const [paies, setPaies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ponctions');
  const [semaine, setSemaine] = useState('');
  const [datePaiement, setDatePaiement] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [qualificationFilter, setQualificationFilter] = useState('');
  const [ouvriers, setOuvriers] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (semaine) {
      const allRecords = [...paies, ...ponctions, ...paiementsLoyer];
      const range = getWeekDateRange(semaine, allRecords);
      if (range.start && range.end) {
        setDateDebut(range.start);
        setDateFin(range.end);
      }
    } else {
      setDateDebut('');
      setDateFin('');
    }
  }, [semaine, paies, ponctions, paiementsLoyer]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ponctionsRes, loyersRes, paiementsRes, paiesRes, ouvriersRes] = await Promise.all([
        apiFetch('/api/ponctions'),
        apiFetch('/api/loyers'),
        apiFetch('/api/paiements-loyer'),
        apiFetch('/api/paies'),
        apiFetch('/api/ouvriers'),
      ]);
      setPonctions(await ponctionsRes.json());
      setLoyers(await loyersRes.json());
      setPaiementsLoyer(await paiementsRes.json());
      setPaies(await paiesRes.json());
      setOuvriers(await ouvriersRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUniqueWeekOptions = () => {
    const allRecords = [...paies, ...ponctions, ...paiementsLoyer];
    const uniqueWeeks = [...new Set(allRecords.map((r) => r.semaine).filter(Boolean))].sort().reverse();
    return uniqueWeeks.map((weekVal) => ({
      value: weekVal,
      label: formatWeekLabel(weekVal, allRecords)
    }));
  };

  const filterByMonth = (data, dateField) => {
    let filtered = data;
    
    if (datePaiement) {
      filtered = filtered.filter((item) => {
        const date = new Date(item[dateField]).toISOString().split('T')[0];
        return date === datePaiement;
      });
    }
    if (semaine && data.length > 0 && data[0].semaine !== undefined) {
      filtered = filtered.filter((item) => item.semaine === semaine || (dateDebut && dateFin && new Date(item[dateField]) >= new Date(dateDebut) && new Date(item[dateField]) <= new Date(dateFin)));
    } else if (dateDebut && dateFin) {
      const debut = new Date(dateDebut);
      const fin = new Date(dateFin);
      filtered = filtered.filter((item) => {
        const date = new Date(item[dateField]);
        return !isNaN(date.getTime()) && date >= debut && date <= fin;
      });
    }
    if (siteFilter) {
      filtered = filtered.filter((item) => item.site === siteFilter);
    }
    if (qualificationFilter) {
      filtered = filtered.filter((item) => item.qualification === qualificationFilter);
    }
    return filtered;
  };

  const getExportSuffix = () => {
    if (datePaiement) return datePaiement;
    if (dateDebut && dateFin) return `${dateDebut}_${dateFin}`;
    if (semaine) return semaine;
    return new Date().toISOString().split('T')[0];
  };

  const getExportPeriode = () => {
    if (datePaiement) return formatDate(datePaiement);
    if (dateDebut && dateFin) return `${formatDate(dateDebut)} - ${formatDate(dateFin)}`;
    if (semaine) return semaine;
    return 'Tout';
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

  const addPdfHeader = (doc, title, subtitle) => {
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
    doc.text(title, 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(subtitle, 14, 27);
    doc.setFontSize(8);
    doc.setTextColor(180, 200, 240);
    doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, 14, 37);
    doc.setTextColor(0, 0, 0);
  };

  const addPdfFooter = (doc, total1Label, total1Val, total2Label, total2Val) => {
    const pageW = doc.internal.pageSize.getWidth();
    const y = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(240, 244, 255);
    doc.roundedRect(14, y, pageW - 28, total2Label ? 22 : 12, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(21, 101, 192);
    doc.text(`${total1Label}: ${total1Val}`, 20, y + 8);
    if (total2Label) {
      doc.setTextColor(34, 139, 34);
      doc.text(`${total2Label}: ${total2Val}`, 20, y + 18);
    }
    doc.setTextColor(0, 0, 0);
  };

  const pdfTableStyle = {
    headStyles: {
      fillColor: [21, 101, 192],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    bodyStyles: { fontSize: 8.5, cellPadding: 3 },
    rowPageBreak: 'auto',
    margin: { top: 52, left: 14, right: 14 },
  };

  const buildStyledExcel = (sheetName, headers, rows, colWidths, filename) => {
    const titleRow = [`RAPPORT - ${sheetName.toUpperCase()} - GEBAT EASYPAIE`];
    const subtitleRow = [`Période : ${getExportPeriode()} | Site : ${siteFilter || 'Tous'} | Qualification : ${qualificationFilter || 'Toutes'} | Généré le ${new Date().toLocaleDateString('fr-FR')}`];
    const emptyRow = [];

    const totalRow = new Array(headers.length).fill('');
    totalRow[0] = 'TOTAL FILTRÉ';
    for (let c = 1; c < headers.length; c++) {
      const h = headers[c] || '';
      if (/FCFA|Montant|Cumul|Brut|Ponction|Loyer|Remb|Déd|Net/i.test(h)) {
        const sum = rows.reduce((acc, r) => acc + (typeof r[c] === 'number' ? r[c] : Number(r[c]) || 0), 0);
        totalRow[c] = sum;
      }
    }

    const wsData = [titleRow, subtitleRow, emptyRow, headers, ...rows, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }
    ];

    ws['!cols'] = colWidths.map((w) => ({ wch: w }));
    ws['!rows'] = [
      { hpt: 36 },
      { hpt: 24 },
      { hpt: 10 },
      { hpt: 28 },
    ];
    ws['!freeze'] = { xSplit: 0, ySplit: 4 };

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

    for (let c = 0; c < headers.length; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 3, c: c });
      if (ws[cellAddress]) {
        const h = headers[c] || '';
        const isNumCol = /FCFA|Montant|Cumul|Brut|Ponction|Loyer|Remb|Déd|Net/i.test(h);
        ws[cellAddress].s = {
          font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '1E293B' } },
          alignment: { horizontal: isNumCol ? 'right' : 'center', vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: '0F172A' } },
            bottom: { style: 'medium', color: { rgb: '0F172A' } },
            left: { style: 'thin', color: { rgb: '475569' } },
            right: { style: 'thin', color: { rgb: '475569' } }
          }
        };
      }
    }

    for (let r = 4; r < 4 + rows.length; r++) {
      for (let c = 0; c < headers.length; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: r, c: c });
        if (ws[cellAddress]) {
          const h = headers[c] || '';
          const isNumCol = /FCFA|Montant|Cumul|Brut|Ponction|Loyer|Remb|Déd|Net/i.test(h);
          if (isNumCol && typeof ws[cellAddress].v === 'number') {
            ws[cellAddress].z = '#,##0';
          }
          ws[cellAddress].s = {
            font: { name: 'Arial', sz: 9.5, color: { rgb: '1E293B' } },
            fill: { fgColor: { rgb: r % 2 === 0 ? 'FFFFFF' : 'F8FAFC' } },
            alignment: { horizontal: isNumCol ? 'right' : 'left', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'E2E8F0' } },
              bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
              left: { style: 'thin', color: { rgb: 'E2E8F0' } },
              right: { style: 'thin', color: { rgb: 'E2E8F0' } }
            }
          };
          if (/Net à Payer/i.test(h)) {
            ws[cellAddress].s.font.bold = true;
            ws[cellAddress].s.font.color = { rgb: '065F46' };
          }
        }
      }
    }

    const totalRowIndex = 4 + rows.length;
    for (let c = 0; c < headers.length; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: totalRowIndex, c: c });
      if (ws[cellAddress]) {
        const h = headers[c] || '';
        const isNumCol = /FCFA|Montant|Cumul|Brut|Ponction|Loyer|Remb|Déd|Net/i.test(h);
        if (isNumCol && typeof ws[cellAddress].v === 'number') {
          ws[cellAddress].z = '#,##0';
        }
        ws[cellAddress].s = {
          font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: /Net à Payer/i.test(h) ? '065F46' : '0F172A' } },
          fill: { fgColor: { rgb: /Net à Payer/i.test(h) ? 'D1FAE5' : 'E2E8F0' } },
          alignment: { horizontal: isNumCol ? 'right' : 'left', vertical: 'center' },
          border: {
            top: { style: 'double', color: { rgb: '475569' } },
            bottom: { style: 'medium', color: { rgb: '0F172A' } }
          }
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  };

  const exportPonctionsExcel = () => {
    const filtered = filterByMonth(ponctions, 'date');
    const headers = ['Nom', 'Prénom', 'Date Paiement', 'Montant (FCFA)', 'Motif', 'Cumul (FCFA)'];
    const rows = filtered.map((p) => [
      p.nom, p.prenom, formatDate(p.date),
      Number(p.montant) || 0, p.motif || '-', Number(p.cumul) || 0,
    ]);
    buildStyledExcel('Ponctions EPI', headers, rows,
      [22, 18, 16, 18, 35, 18],
      `Rapport_Ponctions_${getExportSuffix()}.xlsx`);
  };

  const exportPonctionsPDF = () => {
    const filtered = filterByMonth(ponctions, 'date');
    const doc = new jsPDF({ orientation: 'landscape' });
    const periode = getExportPeriode();
    addPdfHeader(doc, 'Rapport des Ponctions EPI', `Periode : ${periode}`);
    const rows = filtered.map((p) => [
      p.nom, p.prenom || '-', formatDate(p.date),
      fmtPdf(p.montant), p.motif || '-', fmtPdf(p.cumul),
    ]);
    autoTable(doc, {
      ...pdfTableStyle,
      startY: 52,
      head: [['Nom', 'Prenom', 'Date Paiement', 'Montant (FCFA)', 'Motif', 'Cumul (FCFA)']],
      body: rows,
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        3: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
    });
    const total = filtered.reduce((s, p) => s + (Number(p.montant) || 0), 0);
    addPdfFooter(doc, 'Total Ponctions', fmtPdf(total));
    doc.save(`Rapport_Ponctions_${getExportSuffix()}.pdf`);
  };

  const exportLoyersExcel = () => {
    const filtered = filterByMonth(paiementsLoyer, 'date_paiement');
    const headers = ['Nom', 'Prénom', 'Mois', 'Année', 'Montant (FCFA)', 'Date Paiement'];
    const rows = filtered.map((p) => [
      p.nom, p.prenom || '', p.mois, p.annee, Number(p.montant) || 0, formatDate(p.date_paiement),
    ]);
    buildStyledExcel('Paiements Loyer', headers, rows,
      [22, 18, 14, 10, 18, 16],
      `Rapport_Loyers_${getExportSuffix()}.xlsx`);
  };

  const exportLoyersPDF = () => {
    const filtered = filterByMonth(paiementsLoyer, 'date_paiement');
    const doc = new jsPDF();
    const periode = getExportPeriode();
    addPdfHeader(doc, 'Rapport des Paiements de Loyer', `Periode : ${periode}`);
    const rows = filtered.map((p) => [
      p.nom, p.prenom || '-', p.mois, p.annee, fmtPdf(p.montant), formatDate(p.date_paiement),
    ]);
    autoTable(doc, {
      ...pdfTableStyle,
      startY: 52,
      head: [['Nom', 'Prenom', 'Mois', 'Annee', 'Montant (FCFA)', 'Date Paiement']],
      body: rows,
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    });
    const total = filtered.reduce((s, p) => s + (Number(p.montant) || 0), 0);
    addPdfFooter(doc, 'Total Loyers', fmtPdf(total));
    doc.save(`Rapport_Loyers_${getExportSuffix()}.pdf`);
  };

  const exportPaiesExcel = () => {
    const filtered = filterByMonth(paies, 'date');
    const headers = [
      'Nom', 'Prénom', 'Qualification', 'Site', 'Semaine', 'Sem. Début', 'Sem. Fin',
      'Date Paiement', 'Salaire Brut (FCFA)', 'Ponction EPI (FCFA)',
      'Loyer (FCFA)', 'Remb. EPI (FCFA)', 'Déd. EPI (FCFA)', 'Net à Payer (FCFA)',
    ];
    const rows = filtered.map((p) => [
      p.nom, p.prenom || '', p.qualification || '', p.site || '',
      p.semaine || '', p.date_debut ? formatDate(p.date_debut) : '-', p.date_fin ? formatDate(p.date_fin) : '-',
      formatDate(p.date),
      Number(p.salaire_brut) || 0, Number(p.ponction) || 0, Number(p.loyer) || 0,
      Number(p.epi_remboursement) || 0, Number(p.epi_deduction) || 0, Number(p.net_a_payer) || 0,
    ]);
    buildStyledExcel('Paies', headers, rows,
      [20, 16, 16, 14, 12, 13, 13, 15, 20, 18, 15, 18, 16, 18],
      `Rapport_Paies_${getExportSuffix()}.xlsx`);
  };

  const exportPaiesPDF = () => {
    const filtered = filterByMonth(paies, 'date');
    const doc = new jsPDF({ orientation: 'landscape' });
    const periode = getExportPeriode();
    addPdfHeader(doc, 'Rapport des Paies', `Periode : ${periode}`);
    const rows = filtered.map((p) => [
      p.nom,
      p.prenom || '-',
      p.qualification || '-',
      p.semaine || '-',
      p.date_debut ? formatDate(p.date_debut) : '-',
      p.date_fin ? formatDate(p.date_fin) : '-',
      formatDate(p.date),
      fmtPdf(p.salaire_brut),
      p.ponction > 0 ? fmtPdf(p.ponction) : '-',
      p.loyer > 0 ? fmtPdf(p.loyer) : '-',
      fmtPdfSigned(p.epi_remboursement),
      p.epi_deduction > 0 ? '-' + fmtPdf(p.epi_deduction) : '-',
      fmtPdf(p.net_a_payer),
    ]);
    autoTable(doc, {
      ...pdfTableStyle,
      startY: 52,
      head: [[
        'Nom', 'Prenom', 'Qualification', 'Semaine',
        'Sem. Debut', 'Sem. Fin', 'Date Paiement',
        'Sal. Brut', 'Ponction', 'Loyer',
        'Remb. EPI', 'Ded. EPI', 'Net a Payer',
      ]],
      body: rows,
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 22 },
        7: { halign: 'right' },
        8: { halign: 'right', textColor: [180, 60, 0] },
        9: { halign: 'right', textColor: [100, 0, 150] },
        10: { halign: 'right', textColor: [0, 120, 0] },
        11: { halign: 'right', textColor: [180, 0, 0] },
        12: { halign: 'right', fontStyle: 'bold', textColor: [0, 100, 0] },
      },
    });
    const totalBrut = filtered.reduce((s, p) => s + (Number(p.salaire_brut) || 0), 0);
    const totalPonction = filtered.reduce((s, p) => s + (Number(p.ponction) || 0), 0);
    const totalLoyer = filtered.reduce((s, p) => s + (Number(p.loyer) || 0), 0);
    const totalNet = filtered.reduce((s, p) => s + (Number(p.net_a_payer) || 0), 0);
    const pageW = doc.internal.pageSize.getWidth();
    const y = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(240, 244, 255);
    doc.roundedRect(14, y, pageW - 28, 30, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(21, 101, 192);
    doc.text(`Total Salaire Brut : ${fmtPdf(totalBrut)}`, 20, y + 8);
    doc.setTextColor(180, 60, 0);
    doc.text(`Total Ponctions EPI : ${fmtPdf(totalPonction)}`, 20, y + 17);
    doc.setTextColor(100, 0, 150);
    doc.text(`Total Loyers : ${fmtPdf(totalLoyer)}`, 20, y + 26);
    doc.setTextColor(0, 120, 0);
    doc.text(`Total Net a Payer : ${fmtPdf(totalNet)}`, pageW / 2, y + 17, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.save(`Rapport_Paies_${getExportSuffix()}.pdf`);
  };

  const filteredPonctions = filterByMonth(ponctions, 'date');
  const filteredLoyers = filterByMonth(paiementsLoyer, 'date_paiement');
  const filteredPaies = filterByMonth(paies, 'date');

  const totalFilteredPonctions = filteredPonctions.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalFilteredLoyers = filteredLoyers.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalFilteredBrut = filteredPaies.reduce((sum, p) => sum + (Number(p.salaire_brut) || 0), 0);
  const totalFilteredNet = filteredPaies.reduce((sum, p) => sum + (Number(p.net_a_payer) || 0), 0);

  return (
    <div className="space-y-8 pb-16">
      {/* Premium Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-indigo-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <FileText className="text-amber-400" size={30} />
              </div>
              <span className="px-3.5 py-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold rounded-full uppercase tracking-wider shadow-sm">
                Analyses & Statistiques GEBAT
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
              Rapports Financiers
            </h1>
            <p className="text-blue-100 mt-2 max-w-2xl text-sm md:text-base leading-relaxed font-normal">
              Générez et personnalisez vos états d'audit pour les ponctions EPI, les règlements de loyers et les grilles de paie par chantier, semaine ou période spécifique.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                if (activeTab === 'ponctions') exportPonctionsExcel();
                else if (activeTab === 'loyers') exportLoyersExcel();
                else if (activeTab === 'paies') exportPaiesExcel();
              }}
              className="px-5 py-3 bg-emerald-600/90 hover:bg-emerald-600 text-white font-extrabold rounded-2xl transition-all shadow-lg flex items-center gap-2.5 text-sm border border-emerald-400/50 backdrop-blur-md"
              title="Exporter le rapport actif au format Excel (.xlsx)"
            >
              <Download size={18} />
              <span>Export Excel ({activeTab === 'ponctions' ? 'Ponctions' : activeTab === 'loyers' ? 'Loyers' : 'Paies'})</span>
            </button>

            <button
              onClick={() => {
                if (activeTab === 'ponctions') exportPonctionsPDF();
                else if (activeTab === 'loyers') exportLoyersPDF();
                else if (activeTab === 'paies') exportPaiesPDF();
              }}
              className="px-5 py-3 bg-red-600/90 hover:bg-red-600 text-white font-extrabold rounded-2xl transition-all shadow-lg flex items-center gap-2.5 text-sm border border-red-400/50 backdrop-blur-md"
              title="Exporter le rapport actif au format PDF (.pdf)"
            >
              <FileText size={18} />
              <span>Export PDF ({activeTab === 'ponctions' ? 'Ponctions' : activeTab === 'loyers' ? 'Loyers' : 'Paies'})</span>
            </button>

            <button
              onClick={fetchData}
              className="p-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl transition-all shadow-md"
              title="Rafraîchir les rapports"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
            <Filter className="text-blue-600" size={20} />
            Filtres de Période & Chantier
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 mr-2 hidden md:inline">
              Export rapide :
            </span>
            <button
              onClick={() => {
                if (activeTab === 'ponctions') exportPonctionsExcel();
                else if (activeTab === 'loyers') exportLoyersExcel();
                else if (activeTab === 'paies') exportPaiesExcel();
              }}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 flex items-center gap-2 text-xs transition-all shadow-2xs"
            >
              <Download size={14} /> Excel ({activeTab === 'ponctions' ? 'Ponctions' : activeTab === 'loyers' ? 'Loyers' : 'Paies'})
            </button>
            <button
              onClick={() => {
                if (activeTab === 'ponctions') exportPonctionsPDF();
                else if (activeTab === 'loyers') exportLoyersPDF();
                else if (activeTab === 'paies') exportPaiesPDF();
              }}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-800 font-extrabold rounded-xl border border-red-200 flex items-center gap-2 text-xs transition-all shadow-2xs"
            >
              <FileText size={14} /> PDF ({activeTab === 'ponctions' ? 'Ponctions' : activeTab === 'loyers' ? 'Loyers' : 'Paies'})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" /> Semaine
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:bg-white focus:border-blue-500"
              value={semaine}
              onChange={(e) => setSemaine(e.target.value)}
            >
              <option value="">Toutes les semaines</option>
              {getUniqueWeekOptions().map((opt) => (
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
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-blue-500"
              value={datePaiement}
              onChange={(e) => setDatePaiement(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 flex items-center justify-between">
              <span>Date de Début (Optionnel)</span>
              <span className="text-[10px] text-blue-600 font-semibold uppercase bg-blue-50 px-1.5 py-0.5 rounded">Auto</span>
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
              <span className="text-[10px] text-blue-600 font-semibold uppercase bg-blue-50 px-1.5 py-0.5 rounded">Auto</span>
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
              <Building2 size={14} className="text-indigo-600" /> Chantier / Site
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-blue-500"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
            >
              <option value="">Tous les chantiers (Bingerville, Songon...)</option>
              {[...new Set(ouvriers.map(o => o.site).filter(Boolean))].map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Users size={14} className="text-purple-600" /> Qualification
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-blue-500"
              value={qualificationFilter}
              onChange={(e) => setQualificationFilter(e.target.value)}
            >
              <option value="">Toutes les qualifications (Maçons, Ferrailleurs...)</option>
              {[...new Set(ouvriers.map(o => o.qualification).filter(Boolean))].map(qualification => (
                <option key={qualification} value={qualification}>{qualification}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('ponctions')}
          className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black text-sm transition-all ${
            activeTab === 'ponctions'
              ? 'bg-amber-500 text-gray-950 shadow-lg shadow-amber-500/25 scale-105'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Shield size={18} className={activeTab === 'ponctions' ? 'stroke-[2.5]' : ''} />
          Ponctions EPI
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'ponctions' ? 'bg-gray-950 text-white' : 'bg-gray-200 text-gray-700'}`}>
            {filteredPonctions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('loyers')}
          className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black text-sm transition-all ${
            activeTab === 'loyers'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25 scale-105'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Building2 size={18} className={activeTab === 'loyers' ? 'stroke-[2.5]' : ''} />
          Loyers
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'loyers' ? 'bg-white text-purple-700' : 'bg-gray-200 text-gray-700'}`}>
            {filteredLoyers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('paies')}
          className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black text-sm transition-all ${
            activeTab === 'paies'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-105'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <FileText size={18} className={activeTab === 'paies' ? 'stroke-[2.5]' : ''} />
          Bulletins de Paie
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'paies' ? 'bg-white text-blue-700' : 'bg-gray-200 text-gray-700'}`}>
            {filteredPaies.length}
          </span>
        </button>
      </div>

      {/* KPI Cards for the active tab */}
      {activeTab === 'ponctions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-800">Cumul Retenues EPI (Filtré)</span>
              <div className="text-3xl font-black text-amber-900 mt-1 font-mono">{formatCurrency(totalFilteredPonctions)}</div>
            </div>
            <div className="p-4 bg-amber-500/20 rounded-2xl text-amber-800">
              <Shield size={32} strokeWidth={2.5} />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-gray-400">Nombre d'Écritures</span>
              <div className="text-3xl font-black text-gray-900 mt-1 font-mono">{filteredPonctions.length} retenues</div>
            </div>
            <div className="p-4 bg-gray-100 rounded-2xl text-gray-600">
              <Layers size={32} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'loyers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-purple-800">Cumul Règlements Loyers (Filtré)</span>
              <div className="text-3xl font-black text-purple-900 mt-1 font-mono">{formatCurrency(totalFilteredLoyers)}</div>
            </div>
            <div className="p-4 bg-purple-500/20 rounded-2xl text-purple-800">
              <Building2 size={32} strokeWidth={2.5} />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-gray-400">Paiements Logement</span>
              <div className="text-3xl font-black text-gray-900 mt-1 font-mono">{filteredLoyers.length} quittances</div>
            </div>
            <div className="p-4 bg-gray-100 rounded-2xl text-gray-600">
              <Layers size={32} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'paies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-blue-800">Total Salaire Brut</span>
              <div className="text-2xl font-black text-blue-900 mt-1 font-mono">{formatCurrency(totalFilteredBrut)}</div>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-800">
              <DollarSign size={28} strokeWidth={2.5} />
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-blue-950 text-white rounded-2xl p-6 shadow-lg border border-indigo-700 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-300">Total Net à Payer</span>
              <div className="text-3xl font-black text-white mt-1 font-mono">{formatCurrency(totalFilteredNet)}</div>
            </div>
            <div className="p-3 bg-white/10 rounded-2xl text-white">
              <CheckCircle2 size={28} strokeWidth={2.5} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-gray-400">Bulletins Concernés</span>
              <div className="text-2xl font-black text-gray-900 mt-1 font-mono">{filteredPaies.length} fiches</div>
            </div>
            <div className="p-3 bg-gray-100 rounded-2xl text-gray-600">
              <Layers size={28} />
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Ponctions */}
      {activeTab === 'ponctions' && (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-fadeIn">
          <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Shield className="text-amber-600" size={22} />
              Détail des Ponctions EPI
            </h2>
            <div className="flex gap-2">
              <button
                onClick={exportPonctionsExcel}
                className="px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 flex items-center gap-2 text-xs transition-all"
              >
                <Download size={16} /> Export Excel (.xlsx)
              </button>
              <button
                onClick={exportPonctionsPDF}
                className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-800 font-extrabold rounded-xl border border-red-200 flex items-center gap-2 text-xs transition-all"
              >
                <FileText size={16} /> Export PDF (.pdf)
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  <th className="py-4 px-5">Ouvrier</th>
                  <th className="py-4 px-4">Date de Prélèvement</th>
                  <th className="py-4 px-4 text-right">Montant Retenue</th>
                  <th className="py-4 px-4">Motif</th>
                  <th className="py-4 px-5 text-right font-black text-amber-900">Cumul EPI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPonctions.map((ponction) => (
                  <tr key={ponction.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3.5 px-5 font-black text-gray-900 text-sm">
                      {ponction.nom} {ponction.prenom}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-600">
                      {formatDate(ponction.date)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-600 text-sm">
                      {formatCurrency(ponction.montant)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-700">
                      {ponction.motif || '-'}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-black text-gray-900 text-sm bg-amber-50/40">
                      {formatCurrency(ponction.cumul)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPonctions.length === 0 && (
              <div className="text-center py-16 text-gray-400">Aucune ponction trouvée pour cette période.</div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Loyers */}
      {activeTab === 'loyers' && (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-fadeIn">
          <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Building2 className="text-purple-600" size={22} />
              Rapport des Paiements de Loyer
            </h2>
            <div className="flex gap-2">
              <button
                onClick={exportLoyersExcel}
                className="px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 flex items-center gap-2 text-xs transition-all"
              >
                <Download size={16} /> Export Excel (.xlsx)
              </button>
              <button
                onClick={exportLoyersPDF}
                className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-800 font-extrabold rounded-xl border border-red-200 flex items-center gap-2 text-xs transition-all"
              >
                <FileText size={16} /> Export PDF (.pdf)
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  <th className="py-4 px-5">Ouvrier</th>
                  <th className="py-4 px-4">Mois & Année</th>
                  <th className="py-4 px-4 text-right">Montant Rendu</th>
                  <th className="py-4 px-5">Date d'Enregistrement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLoyers.map((paiement) => (
                  <tr key={paiement.id} className="hover:bg-purple-50/30 transition-colors">
                    <td className="py-3.5 px-5 font-black text-gray-900 text-sm">
                      {paiement.nom} {paiement.prenom}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-purple-700 capitalize">
                      {paiement.mois} {paiement.annee}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900 text-sm">
                      {formatCurrency(paiement.montant)}
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-gray-600">
                      {formatDate(paiement.date_paiement)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLoyers.length === 0 && (
              <div className="text-center py-16 text-gray-400">Aucun paiement de loyer trouvé pour cette période.</div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Paies */}
      {activeTab === 'paies' && (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-fadeIn">
          <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" size={22} />
              Grille & Rapport des Paies
            </h2>
            <div className="flex gap-2">
              <button
                onClick={exportPaiesExcel}
                className="px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl border border-emerald-200 flex items-center gap-2 text-xs transition-all"
              >
                <Download size={16} /> Export Excel (.xlsx)
              </button>
              <button
                onClick={exportPaiesPDF}
                className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-800 font-extrabold rounded-xl border border-red-200 flex items-center gap-2 text-xs transition-all"
              >
                <FileText size={16} /> Export PDF (.pdf)
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  <th className="py-4 px-4 text-center">Semaine</th>
                  <th className="py-4 px-4">Ouvrier & Qualification</th>
                  <th className="py-4 px-4 text-right">Salaire Brut</th>
                  <th className="py-4 px-4 text-right">Ponctions EPI</th>
                  <th className="py-4 px-4 text-right">Loyer</th>
                  <th className="py-4 px-4 text-right">Remb. EPI</th>
                  <th className="py-4 px-4 text-right">Déd. EPI</th>
                  <th className="py-4 px-5 text-right font-black text-blue-900 bg-blue-50/50">Net à Payer</th>
                  <th className="py-4 px-4">Date Versement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPaies.map((paie) => (
                  <tr key={paie.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-extrabold rounded-lg text-xs">
                        {paie.semaine || '-'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-gray-900 text-sm">
                      {paie.nom} {paie.prenom}
                      <span className="block text-xs font-semibold text-indigo-600 mt-0.5">{paie.qualification || '-'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-700">
                      {formatCurrency(paie.salaire_brut)}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${paie.ponction > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {paie.ponction > 0 ? formatCurrency(paie.ponction) : '-'}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${paie.loyer > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                      {paie.loyer > 0 ? formatCurrency(paie.loyer) : '-'}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${paie.epi_remboursement > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {formatCurrencySigned(paie.epi_remboursement)}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${paie.epi_deduction > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {paie.epi_deduction > 0 ? '-' + formatCurrency(paie.epi_deduction) : '-'}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-black text-emerald-700 text-sm bg-blue-50/30">
                      {formatCurrency(paie.net_a_payer)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-600">
                      {formatDate(paie.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPaies.length === 0 && (
              <div className="text-center py-16 text-gray-400">Aucune paie trouvée pour cette période.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
