import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, AuthResponse } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('stream_compass_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('stream_compass_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await api.getMe();
        setUser(currentUser);
      } catch (err: any) {
        console.error('Session verification status:', err);
        // Only wipe credentials if the server explicitly confirmed unauthorized (401)
        if (err?.status === 401) {
          localStorage.removeItem('stream_compass_token');
          setToken(null);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res: AuthResponse = await api.login({ email: email.trim(), password: password.trim() });
    localStorage.setItem('stream_compass_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
  };

  const signup = async (email: string, username: string, password: string) => {
    const res: AuthResponse = await api.signup({
      email: email.trim().toLowerCase(),
      username: username.trim(),
      password: password.trim(),
    });
    localStorage.setItem('stream_compass_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('stream_compass_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
