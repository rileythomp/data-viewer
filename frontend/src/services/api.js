const API_BASE = '/api';

export const listApi = {
  getGroupedList: async () => {
    const res = await fetch(`${API_BASE}/list`);
    if (!res.ok) throw new Error('Failed to fetch list');
    return res.json();
  },
};

export const groupsApi = {
  getAll: async () => {
    const res = await fetch(`${API_BASE}/groups`);
    if (!res.ok) throw new Error('Failed to fetch groups');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/groups/${id}`);
    if (!res.ok) throw new Error('Failed to fetch group');
    return res.json();
  },

  create: async (groupName, groupDescription, color, isCalculated = false, formula = null) => {
    const payload = {
      group_name: groupName,
      group_description: groupDescription,
      color,
      is_calculated: isCalculated,
    };
    if (isCalculated && formula) {
      payload.formula = formula;
    }
    const res = await fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create group');
    return res.json();
  },

  update: async (id, groupName, groupDescription, color, isCalculated = false, formula = null) => {
    const payload = {
      group_name: groupName,
      group_description: groupDescription,
      color,
      is_calculated: isCalculated,
    };
    if (isCalculated && formula) {
      payload.formula = formula;
    }
    const res = await fetch(`${API_BASE}/groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update group');
    return res.json();
  },

  archive: async (id) => {
    const res = await fetch(`${API_BASE}/groups/${id}/archive`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error('Failed to archive group');
    return res.json();
  },

  updatePositions: async (positions) => {
    const res = await fetch(`${API_BASE}/groups/positions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    });
    if (!res.ok) throw new Error('Failed to update positions');
    return res.json();
  },

  updateAccountPositionsInGroup: async (groupId, positions) => {
    const res = await fetch(`${API_BASE}/groups/${groupId}/account-positions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    });
    if (!res.ok) throw new Error('Failed to update account positions');
    return res.json();
  },
};

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

  setGroup: async (id, groupId, positionInGroup = null) => {
    const payload = { group_id: groupId };
    if (positionInGroup !== null) {
      payload.position_in_group = positionInGroup;
    }
    const res = await fetch(`${API_BASE}/accounts/${id}/group`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to set account group');
    return res.json();
  },
};
