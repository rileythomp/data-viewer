# Plan: Add Account and Group Creation to Settings Page

Add "Create" functionality to the existing Settings page by reusing the existing `AccountForm` and `GroupForm` components, allowing users to create new accounts and groups directly from the Settings page's Accounts and Groups tabs.

## Steps

1. **Add state variables in `SettingsPage.jsx`** for `showAccountForm`, `showGroupForm`, plus lists for non-archived `groups` and `accounts` needed by the form dropdowns.

2. **Fetch non-archived accounts and groups** on component mount using `accountsApi.getAll()` and `groupsApi.getAll()` to populate form dropdowns (group selection for accounts, account multi-select for groups).

3. **Add "Create Account" button** in the Accounts tab header that toggles `showAccountForm`, and conditionally render the existing `AccountForm` component when active.

4. **Add "Create Group" button** in the Groups tab header that toggles `showGroupForm`, and conditionally render the existing `GroupForm` component when active.

5. **Implement `handleCreateAccount` handler** that calls `accountsApi.create()`, optionally adds group membership via `accountsApi.modifyGroupMembership()`, refreshes all lists, and hides the form.

6. **Implement `handleCreateGroup` handler** that calls `groupsApi.create()`, adds selected accounts via membership API, refreshes all lists, and hides the form.

## Further Considerations

1. **Form placement:** Should the form appear inline (replacing the list temporarily) or as a modal overlay? Inline matches the pattern in `AccountList.jsx`.

2. **Formula support:** Do you want to support creating calculated accounts/groups from Settings, or keep it simpler with just basic accounts/groups? Both forms already support this but it adds complexity.

3. **Post-creation navigation:** After creating an account/group, should users stay on Settings or navigate to the new item's detail page?
