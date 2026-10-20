import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { socketService } from '../services/socket.js';
import { UserDTO } from '@computegrid/shared';

interface AuthContextType {
  user: UserDTO | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const userData = await api.get<UserDTO>('/auth/me');
      setUser(userData);
      socketService.connect(currentToken);
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: UserDTO; token: string }>('/auth/login', {
      email,
      password,
    });
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user);
    socketService.connect(res.token);
  };

  const register = async (email: string, username: string, password: string) => {
    const res = await api.post<{ user: UserDTO; token: string }>('/auth/register', {
      email,
      username,
      password,
    });
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user);
    socketService.connect(res.token);
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    socketService.disconnect();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
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
