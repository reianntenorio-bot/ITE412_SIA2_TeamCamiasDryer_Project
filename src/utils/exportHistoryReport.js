import {
  formatBatchLabel,
  formatSessionDate,
  formatSessionDuration,
  formatStatusLabel,
} from "./dryingHistory";

function escapeCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function csvRow(...cells) {
  return cells.map(escapeCsvCell).join(",");
}

function sessionRows(sessions) {
  return sessions.map((session) => [
    formatBatchLabel(session.id),
    formatSessionDate(session.startedAt || session.endedAt),
    formatSessionDuration(session.durationHours),
    `${session.batchSizeKg ?? 15} kg`,
    formatStatusLabel(session.status),
    session.source === "scheduled" ? "Scheduled batch" : "Dashboard run",
    session.avgTemperature != null ? `${session.avgTemperature.toFixed(1)}°C` : "—",
    session.avgHumidity != null ? `${session.avgHumidity.toFixed(1)}%` : "—",
  ]);
}

export function buildHistoryReportLines(sessions, generatedAt = new Date()) {
  const lines = [];
  lines.push(csvRow("K-Smart Dryer — Drying History Report"));
  lines.push(csvRow("Generated At", generatedAt.toLocaleString()));
  lines.push(csvRow("Total Records", sessions.length));
  lines.push("");
  lines.push(
    csvRow(
      "Batch Name",
      "Date",
      "Duration",
      "Batch Size",
      "Status",
      "Source",
      "Avg Temperature",
      "Avg Humidity"
    )
  );
  for (const row of sessionRows(sessions)) {
    lines.push(csvRow(...row));
  }
  return lines;
}

export function downloadCsv(filename, lines) {
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadExcel(filename, lines) {
  const tsv = lines.map((line) => line.replace(/","/g, "\t").replace(/^"|"$/g, "")).join("\r\n");
  const blob = new Blob(["\uFEFF" + tsv], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename.replace(/\.csv$/i, ".xls");
  link.click();
  URL.revokeObjectURL(link.href);
}

export function printHistoryReport(sessions) {
  const rows = sessionRows(sessions);
  const html = `<!DOCTYPE html><html><head><title>Drying History Report</title>
<style>
body{font-family:Inter,Arial,sans-serif;padding:24px;color:#064e3b}
h1{font-size:20px;margin:0 0 8px}
p{color:#047857;margin:0 0 20px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #d1fae5;padding:8px 10px;text-align:left}
th{background:#f0fdf4}
@media print{body{padding:0}}
</style></head><body>
<h1>K-Smart Dryer — Drying History Report</h1>
<p>Generated ${new Date().toLocaleString()} · ${sessions.length} record(s)</p>
<table><thead><tr>
${["Batch Name", "Date", "Duration", "Batch Size", "Status", "Source", "Avg Temp", "Avg Humidity"].map((h) => `<th>${h}</th>`).join("")}
</tr></thead><tbody>
${rows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}
</tbody></table></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export function downloadPdfViaPrint(sessions) {
  printHistoryReport(sessions);
}
