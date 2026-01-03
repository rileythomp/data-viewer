/**
 * Detects circular dependencies in account formulas
 *
 * @param {number|null} currentAccountId - ID of account being edited (null for new)
 * @param {Array} proposedFormula - Array of {accountId, coefficient} or {account_id, coefficient}
 * @param {Array} allAccounts - All accounts with their formulas
 * @returns {Object} { hasCircle: boolean, errorMessage: string }
 */
export function detectCircularDependency(currentAccountId, proposedFormula, allAccounts) {
  // Build dependency graph from all accounts
  const graph = new Map();
  const accountNames = new Map();

  for (const account of allAccounts) {
    accountNames.set(account.id, account.account_name);
    if (account.is_calculated && account.formula) {
      const deps = account.formula.map((f) => f.account_id);
      graph.set(account.id, deps);
    } else {
      graph.set(account.id, []);
    }
  }

  // Check each account in the proposed formula
  for (const item of proposedFormula) {
    const depId = item.accountId ?? item.account_id;

    // Self-reference check
    if (depId === currentAccountId) {
      return {
        hasCircle: true,
        errorMessage: 'An account cannot reference itself in its formula',
      };
    }

    // For new accounts (currentAccountId is null), we can't have cycles yet
    if (currentAccountId === null) {
      continue;
    }

    // DFS to detect if depId can reach currentAccountId
    const visited = new Set();
    const path = [];

    if (canReach(depId, currentAccountId, graph, visited, path)) {
      // Build path for error message
      const names = [accountNames.get(currentAccountId), accountNames.get(depId)];
      for (const id of path) {
        names.push(accountNames.get(id));
      }
      names.push(accountNames.get(currentAccountId));
      return {
        hasCircle: true,
        errorMessage: `Circular dependency: ${names.join(' → ')}`,
      };
    }
  }

  return { hasCircle: false, errorMessage: '' };
}

function canReach(from, target, graph, visited, path) {
  if (from === target) {
    return true;
  }
  if (visited.has(from)) {
    return false;
  }
  visited.add(from);

  const deps = graph.get(from) || [];
  for (const dep of deps) {
    if (canReach(dep, target, graph, visited, path)) {
      path.push(dep);
      return true;
    }
  }

  return false;
}
