import api from '../api/api';

// ==========================================
// Account / Wallet API service
// Uses the existing api utility (api.js) so
// the JWT auth interceptors apply automatically.
// Backend endpoints (mounted at /api/account):
//   GET  /account            -> getAccount
//   GET  /account/summary    -> getAccountSummary
//   GET  /account/transactions -> getWalletTransactions
//   POST /account/deposit    -> depositMoney
//   POST /account/withdraw   -> withdrawMoney
// ==========================================

export const getAccount = async () => {
  const response = await api.get('/account');
  return response.data;
};

export const getAccountSummary = async () => {
  const response = await api.get('/account/summary');
  return response.data;
};

export const getWalletTransactions = async () => {
  const response = await api.get('/account/transactions');
  return response.data;
};

export const depositMoney = async (amount) => {
  const response = await api.post('/account/deposit', {
    amount
  });
  return response.data;
};

export const withdrawMoney = async (amount) => {
  const response = await api.post('/account/withdraw', {
    amount
  });
  return response.data;
};