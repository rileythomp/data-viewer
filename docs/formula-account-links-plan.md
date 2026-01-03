# Plan: Make Account Names in Formulas Clickable Links

## Overview
Make account names in the `FormulaDisplay` component clickable links that navigate to the account detail page (`/accounts/{id}`).

## Current State
- The `FormulaDisplay` component (`frontend/src/components/FormulaDisplay.jsx`) renders formula items with account names as plain text (line 130)
- Account names are rendered inside a `<span className="formula-account">` element
- The component has access to `accountId` for each formula item via `normalizeItem()`
- The app uses React Router's `useNavigate()` hook for programmatic navigation

## Files to Modify

### 1. `frontend/src/components/FormulaDisplay.jsx`
**Changes:**
1. Import `useNavigate` from `react-router-dom`
2. Create a `navigate` function using the hook
3. Replace the plain `<span className="formula-account">` with a clickable element that navigates to `/accounts/{accountId}`
4. Add click handler that calls `navigate(`/accounts/${accountId}`)`
5. Add `e.stopPropagation()` to prevent bubbling (important when used inside clickable containers)

**Code change location:** Line 130

Only make the link clickable in view mode (not editable mode) to prevent accidental navigation while editing:

```jsx
// Current:
<span className="formula-account">{accountName}</span>

// New (conditional based on editable prop):
{editable ? (
  <span className="formula-account">{accountName}</span>
) : (
  <span
    className="formula-account formula-account-link"
    onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${normalized.accountId}`); }}
    role="link"
    tabIndex={0}
  >
    {accountName}
  </span>
)}
```

### 2. `frontend/src/App.css`
**Changes:**
Add styling for the clickable account link:
- Cursor pointer
- Underline on hover
- Keyboard focus styles

```css
.formula-account-link {
  cursor: pointer;
}

.formula-account-link:hover {
  text-decoration: underline;
}

.formula-account-link:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 2px;
}
```

## Implementation Steps

1. Edit `FormulaDisplay.jsx`:
   - Add `useNavigate` import
   - Initialize `navigate` hook
   - Update the account name span to be clickable with navigation

2. Edit `App.css`:
   - Add hover/focus styles for `.formula-account-link`

## Notes
- Formula items always reference accounts (never groups), so all links go to `/accounts/{id}`
- Links are only active in view mode (not edit mode) to prevent accidental navigation while editing formulas
- Stop propagation prevents issues when FormulaDisplay is inside other clickable elements
