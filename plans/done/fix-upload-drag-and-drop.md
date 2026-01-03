# Plan: Fix Upload Drag-and-Drop Functionality

## Problem

The upload form in `UploadCreate.jsx` displays "Click to select or drag and drop" but only the click functionality is implemented. Dragging and dropping files onto the upload area does nothing.

## Root Cause

The `<label>` element has no drag-and-drop event handlers:
- No `onDrop` handler to receive dropped files
- No `onDragOver` handler (required to allow dropping - without `e.preventDefault()` the browser tries to navigate to the file)
- No `onDragEnter`/`onDragLeave` handlers for visual feedback

## Solution

Add proper drag-and-drop event handlers to `UploadCreate.jsx` and CSS for visual feedback.

## Steps

### 1. Add `isDragging` state
Add state to track when a file is being dragged over the drop zone:
```jsx
const [isDragging, setIsDragging] = useState(false);
```

### 2. Extract file validation logic
Refactor `handleFileSelect` to extract validation into a reusable `validateAndSetFile(file)` function that:
- Validates file type (.csv, .json)
- Validates file size (max 10MB)
- Auto-fills name from filename
- Sets the selected file state

### 3. Add drag-and-drop event handlers
```jsx
const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
};

const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
};

const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
};

const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
        validateAndSetFile(file);
    }
};
```

### 4. Attach handlers to the upload area
Update the `<label>` element:
```jsx
<label
    htmlFor="file-input"
    className={`file-upload-area ${isDragging ? 'dragging' : ''}`}
    onDragOver={handleDragOver}
    onDragEnter={handleDragEnter}
    onDragLeave={handleDragLeave}
    onDrop={handleDrop}
>
```

### 5. Add CSS for dragging state
Add to `App.css`:
```css
.file-upload-area.dragging {
    border-color: #007bff;
    background-color: rgba(0, 123, 255, 0.1);
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/components/UploadCreate.jsx` | Add state, handlers, attach to label |
| `frontend/src/App.css` | Add `.file-upload-area.dragging` styles |

## Further Considerations

1. **Drag scope:** Dropping works only on the upload area (not the entire page) for simplicity and predictability.

2. **Multiple files:** If multiple files are dropped, only the first file is used (matches current single-file behavior).

3. **Edge cases to handle:**
   - Dragging non-file items (text, images from other apps) - should be ignored
   - Dragging folders - should show appropriate error or be ignored
