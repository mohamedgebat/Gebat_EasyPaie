import { apiFetch } from '../lib/api';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, User, AlertCircle, Shield, Building2, Eye, EyeOff, 
  CheckCircle2, ArrowRight, Sparkles, HardHat, FileSpreadsheet, Cpu,
  Mail, KeyRound, RefreshCw, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import gebatLogo from '../assets/logo_gebat.png';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Password Recovery States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryUser, setRecoveryUser] = useState(null);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [simulatedCode, setSimulatedCode] = useState('');
  const [newRecoveryPassword, setNewRecoveryPassword] = useState('');
  const [confirmRecoveryPassword, setConfirmRecoveryPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        setIsLoading(false);
      } else {
        setError('Identifiants incorrects. Veuillez vérifier votre identifiant et mot de passe.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Erreur de connexion au serveur.');
      setIsLoading(false);
    }
  };

  const handleSendRecoveryCode = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    const inputClean = recoveryInput.trim().toLowerCase();
    if (!inputClean) {
      setRecoveryError("Veuillez saisir votre identifiant ou votre adresse e-mail.");
      return;
    }

    try {
      const res = await apiFetch('/api/utilisateurs');
      if (res.ok) {
        const storedUsers = await res.json();
        let found = storedUsers.find(u => {
          const uName = (u.username || '').toLowerCase();
          const uEmail = (u.email || '').toLowerCase();
          return uName === inputClean || uEmail === inputClean;
        });

        if (!found && (inputClean === 'admin' || inputClean === 'admin@gebat.ci')) {
          found = {
            id: 'builtin-admin',
            username: 'admin',
            email: 'admin@gebat.ci',
            titre: 'Administrateur Général GEBAT',
            role: 'Administrateur',
            statut: 'actif',
            isBuiltIn: true
          };
        }

        if (!found) {
          setRecoveryError("Aucun compte actif ne correspond à cet identifiant ou adresse e-mail.");
          return;
        }

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        setSimulatedCode(`GEBAT-${code}`);
        setRecoveryCode(`GEBAT-${code}`);
        setRecoveryUser(found);
        setRecoveryStep(2);
      } else {
        setRecoveryError("Erreur lors de la communication avec le serveur.");
      }
    } catch (err) {
      setRecoveryError("Erreur de connexion au serveur.");
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setRecoveryError('');
    if (recoveryCode.trim().toUpperCase() !== simulatedCode.toUpperCase()) {
      setRecoveryError("Le code de vérification est incorrect.");
      return;
    }
    if (!newRecoveryPassword.trim() || newRecoveryPassword.length < 4) {
      setRecoveryError("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }
    if (newRecoveryPassword !== confirmRecoveryPassword) {
      setRecoveryError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    const isBuiltinAdmin = (recoveryUser.username || '').toLowerCase() === 'admin' && recoveryUser.id === 'builtin-admin';

    try {
      if (isBuiltinAdmin) {
        const resList = await apiFetch('/api/utilisateurs');
        if (resList.ok) {
          const dbUsers = await resList.json();
          const dbAdmin = dbUsers.find(u => u.username.toLowerCase() === 'admin');
          if (dbAdmin) {
            await apiFetch(`/api/utilisateurs/${dbAdmin.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: newRecoveryPassword.trim() })
            });
          } else {
            await apiFetch('/api/utilisateurs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: 'admin',
                email: 'admin@gebat.ci',
                password: newRecoveryPassword.trim(),
                titre: 'Administrateur Général GEBAT',
                role: 'Administrateur',
                statut: 'actif'
              })
            });
          }
        }
      } else {
        await apiFetch(`/api/utilisateurs/${recoveryUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newRecoveryPassword.trim() })
        });
      }
      setRecoveryStep(3);
    } catch (err) {
      setRecoveryError("Erreur lors de la mise à jour du mot de passe.");
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setRecoveryStep(1);
    setRecoveryInput('');
    setRecoveryCode('');
    setNewRecoveryPassword('');
    setConfirmRecoveryPassword('');
    setRecoveryError('');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#001833] font-sans relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-[140px] pointer-events-none"></div>

      {/* LEFT COLUMN: BRAND HERO & PLATFORM HIGHLIGHTS (Hidden on small screens, stunning on LG+) */}
      <div className="hidden lg:flex lg:w-7/12 p-12 xl:p-16 flex-col justify-between relative z-10 border-r border-white/10">
        {/* Top Brand & Logo */}
        <div className="flex items-center gap-4 animate-fade-in">
          <div className="bg-transparent transform hover:scale-105 transition-transform duration-300">
            <img 
              src={gebatLogo} 
              alt="GEBAT Logo" 
              className="h-24 w-auto object-contain drop-shadow-[0_2px_12px_rgba(255,255,255,0.7)]"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-extrabold uppercase tracking-wider rounded-full flex items-center gap-1.5 shadow-sm">
                <Sparkles size={13} className="text-blue-400 animate-pulse" />
                Version 1.0.0 Pro
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              GEBAT <span className="text-blue-400">EasyPaie</span>
            </h1>
          </div>
        </div>

        {/* Center Presentation & Value Proposition */}
        <div className="max-w-2xl my-auto py-12 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <h2 className="text-4xl xl:text-5xl font-black text-white leading-tight tracking-tight mb-6">
            L'Excellence & la Précision au Cœur de la <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-blue-400 to-sky-200">Gestion des Paies</span>
          </h2>
          <p className="text-blue-100/80 text-lg font-medium leading-relaxed mb-10">
            Plateforme cloud intégrée conçue pour les chantiers GEBAT. Automatisez le pointage des ouvriers, calculez les heures supplémentaires à la perfection, et générez des états financiers normés.
          </p>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-2xl p-5 backdrop-blur-md transition-all duration-300 flex items-start gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 flex-shrink-0 border border-blue-400/20">
                <HardHat size={22} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm mb-1">Pointages & Chantier</h3>
                <p className="text-xs text-blue-200/70 leading-relaxed">
                  Suivi quotidien des fiches de présence, loyers et ponctions (Songon, Grand-Bassam, etc.).
                </p>
              </div>
            </div>

            <div className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-2xl p-5 backdrop-blur-md transition-all duration-300 flex items-start gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400 flex-shrink-0 border border-indigo-400/20">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm mb-1">Calculs 7 500 & Exports</h3>
                <p className="text-xs text-blue-200/70 leading-relaxed">
                  Application automatique de la règle 8h / 7 500 FCFA par jour et export Excel instantané.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Status / Security Badge */}
        <div className="flex items-center justify-between pt-8 border-t border-white/10 text-xs text-blue-300/70 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-blue-200">Système opérationnel</span>
            <span className="text-white/30">•</span>
            <span>Chantier Pilote : Songon</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-blue-200/60">
            <Cpu size={14} className="text-blue-400" />
            <span>Moteur EasyPaie v1.0</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: LOGIN FORM SECTION */}
      <div className="w-full lg:w-5/12 flex items-center justify-center p-6 sm:p-10 lg:p-12 relative z-10">
        <div className="w-full max-w-md">
          
          {/* Mobile Header (Shown only on small screens) */}
          <div className="text-center mb-8 lg:hidden animate-fade-in">
            <div className="inline-block bg-transparent mb-4">
              <img 
                src={gebatLogo} 
                alt="GEBAT Logo" 
                className="h-20 w-auto mx-auto drop-shadow-[0_2px_12px_rgba(255,255,255,0.7)]"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              GEBAT EasyPaie
            </h1>
            <p className="text-blue-200 text-sm font-medium mt-1">Système de Gestion de Paie</p>
          </div>

          {/* Glassmorphic Login Card */}
          <div className="bg-white rounded-[32px] shadow-[0_25px_80px_rgba(0,0,0,0.5)] border border-white/80 p-8 sm:p-10 relative animate-fade-in">
            
            {/* Header inside form card */}
            <div className="mb-8 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-extrabold mb-3 border border-blue-100">
                <Shield size={14} className="text-blue-600" />
                <span>Accès Restreint & Sécurisé</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                Connectez-vous
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 font-semibold mt-1">
                Saisissez vos identifiants pour ouvrir votre session de travail.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-2xl flex items-start gap-3 text-red-700 animate-shake shadow-sm">
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5 text-red-600" />
                <div className="text-xs">
                  <p className="font-extrabold mb-0.5">Échec d'authentification</p>
                  <p className="font-medium text-red-600 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Username Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Identifiant de connexion
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#003366] transition-colors pointer-events-none">
                    <User size={19} />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50/80 border-2 border-gray-200/90 rounded-2xl text-sm font-bold text-gray-900 focus:bg-white focus:border-[#003366] focus:ring-4 focus:ring-[#003366]/10 transition-all outline-none placeholder:text-gray-400 placeholder:font-normal"
                    placeholder="Ex: admin ou c.songon"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(true);
                      setRecoveryStep(1);
                      setRecoveryError('');
                    }}
                    className="text-xs font-extrabold text-[#003366] hover:text-blue-600 transition-colors focus:outline-none"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#003366] transition-colors pointer-events-none">
                    <Lock size={19} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-11 pr-12 py-3.5 bg-gray-50/80 border-2 border-gray-200/90 rounded-2xl text-sm font-bold text-gray-900 focus:bg-white focus:border-[#003366] focus:ring-4 focus:ring-[#003366]/10 transition-all outline-none placeholder:text-gray-400 placeholder:font-normal"
                    placeholder="Saisissez votre mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
                    title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-gradient-to-r from-[#003366] via-blue-700 to-indigo-700 hover:from-[#002244] hover:to-indigo-800 text-white font-black py-4 px-6 rounded-2xl shadow-xl hover:shadow-blue-600/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-3 text-base group disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Ouverture de la session...</span>
                  </>
                ) : (
                  <>
                    <span>Accéder au Tableau de Bord</span>
                    <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Assistance Card */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                <Building2 size={20} />
              </div>
              <div className="text-xs">
                <p className="font-extrabold text-gray-800">Besoin d'un compte ou d'un rôle ?</p>
                <p className="text-gray-500 font-medium">Contactez l'Administrateur Général GEBAT pour obtenir vos identifiants d'habilitation.</p>
              </div>
            </div>

          </div>

          {/* Bottom Copyright */}
          <div className="mt-6 text-center lg:text-left text-xs text-blue-200/60 font-medium flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© 2026 GEBAT EasyPaie • Tous droits réservés</span>
            <span className="hidden sm:inline">Sécurité 256-bit Encrypted</span>
          </div>

        </div>
      </div>

      {/* RECOVERY MODAL (MOT DE PASSE OUBLIÉ) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-8 sm:p-10 shadow-2xl border border-gray-100 relative">
            <button
              onClick={closeForgotModal}
              className="absolute top-6 right-6 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 font-bold flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>

            {recoveryStep === 1 && (
              <div>
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="p-3.5 bg-blue-50 text-[#003366] rounded-2xl border border-blue-100 flex-shrink-0">
                    <Mail size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Réinitialisation d'Accès</h3>
                    <p className="text-xs text-gray-500 font-semibold">Identifiez votre compte GEBAT EasyPaie</p>
                  </div>
                </div>

                {recoveryError && (
                  <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-2xl text-xs text-red-700 font-bold flex items-center gap-2.5 animate-shake">
                    <AlertCircle size={18} className="flex-shrink-0 text-red-600" />
                    <span>{recoveryError}</span>
                  </div>
                )}

                <form onSubmit={handleSendRecoveryCode} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                      Saisissez votre Adresse E-mail ou Identifiant *
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#003366] transition-colors pointer-events-none">
                        <User size={19} />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Ex: c.songon@gebat.ci ou admin"
                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50/80 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:bg-white focus:border-[#003366] focus:ring-4 focus:ring-[#003366]/10 transition-all outline-none"
                        value={recoveryInput}
                        onChange={(e) => setRecoveryInput(e.target.value)}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 font-medium mt-2 leading-relaxed">
                      L'adresse e-mail ou le nom d'utilisateur saisi servira à vérifier votre habilitation et envoyer le code de sécurité.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#003366] to-blue-700 hover:from-[#002244] hover:to-blue-800 text-white font-black py-4 px-6 rounded-2xl shadow-xl hover:shadow-blue-600/30 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <span>Continuer vers la vérification</span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            )}

            {recoveryStep === 2 && (
              <div>
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 flex-shrink-0">
                    <KeyRound size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Nouveau Mot de Passe</h3>
                    <p className="text-xs text-gray-500 font-semibold">Compte : {recoveryUser?.username} ({recoveryUser?.email || recoveryUser?.username + '@gebat.ci'})</p>
                  </div>
                </div>

                {recoveryError && (
                  <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-2xl text-xs text-red-700 font-bold flex items-center gap-2.5 animate-shake">
                    <AlertCircle size={18} className="flex-shrink-0 text-red-600" />
                    <span>{recoveryError}</span>
                  </div>
                )}

                {/* Simulation Notice Box */}
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 leading-relaxed shadow-sm">
                  <div className="flex items-center gap-2 font-black text-emerald-800 mb-1">
                    <Sparkles size={16} className="text-emerald-600" />
                    <span>Vérification d'identité E-mail (Simulation GEBAT) :</span>
                  </div>
                  <p className="font-medium">
                    Un e-mail de sécurité a été émis vers <span className="font-bold underline">{recoveryUser?.email || recoveryUser?.username + '@gebat.ci'}</span>. 
                    Pour validation rapide sur ce poste, votre code temporaire est : <span className="font-black text-sm bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-300 ml-1">{simulatedCode}</span>
                  </p>
                </div>

                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      Code de confirmation reçu par E-mail *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-black text-[#003366] tracking-wider uppercase focus:bg-white focus:border-[#003366] transition-all outline-none"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      Nouveau mot de passe *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Minimum 4 caractères"
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-[#003366] transition-all outline-none"
                      value={newRecoveryPassword}
                      onChange={(e) => setNewRecoveryPassword(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      Confirmez le nouveau mot de passe *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Saisissez à nouveau le mot de passe"
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-[#003366] transition-all outline-none"
                      value={confirmRecoveryPassword}
                      onChange={(e) => setConfirmRecoveryPassword(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-4 px-6 rounded-2xl shadow-xl hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw size={16} />
                    <span>Réinitialiser et Activer mon nouveau mot de passe</span>
                  </button>
                </form>
              </div>
            )}

            {recoveryStep === 3 && (
              <div className="text-center py-4 animate-fade-in">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg">
                  <CheckCircle2 size={36} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
                  Mot de passe réinitialisé !
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 font-medium max-w-sm mx-auto leading-relaxed mb-8">
                  Félicitations, votre accès au compte <span className="font-bold text-gray-900">"{recoveryUser?.username}"</span> a été mis à jour avec votre nouveau mot de passe.
                </p>

                <button
                  onClick={() => {
                    setUsername(recoveryUser?.username || '');
                    setPassword(newRecoveryPassword.trim());
                    closeForgotModal();
                  }}
                  className="w-full bg-[#003366] hover:bg-[#002244] text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <span>Se connecter immédiatement</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          15%, 45%, 75% {
            transform: translateX(-6px);
          }
          30%, 60%, 90% {
            transform: translateX(6px);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-shake {
          animation: shake 0.45s ease-in-out;
        }
      `}</style>
    </div>
  );
}
