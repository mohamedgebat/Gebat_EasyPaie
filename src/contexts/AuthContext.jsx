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
    const inputUser = String(username).trim();
    const inputPass = String(password).trim();

    try {
      const res = await apiFetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: inputUser, password: inputPass })
      });

      if (res.ok) {
        const data = await res.json();
        
        setIsAuthenticated(true);
        setCurrentUser(data.user);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('easypaie_current_user', JSON.stringify(data.user));
        localStorage.setItem('easypaie_jwt_token', data.token);
        window.dispatchEvent(new Event('storage'));
        return true;
      }
    } catch (e) {
      console.error('Error authenticating user from API', e);
    }
    
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('easypaie_current_user');
    localStorage.removeItem('easypaie_jwt_token');
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
