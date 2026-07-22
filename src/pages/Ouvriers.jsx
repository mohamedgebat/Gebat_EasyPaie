import { apiFetch } from '../lib/api';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Edit, Trash2, Eye, FileText, Users, Briefcase, 
  Building2, Phone, Calendar, CreditCard, Filter, X, Grid, List, 
  ShieldCheck, UserX, CheckCircle2, AlertCircle, RefreshCw, HardHat, Award, ArrowRight
} from 'lucide-react';
import { formatDate } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import gebatLogo from '../assets/logo_gebat.png';

// Helper for generating consistent avatar background colors from strings
const getAvatarColor = (name = '') => {
  const colors = [
    'from-blue-600 to-indigo-700',
    'from-emerald-600 to-teal-700',
    'from-amber-500 to-orange-600',
    'from-purple-600 to-violet-700',
    'from-rose-600 to-pink-700',
    'from-cyan-600 to-blue-700'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function Ouvriers() {
  const navigate = useNavigate();
  const [ouvriers, setOuvriers] = useState([]);
  const [epiProgrammes, setEpiProgrammes] = useState([]);
  const [ponctions, setPonctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOuvrier, setEditingOuvrier] = useState(null);
  
  // UI States & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'actif' | 'parti'
  const [qualificationFilter, setQualificationFilter] = useState('ALL');
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    prenom: '',
    telephone: '',
    site: '',
    qualification: '',
    operateur: '',
    numero_mobile_money: '',
    date_entree: '',
    statut: 'actif',
  });

  useEffect(() => {
    fetchOuvriers();
  }, []);

  const fetchOuvriers = async () => {
    setLoading(true);
    try {
      const [resOuv, resEpi, resPonc] = await Promise.all([
        apiFetch('/api/ouvriers'),
        apiFetch('/api/epi-programmes'),
        apiFetch('/api/ponctions')
      ]);
      
      if (resOuv.ok) setOuvriers(await resOuv.json());
      else setOuvriers([]);

      if (resEpi.ok) setEpiProgrammes(await resEpi.json());
      else setEpiProgrammes([]);

      if (resPonc.ok) setPonctions(await resPonc.json());
      else setPonctions([]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const path = editingOuvrier
        ? `/api/ouvriers/${editingOuvrier.id}`
        : '/api/ouvriers';
      
      const method = editingOuvrier ? 'PUT' : 'POST';
      
      const response = await apiFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingOuvrier(null);
        setFormData({
          matricule: '',
          nom: '',
          prenom: '',
          telephone: '',
          site: '',
          qualification: '',
          operateur: '',
          numero_mobile_money: '',
          date_entree: '',
          statut: 'actif',
        });
        fetchOuvriers();
      }
    } catch (error) {
      console.error('Error saving ouvrier:', error);
    }
  };

  const handleEdit = (ouvrier) => {
    setEditingOuvrier(ouvrier);
    setFormData(ouvrier);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet ouvrier de la base ?')) {
      try {
        await apiFetch(`/api/ouvriers/${id}`, {
          method: 'DELETE',
        });
        fetchOuvriers();
      } catch (error) {
        console.error('Error deleting ouvrier:', error);
      }
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const subtitle = searchTerm ? `Filtre : "${searchTerm}"` : 'Tous les ouvriers GEBAT';
    
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
    doc.text('Répertoire Général des Ouvriers', 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(subtitle, 14, 27);
    doc.setFontSize(8);
    doc.setTextColor(180, 200, 240);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} - Effectif : ${filteredOuvriers.length}`, 14, 37);
    doc.setTextColor(0, 0, 0);

    const rows = filteredOuvriers.map((o) => {
      let epiStatusStr = "Aucun";
      if (o.statut === 'parti' && o.epi_settled) {
        epiStatusStr = "Remboursé";
      } else {
        const prog = epiProgrammes.find(e => Number(e.ouvrier_id) === Number(o.id));
        if (prog) {
          const ponctionsReliees = ponctions.filter(p => p.motif?.includes(`[PROG EPI N°${prog.id}]`)).length;
          const total = Number(prog.semaines_totales);
          epiStatusStr = ponctionsReliees >= total ? "Terminé" : `${ponctionsReliees}/${total}`;
        }
      }

      return [
        o.matricule || '-',
        o.nom,
        o.prenom || '-',
        o.telephone || '-',
        o.site || '-',
        o.qualification || '-',
        o.operateur || '-',
        o.numero_mobile_money || '-',
        o.date_entree ? formatDate(o.date_entree) : '-',
        epiStatusStr,
        o.statut?.toUpperCase() || '-'
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
      bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
      rowPageBreak: 'auto',
      margin: { top: 52, left: 14, right: 14 },
      startY: 52,
      head: [[
        'Matricule', 'Nom', 'Prénom', 'Téléphone', 'Site / Chantier',
        'Qualification', 'Opérateur', 'Mobile Money', 'Date Entrée', 'Prog. EPI', 'Statut'
      ]],
      body: rows,
      columnStyles: {
        0: { halign: 'center' },
        8: { halign: 'center' },
        9: { halign: 'center', fontStyle: 'bold' },
        10: { halign: 'center' }
      },
    });

    const y = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(240, 244, 255);
    doc.roundedRect(14, y, pageW - 28, 12, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(21, 101, 192);
    doc.text(`Total des ouvriers listés dans ce rapport : ${filteredOuvriers.length}`, 20, y + 8);
    doc.setTextColor(0, 0, 0);

    doc.save(`Liste_Ouvriers_GEBAT_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Distinct Qualifications & Sites for dropdowns
  const qualificationsList = useMemo(() => {
    const set = new Set(ouvriers.map(o => o.qualification || 'Non renseigné').filter(Boolean));
    return Array.from(set).sort();
  }, [ouvriers]);

  const sitesList = useMemo(() => {
    const set = new Set(ouvriers.map(o => o.site || 'Non assigné').filter(Boolean));
    return Array.from(set).sort();
  }, [ouvriers]);

  // Filtered Ouvriers
  const filteredOuvriers = useMemo(() => {
    return ouvriers.filter((ouvrier) => {
      const matchesSearch = !searchTerm || (
        ouvrier.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ouvrier.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ouvrier.matricule?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ouvrier.site?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ouvrier.telephone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ouvrier.qualification?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesStatus = statusFilter === 'ALL' || ouvrier.statut === statusFilter;
      const matchesQual = qualificationFilter === 'ALL' || (ouvrier.qualification || 'Non renseigné') === qualificationFilter;
      const matchesSite = siteFilter === 'ALL' || (ouvrier.site || 'Non assigné') === siteFilter;

      return matchesSearch && matchesStatus && matchesQual && matchesSite;
    });
  }, [ouvriers, searchTerm, statusFilter, qualificationFilter, siteFilter]);

  // Stats
  const stats = useMemo(() => {
    const actifs = filteredOuvriers.filter(o => o.statut === 'actif').length;
    const partis = filteredOuvriers.filter(o => o.statut === 'parti').length;
    
    // Compter les sites uniques et qualifications uniques dans les résultats filtrés
    const uniqueSites = new Set(filteredOuvriers.map(o => o.site).filter(Boolean));
    const uniqueQuals = new Set(filteredOuvriers.map(o => o.qualification).filter(Boolean));

    return {
      total: filteredOuvriers.length,
      actifs,
      partis,
      sitesCount: uniqueSites.size,
      qualsCount: uniqueQuals.size
    };
  }, [filteredOuvriers]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setQualificationFilter('ALL');
    setSiteFilter('ALL');
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Premium Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
              <HardHat className="text-amber-400" size={30} />
            </div>
            <span className="px-3.5 py-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold rounded-full uppercase tracking-wider shadow-sm">
              Répertoire GEBAT
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
            Gestion des Ouvriers
          </h1>
          <p className="text-blue-100 mt-2 max-w-2xl text-sm md:text-base leading-relaxed font-normal">
            Gérez, suivez et administrez l'ensemble de vos maçons, ferrailleurs, coffreurs et journaliers sur vos différents chantiers avec leurs coordonnées de paiement.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 relative z-10">
          <button
            onClick={fetchOuvriers}
            className="p-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-medium flex items-center justify-center transition-all duration-200 shadow-md"
            title="Rafraîchir la liste"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
          
          <button
            onClick={handleExportPDF}
            className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all duration-200 text-sm shadow-md"
          >
            <FileText size={18} className="text-amber-300" />
            Exporter PDF ({filteredOuvriers.length})
          </button>

          <button
            onClick={() => {
              setEditingOuvrier(null);
              setFormData({
                matricule: '',
                nom: '',
                prenom: '',
                telephone: '',
                site: '',
                qualification: '',
                operateur: '',
                numero_mobile_money: '',
                date_entree: '',
                statut: 'actif',
              });
              setShowModal(true);
            }}
            className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2.5 transform active:scale-95 transition-all duration-200 text-sm whitespace-nowrap"
          >
            <Plus size={20} className="stroke-[3]" />
            Ajouter un ouvrier
          </button>
        </div>
      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Effectif Total</span>
            <div className="text-3xl font-black text-gray-900 mt-1">{stats.total}</div>
            <p className="text-xs text-indigo-600 font-semibold mt-1 flex items-center gap-1">
              <Users size={12} /> Répertoire complet
            </p>
          </div>
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Users size={26} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Ouvriers Actifs</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{stats.actifs}</div>
            <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> Présents sur chantiers
            </p>
          </div>
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <ShieldCheck size={26} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Qualifications</span>
            <div className="text-3xl font-black text-purple-600 mt-1">{stats.qualsCount}</div>
            <p className="text-xs text-purple-700 font-semibold mt-1 flex items-center gap-1">
              <Award size={12} /> Corps de métiers
            </p>
          </div>
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <Briefcase size={26} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Chantiers / Sites</span>
            <div className="text-3xl font-black text-amber-600 mt-1">{stats.sitesCount}</div>
            <p className="text-xs text-amber-700 font-semibold mt-1 flex items-center gap-1">
              <Building2 size={12} /> {stats.partis > 0 ? `${stats.partis} parti(s)` : 'Aucun départ'}
            </p>
          </div>
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Building2 size={26} />
          </div>
        </div>
      </div>

      {/* Advanced Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher par nom, prénom, matricule, téléphone, chantier ou qualification..."
              className="w-full pl-11 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <div className="bg-gray-100 p-1 rounded-xl flex items-center">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List size={16} /> Tableau
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid size={16} /> Cartes
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills / Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 text-xs">
          <span className="font-bold text-gray-500 flex items-center gap-1">
            <Filter size={14} /> Filtres :
          </span>

          {/* Status filter */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                statusFilter === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tous ({ouvriers.length})
            </button>
            <button
              onClick={() => setStatusFilter('actif')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                statusFilter === 'actif' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              Actifs ({stats.actifs})
            </button>
            <button
              onClick={() => setStatusFilter('parti')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                statusFilter === 'parti' ? 'bg-red-600 text-white shadow-sm' : 'text-red-700 hover:text-red-900'
              }`}
            >
              Partis ({stats.partis})
            </button>
          </div>

          {/* Qualification dropdown */}
          <select
            value={qualificationFilter}
            onChange={(e) => setQualificationFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-semibold text-gray-700 focus:border-indigo-500"
          >
            <option value="ALL">Toutes Qualifications ({qualificationsList.length})</option>
            {qualificationsList.map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>

          {/* Site dropdown */}
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-semibold text-gray-700 focus:border-indigo-500"
          >
            <option value="ALL">Tous les Chantiers ({sitesList.length})</option>
            {sitesList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {(searchTerm || statusFilter !== 'ALL' || qualificationFilter !== 'ALL' || siteFilter !== 'ALL') && (
            <button
              onClick={resetFilters}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 ml-auto underline"
            >
              <X size={14} /> Réinitialiser filtres
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600 font-semibold text-sm">Chargement du répertoire des ouvriers...</p>
        </div>
      ) : filteredOuvriers.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX size={36} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">Aucun ouvrier trouvé</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            {searchTerm || statusFilter !== 'ALL' || qualificationFilter !== 'ALL' || siteFilter !== 'ALL'
              ? 'Aucun ouvrier ne correspond à vos critères de recherche ou filtres actuels.'
              : 'Votre base de données ouvriers est actuellement vide.'}
          </p>
          {searchTerm || statusFilter !== 'ALL' || qualificationFilter !== 'ALL' || siteFilter !== 'ALL' ? (
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl text-xs transition-colors"
            >
              Réinitialiser tous les filtres
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingOuvrier(null);
                setShowModal(true);
              }}
              className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl text-sm transition-colors inline-flex items-center gap-2"
            >
              <Plus size={18} /> Ajouter votre premier ouvrier
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 font-extrabold uppercase tracking-wider border-b border-gray-200">
                  <th className="py-4 px-4">Ouvrier / Désignation</th>
                  <th className="py-4 px-3">Matricule</th>
                  <th className="py-4 px-4">Qualification / Métier</th>
                  <th className="py-4 px-4">Chantier (Site)</th>
                  <th className="py-4 px-3">Téléphone</th>
                  <th className="py-4 px-4">Coordonnées Mobile Money</th>
                  <th className="py-4 px-3 text-center">Prog. EPI</th>
                  <th className="py-4 px-3 text-center">Statut</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOuvriers.map((ouvrier) => {
                  const fullName = `${ouvrier.nom} ${ouvrier.prenom || ''}`.trim();
                  const initials = `${ouvrier.nom.charAt(0)}${(ouvrier.prenom || '').charAt(0) || ''}`.toUpperCase();
                  
                  return (
                    <tr key={ouvrier.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarColor(ouvrier.nom)} text-white font-black flex items-center justify-center shadow-sm flex-shrink-0 text-sm`}>
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">
                              {fullName}
                            </div>
                            {ouvrier.date_entree && (
                              <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                <Calendar size={11} /> Entré le {formatDate(ouvrier.date_entree)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {ouvrier.matricule ? (
                          <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-md text-xs">
                            {ouvrier.matricule}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {ouvrier.qualification ? (
                          <span className="font-bold text-indigo-950 bg-indigo-50/80 border border-indigo-100 px-3 py-1 rounded-lg text-xs inline-flex items-center gap-1.5">
                            <Briefcase size={13} className="text-indigo-600" />
                            {ouvrier.qualification}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {ouvrier.site ? (
                          <span className="font-bold text-amber-950 bg-amber-50/80 border border-amber-200/60 px-3 py-1 rounded-lg text-xs inline-flex items-center gap-1.5">
                            <Building2 size={13} className="text-amber-600" />
                            {ouvrier.site}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-gray-700">
                        {ouvrier.telephone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone size={13} className="text-gray-400" />
                            {ouvrier.telephone}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {ouvrier.numero_mobile_money || ouvrier.operateur ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 font-bold text-gray-900">
                              <CreditCard size={13} className="text-emerald-600" />
                              {ouvrier.numero_mobile_money || 'Non précisé'}
                            </div>
                            {ouvrier.operateur && (
                              <span className={`text-[10px] font-extrabold uppercase mt-0.5 w-max px-1.5 py-0.5 rounded ${
                                ouvrier.operateur.toLowerCase().includes('orange') ? 'bg-orange-100 text-orange-800' :
                                ouvrier.operateur.toLowerCase().includes('mtn') ? 'bg-yellow-100 text-yellow-800' :
                                ouvrier.operateur.toLowerCase().includes('wave') ? 'bg-blue-100 text-blue-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {ouvrier.operateur}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        {(() => {
                          if (ouvrier.statut === 'parti' && ouvrier.epi_settled) {
                            return (
                              <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-600 border border-purple-100 font-bold px-2.5 py-1 rounded-md text-[10px] whitespace-nowrap">
                                <CheckCircle2 size={12} /> Remboursé
                              </span>
                            );
                          }
                          const prog = epiProgrammes.find(e => Number(e.ouvrier_id) === Number(ouvrier.id));
                          if (!prog) return <span className="text-xs text-gray-300 font-medium italic">Aucun</span>;
                          const ponctionsReliees = ponctions.filter(p => p.motif?.includes(`[PROG EPI N°${prog.id}]`)).length;
                          const total = Number(prog.semaines_totales);
                          if (ponctionsReliees >= total) {
                            return (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-2.5 py-1 rounded-md text-[10px] whitespace-nowrap">
                                <CheckCircle2 size={12} /> Terminé
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-100 font-bold px-2.5 py-1 rounded-md text-[10px] whitespace-nowrap">
                              <RefreshCw size={10} className="animate-spin-slow" /> {ponctionsReliees}/{total}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                            ouvrier.statut === 'actif'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}
                        >
                          {ouvrier.statut === 'actif' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {ouvrier.statut ? ouvrier.statut.toUpperCase() : 'ACTIF'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/ouvriers/${ouvrier.id}`)}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Voir la fiche détaillée"
                          >
                            <Eye size={17} />
                          </button>
                          <button
                            onClick={() => handleEdit(ouvrier)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Modifier les informations"
                          >
                            <Edit size={17} />
                          </button>
                          <button
                            onClick={() => handleDelete(ouvrier.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer l'ouvrier"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 text-xs font-semibold text-gray-500 flex items-center justify-between">
            <span>Affichage de {filteredOuvriers.length} sur {ouvriers.length} ouvriers</span>
            <span className="text-indigo-600 font-bold">GEBAT</span>
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredOuvriers.map((ouvrier) => {
            const fullName = `${ouvrier.nom} ${ouvrier.prenom || ''}`.trim();
            const initials = `${ouvrier.nom.charAt(0)}${(ouvrier.prenom || '').charAt(0) || ''}`.toUpperCase();

            return (
              <div
                key={ouvrier.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300 flex flex-col justify-between group overflow-hidden"
              >
                <div className="p-5">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getAvatarColor(ouvrier.nom)} text-white font-black flex items-center justify-center shadow-md text-base group-hover:scale-105 transition-transform`}>
                      {initials}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                        ouvrier.statut === 'actif'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ouvrier.statut === 'actif' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                      {ouvrier.statut?.toUpperCase()}
                    </span>
                  </div>

                  {/* Name & Matricule */}
                  <div>
                    <h3 className="font-extrabold text-base text-gray-900 group-hover:text-indigo-600 transition-colors leading-tight">
                      {fullName}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono mt-1">
                      {ouvrier.matricule ? `Matricule: ${ouvrier.matricule}` : 'Pas de matricule assigné'}
                    </p>
                  </div>

                  {/* Badges / Infos */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-gray-700 font-semibold">
                      <Briefcase size={14} className="text-indigo-500 flex-shrink-0" />
                      <span>{ouvrier.qualification || 'Qualification non renseignée'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700 font-semibold">
                      <Building2 size={14} className="text-amber-500 flex-shrink-0" />
                      <span>{ouvrier.site || 'Aucun chantier assigné'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone size={14} className="text-gray-400 flex-shrink-0" />
                      <span>{ouvrier.telephone || 'Non renseigné'}</span>
                    </div>

                    {(ouvrier.numero_mobile_money || ouvrier.operateur) && (
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-gray-800 flex items-center gap-1">
                          <CreditCard size={13} className="text-emerald-600" />
                          {ouvrier.numero_mobile_money || 'Mobile Money'}
                        </span>
                        {ouvrier.operateur && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded font-bold text-gray-700 uppercase">
                            {ouvrier.operateur}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => navigate(`/ouvriers/${ouvrier.id}`)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    Fiche ouvrier <ArrowRight size={13} />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(ouvrier)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(ouvrier.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modern Backdrop Blurred Modal for Add / Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  {editingOuvrier ? <Edit className="text-amber-300" size={24} /> : <Plus className="text-amber-300" size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold">
                    {editingOuvrier ? 'Modifier la fiche de l\'ouvrier' : 'Ajouter un nouvel ouvrier'}
                  </h2>
                  <p className="text-xs text-blue-200 mt-0.5">
                    {editingOuvrier ? `Mise à jour des informations pour ${editingOuvrier.nom}` : 'Renseignez les informations du travailleur pour le suivi de paie.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingOuvrier(null);
                }}
                className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Section 1: Identité */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 mb-3 pb-1 border-b border-gray-100 flex items-center gap-1.5">
                  <Users size={14} /> 1. Informations Personnelles & Identité
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Matricule / Badge
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: M042"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      value={formData.matricule || ''}
                      onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Nom Prénom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: KOUASSI Jean-Luc"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 uppercase focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      value={formData.nom || ''}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Affectation & Chantier */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-600 mb-3 pb-1 border-b border-gray-100 flex items-center gap-1.5">
                  <Briefcase size={14} /> 2. Métier & Affectation sur Chantier
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Qualification / Corps de métier
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: MACONS, FERRAILLEURS..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 uppercase focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      value={formData.qualification || ''}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Chantier / Site d'affectation
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: SONGON, COCODY..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 uppercase focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      value={formData.site || ''}
                      onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Date d'entrée sur chantier
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      value={formData.date_entree || ''}
                      onChange={(e) => setFormData({ ...formData, date_entree: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Contact & Paiement */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 mb-3 pb-1 border-b border-gray-100 flex items-center gap-1.5">
                  <CreditCard size={14} /> 3. Contact & Coordonnées Mobile Money
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Téléphone Appel
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 07 08..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      value={formData.telephone || ''}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Opérateur Paiement
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      value={formData.operateur || ''}
                      onChange={(e) => setFormData({ ...formData, operateur: e.target.value })}
                    >
                      <option value="">Sélectionner</option>
                      <option value="Orange Money">Orange Money</option>
                      <option value="MTN">MTN</option>
                      <option value="Wave">Wave</option>
                      <option value="Banque">Virement Bancaire</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Numéro Mobile Money
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 07 08 09 10 11"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      value={formData.numero_mobile_money || ''}
                      onChange={(e) => setFormData({ ...formData, numero_mobile_money: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Statut Ouvrier
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-extrabold text-gray-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      value={formData.statut || 'actif'}
                      onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                    >
                      <option value="actif">🟢 Actif sur chantier</option>
                      <option value="parti">🔴 Parti / Fin contrat</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingOuvrier(null);
                  }}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 text-sm transition-all"
                >
                  {editingOuvrier ? 'Enregistrer les modifications' : 'Créer et ajouter l\'ouvrier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
