import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Field,
  FluentProvider,
  Input,
  Spinner,
  Text,
  Title1,
  Title2,
  webDarkTheme,
  webLightTheme,
} from "@fluentui/react-components";
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
import "./app.css";

const RUNTIME_PROBE_TEXT = "Hello — مرحبا — こんにちは 👋";

function preferredTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? webDarkTheme
    : webLightTheme;
}

export default function App() {
  // Backend Status
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [statusError, setStatusError] = useState("");

  // Echo Baseline
  const [echoInput, setEchoInput] = useState("Hello — مرحبا — こんにちは 👋");
  const [echoResult, setEchoResult] = useState("");
  const [echoError, setEchoError] = useState("");
  const [echoBusy, setEchoBusy] = useState(false);

  // Task Resilience (spike.count)
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

  // Fault Operations
  const [faultAction, setFaultAction] = useState("");
  const [faultError, setFaultError] = useState("");

  // Probe & CSP
  const runtimeProbeStarted = useRef(false);
  const cspViolations = useRef<string[]>([]);
  const lastProgressAnnouncement = useRef(0);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

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

          // Coalesce screen reader announcements (at most once every 1 second)
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
    if (!activeTaskId) {
      return;
    }
    setCancelling(true);
    setLiveAnnouncement("Cancellation requested");
    try {
      const ack = await cancelTask(activeTaskId);
      setTaskMessage(`Cancellation acknowledged: status ${ack.status}`);
      if (ack.status === "cancelling") {
        setTaskState("Cancelling");
      }
    } catch (reason) {
      const err = toSafeError(reason);
      setTaskError(`${err.code}: ${err.message} [trace: ${err.traceId}]`);
    }
  }

  async function handleResetBackend() {
    setFaultAction("Resetting backend…");
    setFaultError("");
    try {
      const updated = await resetBackend();
      setStatus(updated);
      setLiveAnnouncement("Backend reset successful");
      setFaultAction("Backend reset completed.");
    } catch (reason) {
      const err = toSafeError(reason);
      setFaultError(`${err.code}: ${err.message} [trace: ${err.traceId}]`);
      setFaultAction("");
    }
  }

  async function handleTriggerCrash() {
    setFaultAction("Triggering deliberate crash…");
    setFaultError("");
    try {
      await triggerCrash();
    } catch (reason) {
      const err = toSafeError(reason);
      setFaultError(`Observed crash: ${err.code} - ${err.message}`);
    } finally {
      setFaultAction("");
      await refreshStatus();
    }
  }

  async function handleTriggerHang() {
    setFaultAction("Triggering deliberate hang (waiting for 2s escalation)…");
    setFaultError("");
    try {
      await triggerHang();
    } catch (reason) {
      const err = toSafeError(reason);
      setFaultError(`Observed hang escalation: ${err.code} - ${err.message}`);
    } finally {
      setFaultAction("");
      await refreshStatus();
    }
  }

  async function handleTriggerOversized() {
    setFaultAction("Triggering oversized payload rejection…");
    setFaultError("");
    try {
      await triggerLargeRejected();
    } catch (reason) {
      const err = toSafeError(reason);
      setFaultError(`Observed rejection: ${err.code} - ${err.message}`);
    } finally {
      setFaultAction("");
      await refreshStatus();
    }
  }

  // Native runtime automated verification probe
  useEffect(() => {
    if (runtimeProbeStarted.current) {
      return;
    }
    runtimeProbeStarted.current = true;

    void (async () => {
      try {
        const probe = await getRuntimeProbeConfig();
        if (!probe.enabled) {
          return;
        }

        const initialStatus = await getBackendStatus();
        let unicodeResult = "";
        let safeError = "";

        setEchoInput(RUNTIME_PROBE_TEXT);
        if (initialStatus.ready) {
          const response = await echoText(RUNTIME_PROBE_TEXT);
          unicodeResult = response.text;
          setEchoResult(response.text);
        }

        try {
          await echoText("x".repeat(262_145));
        } catch (reason) {
          const parsed = toSafeError(reason);
          safeError = `${parsed.code}: ${parsed.message}`;
        }

        // Verify count completion in probe
        let countSuccess: boolean;
        try {
          const tid = await startCountTask(3, 10);
          await new Promise((r) => setTimeout(r, 200));
          countSuccess = Boolean(tid);
        } catch {
          countSuccess = false;
        }

        await new Promise((resolve) => {
          if (typeof requestAnimationFrame !== "undefined") {
            requestAnimationFrame(resolve);
          }
          setTimeout(resolve, 200);
        });

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
        });
      } catch (err) {
        console.error("Probe error:", err);
      }
    })();
  }, []);

  const isReady = status?.ready ?? false;
  const stateLower = status?.state?.toLowerCase() ?? "";
  const isBusy = stateLower === "busy" || taskState === "Running" || taskStarting;

  return (
    <FluentProvider theme={preferredTheme()}>
      <main className="app">
        <div className="card-container">
          {/* Header & Backend Lifecycle Status Card */}
          <Card className="card">
            <header>
              <div>
                <Title1 as="h1" id="main-title">Prime Shell Lifecycle &amp; Resilience</Title1>
                <Text size={200} className="subtitle">
                  Work Package GFD-P0B-WP02 Spike UI
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

            <div className="backend-controls">
              <Button
                id="btn-reset-backend"
                appearance="outline"
                onClick={() => void handleResetBackend()}
                disabled={checking}
                aria-label="Reset Backend"
              >
                Reset Backend
              </Button>
              <Button
                id="btn-refresh-status"
                appearance="subtle"
                onClick={() => void refreshStatus()}
                disabled={checking}
                aria-label="Refresh Status"
              >
                Refresh Status
              </Button>
            </div>

            {statusError && (
              <Text role="alert" className="error">
                {statusError}
              </Text>
            )}
          </Card>

          {/* Task Resilience (spike.count) Card */}
          <Card className="card">
            <header>
              <Title2>Long-Running Task Resilience</Title2>
              {taskState && (
                <span
                  id="task-state-badge"
                  className={`status-badge status-badge-${
                    taskState === "Succeeded"
                      ? "success"
                      : taskState === "Running"
                        ? "informative"
                        : taskState === "Cancelled" || taskState === "Cancelling"
                          ? "warning"
                          : "danger"
                  }`}
                >
                  {taskState}
                </span>
              )}
            </header>

            <div className="task-form">
              <Field label="Target count">
                <Input
                  id="count-target"
                  type="number"
                  value={targetCount}
                  onChange={(_, data) => setTargetCount(data.value)}
                  disabled={isBusy}
                  aria-label="Target count"
                />
              </Field>

              <Field label="Step delay (ms)">
                <Input
                  id="count-delay"
                  type="number"
                  value={delayMs}
                  onChange={(_, data) => setDelayMs(data.value)}
                  disabled={isBusy}
                  aria-label="Step delay in milliseconds"
                />
              </Field>
            </div>

            <div className="task-actions">
              <Button
                id="btn-start-count"
                appearance="primary"
                onClick={() => void handleStartTask()}
                disabled={!isReady || isBusy}
                aria-label="Start Count Task"
              >
                {taskStarting ? "Starting…" : "Start Count Task"}
              </Button>

              <Button
                id="btn-cancel-count"
                appearance="secondary"
                onClick={() => void handleCancelTask()}
                disabled={taskState !== "Running" || cancelling}
                aria-label="Cancel Task"
              >
                {cancelling ? "Cancelling…" : "Cancel Task"}
              </Button>
            </div>

            {/* Accessible Progress Bar & Values */}
            {(taskState === "Running" || taskCompleted !== null) && (
              <div
                id="task-progressbar"
                className="progress-container"
                role="progressbar"
                aria-valuenow={currentProgress}
                aria-valuemin={0}
                aria-valuemax={parseInt(targetCount, 10) || 100}
                aria-valuetext={`${currentProgress} of ${targetCount}`}
              >
                <div className="progress-labels">
                  <Text id="progress-text" size={200}>
                    Progress: {currentProgress} / {targetCount}
                  </Text>
                  {activeTaskId && (
                    <Text id="task-id-text" size={200} className="task-id">
                      ID: {activeTaskId}
                    </Text>
                  )}
                </div>
                {(() => {
                  const target = parseInt(targetCount, 10) || 1;
                  const percent = Math.min(
                    100,
                    Math.max(0, (currentProgress / target) * 100),
                  );
                  return (
                    <div className="progress-track">
                      <svg
                        className="progress-svg"
                        viewBox="0 0 100 6"
                        preserveAspectRatio="none"
                      >
                        <rect
                          width={`${percent}%`}
                          height="6"
                          fill="#0078d4"
                          rx="3"
                        />
                      </svg>
                    </div>
                  );
                })()}
              </div>
            )}

            {taskMessage && (
              <div id="task-message" className="task-message" aria-live="polite">
                <Text weight="semibold">{taskMessage}</Text>
              </div>
            )}

            {taskError && (
              <Text id="task-error" role="alert" className="error">
                {taskError}
              </Text>
            )}
          </Card>

          {/* Fault Injection & Recovery Card */}
          <Card className="card">
            <header>
              <Title2>Fault Injection &amp; Recovery</Title2>
            </header>
            <Text size={200}>
              Exercise deliberate failure modes to test circuit breaker and restart bounds:
            </Text>

            <div className="fault-actions">
              <Button
                id="btn-trigger-crash"
                appearance="outline"
                onClick={() => void handleTriggerCrash()}
                disabled={isBusy}
                aria-label="Trigger Crash"
              >
                Trigger Crash
              </Button>

              <Button
                id="btn-trigger-hang"
                appearance="outline"
                onClick={() => void handleTriggerHang()}
                disabled={isBusy}
                aria-label="Trigger Hang"
              >
                Trigger Hang
              </Button>

              <Button
                id="btn-trigger-oversized"
                appearance="outline"
                onClick={() => void handleTriggerOversized()}
                disabled={isBusy}
                aria-label="Trigger Oversized"
              >
                Trigger Oversized
              </Button>
            </div>

            {faultAction && (
              <Text id="fault-status" size={200} className="fault-status">
                {faultAction}
              </Text>
            )}

            {faultError && (
              <Text id="fault-error" role="alert" className="error">
                {faultError}
              </Text>
            )}
          </Card>

          {/* Regression Baseline Card (spike.echo) */}
          <Card className="card">
            <header>
              <Title2>Packaged Unicode Echo</Title2>
              <div className="status" aria-live="polite">
                <Text id="echo-status-text" weight="semibold">
                  Echo Status: {isReady ? "Ready" : "Unavailable"}
                </Text>
              </div>
            </header>

            <Field label="Unicode text">
              <Input
                id="echo-input"
                value={echoInput}
                onChange={(_, data) => setEchoInput(data.value)}
                disabled={!isReady || echoBusy}
                aria-label="Unicode text"
              />
            </Field>

            <Button
              id="btn-echo"
              appearance="primary"
              onClick={() => void handleEchoSubmit()}
              disabled={!isReady || echoBusy}
              aria-label="Echo"
            >
              {echoBusy ? "Echoing…" : "Echo"}
            </Button>

            {echoResult && (
              <section className="result" aria-live="polite">
                <Text weight="semibold">Result</Text>
                <output id="echo-result">{echoResult}</output>
              </section>
            )}

            {echoError && (
              <Text id="echo-error" role="alert" className="error">
                {echoError}
              </Text>
            )}
          </Card>
        </div>

        {/* Global Live Region for screen readers */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {liveAnnouncement}
        </div>
      </main>
    </FluentProvider>
  );
}
