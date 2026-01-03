const API_BASE = '/api';

export const accountsApi = {
  getAll: async () => {
    const res = await fetch(`${API_BASE}/accounts`);
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/accounts/${id}`);
    if (!res.ok) throw new Error('Failed to fetch account');
    return res.json();
  },

  create: async (accountName, accountInfo, currentBalance, calculatedData = null) => {
    const payload = {
      account_name: accountName,
      account_info: accountInfo,
      current_balance: currentBalance
    };
    if (calculatedData) {
      payload.is_calculated = calculatedData.is_calculated;
      payload.formula = calculatedData.formula;
    }
    const res = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create account');
    return res.json();
  },

  updateName: async (id, accountName) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_name: accountName }),
    });
    if (!res.ok) throw new Error('Failed to update name');
    return res.json();
  },

  updateInfo: async (id, accountInfo) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/info`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_info: accountInfo }),
    });
    if (!res.ok) throw new Error('Failed to update info');
    return res.json();
  },

  updateBalance: async (id, balance) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/balance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance }),
    });
    if (!res.ok) throw new Error('Failed to update balance');
    return res.json();
  },

  archive: async (id) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/archive`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error('Failed to archive account');
    return res.json();
  },

  getHistory: async (id) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/history`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  updatePositions: async (positions) => {
    const res = await fetch(`${API_BASE}/accounts/positions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    });
    if (!res.ok) throw new Error('Failed to update positions');
    return res.json();
  },
};
