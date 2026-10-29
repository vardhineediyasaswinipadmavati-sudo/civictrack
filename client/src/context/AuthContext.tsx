import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  unreadCount: number;
  login: (email: string, pass: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('civictrack_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUser = async () => {
    const savedToken = localStorage.getItem('civictrack_token');
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getCurrentUser();
      setUser(data.user);
      setUnreadCount(data.unreadNotificationsCount || 0);
    } catch (err) {
      console.warn('Session expired or invalid, clearing authentication token', err);
      localStorage.removeItem('civictrack_token');
      setUser(null);
      setToken(null);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, pass: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.login(email, pass);
      localStorage.setItem('civictrack_token', res.token);
      setToken(res.token);

      // Fetch complete user profile with department details and notifications
      const profile = await api.getCurrentUser();
      const authenticatedUser = profile.user || res.user;
      setUser(authenticatedUser);
      setUnreadCount(profile.unreadNotificationsCount || 0);
      return authenticatedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { name: string; email: string; password: string; phone?: string }): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      localStorage.setItem('civictrack_token', res.token);
      setToken(res.token);
      const profile = await api.getCurrentUser();
      const newUser = profile.user || res.user;
      setUser(newUser);
      setUnreadCount(profile.unreadNotificationsCount || 0);
      return newUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('civictrack_token');
    setUser(null);
    setToken(null);
    setUnreadCount(0);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        unreadCount,
        login,
        register,
        logout,
        refreshUser
      }}
    >
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
