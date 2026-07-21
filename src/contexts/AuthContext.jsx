import { apiFetch } from '../lib/api';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState({
    username: 'admin',
    titre: 'Administrateur Général',
    role: 'Administrateur',
    statut: 'actif'
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const auth = localStorage.getItem('isAuthenticated');
      const storedUser = localStorage.getItem('easypaie_current_user');
      if (auth === 'true') {
        setIsAuthenticated(true);
        if (storedUser) {
          try {
            setCurrentUser(JSON.parse(storedUser));
          } catch (e) {
            console.error('Error parsing stored user', e);
          }
        }
      } else {
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  const login = async (username, password) => {
    if (!username || !password) return false;
    const inputUser = String(username).trim().toLowerCase();
    const inputPass = String(password).trim();

    try {
      const res = await apiFetch('/api/utilisateurs');
      if (res.ok) {
        const dbUsers = await res.json();
        const matched = dbUsers.find(u => {
          const uName = String(u.username || '').trim().toLowerCase();
          const uPass = String(u.password || '').trim();
          const isActif = u.statut === 'actif' || !u.statut;
          return uName === inputUser && uPass === inputPass && isActif;
        });

        if (matched) {
          setIsAuthenticated(true);
          setCurrentUser(matched);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('easypaie_current_user', JSON.stringify(matched));
          window.dispatchEvent(new Event('storage'));
          return true;
        }
      }
    } catch (e) {
      console.error('Error authenticating user from API, falling back to local check', e);
    }

    // Default built-in admin fallback in case API is offline (or database not seeded yet)
    if (inputUser === 'admin' && inputPass === 'admin123') {
      const defaultUser = {
        id: 'builtin-admin',
        username: 'admin',
        email: 'admin@gebat.ci',
        password: 'admin123',
        titre: 'Administrateur Général GEBAT',
        role: 'Administrateur',
        statut: 'actif',
        isBuiltIn: true
      };
      setIsAuthenticated(true);
      setCurrentUser(defaultUser);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('easypaie_current_user', JSON.stringify(defaultUser));
      window.dispatchEvent(new Event('storage'));
      return true;
    }

    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('easypaie_current_user');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
