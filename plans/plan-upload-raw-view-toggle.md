# Plan: Toggle Table/Raw View for Data Uploads

Add a view toggle to the upload detail page allowing users to switch between the formatted table view and a raw JSON data view, following the existing toggle pattern used in the balance history modal.

## Steps

1. **Add view mode state** in `UploadDetail.jsx`: Add `useState('table')` to track the current view mode (`table` or `raw`).

2. **Add toggle UI component** in `UploadDetail.jsx`: Insert a `.view-toggle` button group (Table / Raw Data) above the data display section, reusing the existing CSS pattern from `BalanceHistoryModal`.

3. **Create raw data rendering** in `UploadDetail.jsx`: Add conditional rendering that shows a `<pre>` block with `JSON.stringify(dataResponse, null, 2)` when in raw mode, keeping the existing table implementation for table mode.

4. **Add raw view styling** in `UploadDetail.css`: Add `.upload-raw-data` CSS class for the raw view container with monospace font, proper padding, and horizontal scroll support.

## Further Considerations

1. **Raw data format preference?** Show as indented JSON (recommended for readability) / Show as compact JSON / Show as original CSV text (would require backend changes)

2. **Pagination in raw view?** Keep pagination in raw mode (consistent) / Show all data at once in raw mode (more "raw" but could be slow for large files)
