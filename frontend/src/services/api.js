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

  getAllIncludingArchived: async () => {
    const res = await fetch(`${API_BASE}/groups/all`);
    if (!res.ok) throw new Error('Failed to fetch groups');
    return res.json();
  },

  unarchive: async (id) => {
    const res = await fetch(`${API_BASE}/groups/${id}/unarchive`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error('Failed to unarchive group');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/groups/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete group');
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

  getHistory: async (id) => {
    const res = await fetch(`${API_BASE}/groups/${id}/history`);
    if (!res.ok) throw new Error('Failed to fetch group history');
    return res.json();
  },
};

export const accountsApi = {
  getAll: async () => {
    const res = await fetch(`${API_BASE}/accounts`);
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
  },

  getAllIncludingArchived: async () => {
    const res = await fetch(`${API_BASE}/accounts/all`);
    if (!res.ok) throw new Error('Failed to fetch accounts');
    return res.json();
  },

  unarchive: async (id) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/unarchive`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error('Failed to unarchive account');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/accounts/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete account');
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

  // Modify group membership (add/remove/move)
  modifyGroupMembership: async (id, action, groupId, sourceGroupId = null, positionInGroup = null) => {
    const payload = {
      action,  // "add", "remove", or "move"
      group_id: groupId
    };
    if (sourceGroupId !== null) {
      payload.source_group_id = sourceGroupId;
    }
    if (positionInGroup !== null) {
      payload.position_in_group = positionInGroup;
    }
    const res = await fetch(`${API_BASE}/accounts/${id}/membership`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to modify group membership');
    return res.json();
  },

  // Set all group memberships at once (for multi-select UI)
  setGroupMemberships: async (id, groupIds) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/groups`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_ids: groupIds }),
    });
    if (!res.ok) throw new Error('Failed to set group memberships');
    return res.json();
  },

  updateFormula: async (id, isCalculated, formula) => {
    const res = await fetch(`${API_BASE}/accounts/${id}/formula`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_calculated: isCalculated, formula }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to update formula');
    }
    return res.json();
  },
};

export const settingsApi = {
  getTotalFormula: async () => {
    const res = await fetch(`${API_BASE}/settings/total-formula`);
    if (!res.ok) throw new Error('Failed to fetch total formula');
    return res.json();
  },

  updateTotalFormula: async (isEnabled, formula) => {
    const res = await fetch(`${API_BASE}/settings/total-formula`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: isEnabled, formula }),
    });
    if (!res.ok) throw new Error('Failed to update total formula');
    return res.json();
  },
};

export const dashboardsApi = {
  getAll: async (page = 1, pageSize = 20) => {
    const res = await fetch(`${API_BASE}/dashboards?page=${page}&page_size=${pageSize}`);
    if (!res.ok) throw new Error('Failed to fetch dashboards');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/dashboards/${id}`);
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
  },

  create: async (name, description, accountIds = [], groupIds = []) => {
    const res = await fetch(`${API_BASE}/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        account_ids: accountIds,
        group_ids: groupIds,
      }),
    });
    if (!res.ok) throw new Error('Failed to create dashboard');
    return res.json();
  },

  update: async (id, name, description, accountIds = [], groupIds = []) => {
    const res = await fetch(`${API_BASE}/dashboards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        account_ids: accountIds,
        group_ids: groupIds,
      }),
    });
    if (!res.ok) throw new Error('Failed to update dashboard');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/dashboards/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete dashboard');
    return res.json();
  },
};

export const chartsApi = {
  getAll: async (page = 1, pageSize = 20) => {
    const res = await fetch(`${API_BASE}/charts?page=${page}&page_size=${pageSize}`);
    if (!res.ok) throw new Error('Failed to fetch charts');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/charts/${id}`);
    if (!res.ok) throw new Error('Failed to fetch chart');
    return res.json();
  },

  create: async (name, description, accountIds = [], groupIds = []) => {
    const res = await fetch(`${API_BASE}/charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        account_ids: accountIds,
        group_ids: groupIds,
      }),
    });
    if (!res.ok) throw new Error('Failed to create chart');
    return res.json();
  },

  update: async (id, name, description, accountIds = [], groupIds = []) => {
    const res = await fetch(`${API_BASE}/charts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        account_ids: accountIds,
        group_ids: groupIds,
      }),
    });
    if (!res.ok) throw new Error('Failed to update chart');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/charts/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete chart');
    return res.json();
  },
};

export const uploadsApi = {
  getAll: async (page = 1, pageSize = 20) => {
    const res = await fetch(`${API_BASE}/uploads?page=${page}&page_size=${pageSize}`);
    if (!res.ok) throw new Error('Failed to fetch uploads');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/uploads/${id}`);
    if (!res.ok) throw new Error('Failed to fetch upload');
    return res.json();
  },

  getData: async (id, page = 1, pageSize = 50) => {
    const res = await fetch(`${API_BASE}/uploads/${id}/data?page=${page}&page_size=${pageSize}`);
    if (!res.ok) throw new Error('Failed to fetch upload data');
    return res.json();
  },

  create: async (formData) => {
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to create upload');
    }
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/uploads/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete upload');
    return res.json();
  },
};
