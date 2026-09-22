function escapeCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function csvRow(...cells) {
  return cells.map(escapeCsvCell).join(",");
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

export function buildDashboardReport({
  generatedAt,
  dryerStatus,
  demoMode,
  liveConnected,
  temperature,
  humidity,
  targetTemp,
  powerUsage,
  batchSize,
  heatLevel,
  progress,
  remainingTime,
  chartData,
}) {
  const lines = [];

  lines.push(csvRow("K-Smart Dryer Monitoring Report"));
  lines.push(csvRow("Generated At", generatedAt));
  lines.push(
    csvRow("Mode", demoMode ? "Demo" : liveConnected ? "Live (ESP8266)" : "Offline")
  );
  lines.push(csvRow("Status", dryerStatus));
  lines.push("");

  lines.push(csvRow("Session Summary"));
  lines.push(csvRow("Metric", "Value"));
  lines.push(csvRow("Current Temperature (°C)", temperature.toFixed(1)));
  lines.push(csvRow("Target Setpoint (°C)", targetTemp));
  lines.push(csvRow("Current Humidity (%)", humidity.toFixed(1)));
  lines.push(csvRow("Energy Usage (kWh)", powerUsage.toFixed(1)));
  lines.push(csvRow("Batch Size (kg)", batchSize));
  lines.push(csvRow("Heat Level", heatLevel));
  lines.push(csvRow("Drying Progress (%)", progress));
  lines.push(csvRow("Remaining Time (min)", Math.ceil(remainingTime / 60)));
  lines.push("");

  lines.push(csvRow("Temperature & Humidity Trends"));
  lines.push(csvRow("Time", "Temperature (°C)", "Humidity (%)"));
  for (const point of chartData) {
    const temp =
      typeof point.temperature === "number"
        ? point.temperature.toFixed(1)
        : point.temperature;
    const hum =
      typeof point.humidity === "number"
        ? point.humidity.toFixed(1)
        : point.humidity;
    lines.push(csvRow(point.time, temp, hum));
  }

  return lines;
}
