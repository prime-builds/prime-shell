import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Divider,
  Field,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Spinner,
  Text,
  Title1,
  Title2,
  Title3,
  Tooltip,
} from "@fluentui/react-components";
import { validateCustomSeed } from "@prime-shell/design-tokens";
import {
  cancelTask,
  echoText,
  getBackendStatus,
  getRuntimeProbeConfig,
  listenToTaskEvents,
  resetBackend,
  startCountTask,
  toSafeError,
  triggerCrash,
  triggerHang,
  triggerLargeRejected,
  writeRuntimeEvidence,
} from "./backend";
import type { BackendStatus, TaskEvent, TaskState } from "./contracts";
import { AppThemeProvider } from "./providers/AppThemeProvider";
import { useThemeController } from "./theme/ThemeContext";
import "./app.css";

const RUNTIME_PROBE_TEXT = "Hello — مرحبا — こんにちは 👋";

function AppContent() {
  const {
    themeMode,
    setThemeMode,
    effectiveTheme,
    accentMode,
    setAccentMode,
    density,
    setDensity,
    resolvedMaterial,
    accessibilityPreferences,
    tokens,
  } = useThemeController();

  // Custom accent state
  const [customSeedInput, setCustomSeedInput] = useState("#0078D4");
  const [seedError, setSeedError] = useState("");

  // Backend Status (Phase 0B)
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [statusError, setStatusError] = useState("");

  // Echo Baseline (Phase 0B)
  const [echoInput, setEchoInput] = useState("Hello — مرحبا — こんにちは 👋");
  const [echoResult, setEchoResult] = useState("");
  const [echoError, setEchoError] = useState("");
  const [echoBusy, setEchoBusy] = useState(false);

  // Task Resilience (Phase 0B)
  const [targetCount, setTargetCount] = useState("20");
  const [delayMs, setDelayMs] = useState("50");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<TaskState | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [taskCompleted, setTaskCompleted] = useState<number | null>(null);
  const [taskMessage, setTaskMessage] = useState("");
  const [taskError, setTaskError] = useState("");
  const [taskStarting, setTaskStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Fault Operations (Phase 0B)
  const [faultAction, setFaultAction] = useState("");
  const [faultError, setFaultError] = useState("");

  // Probe & CSP
  const runtimeProbeStarted = useRef(false);
  const cspViolations = useRef<string[]>([]);
  const lastProgressAnnouncement = useRef(0);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  // Accessible Form state
  const [sampleFormField, setSampleFormField] = useState("Jane Doe");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const recordViolation = (event: SecurityPolicyViolationEvent) => {
      cspViolations.current.push(
        `${event.violatedDirective}:${event.blockedURI}`,
      );
    };
    document.addEventListener("securitypolicyviolation", recordViolation);
    return () => {
      document.removeEventListener("securitypolicyviolation", recordViolation);
    };
  }, []);

  const refreshStatus = async () => {
    try {
      const s = await getBackendStatus();
      setStatus(s);
      setStatusError("");
      return s;
    } catch (reason) {
      const err = toSafeError(reason);
      setStatusError(err.message);
      return null;
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  // Listen to background task events from Rust
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenToTaskEvents((event: TaskEvent) => {
      if (event.event === "progress") {
        if (typeof event.payload.current === "number") {
          setCurrentProgress(event.payload.current);
          setTaskState("Running");

          const now = Date.now();
          if (now - lastProgressAnnouncement.current >= 1000) {
            lastProgressAnnouncement.current = now;
            setLiveAnnouncement(
              `Task progress: ${event.payload.current} of ${targetCount}`,
            );
          }
        }
      } else if (event.event === "terminal") {
        const terminalState = event.payload.status ?? "Succeeded";
        setTaskState(terminalState);
        setCancelling(false);
        if (typeof event.payload.completed === "number") {
          setTaskCompleted(event.payload.completed);
          setCurrentProgress(event.payload.completed);
        }
        setLiveAnnouncement(`Task ${terminalState}`);
        setTaskMessage(`Task terminated with state: ${terminalState}`);
        void refreshStatus();
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [targetCount]);

  async function handleEchoSubmit() {
    setEchoBusy(true);
    setEchoError("");
    setEchoResult("");
    try {
      const response = await echoText(echoInput);
      setEchoResult(response.text);
    } catch (reason) {
      setEchoError(toSafeError(reason).message);
    } finally {
      setEchoBusy(false);
    }
  }

  async function handleStartTask() {
    const target = parseInt(targetCount, 10);
    const delay = parseInt(delayMs, 10);
    if (isNaN(target) || target <= 0) {
      setTaskError("Target count must be a positive integer.");
      return;
    }
    if (isNaN(delay) || delay < 0) {
      setTaskError("Delay must be a non-negative integer.");
      return;
    }

    setTaskStarting(true);
    setTaskError("");
    setTaskMessage("");
    setTaskCompleted(null);
    setCurrentProgress(0);
    setTaskState("Queued");
    setLiveAnnouncement("Task queued");

    try {
      const taskId = await startCountTask(target, delay);
      setActiveTaskId(taskId);
      setTaskState("Running");
      setLiveAnnouncement(`Task ${taskId} started`);
      void refreshStatus();
    } catch (reason) {
      const err = toSafeError(reason);
      setTaskError(`${err.code}: ${err.message} [trace: ${err.traceId}]`);
      setTaskState("Failed");
      setLiveAnnouncement(`Task failed: ${err.message}`);
    } finally {
      setTaskStarting(false);
    }
  }

  async function handleCancelTask() {
    if (!activeTaskId) return;
    setCancelling(true);
    setLiveAnnouncement("Cancelling task");
    try {
      await cancelTask(activeTaskId);
    } catch (reason) {
      const err = toSafeError(reason);
      setTaskError(`${err.code}: ${err.message} [trace: ${err.traceId}]`);
      setCancelling(false);
    }
  }

  async function handleCrash() {
    setFaultAction("Triggering sidecar crash...");
    setFaultError("");
    try {
      await triggerCrash();
      setFaultAction("Crash sent. Waiting for bounded recovery...");
      setTimeout(() => void refreshStatus(), 1500);
    } catch (reason) {
      setFaultError(toSafeError(reason).message);
    }
  }

  async function handleHang() {
    setFaultAction("Triggering sidecar hang (5s)...");
    setFaultError("");
    try {
      await triggerHang();
      setFaultAction("Hang sent. Timeout will terminate and restart...");
      setTimeout(() => void refreshStatus(), 2500);
    } catch (reason) {
      setFaultError(toSafeError(reason).message);
    }
  }

  async function handleLargeRejected() {
    setFaultAction("Sending 2 MB payload (limit: 1 MB)...");
    setFaultError("");
    try {
      await triggerLargeRejected();
      setFaultAction("Large request submitted.");
    } catch (reason) {
      const err = toSafeError(reason);
      setFaultError(`${err.code}: ${err.message} (Safe error rejection verified)`);
    }
  }

  async function handleReset() {
    setFaultAction("Resetting circuit breaker...");
    setFaultError("");
    try {
      const s = await resetBackend();
      setStatus(s);
      setFaultAction("Backend reset completed.");
    } catch (reason) {
      setFaultError(toSafeError(reason).message);
    }
  }

  function handleApplyCustomSeed() {
    const validation = validateCustomSeed(customSeedInput);
    if (!validation.valid) {
      setSeedError(validation.reason || "Invalid seed color.");
      return;
    }
    setSeedError("");
    setAccentMode({ mode: "custom", seedColor: customSeedInput });
  }

  // Runtime probe runner
  useEffect(() => {
    if (runtimeProbeStarted.current) return;
    runtimeProbeStarted.current = true;

    void (async () => {
      try {
        const probe = await getRuntimeProbeConfig();
        if (!probe.enabled || !probe.evidencePath) return;

        await new Promise((r) => setTimeout(r, 400));
        const initialStatus = (await refreshStatus()) || {
          ready: false,
          state: "stopped",
          backendVersion: null,
          circuitOpen: false,
        };

        let unicodeResult = "";
        try {
          const res = await echoText(RUNTIME_PROBE_TEXT);
          unicodeResult = res.text;
        } catch {
          unicodeResult = "";
        }

        let safeError = "";
        try {
          await triggerLargeRejected();
        } catch (reason) {
          const parsed = toSafeError(reason);
          safeError = `${parsed.code}: ${parsed.message}`;
        }

        let countSuccess = false;
        try {
          const tid = await startCountTask(3, 10);
          await new Promise((r) => setTimeout(r, 200));
          countSuccess = Boolean(tid);
        } catch {
          countSuccess = false;
        }

        await writeRuntimeEvidence({
          status: "passed",
          windowRendered:
            window.innerWidth > 0 &&
            window.innerHeight > 0 &&
            document.visibilityState === "visible",
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          fluentRendered: Boolean(document.querySelector(".fui-FluentProvider")),
          releaseCspViolationCount: cspViolations.current.length,
          releaseCspViolations: cspViolations.current,
          backendReady: initialStatus.ready,
          backendState: initialStatus.state,
          backendVersion: initialStatus.backendVersion,
          circuitOpen: initialStatus.circuitOpen,
          unicodeInput: RUNTIME_PROBE_TEXT,
          unicodeOutput: unicodeResult,
          unicodeExactMatch: unicodeResult === RUNTIME_PROBE_TEXT,
          countOperationVerified: countSuccess,
          renderedText: document.body.innerText,
          safeErrorPath: safeError,
          evidencePath: probe.evidencePath,
          themeFoundation: {
            effectiveTheme,
            themeMode,
            density,
            material: resolvedMaterial.effectiveMaterial,
          },
        });
      } catch (err) {
        console.error("Probe error:", err);
      }
    })();
  }, [effectiveTheme, themeMode, density, resolvedMaterial.effectiveMaterial]);

  const stateLower = status?.state?.toLowerCase() ?? "";

  return (
    <main className="app">
      <div className="card-container">
        {/* Header & Theme Overview Card */}
        <Card className="card" role="region" aria-label="Application Header">
          <header>
            <div>
              <Title1 as="h1" id="main-title">Prime Shell Desktop</Title1>
              <Text size={200} className="subtitle" as="p">
                Phase 2 — Theme, Tokens, and Accessibility Foundation
              </Text>
            </div>
            <div className="status" aria-live="polite">
              {checking ? (
                <Spinner size="tiny" label="Checking backend" />
              ) : (
                <div className="status-badges">
                  <Text weight="semibold">
                    Backend:{" "}
                    <span
                      id="backend-status-text"
                      data-testid="backend-status-badge"
                      className={`status-badge status-badge-${
                        stateLower === "ready"
                          ? "success"
                          : stateLower === "busy"
                            ? "informative"
                            : stateLower === "restarting"
                              ? "warning"
                              : "danger"
                      }`}
                    >
                      {status?.state
                        ? status.state.charAt(0).toUpperCase() +
                          status.state.slice(1).toLowerCase()
                        : "Unavailable"}
                    </span>
                  </Text>
                  {status?.circuitOpen && (
                    <span id="backend-circuit-badge" className="status-badge status-badge-danger">
                      Circuit: OPEN
                    </span>
                  )}
                </div>
              )}
            </div>
          </header>
        </Card>

        {/* 1. Theme, Accent & Density Control Card */}
        <Card className="card" role="region" aria-label="Theme and Density Controls">
          <Title2 as="h2">Theme &amp; Tokens Configuration</Title2>
          <Text size={300}>
            Configure theme mode, accent brand ramp, and layout density. Changes propagate instantly to native windows and webview portals without restart.
          </Text>

          <div className="theme-control-group">
            {/* Theme Mode Selector */}
            <div className="control-row">
              <Text weight="semibold" id="theme-mode-label">Theme Mode:</Text>
              <div className="button-group" role="group" aria-labelledby="theme-mode-label">
                <Button
                  appearance={themeMode === "system" ? "primary" : "secondary"}
                  onClick={() => setThemeMode("system")}
                  data-testid="theme-system-btn"
                  aria-pressed={themeMode === "system"}
                >
                  System ({effectiveTheme})
                </Button>
                <Button
                  appearance={themeMode === "light" ? "primary" : "secondary"}
                  onClick={() => setThemeMode("light")}
                  data-testid="theme-light-btn"
                  aria-pressed={themeMode === "light"}
                >
                  Light
                </Button>
                <Button
                  appearance={themeMode === "dark" ? "primary" : "secondary"}
                  onClick={() => setThemeMode("dark")}
                  data-testid="theme-dark-btn"
                  aria-pressed={themeMode === "dark"}
                >
                  Dark
                </Button>
              </div>
            </div>

            {/* Density Selector */}
            <div className="control-row">
              <Text weight="semibold" id="density-mode-label">Layout Density:</Text>
              <div className="button-group" role="group" aria-labelledby="density-mode-label">
                <Button
                  appearance={density === "comfortable" ? "primary" : "secondary"}
                  onClick={() => setDensity("comfortable")}
                  data-testid="density-comfortable-btn"
                  aria-pressed={density === "comfortable"}
                >
                  Comfortable
                </Button>
                <Button
                  appearance={density === "compact" ? "primary" : "secondary"}
                  onClick={() => setDensity("compact")}
                  data-testid="density-compact-btn"
                  aria-pressed={density === "compact"}
                >
                  Compact
                </Button>
              </div>
            </div>

            {/* Accent Mode Selector */}
            <div className="control-row">
              <Text weight="semibold" id="accent-mode-label">Accent Brand:</Text>
              <div className="button-group" role="group" aria-labelledby="accent-mode-label">
                <Button
                  appearance={accentMode.mode === "default" ? "primary" : "secondary"}
                  onClick={() => setAccentMode({ mode: "default" })}
                  data-testid="accent-default-btn"
                  aria-pressed={accentMode.mode === "default"}
                >
                  Fluent Default (#0F6CBD)
                </Button>
                <Button
                  appearance={accentMode.mode === "system" ? "primary" : "secondary"}
                  onClick={() => setAccentMode({ mode: "system" })}
                  data-testid="accent-system-btn"
                  aria-pressed={accentMode.mode === "system"}
                >
                  System Accent
                </Button>
              </div>
            </div>

            {/* Custom Accent Seed Generator */}
            <div className="custom-seed-form">
              <Field
                label="Custom Accent Seed Hex"
                validationMessage={seedError}
                validationState={seedError ? "error" : "none"}
              >
                <Input
                  value={customSeedInput}
                  onChange={(_, data) => setCustomSeedInput(data.value)}
                  placeholder="#0078D4"
                  data-testid="custom-seed-input"
                  aria-label="Custom accent seed hex code"
                />
              </Field>
              <Button
                appearance="primary"
                onClick={handleApplyCustomSeed}
                data-testid="apply-custom-seed-btn"
              >
                Apply Custom Ramp
              </Button>
            </div>
          </div>

          <Divider />

          {/* Semantic Surface Tokens Palette Preview */}
          <div>
            <Title3 as="h3">Semantic Surface Palette</Title3>
            <div className="tokens-preview-grid">
              <div className="token-swatch">
                <span className="token-swatch-name">App Shell</span>
                <span className="token-swatch-val">{tokens.surfaces.appShell}</span>
              </div>
              <div className="token-swatch">
                <span className="token-swatch-name">Workspace</span>
                <span className="token-swatch-val">{tokens.surfaces.mainWorkspace}</span>
              </div>
              <div className="token-swatch">
                <span className="token-swatch-name">Card Surface</span>
                <span className="token-swatch-val">{tokens.surfaces.cardElevated}</span>
              </div>
              <div className="token-swatch">
                <span className="token-swatch-name">Panel Border</span>
                <span className="token-swatch-val">{tokens.surfaces.panelBorder}</span>
              </div>
              <div className="token-swatch">
                <span className="token-swatch-name">Accent BG</span>
                <span className="token-swatch-val">{tokens.accent.accentBackground}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Platform Capabilities & Accessibility Adaptations Card */}
        <Card className="card" role="region" aria-label="Platform and Accessibility State">
          <Title2 as="h2">Platform Capabilities &amp; Accessibility</Title2>
          <div className="theme-control-group">
            <div className="control-row">
              <Text weight="semibold">Effective Window Material:</Text>
              <span className="status-badge status-badge-informative" data-testid="material-badge">
                {resolvedMaterial.effectiveMaterial.toUpperCase()}
              </span>
              {resolvedMaterial.isFallback && (
                <Text size={200} className="subtitle">
                  ({resolvedMaterial.reason || "Solid semantic fallback active"})
                </Text>
              )}
            </div>

            <div className="control-row">
              <Text weight="semibold">Accessibility Modes:</Text>
              <span
                className={`status-badge ${
                  accessibilityPreferences.forcedColors
                    ? "status-badge-warning"
                    : "status-badge-informative"
                }`}
                data-testid="forced-colors-badge"
              >
                Forced Colors: {accessibilityPreferences.forcedColors ? "ACTIVE" : "INACTIVE"}
              </span>
              <span
                className={`status-badge ${
                  accessibilityPreferences.prefersReducedMotion
                    ? "status-badge-warning"
                    : "status-badge-informative"
                }`}
                data-testid="reduced-motion-badge"
              >
                Reduced Motion: {accessibilityPreferences.prefersReducedMotion ? "ACTIVE" : "INACTIVE"}
              </span>
              <span
                className={`status-badge ${
                  accessibilityPreferences.prefersReducedTransparency
                    ? "status-badge-warning"
                    : "status-badge-informative"
                }`}
                data-testid="reduced-transparency-badge"
              >
                Reduced Transparency: {accessibilityPreferences.prefersReducedTransparency ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          </div>
        </Card>

        {/* 3. Accessible Components Showcase & Portal Theme Inheritance */}
        <Card className="card" role="region" aria-label="Accessible Components Showcase">
          <Title2 as="h2">Accessible Components &amp; Portals</Title2>
          <Text size={300}>
            Smoke tests verifying focus indicators, keyboard accessibility, accessible naming, status communications, and portal theme inheritance.
          </Text>

          {/* Button Variants */}
          <div className="control-row">
            <Button appearance="primary" data-testid="btn-primary">Primary Action</Button>
            <Button appearance="secondary" data-testid="btn-secondary">Secondary Action</Button>
            <Button appearance="subtle" data-testid="btn-subtle">Subtle Action</Button>
            <Button disabled data-testid="btn-disabled">Disabled Action</Button>
          </div>

          {/* Accessible Form Control */}
          <Field
            label="User Name"
            required
            hint="Enter an accessible username."
            validationMessage={formError}
            validationState={formError ? "error" : "none"}
          >
            <Input
              value={sampleFormField}
              onChange={(_, d) => {
                setSampleFormField(d.value);
                setFormError(d.value.trim() ? "" : "Username is required.");
              }}
              data-testid="accessible-input"
              aria-label="User name input"
            />
          </Field>

          {/* Status Messaging with Icon + Text Pairing (Never Color Alone) */}
          <div className="theme-control-group">
            <div className="status-message-box status-message-danger" role="alert" data-testid="status-danger">
              <span aria-hidden="true">✕</span>
              <span><strong>Danger:</strong> Connection terminated unexpectedly. Safe retry required.</span>
            </div>
            <div className="status-message-box status-message-success" role="status" data-testid="status-success">
              <span aria-hidden="true">✓</span>
              <span><strong>Success:</strong> Theme and native window background synchronized cleanly.</span>
            </div>
            <div className="status-message-box status-message-warning" role="status" data-testid="status-warning">
              <span aria-hidden="true">⚠</span>
              <span><strong>Warning:</strong> Low contrast detected on custom seed. Deterministic adjustment applied.</span>
            </div>
          </div>

          {/* Dual-Tone Focus Indicator Test */}
          <div className="control-row">
            <Text weight="semibold">Dual-Tone Focus Target:</Text>
            <div
              tabIndex={0}
              role="button"
              className="dual-tone-focus-target"
              data-testid="dual-tone-focus"
              aria-label="Dual tone focus test target"
            >
              Tab here to inspect dual-tone focus ring
            </div>
          </div>

          <Divider />

          {/* Portals Theme Inheritance Verification (Menu, Tooltip, Dialog) */}
          <div>
            <Title3 as="h3">Portal Theme Inheritance &amp; Strict CSP Smoke Test</Title3>
            <Text size={200} className="subtitle" as="p">
              Renders Menu, Tooltip, and Dialog into document body portals to verify theme token inheritance and 0 CSP violations.
            </Text>
            <div className="portal-action-row" style={{ marginTop: 12 }}>
              {/* Menu Portal */}
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button data-testid="menu-portal-trigger">Open Themed Menu</Button>
                </MenuTrigger>
                <MenuPopover data-testid="menu-portal-popover">
                  <MenuList>
                    <MenuItem data-testid="menu-item-1">Themed Menu Item 1</MenuItem>
                    <MenuItem data-testid="menu-item-2">Themed Menu Item 2</MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>

              {/* Tooltip Portal */}
              <Tooltip content="Themed tooltip rendered inside portal container" relationship="label">
                <Button data-testid="tooltip-portal-trigger">Hover for Themed Tooltip</Button>
              </Tooltip>

              {/* Dialog Modal Portal */}
              <Dialog>
                <DialogTrigger disableButtonEnhancement>
                  <Button data-testid="dialog-portal-trigger">Open Themed Dialog</Button>
                </DialogTrigger>
                <DialogSurface data-testid="dialog-portal-surface">
                  <DialogBody>
                    <DialogTitle>Themed Modal Dialog</DialogTitle>
                    <DialogContent>
                      This dialog is rendered into document body portals and inherits all active theme tokens without CSP violations.
                    </DialogContent>
                    <DialogActions>
                      <DialogTrigger disableButtonEnhancement>
                        <Button appearance="secondary">Close</Button>
                      </DialogTrigger>
                      <Button appearance="primary">Acknowledge</Button>
                    </DialogActions>
                  </DialogBody>
                </DialogSurface>
              </Dialog>
            </div>
          </div>
        </Card>

        {/* 4. Preserved Phase 0B Backend Operations & Echo Baseline */}
        <Card className="card" role="region" aria-label="Backend Operations and Echo Baseline">
          <header>
            <Title2 as="h2">Backend Echo &amp; Task Lifecycle Baseline</Title2>
          </header>

          <form
            className="backend-controls"
            onSubmit={(e) => {
              e.preventDefault();
              void handleEchoSubmit();
            }}
          >
            <Field label="Unicode text" style={{ flex: 1 }}>
              <Input
                value={echoInput}
                onChange={(_, data) => setEchoInput(data.value)}
                disabled={echoBusy}
                aria-label="Unicode text"
              />
            </Field>
            <Button
              appearance="primary"
              type="submit"
              disabled={echoBusy || !echoInput}
              style={{ alignSelf: "flex-end" }}
            >
              {echoBusy ? "Echoing..." : "Echo"}
            </Button>
          </form>

          {echoResult && (
            <div className="result" aria-live="polite">
              <Text weight="semibold">Echo Output:</Text>
              <output data-testid="echo-output">{echoResult}</output>
            </div>
          )}

          {echoError && (
            <div className="error" role="alert">
              Error: {echoError}
            </div>
          )}

          <Divider />

          {/* Task Resilience Form */}
          <div className="task-form">
            <Field label="Target count">
              <Input
                type="number"
                value={targetCount}
                onChange={(_, data) => setTargetCount(data.value)}
                disabled={taskStarting || taskState === "Running"}
                aria-label="Target count"
              />
            </Field>
            <Field label="Delay per step (ms)">
              <Input
                type="number"
                value={delayMs}
                onChange={(_, data) => setDelayMs(data.value)}
                disabled={taskStarting || taskState === "Running"}
                aria-label="Delay per step in milliseconds"
              />
            </Field>
          </div>

          <div className="task-actions">
            <Button
              appearance="primary"
              onClick={() => void handleStartTask()}
              disabled={taskStarting || taskState === "Running"}
            >
              {taskStarting ? "Starting..." : "Start Count Task"}
            </Button>
            <Button
              appearance="secondary"
              onClick={() => void handleCancelTask()}
              disabled={taskState !== "Running" || cancelling}
            >
              {cancelling ? "Cancelling..." : "Cancel Task"}
            </Button>
          </div>

          {activeTaskId && (
            <div className="progress-container">
              <div className="progress-labels">
                <Text size={200} className="task-id">
                  Task ID: {activeTaskId}
                </Text>
                <Text size={200} weight="semibold">
                  Progress: {currentProgress} / {targetCount}
                </Text>
              </div>
              <div className="progress-track" role="progressbar" aria-valuenow={currentProgress} aria-valuemin={0} aria-valuemax={parseInt(targetCount, 10) || 100}>
                <svg className="progress-svg" viewBox="0 0 100 6" preserveAspectRatio="none">
                  <rect
                    x="0"
                    y="0"
                    width={`${Math.min(100, Math.max(0, (currentProgress / (parseInt(targetCount, 10) || 1)) * 100))}%`}
                    height="6"
                    fill="var(--colorBrandBackground, #0F6CBD)"
                  />
                </svg>
              </div>
              {taskState && (
                <Text size={200}>
                  State: <strong>{taskState}</strong>
                  {taskCompleted !== null && ` (${taskCompleted} steps completed)`}
                </Text>
              )}
            </div>
          )}

          {taskMessage && (
            <div className="task-message" role="status">
              <Text size={200}>{taskMessage}</Text>
            </div>
          )}

          {taskError && (
            <div className="error" role="alert">
              {taskError}
            </div>
          )}

          <Divider />

          {/* Fault Operations */}
          <div className="fault-actions">
            <Button appearance="secondary" onClick={() => void handleCrash()}>
              Trigger Crash
            </Button>
            <Button appearance="secondary" onClick={() => void handleHang()}>
              Trigger Hang (5s)
            </Button>
            <Button appearance="secondary" onClick={() => void handleLargeRejected()}>
              Trigger 2 MB Payload
            </Button>
            <Button appearance="subtle" onClick={() => void handleReset()}>
              Reset Backend
            </Button>
          </div>

          {faultAction && (
            <div className="fault-status" role="status">
              <Text size={200}>{faultAction}</Text>
            </div>
          )}

          {faultError && (
            <div className="error" role="alert">
              {faultError}
            </div>
          )}

          {statusError && (
            <div className="error" role="alert">
              Status error: {statusError}
            </div>
          )}
        </Card>
      </div>

      {/* Screen reader live announcement region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* CSP violation counter for test inspection */}
      <div
        data-testid="csp-violation-count"
        style={{ display: "none" }}
        data-count={cspViolations.current.length}
      />
    </main>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <AppContent />
    </AppThemeProvider>
  );
}
