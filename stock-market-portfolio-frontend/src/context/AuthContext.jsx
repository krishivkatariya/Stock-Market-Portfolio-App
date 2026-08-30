import { useEffect, useState } from 'react';
import api from '../api/api';
import { AuthContext } from './authContext';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');

    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      return;
    }

    const verifyUser = async () => {
      try {
        const response = await api.get('/users/profile');

        if (response.data?.user) {
          setUser(response.data.user);
          localStorage.setItem(
            'user',
            JSON.stringify(response.data.user)
          );
        }
      } catch (error) {
        console.error('Authentication verification failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', {
      email,
      password
    });

    const { token, user: loggedInUser } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem(
      'user',
      JSON.stringify(loggedInUser)
    );

    setUser(loggedInUser);

    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await api.post('/auth/register', {
      name,
      email,
      password
    });

    const { token, user: registeredUser } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem(
      'user',
      JSON.stringify(registeredUser)
    );

    setUser(registeredUser);

    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
