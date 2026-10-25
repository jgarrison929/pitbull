/**
 * Escape a value for CSV output per RFC 4180.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 * Internal double quotes are escaped by doubling them.
 * Numbers are passed through as-is.
 */
export function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV row from an array of field values.
 */
export function csvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(",");
}

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCsvFile(rows: string[], filename: string): void {
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
