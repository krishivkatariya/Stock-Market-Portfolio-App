import api from '../api/api';

export const getIpos = async (params = {}) => {
  const response = await api.get('/ipos', { params });
  return response.data;
};

export const getIpo = async (id) => {
  const response = await api.get(`/ipos/${encodeURIComponent(id)}`);
  return response.data;
};
