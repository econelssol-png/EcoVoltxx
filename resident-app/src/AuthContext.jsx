import { useState, useEffect, createContext, useContext } from 'react';
import api from './services/api';

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // Return safe fallback while context mounts
    return {
      user: null,
      society: null,
      memberships: [],
      loading: true,
      login: async () => {},
      register: async () => {},
      logout: () => {},
      selectSociety: () => {},
      setMemberships: () => {},
    };
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sc_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [society, setSociety] = useState(() => {
    try {
      const saved = localStorage.getItem('sc_society');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sc_token');
    if (token) {
      api.getMe()
        .then(data => {
          setUser(data.user);
          setMemberships(data.memberships || []);
          localStorage.setItem('sc_user', JSON.stringify(data.user));
          if (data.memberships?.length && !society) {
            const s = data.memberships[0];
            const sData = { id: s.society_id, name: s.society_name, code: s.society_code, member_role: s.member_role, flat_number: s.flat_number };
            setSociety(sData);
            localStorage.setItem('sc_society', JSON.stringify(sData));
          }
        })
        .catch(() => {
          api.clearTokens();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    api.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    setMemberships(data.memberships || []);
    localStorage.setItem('sc_user', JSON.stringify(data.user));
    if (data.memberships?.length) {
      const s = data.memberships[0];
      const sData = { id: s.society_id, name: s.society_name, code: s.society_code, member_role: s.member_role, flat_number: s.flat_number };
      setSociety(sData);
      localStorage.setItem('sc_society', JSON.stringify(sData));
    }
    return data;
  };

  const register = async (name, email, phone, password) => {
    const data = await api.register(name, email, phone, password);
    api.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    localStorage.setItem('sc_user', JSON.stringify(data.user));
    return data;
  };

  const logout = () => {
    api.clearTokens();
    setUser(null);
    setSociety(null);
    setMemberships([]);
  };

  const selectSociety = (s) => {
    setSociety(s);
    localStorage.setItem('sc_society', JSON.stringify(s));
  };

  return (
    <AuthContext.Provider value={{ user, society, memberships, loading, login, register, logout, selectSociety, setMemberships }}>
      {children}
    </AuthContext.Provider>
  );
}
