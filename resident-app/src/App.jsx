import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import api from './services/api';
import './index.css';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import JoinSociety from './pages/JoinSociety';
import Home from './pages/Home';
import Chargers from './pages/Chargers';
import ChargerDetail from './pages/ChargerDetail';
import BookCharger from './pages/BookCharger';
import Bookings from './pages/Bookings';
import Sessions from './pages/Sessions';
import Billing from './pages/Billing';
import Payments from './pages/Payments';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import PublicChargers from './pages/PublicChargers';
import BottomNav from './components/BottomNav';

// ── Auth Context ────────────────────────────────────────
import { useAuth, AuthProvider } from './AuthContext';

// ── Protected Route ─────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /><span className="loading-text">Loading...</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireSociety({ children }) {
  const { user, society, loading } = useAuth();
  if (loading) return <div className="loading-spinner"><div className="spinner" /><span className="loading-text">Loading...</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!society) return <Navigate to="/join" replace />;
  return children;
}

// ── App Layout ──────────────────────────────────────────
function AppLayout() {
  const location = useLocation();
  const hideNav = ['/login', '/register', '/join', '/public'].includes(location.pathname);

  return (
    <div className="app-container">
      <Routes>
        <Route path="/public" element={<PublicChargers />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/join" element={<ProtectedRoute><JoinSociety /></ProtectedRoute>} />
        <Route path="/" element={<RequireSociety><Home /></RequireSociety>} />
        <Route path="/chargers" element={<RequireSociety><Chargers /></RequireSociety>} />
        <Route path="/chargers/:id" element={<RequireSociety><ChargerDetail /></RequireSociety>} />
        <Route path="/chargers/:id/book" element={<RequireSociety><BookCharger /></RequireSociety>} />
        <Route path="/bookings" element={<RequireSociety><Bookings /></RequireSociety>} />
        <Route path="/sessions" element={<RequireSociety><Sessions /></RequireSociety>} />
        <Route path="/billing" element={<RequireSociety><Billing /></RequireSociety>} />
        <Route path="/payments" element={<RequireSociety><Payments /></RequireSociety>} />
        <Route path="/notifications" element={<RequireSociety><Notifications /></RequireSociety>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  );
}

// ── Root App ────────────────────────────────────────────
export default function App() {
  const isSubPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
  return (
    <BrowserRouter basename={isSubPath ? '/app' : '/'}>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}

