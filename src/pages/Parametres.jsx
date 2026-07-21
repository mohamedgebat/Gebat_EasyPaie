import { apiFetch } from '../lib/api';
import { useState, useEffect } from 'react';
import { 
  Save, Database, Building, Shield, DollarSign, RefreshCw, 
  Settings, AlertTriangle, CheckCircle2, Plus, Trash2, ShieldAlert,
  Sliders, HardDrive, Cpu, Sparkles, Building2, Layers, Users,
  UserCheck, UserPlus, Lock, Key, Award, ShieldCheck, Eye, EyeOff, Mail
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import gebatLogo from '../assets/gebat_logo.jpg';

export default function Parametres() {
  const [settings, setSettings] = useState({
    epi_limits: {
      'Bingerville': 12000,
      'Songon': 9000,
    },
    epi_weekly_deduction: 3000,
    company_name: 'GEBAT & NOURIVOIRE',
    currency: 'XOF',
    default_site: '',
  });
  const [newSite, setNewSite] = useState('');
  const [newSiteLimit, setNewSiteLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [dbStats, setDbStats] = useState({ ouvriers: 0, pointages: 0, paies: 0 });

  // Users Management State
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newTitre, setNewTitre] = useState('');
  const [newRole, setNewRole] = useState('Gestionnaire Paie');
  const [showPassword, setShowPassword] = useState(false);

  // Edit User State
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editTitre, setEditTitre] = useState('');
  const [editRole, setEditRole] = useState('Gestionnaire Paie');
  const [showEditPassword, setShowEditPassword] = useState(false);

  useEffect(() => {
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

    // Load Users
    fetchUsers();
    fetchDbStats();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/utilisateurs');
      if (res.ok) {
        const dbUsers = await res.json();
        setUsers(dbUsers);
      }
    } catch (e) {
      console.error('Error loading users from server:', e);
    }
  };

  const fetchDbStats = async () => {
    try {
      const [ouvriersRes, pointagesRes, paiesRes] = await Promise.all([
        apiFetch('/api/ouvriers'),
        apiFetch('/api/pointages'),
        apiFetch('/api/paies'),
      ]);
      if (ouvriersRes.ok && pointagesRes.ok && paiesRes.ok) {
        setDbStats({
          ouvriers: (await ouvriersRes.json()).length || 0,
          pointages: (await pointagesRes.json()).length || 0,
          paies: (await paiesRes.json()).length || 0,
        });
      }
    } catch (e) {
      console.error('Error fetching stats for settings page:', e);
    }
  };

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('easypaie_settings', JSON.stringify(settings));
    setTimeout(() => {
      setSaving(false);
      alert('Paramètres système enregistrés avec succès !');
    }, 400);
  };

  const handleReset = () => {
    if (window.confirm('Êtes-vous sûr de vouloir réinitialiser les paramètres par défaut ?')) {
      const defaultSettings = {
        epi_limits: {
          'Bingerville': 12000,
          'Songon': 9000,
        },
        epi_weekly_deduction: 3000,
        company_name: 'GEBAT & NOURIVOIRE',
        currency: 'XOF',
        default_site: '',
      };
      setSettings(defaultSettings);
      localStorage.setItem('easypaie_settings', JSON.stringify(defaultSettings));
    }
  };

  const addSite = () => {
    if (newSite && newSiteLimit) {
      setSettings({
        ...settings,
        epi_limits: {
          ...settings.epi_limits,
          [newSite.trim()]: parseInt(newSiteLimit),
        },
      });
      setNewSite('');
      setNewSiteLimit('');
    }
  };

  const removeSite = (siteName) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le site "${siteName}" et son plafond EPI ?`)) {
      const newLimits = { ...settings.epi_limits };
      delete newLimits[siteName];
      setSettings({
        ...settings,
        epi_limits: newLimits,
      });
    }
  };

  // User Management Functions
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || !newTitre.trim()) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const usernameLower = newUsername.trim().toLowerCase();
    if (users.some(u => u.username.toLowerCase() === usernameLower)) {
      alert(`L'identifiant "${newUsername}" est déjà utilisé. Veuillez choisir un autre identifiant.`);
      return;
    }

    const newUser = {
      username: newUsername.trim(),
      email: newEmail.trim() || `${newUsername.trim().toLowerCase()}@gebat.ci`,
      password: newPassword.trim(),
      titre: newTitre.trim(),
      role: newRole,
      statut: 'actif'
    };

    try {
      const res = await apiFetch('/api/utilisateurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        // Reset fields
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setNewTitre('');
        setNewRole('Gestionnaire Paie');
        setShowUserModal(false);
        fetchUsers();
        alert(`Compte d'accès créé pour "${newUser.username}" (${newUser.titre}) !`);
      } else {
        alert("Erreur lors de la création de l'utilisateur.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion au serveur.");
    }
  };

  const handleToggleUserStatus = async (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user || user.username === 'admin') return;
    const nextStatut = user.statut === 'actif' ? 'suspendu' : 'actif';

    try {
      const res = await apiFetch(`/api/utilisateurs/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: nextStatut })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert("Erreur lors de la modification du statut.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion au serveur.");
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (username === 'admin') {
      alert("Le compte admin principal ne peut pas être supprimé.");
      return;
    }
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'accès de "${username}" ?`)) {
      try {
        const res = await apiFetch(`/api/utilisateurs/${userId}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          fetchUsers();
        } else {
          alert("Erreur lors de la suppression de l'utilisateur.");
        }
      } catch (err) {
        console.error(err);
        alert("Erreur de connexion au serveur.");
      }
    }
  };

  const handleResetDatabase = async () => {
    if (window.confirm('ATTENTION ZONE DE DANGER : Êtes-vous sûr de vouloir vider et réinitialiser toute la base de données ? Cette action supprimera définitivement tous les ouvriers, pointages, loyers, ponctions, règlements et utilisateurs (sauf le compte admin principal).')) {
      try {
        const response = await apiFetch('/api/database/reset', {
          method: 'POST',
        });
        if (response.ok) {
          const resData = await response.json();
          alert(resData.message || 'La base de données a été réinitialisée avec succès !');
          fetchDbStats();
          fetchUsers();
        } else {
          alert('Erreur lors de la réinitialisation de la base de données.');
        }
      } catch (error) {
        console.error('Error resetting database:', error);
        alert('Erreur réseau lors de la réinitialisation.');
      }
    }
  };

  const handleOpenEditUser = (user) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditEmail(user.email || `${user.username}@gebat.ci`);
    setEditPassword(user.password || '');
    setEditTitre(user.titre);
    setEditRole(user.role || 'Administrateur');
    setShowEditPassword(false);
    setShowEditUserModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editUsername.trim() || !editTitre.trim()) {
      alert('Veuillez remplir les champs obligatoires.');
      return;
    }

    const usernameLower = editUsername.trim().toLowerCase();
    if (users.some(u => u.id !== editingUser?.id && u.username.toLowerCase() === usernameLower)) {
      alert(`L'identifiant "${editUsername}" est déjà utilisé par un autre collaborateur.`);
      return;
    }

    const updatedData = {
      username: editUsername.trim(),
      email: editEmail.trim() || `${editUsername.trim().toLowerCase()}@gebat.ci`,
      password: editPassword.trim() || editingUser.password || 'admin123',
      titre: editTitre.trim(),
      role: editRole
    };

    try {
      const res = await apiFetch(`/api/utilisateurs/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (res.ok) {
        fetchUsers();

        // If current logged-in user is updated, sync session
        const currentLogged = localStorage.getItem('easypaie_current_user');
        if (currentLogged) {
          try {
            const parsedLogged = JSON.parse(currentLogged);
            if (parsedLogged.username.toLowerCase() === editingUser?.username.toLowerCase() || (editingUser?.isBuiltIn && parsedLogged.username === 'admin')) {
              const updatedCurrent = {
                ...parsedLogged,
                username: editUsername.trim(),
                titre: editTitre.trim(),
                role: editRole,
                password: editPassword.trim() || parsedLogged.password || 'admin123'
              };
              localStorage.setItem('easypaie_current_user', JSON.stringify(updatedCurrent));
              window.dispatchEvent(new Event('storage'));
            }
          } catch (err) {
            console.error('Error syncing updated user to session:', err);
          }
        }

        setShowEditUserModal(false);
        alert(`Les informations de "${editUsername.trim()}" (${editTitre.trim()}) ont été mises à jour avec succès !`);
      } else {
        alert("Erreur lors de la mise à jour de l'utilisateur.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion au serveur.");
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'Administrateur': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Gestionnaire Paie': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Contrôleur Chantier': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Auditeur': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Executive Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-indigo-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="hidden sm:block p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
              <img src={gebatLogo} alt="GEBAT" className="w-14 h-14 object-cover rounded-xl shadow-md" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2.5">
                <span className="px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[11px] font-black rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                  <Sparkles size={13} /> Administration GEBAT
                </span>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-black rounded-full uppercase tracking-wider">
                  Sécurité & Accès
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
                Paramètres Système & Utilisateurs
              </h1>
              <p className="text-purple-100 mt-2 max-w-2xl text-sm md:text-base leading-relaxed font-normal">
                Gérez les comptes d'accès avec titres et rôles, configurez les plafonds EPI par chantier, personnalisez l'entreprise et pilotez la base de données.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center gap-2.5 text-sm transition-all transform active:scale-95 disabled:opacity-50"
            >
              <Save size={18} strokeWidth={2.5} />
              {saving ? 'Enregistrement en cours...' : 'Enregistrer les paramètres'}
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-extrabold rounded-2xl transition-all text-xs"
            >
              Réinitialiser par défaut
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: USER MANAGEMENT (GESTION DES UTILISATEURS & ACCÈS) */}
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-gray-100 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100 shadow-xs">
              <Users size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-xl text-gray-900 flex items-center gap-2">
                Gestion des Utilisateurs & Habilitations
              </h2>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">
                Créez des accès personnalisés avec titres professionnels, rôles et privilèges pour vos collaborateurs
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowUserModal(true)}
            className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold rounded-xl shadow-md shadow-indigo-500/20 flex items-center gap-2 text-xs transition-all transform active:scale-95 self-start sm:self-auto"
          >
            <UserPlus size={16} strokeWidth={2.5} />
            + Créer un Nouvel Utilisateur
          </button>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-[11px] font-black uppercase tracking-wider text-gray-400 bg-gray-50/70">
                <th className="py-3.5 px-4 rounded-l-xl">Collaborateur & Identifiant</th>
                <th className="py-3.5 px-4">Titre Professionnel / Poste</th>
                <th className="py-3.5 px-4">Niveau de Privilège (Rôle)</th>
                <th className="py-3.5 px-4 text-center">Statut d'Accès</th>
                <th className="py-3.5 px-4 text-right rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black flex items-center justify-center shadow-sm text-sm">
                        {u.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-black text-gray-900 flex items-center gap-1.5">
                          {u.username}
                          {u.isBuiltIn && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black rounded uppercase">
                              Compte Maître
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                          <Mail size={12} className="text-indigo-500 flex-shrink-0" />
                          <span>{u.email || `${u.username}@gebat.ci`}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          ID: {String(u.id).replace('user-', '')}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-extrabold text-gray-800 flex items-center gap-1.5">
                      <Award size={15} className="text-indigo-600 flex-shrink-0" />
                      {u.titre}
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${getRoleBadgeColor(u.role)} shadow-2xs`}>
                      <ShieldCheck size={13} /> {u.role}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${
                      u.statut === 'actif'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${u.statut === 'actif' ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'}`}></span>
                      {u.statut === 'actif' ? 'Actif' : 'Suspendu'}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditUser(u)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                        title="Modifier le compte ou les autorisations"
                      >
                        <UserCheck size={14} className="text-indigo-600" />
                        Modifier
                      </button>

                      {u.username !== 'admin' ? (
                        <>
                          <button
                            onClick={() => handleToggleUserStatus(u.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                              u.statut === 'actif'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                            title={u.statut === 'actif' ? 'Suspendre cet utilisateur' : 'Réactiver l\'accès'}
                          >
                            {u.statut === 'actif' ? 'Désactiver' : 'Activer'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Supprimer définitivement l'utilisateur"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[11px] font-black">
                          <ShieldCheck size={12} /> Compte Protégé
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4 Main Settings Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card 1: EPI Limits & Rules */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 border border-amber-100">
                  <Shield size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-black text-lg text-gray-900">Retenues & Plafonds EPI</h2>
                  <p className="text-xs font-semibold text-gray-400">Règles de déductions pour les équipements de sécurité</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 font-extrabold rounded-full text-xs">
                Actif
              </span>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-amber-600" /> Retenue hebdomadaire fixe par ouvrier (FCFA)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono font-black text-lg text-gray-900 focus:bg-white focus:border-amber-500 transition-all"
                    value={settings.epi_weekly_deduction}
                    onChange={(e) => setSettings({ ...settings, epi_weekly_deduction: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                  <div className="flex gap-1.5 flex-shrink-0">
                    {[2500, 3000, 5000].map((val) => (
                      <button
                        key={val}
                        onClick={() => setSettings({ ...settings, epi_weekly_deduction: val })}
                        className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition-all ${
                          settings.epi_weekly_deduction === val
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-gray-400 mt-1.5">
                  Montant prélevé chaque semaine sur le salaire brut tant que le plafond du chantier n'est pas atteint.
                </p>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <label className="block text-xs font-bold text-gray-700 mb-3 flex items-center justify-between">
                  <span>Plafonds de Caution par Chantier</span>
                  <span className="text-indigo-600 font-extrabold">{settings.epi_limits ? Object.keys(settings.epi_limits).length : 0} chantiers définis</span>
                </label>

                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {settings.epi_limits && Object.entries(settings.epi_limits).map(([site, limit]) => (
                    <div key={site} className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-indigo-50/40 rounded-2xl border border-gray-200/80 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                        <span className="font-black text-sm text-gray-900">{site}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-indigo-700 bg-white px-3 py-1 rounded-xl border border-indigo-100 shadow-sm">
                          {formatCurrency(limit)}
                        </span>
                        <button
                          onClick={() => removeSite(site)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer ce plafond"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!settings.epi_limits || Object.keys(settings.epi_limits).length === 0) && (
                    <p className="text-gray-400 text-xs italic text-center py-4 bg-gray-50 rounded-xl">Aucun chantier configuré.</p>
                  )}
                </div>

                {/* Add new site box */}
                <div className="mt-4 p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-3">
                  <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                    <Plus size={14} className="stroke-[3]" /> Ajouter ou modifier un chantier / plafond
                  </span>
                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <input
                      type="text"
                      className="flex-1 min-w-[140px] px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-gray-900 placeholder-gray-400 focus:border-indigo-500"
                      placeholder="Nom du chantier (ex: Bingerville)"
                      value={newSite}
                      onChange={(e) => setNewSite(e.target.value)}
                    />
                    <input
                      type="number"
                      className="w-32 px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-mono font-bold text-gray-900 placeholder-gray-400 focus:border-indigo-500"
                      placeholder="Plafond FCFA"
                      value={newSiteLimit}
                      onChange={(e) => setNewSiteLimit(e.target.value)}
                      min="0"
                    />
                    <button
                      onClick={addSite}
                      disabled={!newSite || !newSiteLimit}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1"
                    >
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Company Identity & Defaults */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 border border-purple-100">
                  <Building2 size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-black text-lg text-gray-900">Identité & Documents</h2>
                  <p className="text-xs font-semibold text-gray-400">Informations affichées sur les en-têtes PDF</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 font-extrabold rounded-full text-xs">
                GEBAT Corporate
              </span>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Nom officiel de l'entreprise (En-tête PDF)
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm text-gray-900 focus:bg-white focus:border-purple-500 transition-all"
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Devise Monétaire
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm text-gray-900 focus:bg-white focus:border-purple-500 transition-all"
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  >
                    <option value="XOF">FCFA (XOF)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="USD">Dollar (USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Chantier / Site par Défaut
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm text-gray-900 focus:bg-white focus:border-purple-500 transition-all"
                    value={settings.default_site}
                    onChange={(e) => setSettings({ ...settings, default_site: e.target.value })}
                    placeholder="Ex: Songon ou Bingerville"
                  />
                </div>
              </div>

              {/* PDF Preview Box */}
              <div className="mt-6 p-5 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl text-white shadow-md relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/15 pb-3 mb-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300">Aperçu En-tête Rapport PDF</span>
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white font-mono">Généré en instantané</span>
                </div>
                <div className="flex items-center gap-4">
                  <img src={gebatLogo} alt="GEBAT" className="w-12 h-12 rounded-lg bg-white p-0.5 object-cover" />
                  <div>
                    <div className="text-base font-black text-white">{settings.company_name}</div>
                    <div className="text-xs text-blue-200 mt-0.5">Synthèse et Calcul des Salaires — Chantier {settings.default_site || 'Tous'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Database & LowDB Administration */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 border border-blue-100">
                  <Database size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-black text-lg text-gray-900">Base de Données Locale</h2>
                  <p className="text-xs font-semibold text-gray-400">Stockage et persistance des informations (`database.json`)</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-extrabold rounded-full text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span> Connectée
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Ouvriers</span>
                <div className="text-2xl font-black text-gray-900 mt-1 font-mono">{dbStats.ouvriers}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Pointages</span>
                <div className="text-2xl font-black text-blue-600 mt-1 font-mono">{dbStats.pointages}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Paies</span>
                <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">{dbStats.paies}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100 text-xs text-blue-900 leading-relaxed flex items-start gap-3">
                <HardDrive size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-black mb-0.5">Sauvegarde Recommandée :</strong>
                  Votre base est stockée en toute sécurité sous <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono font-bold">server/database.json</code>. Copiez ce fichier sur une clé USB ou le cloud pour l'archiver.
                </div>
              </div>

              <div className="p-5 bg-red-50/80 rounded-2xl border-2 border-red-200 space-y-3">
                <div className="flex items-center gap-2 text-red-900 font-black text-xs">
                  <ShieldAlert size={18} className="text-red-600 flex-shrink-0" />
                  ZONE DE DANGER — RÉINITIALISATION COMPLÈTE
                </div>
                <p className="text-[11px] text-red-800 font-medium leading-relaxed">
                  Cette action vide et réinitialise définitivement tout le fichier <code className="font-bold">database.json</code> (supprime tous les ouvriers, fiches de présence, retenues et historiques de paie).
                </p>
                <button
                  onClick={handleResetDatabase}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl shadow-md text-xs transition-all flex items-center justify-center gap-2 transform active:scale-95"
                >
                  <Trash2 size={16} />
                  Réinitialiser la base de données à vide
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: System Diagnostics & Health */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100">
                  <Cpu size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-black text-lg text-gray-900">Diagnostics Système</h2>
                  <p className="text-xs font-semibold text-gray-400">État des services, moteurs et API EasyPaie</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-extrabold rounded-full text-xs">
                Opérationnel
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200/80">
                <span className="text-xs font-bold text-gray-700">Moteur de calcul de paie</span>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-black text-[11px] rounded-lg">
                  ✓ Version 1.0.0 Pro
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200/80">
                <span className="text-xs font-bold text-gray-700">Générateur d'états Excel (.xlsx)</span>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-black text-[11px] rounded-lg">
                  ✓ SheetJS Intégré
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200/80">
                <span className="text-xs font-bold text-gray-700">Générateur de rapports PDF</span>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-black text-[11px] rounded-lg">
                  ✓ jsPDF AutoTable
                </span>
              </div>

              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-center gap-3 text-xs text-emerald-900 font-bold">
                <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                <span>Tous les modules et services API de GEBAT EasyPaie répondent de manière optimale.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-gray-100 relative">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                  <UserPlus size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">Nouveau Collaborateur</h3>
                  <p className="text-xs text-gray-400 font-semibold">Créez des identifiants et un titre professionnel</p>
                </div>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-indigo-600" /> Identifiant de connexion (Username) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: j.kouassi ou c.songon"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-indigo-500 transition-all"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Mail size={14} className="text-indigo-600" /> Adresse E-mail Professionnelle (pour récupération)
                </label>
                <input
                  type="email"
                  placeholder="Ex: c.songon@gebat.ci"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-indigo-500 transition-all"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Award size={14} className="text-indigo-600" /> Titre / Poste dans l'entreprise *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Responsable Comptable Songon"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-indigo-500 transition-all"
                  value={newTitre}
                  onChange={(e) => setNewTitre(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-indigo-600" /> Niveau d'Habilitation & Rôle *
                </label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-indigo-500 transition-all"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="Administrateur">Administrateur (Accès Total & Paramètres)</option>
                  <option value="Gestionnaire Paie">Gestionnaire Paie (Tableau de bord, Gestion des Ouvriers, SALAIRES & ARCHIVES)</option>
                  <option value="Contrôleur Chantier">Contrôleur Chantier (Pointages, Ouvriers, Ponctions & Loyers)</option>
                  <option value="Auditeur">Auditeur (Consultation & Rapports PDF/Excel)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Key size={14} className="text-indigo-600" /> Mot de passe d'accès *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Saisissez un mot de passe sécurisé"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-indigo-500 transition-all pr-12"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-xl text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black rounded-xl shadow-md shadow-indigo-500/20 text-xs transition-all transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} strokeWidth={2.5} />
                  Valider la Création
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-gray-100 relative">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                  <Sliders size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">Modifier l'Utilisateur</h3>
                  <p className="text-xs text-gray-400 font-semibold">Mettez à jour les accès de « {editingUser?.username} »</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditUserModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-amber-600" /> Identifiant de connexion (Username) *
                </label>
                <input
                  type="text"
                  required
                  disabled={editingUser?.isBuiltIn}
                  placeholder="Ex: j.kouassi"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-amber-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                />
                {editingUser?.isBuiltIn && (
                  <p className="text-[10px] font-semibold text-amber-600 mt-1">L'identifiant du compte maître ne peut pas être modifié.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Mail size={14} className="text-amber-600" /> Adresse E-mail Professionnelle (pour récupération)
                </label>
                <input
                  type="email"
                  placeholder="Ex: admin@gebat.ci"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-amber-500 transition-all"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Award size={14} className="text-amber-600" /> Titre / Poste dans l'entreprise *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Directeur Général ou Contrôleur Principal"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-amber-500 transition-all"
                  value={editTitre}
                  onChange={(e) => setEditTitre(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-600" /> Niveau d'Habilitation & Rôle *
                </label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-amber-500 transition-all"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                >
                  <option value="Administrateur">Administrateur (Accès Total & Paramètres)</option>
                  <option value="Gestionnaire Paie">Gestionnaire Paie (Tableau de bord, Gestion des Ouvriers, SALAIRES & ARCHIVES)</option>
                  <option value="Contrôleur Chantier">Contrôleur Chantier (Pointages, Ouvriers, Ponctions & Loyers)</option>
                  <option value="Auditeur">Auditeur (Consultation & Rapports PDF/Excel)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Key size={14} className="text-amber-600" /> Mot de passe d'accès (laisser vide pour ne pas changer)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Saisissez un nouveau mot de passe"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-amber-500 transition-all pr-12"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-xl text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-blue-950 font-black rounded-xl shadow-md shadow-amber-500/20 text-xs transition-all transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save size={16} strokeWidth={2.5} />
                  Enregistrer les Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
