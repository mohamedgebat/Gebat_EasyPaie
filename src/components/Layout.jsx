import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, Users, FileText, Shield, Building2, Calculator, 
  History, BarChart3, Settings, Menu, LogOut, Layers,
  ChevronLeft, ChevronRight, Sparkles, ShieldCheck, UserCheck, Upload
} from 'lucide-react';
import gebatLogo from '../assets/logo_gebat.png';

const allNavGroups = [
  {
    category: 'PILOTAGE & FLUX',
    items: [
      { path: '/', label: 'Tableau de bord', icon: Home, roles: ['Administrateur', 'Gestionnaire Paie', 'Contrôleur Chantier', 'Auditeur'] },
      { path: '/ouvriers', label: 'Gestion des Ouvriers', icon: Users, roles: ['Administrateur', 'Gestionnaire Paie', 'Contrôleur Chantier'] },
      { path: '/import-pointage', label: 'Conversion de Pointage & Suivi', icon: Upload, roles: ['Administrateur', 'Gestionnaire Paie', 'Contrôleur Chantier'] },
      { path: '/conversion', label: 'Pointage & Édition', icon: Layers, roles: ['Administrateur', 'Contrôleur Chantier'] },
    ]
  },
  {
    category: 'MAIN-D\'ŒUVRE & RETENUES',
    items: [
      { path: '/ponctions', label: 'Ponctions EPI', icon: Shield, roles: ['Administrateur', 'Contrôleur Chantier'] },
      { path: '/loyers', label: 'Loyers Hébergement', icon: Building2, roles: ['Administrateur', 'Contrôleur Chantier'] },
    ]
  },
  {
    category: 'SALAIRES & ARCHIVES',
    items: [
      { path: '/calcul-paie', label: 'Calcul de la Paie', icon: Calculator, roles: ['Administrateur', 'Gestionnaire Paie', 'Contrôleur Chantier'] },
      { path: '/historique', label: 'Historique Bulletins', icon: History, roles: ['Administrateur', 'Gestionnaire Paie', 'Auditeur'] },
      { path: '/rapports', label: 'Rapports & Audits', icon: BarChart3, roles: ['Administrateur', 'Gestionnaire Paie', 'Auditeur'] },
    ]
  },
  {
    category: 'CONFIGURATION',
    items: [
      { path: '/parametres', label: 'Paramètres Système', icon: Settings, roles: ['Administrateur'] },
    ]
  }
];

export default function Layout({ children }) {
  const location = useLocation();
  const { logout, currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  // Filter navigation items by currentUser role
  const userRole = currentUser?.role || 'Administrateur';
  const navGroups = allNavGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.roles || item.roles.includes(userRole) || userRole === 'Administrateur')
    }))
    .filter(group => group.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-100/80 flex overflow-hidden font-sans">
      {/* Sidebar spacer */}
      <div className={`transition-all duration-300 ease-in-out flex-shrink-0 ${isOpen ? 'w-72' : 'w-20'}`} />

      {/* Sidebar */}
      <aside
        className={`fixed h-full z-40 flex flex-col transition-all duration-300 ease-in-out bg-gradient-to-b from-[#0D47A1] via-[#1565C0] to-[#0A3275] border-r border-blue-400/20 shadow-2xl ${isOpen ? 'w-72' : 'w-20'}`}
      >
        {/* Floating Toggle Collapse Button on Border Edge */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -right-3.5 top-8 bg-amber-400 hover:bg-amber-300 text-blue-950 p-1.5 rounded-full shadow-xl border-2 border-[#0D47A1] z-50 transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center"
          title={isOpen ? 'Réduire le menu latéral' : 'Agrandir le menu latéral'}
        >
          {isOpen ? <ChevronLeft size={16} strokeWidth={3} /> : <ChevronRight size={16} strokeWidth={3} />}
        </button>

        {/* Header / Logo Brand Area */}
        <div className={`flex flex-col items-center justify-center pt-6 pb-5 flex-shrink-0 border-b border-white/10 transition-all ${isOpen ? 'px-5' : 'px-2'}`}>
          <div className="flex items-center gap-3.5 w-full justify-center">
            <div className="p-1.5 bg-transparent flex-shrink-0 transition-transform hover:scale-105">
              <img
                src={gebatLogo}
                alt="Logo GEBAT"
                className="object-contain transition-all duration-300 drop-shadow-[0_2px_10px_rgba(255,255,255,0.5)]"
                style={{ width: isOpen ? '56px' : '44px', height: isOpen ? '56px' : '44px' }}
              />
            </div>

            <div className={`transition-all duration-300 overflow-hidden flex flex-col ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 h-0 hidden'}`}>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-white tracking-tight text-lg drop-shadow-sm">
                  GEBAT
                </span>
                <span className="bg-amber-400 text-blue-950 font-black text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm">
                  Pro
                </span>
              </div>
              <span className="text-[11px] font-bold text-blue-200 tracking-wider uppercase">
                EasyPaie Chantier
              </span>
            </div>
          </div>

          {/* Live system pill */}
          <div className={`mt-3 w-full transition-all duration-300 overflow-hidden ${isOpen ? 'opacity-100 max-h-10' : 'opacity-0 max-h-0 hidden'}`}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15 text-[11px]">
              <span className="text-blue-100 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Serveur Connecté
              </span>
              <span className="text-amber-300 font-mono font-bold">v1.0</span>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className={`flex-1 overflow-y-auto py-4 space-y-5 custom-scrollbar ${isOpen ? 'px-4' : 'px-2.5'}`}>
          {navGroups.map((group, groupIdx) => (
            <div key={group.category} className="space-y-1.5">
              {/* Category Header */}
              <div className={`text-[10px] font-black tracking-widest uppercase text-blue-200/80 px-2 transition-all duration-300 ${isOpen ? 'opacity-100 block pb-1' : 'opacity-0 hidden'}`}>
                {group.category}
              </div>

              {/* Group Items */}
              <ul className="space-y-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className={`group flex items-center rounded-2xl transition-all duration-200 font-bold text-xs ${
                          isOpen ? 'gap-3 px-3.5 py-3' : 'justify-center py-3.5 px-0'
                        } ${
                          isActive
                            ? 'bg-gradient-to-r from-amber-400 via-amber-400 to-amber-500 text-[#0A2960] shadow-lg shadow-amber-500/30 scale-[1.02]'
                            : 'text-blue-100 hover:bg-white/15 hover:text-white hover:translate-x-1'
                        }`}
                        title={!isOpen ? item.label : undefined}
                      >
                        <span
                          className={`flex items-center justify-center rounded-xl transition-all ${
                            isOpen ? 'w-8 h-8' : 'w-9 h-9'
                          } ${
                            isActive
                              ? 'bg-[#0A2960] text-amber-400 shadow-inner'
                              : 'bg-white/10 text-blue-100 group-hover:bg-white/20 group-hover:text-white group-hover:scale-110'
                          }`}
                        >
                          <Icon size={isOpen ? 18 : 20} strokeWidth={isActive ? 2.5 : 2} />
                        </span>

                        <span className={`whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 w-auto inline-block' : 'opacity-0 w-0 hidden'}`}>
                          {item.label}
                        </span>

                        {/* Active Dot / Chevron */}
                        {isActive && isOpen && (
                          <span className="ml-auto w-2 h-2 rounded-full bg-[#0A2960] shadow-sm animate-pulse" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Group divider when closed */}
              {!isOpen && groupIdx < navGroups.length - 1 && (
                <div className="w-8 mx-auto h-[1px] bg-white/10 my-2" />
              )}
            </div>
          ))}
        </nav>

        {/* Footer Area with User Profile Card & Logout */}
        <div className={`p-3 border-t border-white/10 transition-all duration-300 ${isOpen ? 'px-4' : 'px-2'}`}>
          {/* User info box when open */}
          <div className={`mb-3 p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex items-center gap-3 transition-all duration-300 ${isOpen ? 'opacity-100 block' : 'opacity-0 hidden h-0 p-0 mb-0'}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-blue-950 font-black shadow-md flex-shrink-0">
              <UserCheck size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-white truncate capitalize">
                {currentUser?.username || 'admin'}
              </div>
              <div className="text-[10px] text-amber-300 font-bold truncate flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-400 flex-shrink-0" /> {currentUser?.titre || 'Administrateur'}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className={`flex items-center gap-3 w-full px-3.5 py-3 rounded-2xl transition-all duration-200 font-extrabold text-xs text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-200 border border-rose-500/20 hover:border-rose-500/40 shadow-sm ${
              isOpen ? 'justify-start' : 'justify-center py-3.5 px-0'
            }`}
            title="Déconnexion sécurisée"
          >
            <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 flex-shrink-0">
              <LogOut size={16} strokeWidth={2.5} />
            </span>
            <span className={`whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 inline' : 'opacity-0 hidden w-0'}`}>
              Déconnexion
            </span>
          </button>

          <div className={`text-center text-[10px] font-bold mt-2.5 text-slate-500 transition-all duration-300 ${isOpen ? 'opacity-100 block' : 'opacity-0 hidden h-0'}`}>
            © 2026 GEBAT
          </div>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top bar header with breadcrumb/toggle */}
        <header className="flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-200/80 px-6 py-3 flex items-center justify-between z-30 shadow-xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 bg-gray-100 hover:bg-indigo-50 rounded-xl text-gray-700 hover:text-indigo-600 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-2xs"
              aria-label="Toggle Menu"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-gray-500">
              <span>GEBAT EasyPaie</span>
              <span>/</span>
              <span className="text-indigo-600 font-black">
                {navGroups.flatMap(g => g.items).find(i => i.path === location.pathname)?.label || 'Application'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold rounded-xl shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Chantiers Songon & Bingerville
            </span>
          </div>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/60 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
