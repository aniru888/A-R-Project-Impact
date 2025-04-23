/**
 * Utility functions for forest module
 */

/**
 * Export table data to CSV
 * @param {HTMLTableElement} table - The table element to export
 * @param {string} filename - The name of the CSV file
 */
export function exportToCsv(table, filename) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const csvContent = rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map(cell => cell.textContent.trim()).join(',');
    }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
