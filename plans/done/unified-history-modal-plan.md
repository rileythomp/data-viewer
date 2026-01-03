## Plan: Unified Balance History Modal Component

Create a reusable `BalanceHistoryModal` component to replace the separate account (`HistoryTable.jsx`) and group (`GroupHistoryModal.jsx`) history modals, ensuring consistent table/chart toggle functionality across both.

### Steps

1. **Create new unified component** `frontend/src/components/BalanceHistoryModal.jsx` with props for `entityType` ('account' | 'group'), `entityId`, `entityName`, and `onClose`. Include the `viewMode` state and toggle UI from `GroupHistoryModal`.

2. **Add data fetching logic** in the new component that conditionally calls `accountsApi.getHistory()` or `groupsApi.getHistory()` based on `entityType`, using the existing API functions from `frontend/src/services/api.js`.

3. **Update `frontend/src/components/AccountCard.jsx`** to import and render `BalanceHistoryModal` instead of `HistoryTable`, passing `entityType="account"`.

4. **Update `frontend/src/components/AccountList.jsx`** to import and render `BalanceHistoryModal` instead of `HistoryTable`, passing `entityType="account"`.

5. **Update `frontend/src/components/GroupCard.jsx`** to import and render `BalanceHistoryModal` instead of `GroupHistoryModal`, passing `entityType="group"`.

6. **Delete deprecated components** `frontend/src/components/HistoryTable.jsx` and `frontend/src/components/GroupHistoryModal.jsx` after migration is complete.

### Further Considerations

1. **Prop for `showAccountName`**: Account history includes `account_name_snapshot` field—should the table show this column? Recommend: pass `showAccountName={false}` for modal contexts (consistent with current group behavior).

2. **Default view mode**: Should the modal default to 'table' or 'chart' view? Current `GroupHistoryModal` defaults to 'table'—recommend keeping that default.
