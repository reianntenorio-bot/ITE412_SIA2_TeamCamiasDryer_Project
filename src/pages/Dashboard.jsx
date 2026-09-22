import { useState, useEffect, useCallback, useRef } from "react";
import {
  Thermometer,
  Droplets,
  Zap,
  Clock,
  Play,
  Pause,
  Square,
  Package,
  LayoutDashboard,
  Wifi,
  WifiOff,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, update } from "firebase/database";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { rtdb, auth, isRtdbConfigured } from "../firebase";
import { getDryerRunSeconds } from "../dryerRunSettings";
import { saveDryingSession } from "../utils/dryingHistory";
import { addNotification } from "../utils/notifications";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/** Same paths as device/kamyas_dryer.ino (KAMYAS_RTDB_PATH / KAMYAS_RTDB_CONTROL_PATH) */
const RTDB_LATEST = "kamyas_dryer/latest";
const RTDB_CONTROL = "kamyas_dryer/control";

/** Live: web timer + ESP closed-loop `thermostat` + setpoint (bang-bang on device). */
function Dashboard() {
  const [demoMode, setDemoMode] = useState(!isRtdbConfigured || !rtdb);
  const [liveError, setLiveError] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const [dryerStatus, setDryerStatus] = useState("idle");
  const [temperature, setTemperature] = useState(45);
  const [humidity, setHumidity] = useState(65);
  const [remainingTime, setRemainingTime] = useState(() => getDryerRunSeconds());
  const [demoTotalSec, setDemoTotalSec] = useState(() => getDryerRunSeconds());
  const [heatTotalSec, setHeatTotalSec] = useState(0);
  const [deviceProgressPct, setDeviceProgressPct] = useState(0);
  /** Live-only: web-driven schedule (device uses steady heater, not heat_secs countdown). */
  const [webSchedule, setWebSchedule] = useState(null);
  const webScheduleRef = useRef(null);
  webScheduleRef.current = webSchedule;
  const [targetTemp, setTargetTemp] = useState(65);
  const [targetTempInput, setTargetTempInput] = useState("65");
  const [powerUsage, setPowerUsage] = useState(1.2);
  const [batchSize] = useState(15);
  const [chartData, setChartData] = useState([
    { time: "10:00", temperature: 25, humidity: 85 },
    { time: "10:15", temperature: 35, humidity: 72 },
    { time: "10:30", temperature: 45, humidity: 58 },
    { time: "10:45", temperature: 55, humidity: 42 },
    { time: "11:00", temperature: 62, humidity: 35 },
    { time: "11:15", temperature: 66.5, humidity: 32.1 },
  ]);

  const lastChartSampleRef = useRef({ t: null, h: null });
  const sessionStartRef = useRef(null);
  const fiveMinNotifiedRef = useRef(false);
  const batchStartNotifiedRef = useRef(new Set());
  const chartDataRef = useRef(chartData);
  chartDataRef.current = chartData;

  const logDryingSession = useCallback(async (status, progressPct) => {
    const startedMs = sessionStartRef.current;
    if (!startedMs) return;
    sessionStartRef.current = null;

    const startedAt = new Date(startedMs);
    const endedAt = new Date();
    const durationHours = Math.max(0, (endedAt.getTime() - startedMs) / 3600000);
    const samples = chartDataRef.current.filter(
      (point) =>
        typeof point.temperature === "number" && typeof point.humidity === "number"
    );
    const avgTemperature = samples.length
      ? samples.reduce((sum, point) => sum + point.temperature, 0) / samples.length
      : null;
    const avgHumidity = samples.length
      ? samples.reduce((sum, point) => sum + point.humidity, 0) / samples.length
      : null;

    try {
      await saveDryingSession({
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationHours,
        batchSizeKg: batchSize,
        status,
        progressPct,
        avgTemperature,
        avgHumidity,
      });
      if (status === "completed") {
        addNotification({
          type: "success",
          title: "Batch completed",
          message: "Drying cycle finished successfully.",
        });
      }
    } catch (err) {
      console.error("Failed to log drying session:", err);
    }
  }, [batchSize]);

  const applyLatestSnapshot = useCallback((data) => {
    if (!data || typeof data !== "object") return;

    const t = typeof data.t === "number" ? data.t : parseFloat(data.t);
    const h = typeof data.h === "number" ? data.h : parseFloat(data.h);
    const sp = typeof data.setpoint === "number" ? data.setpoint : parseFloat(data.setpoint);
    const heaterOn =
      data.heater_actual === 1 ||
      data.heater_actual === true ||
      data.heater_actual === "1";
    const heatRem =
      typeof data.heat_remaining_sec === "number"
        ? data.heat_remaining_sec
        : parseInt(data.heat_remaining_sec, 10) || 0;
    const heatTotal =
      typeof data.heat_total_sec === "number"
        ? data.heat_total_sec
        : parseInt(data.heat_total_sec, 10) || 0;
    const dhtOk = data.dhtOk === 1 || data.dhtOk === true;

    let pct =
      typeof data.dry_progress_pct === "number"
        ? data.dry_progress_pct
        : parseInt(data.dry_progress_pct, 10);
    if (Number.isNaN(pct) && heatTotal > 0) {
      pct = Math.round(
        (100 * (heatTotal - Math.min(heatRem, heatTotal))) / heatTotal
      );
    }
    if (Number.isNaN(pct)) {
      pct = 0;
    }
    setDeviceProgressPct(Math.min(100, Math.max(0, pct)));
    setHeatTotalSec(Math.max(0, heatTotal));

    if (!Number.isNaN(sp) && sp >= 20 && sp <= 90) {
      setTargetTemp(sp);
      setTargetTempInput(String(Math.round(sp * 10) / 10));
    }

    if (dhtOk && !Number.isNaN(t) && !Number.isNaN(h)) {
      setTemperature(t);
      setHumidity(h);
    }

    const ws = webScheduleRef.current;
    if (ws == null) {
      setDryerStatus(heaterOn ? "running" : "idle");
      setRemainingTime(Math.max(0, heatRem));
    }

    const estPower = heaterOn ? 1.5 + Math.random() * 0.4 : 0.2 + Math.random() * 0.15;
    setPowerUsage(estPower);

    if (dhtOk && !Number.isNaN(t) && !Number.isNaN(h)) {
      const prev = lastChartSampleRef.current;
      if (prev.t !== t || prev.h !== h) {
        lastChartSampleRef.current = { t, h };
        const now = new Date();
        const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
        setChartData((prevData) => {
          const next = [...prevData, { time: timeStr, temperature: t, humidity: h }];
          return next.slice(-24);
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!rtdb || !isRtdbConfigured) {
      setDemoMode(true);
      return;
    }

    if (!auth) {
      setDemoMode(true);
      return;
    }

    setDemoMode(false);
    let detachRtdb = () => {};

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      detachRtdb();
      detachRtdb = () => {};
      setLiveError(null);

      if (!user) {
        setLiveConnected(false);
        setLiveError(
          "Sign in required. Realtime Database rules allow reads only for authenticated users."
        );
        return;
      }

      const latestRef = ref(rtdb, RTDB_LATEST);
      detachRtdb = onValue(
        latestRef,
        (snap) => {
          setLiveConnected(true);
          setLiveError(null);
          const val = snap.val();
          if (val != null) {
            applyLatestSnapshot(val);
          }
        },
        (err) => {
          console.error("RTDB /latest:", err);
          setLiveError(err.message || "Realtime Database error");
          setLiveConnected(false);
        }
      );
    });

    return () => {
      unsubAuth();
      detachRtdb();
    };
  }, [applyLatestSnapshot]);

  const writeControl = useCallback(async (partial) => {
    if (!rtdb || demoMode) {
      return true;
    }
    try {
      await update(ref(rtdb, RTDB_CONTROL), partial);
      setLiveError(null);
      return true;
    } catch (e) {
      console.error(e);
      setLiveError(e.message || "Failed to write control");
      return false;
    }
  }, [rtdb, demoMode]);

  const stopSsrOnDevice = useCallback(async () => {
    await writeControl({ heat_secs: 0 });
    await writeControl({ thermostat: 0, heater: 0, heat_secs: 0 });
  }, [writeControl]);

  /** Count down in the browser; at 0 send RTDB stop so the ESP turns SSR off. */
  useEffect(() => {
    if (demoMode || webSchedule == null || webSchedule.kind !== "running") {
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) {
        return;
      }
      const rem = Math.max(
        0,
        Math.ceil((webSchedule.endAtMs - Date.now()) / 1000)
      );
      setRemainingTime(rem);
      if (rem <= 0 && !cancelled) {
        cancelled = true;
        setWebSchedule(null);
        setDryerStatus("idle");
        setRemainingTime(getDryerRunSeconds());
        void stopSsrOnDevice();
        void logDryingSession("completed", 100);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [demoMode, webSchedule, stopSsrOnDevice, logDryingSession]);

  useEffect(() => {
    if (demoMode && dryerStatus === "complete") {
      void logDryingSession("completed", 100);
    }
  }, [demoMode, dryerStatus, logDryingSession]);

  useEffect(() => {
    if (demoMode && dryerStatus === "running") {
      const interval = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            setDryerStatus("complete");
            return 0;
          }
          return prev - 1;
        });
        setTemperature((prev) =>
          Math.min(prev + (Math.random() * 2 - 0.5), 80),
        );
        setHumidity((prev) => Math.max(prev - Math.random() * 0.8, 10));
        setPowerUsage((prev) => 1.5 + Math.random() * 1.2);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [demoMode, dryerStatus]);

  useEffect(() => {
    if (demoMode && dryerStatus === "running") {
      const now = new Date();
      const timeStr = `${now.getHours()}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;
      setChartData((prev) => {
        const newData = [...prev, { time: timeStr, temperature, humidity }];
        return newData.slice(-10);
      });
    }
  }, [demoMode, dryerStatus, temperature, humidity]);

  const thermoStartPayload = () => {
    const sp = parseFloat(targetTempInput);
    const p = { thermostat: 1, heat_secs: 0 };
    if (!Number.isNaN(sp) && sp >= 20 && sp <= 90) {
      p.setpoint = sp;
    }
    return p;
  };

  const handleStart = async () => {
    const runSecs = getDryerRunSeconds();
    if (demoMode) {
      sessionStartRef.current = Date.now();
      fiveMinNotifiedRef.current = false;
      setDemoTotalSec(runSecs);
      setDryerStatus("running");
      setTemperature(25);
      setHumidity(85);
      setRemainingTime(runSecs);
      return;
    }
    if (webSchedule?.kind === "paused") {
      const rem = webSchedule.remainingSec;
      const total = webSchedule.totalSec;
      const endAtMs = Date.now() + rem * 1000;
      setWebSchedule({ kind: "running", endAtMs, totalSec: total });
      setDryerStatus("running");
      setRemainingTime(rem);
      const z = await writeControl({ heat_secs: 0 });
      if (!z) {
        setWebSchedule(null);
        setDryerStatus("idle");
        return;
      }
      const on = await writeControl(thermoStartPayload());
      if (!on) {
        setWebSchedule(null);
        setDryerStatus("idle");
      }
      return;
    }
    const endAtMs = Date.now() + runSecs * 1000;
    sessionStartRef.current = Date.now();
    fiveMinNotifiedRef.current = false;
    setWebSchedule({ kind: "running", endAtMs, totalSec: runSecs });
    setDryerStatus("running");
    setRemainingTime(runSecs);
    const cleared = await writeControl({ heat_secs: 0 });
    if (!cleared) {
      setWebSchedule(null);
      setDryerStatus("idle");
      return;
    }
    const armed = await writeControl(thermoStartPayload());
    if (!armed) {
      setWebSchedule(null);
      setDryerStatus("idle");
    }
  };

  const handlePause = async () => {
    if (demoMode) {
      setDryerStatus("paused");
      return;
    }
    if (webSchedule?.kind === "running") {
      const rem = Math.max(
        0,
        Math.ceil((webSchedule.endAtMs - Date.now()) / 1000)
      );
      setWebSchedule({
        kind: "paused",
        remainingSec: rem,
        totalSec: webSchedule.totalSec,
      });
      setDryerStatus("paused");
      setRemainingTime(rem);
      await stopSsrOnDevice();
      return;
    }
    await stopSsrOnDevice();
    setDryerStatus("paused");
  };

  const handleStop = async () => {
    const runSecs = getDryerRunSeconds();
    const wasActive =
      dryerStatus === "running" ||
      dryerStatus === "paused" ||
      dryerStatus === "complete";
    if (wasActive && sessionStartRef.current) {
      const totalSec = demoMode
        ? demoTotalSec
        : webSchedule?.totalSec || heatTotalSec || runSecs;
      const elapsedSec = totalSec > 0 ? totalSec - remainingTime : 0;
      const pct =
        totalSec > 0
          ? Math.min(100, Math.round((100 * elapsedSec) / totalSec))
          : dryerStatus === "complete"
            ? 100
            : 0;
      const status =
        dryerStatus === "complete" || pct >= 100 ? "completed" : "stopped";
      void logDryingSession(status, pct);
    }
    if (demoMode) {
      setDryerStatus("idle");
      setRemainingTime(runSecs);
      setDemoTotalSec(runSecs);
      setTemperature(45);
      setHumidity(65);
      return;
    }
    setWebSchedule(null);
    setDryerStatus("idle");
    setRemainingTime(runSecs);
    await stopSsrOnDevice();
  };

  const applySetpoint = () => {
    const v = parseFloat(targetTempInput);
    if (Number.isNaN(v) || v < 20 || v > 90) return;
    if (demoMode) {
      setTargetTemp(v);
      return;
    }
    writeControl({ setpoint: v });
  };

  const webTotalSec =
    webSchedule?.kind === "running"
      ? webSchedule.totalSec
      : webSchedule?.kind === "paused"
        ? webSchedule.totalSec
        : 0;
  const webProgressPct =
    !demoMode && webSchedule != null && webTotalSec > 0
      ? Math.min(
          100,
          Math.round(
            (100 * (webTotalSec - remainingTime)) / webTotalSec
          )
        )
      : null;

  const progress = demoMode
    ? Math.round((1 - remainingTime / Math.max(1, demoTotalSec)) * 100)
    : webProgressPct != null
      ? webProgressPct
      : deviceProgressPct;

  const estimatedMins = Math.ceil(remainingTime / 60);

  const tempGaugePercent = Math.min((temperature / 80) * 100, 100);
  const humidityGaugePercent = Math.min((humidity / 100) * 100, 100);

  useEffect(() => {
    if (dryerStatus !== "running" || remainingTime <= 0) {
      if (dryerStatus === "idle") fiveMinNotifiedRef.current = false;
      return;
    }
    if (remainingTime <= 300 && !fiveMinNotifiedRef.current) {
      fiveMinNotifiedRef.current = true;
      addNotification({
        type: "info",
        title: "5 minutes remaining",
        message: "Drying cycle will finish in about 5 minutes.",
      });
    }
  }, [dryerStatus, remainingTime]);

  useEffect(() => {
    let cancelled = false;
    const checkUpcomingBatches = async () => {
      try {
        const res = await fetch(`${API_URL}/api/dryer-batches`);
        if (!res.ok || cancelled) return;
        const batches = await res.json();
        if (!Array.isArray(batches)) return;
        const now = Date.now();
        for (const batch of batches) {
          const startMs = new Date(batch.startAt).getTime();
          if (Number.isNaN(startMs)) continue;
          const diff = startMs - now;
          if (diff >= 0 && diff <= 60000 && !batchStartNotifiedRef.current.has(batch.id)) {
            batchStartNotifiedRef.current.add(batch.id);
            addNotification({
              type: "info",
              title: "Scheduled batch starting",
              message: `Kamyas Batch #${String(batch.id).slice(0, 8)} is starting now.`,
            });
          }
        }
      } catch {
        /* ignore */
      }
    };
    checkUpcomingBatches();
    const id = setInterval(checkUpcomingBatches, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dashboard-banner">
        Kamyas Smart Machine for Automated Regulated Temperature
      </div>

      {!isRtdbConfigured && (
        <div className="manage-products-error" style={{ marginBottom: 16 }}>
          Realtime Database URL missing. Add{" "}
          <code>VITE_FIREBASE_DATABASE_URL</code> (Console → Realtime Database) or
          enable RTDB in the same Firebase project as the admin app. Update{" "}
          <code>device/kamyas_dryer.ino</code> <code>FIREBASE_HOST</code> / secret
          to match — paths: <code>kamyas_dryer/latest</code> and{" "}
          <code>kamyas_dryer/control</code>.
        </div>
      )}

      {isRtdbConfigured && (
        <div
          className="dashboard-device-bar"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 12,
            border: "2px solid #d1fae5",
            background: liveConnected ? "#ecfdf5" : "#fffbeb",
            color: "var(--text-primary)",
            fontSize: 14,
          }}
        >
          {liveConnected ? (
            <Wifi size={18} color="#059669" />
          ) : (
            <WifiOff size={18} color="#d97706" />
          )}
          <span>
            {demoMode
              ? "Demo mode (no RTDB)"
              : liveConnected
                ? "ESP8266 / Realtime DB — schedule in this browser; device runs thermostat to the Target setpoint (±0.5°C). Keep tab open."
                : "Connecting to device…"}
          </span>
          {liveError && (
            <span style={{ color: "#dc2626", marginLeft: 8, flex: "1 1 100%" }}>
              {liveError}
              {/permission|PERMISSION_DENIED/i.test(liveError) && (
                <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                  Deploy rules: run <code style={{ fontSize: 12 }}>firebase deploy --only database</code> from the
                  repo (uses <code style={{ fontSize: 12 }}>database.rules.json</code>). In Firebase Console →
                  Realtime Database → Rules, authenticated users need <code style={{ fontSize: 12 }}>.read</code> on{" "}
                  <code style={{ fontSize: 12 }}>kamyas_dryer</code>. The ESP still writes using its database secret.
                </span>
              )}
            </span>
          )}
        </div>
      )}

      <section className="dashboard-section">
        <div className="dashboard-header">
          <h2 className="section-title">
            <LayoutDashboard size={22} />
            Real-Time Monitoring
          </h2>
          <div className="dashboard-header-right">
            <span
              className={`status-pill monitoring-status ${
                dryerStatus === "running"
                  ? "active"
                  : dryerStatus === "paused"
                    ? "paused"
                    : "idle"
              }`}
            >
              {dryerStatus === "running"
                ? "Active"
                : dryerStatus === "paused"
                  ? "Paused"
                  : dryerStatus === "complete"
                    ? "Done"
                    : "Idle"}
            </span>
            <div className="actions-buttons">
              <button
                className={`ctrl-btn start ${dryerStatus === "running" ? "active" : ""}`}
                onClick={dryerStatus === "running" ? handlePause : handleStart}
                disabled={!demoMode && !rtdb}
              >
                <Play size={18} />
                Start
              </button>
              <button
                className="ctrl-btn pause"
                onClick={handlePause}
                disabled={dryerStatus !== "running" || (!demoMode && !rtdb)}
              >
                <Pause size={18} />
                Pause
              </button>
              <button
                className="ctrl-btn stop"
                onClick={handleStop}
                disabled={dryerStatus === "idle" || (!demoMode && !rtdb)}
              >
                <Square size={18} />
                Stop
              </button>
            </div>
          </div>
        </div>

        <div className="dashboard-setpoint-row" style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <label htmlFor="setpoint-input" style={{ fontWeight: 600 }}>
            Target setpoint (°C)
          </label>
          <input
            id="setpoint-input"
            type="number"
            min={20}
            max={90}
            step={0.5}
            value={targetTempInput}
            onChange={(e) => setTargetTempInput(e.target.value)}
            style={{
              width: 88,
              padding: "8px 12px",
              borderRadius: 8,
              border: "2px solid #d1fae5",
              fontSize: 15,
            }}
          />
          <button type="button" className="ctrl-btn start" onClick={applySetpoint}>
            Apply to device
          </button>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Written to <code>kamyas_dryer/control</code> (same as firmware).
          </span>
        </div>

        <div className="kpi-grid">
        <div className="kpi-card gauge-card temp">
          <div className="gauge-card-header">
            <Thermometer size={20} className="gauge-title-icon temp" />
            <h3 className="kpi-label">Current Temperature</h3>
          </div>
          <div className="gauge-container">
            <div
              className="gauge-circle temp"
              style={{
                background: `conic-gradient(#f59e0b ${tempGaugePercent * 3.6}deg, #e5e7eb 0deg)`,
              }}
            >
              <div className="gauge-inner">
                <span className="gauge-value">{temperature.toFixed(1)}°C</span>
                <span className="gauge-target">Target: {targetTemp}°C</span>
              </div>
            </div>
          </div>
        </div>

        <div className="kpi-card gauge-card humidity">
          <div className="gauge-card-header">
            <Droplets size={20} className="gauge-title-icon humidity" />
            <h3 className="kpi-label">Current Humidity</h3>
          </div>
          <div className="gauge-container">
            <div
              className="gauge-circle humidity"
              style={{
                background: `conic-gradient(#3b82f6 ${humidityGaugePercent * 3.6}deg, #e5e7eb 0deg)`,
              }}
            >
              <div className="gauge-inner">
                <span className="gauge-value">{humidity.toFixed(1)}%</span>
                <span className="gauge-target">
                  Target: &lt;40%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Energy Usage</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{powerUsage.toFixed(1)} kWh</span>
            <Zap size={28} className="kpi-icon" />
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Batch Size</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{batchSize} kg</span>
            <Package size={28} className="kpi-icon" />
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Drying Time</span>
          <div className="kpi-value-row">
            <span className="kpi-value">
              {(() => {
                const denom = demoMode
                  ? demoTotalSec
                  : webTotalSec > 0
                    ? webTotalSec
                    : heatTotalSec > 0
                      ? heatTotalSec
                      : dryerStatus === "running"
                        ? getDryerRunSeconds()
                        : 0;
                const frac =
                  denom > 0 ? (denom - remainingTime) / denom : 0;
                return frac > 0 ? frac.toFixed(1) : "0";
              })()}{" "}
              hrs
            </span>
            <Clock size={28} className="kpi-icon" />
          </div>
        </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">Drying Progress</h2>
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">Drying Progress</span>
          <span className="progress-value">{Math.min(100, Math.max(0, progress))}%</span>
          </div>
          <div className="progress-bar-new">
            <div
              className="progress-fill-new"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            ></div>
          </div>
          <p className="progress-eta">
            {!demoMode && webSchedule != null
              ? `Web timer: ~${estimatedMins} min left of ${Math.ceil(webTotalSec / 60)} min. ESP maintains Target setpoint (thermostat on /control); heater commands are ignored until Stop.`
              : heatTotalSec > 0
                ? `Device timed heat: ~${estimatedMins} min left of ${Math.ceil(heatTotalSec / 60)} min (from ESP).`
                : `Ready — Start enables thermostat + your Target setpoint for ${Math.ceil(getDryerRunSeconds() / 60)} min (browser timer), then turns thermostat off. Configure duration in Settings.`}
          </p>
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">Temperature & Humidity Trends</h2>
        <div className="chart-section">
          <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
              <XAxis
                dataKey="time"
                stroke="#047857"
                tick={{ fill: "#064e3b" }}
              />
              <YAxis stroke="#047857" tick={{ fill: "#064e3b" }} />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "2px solid #d1fae5",
                  borderRadius: "12px",
                }}
                formatter={(value) => [value.toFixed(1), ""]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: "#f59e0b" }}
                name="Temperature (°C)"
              />
              <Line
                type="monotone"
                dataKey="humidity"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6" }}
                name="Humidity (%)"
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
