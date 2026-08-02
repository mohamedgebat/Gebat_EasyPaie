import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Ouvriers from './pages/Ouvriers';
import WorkerDetails from './pages/WorkerDetails';
import ImportPointage from './pages/ImportPointage';
import Ponctions from './pages/Ponctions';
import Loyers from './pages/Loyers';
import CalculPaie from './pages/CalculPaie';
import Historique from './pages/Historique';
import Rapports from './pages/Rapports';
import Parametres from './pages/Parametres';
import Conversion from './pages/Conversion';
import ForcePasswordChange from './components/ForcePasswordChange';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, currentUser, logout } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (currentUser?.must_change_password) {
    return <ForcePasswordChange onComplete={() => window.location.reload()} onLogout={logout} />;
  }
  
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/ouvriers" element={<Ouvriers />} />
                    <Route path="/ouvriers/:id" element={<WorkerDetails />} />
                    <Route path="/import-pointage" element={<ImportPointage />} />
                    <Route path="/conversion" element={<Conversion />} />
                    <Route path="/ponctions" element={<Ponctions />} />
                    <Route path="/loyers" element={<Loyers />} />
                    <Route path="/calcul-paie" element={<CalculPaie />} />
                    <Route path="/historique" element={<Historique />} />
                    <Route path="/rapports" element={<Rapports />} />
                    <Route path="/parametres" element={<Parametres />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
