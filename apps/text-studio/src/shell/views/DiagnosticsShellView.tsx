import React, { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  shorthands,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Title1,
  Title2,
  Title3,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  ArrowReset20Regular,
  ArrowSync20Regular,
  CheckmarkCircle20Regular,
  Dismiss20Regular,
  DocumentArrowDown20Regular,
  Eye20Regular,
  HeartPulse20Regular,
  ShieldCheckmark20Regular,
  Warning20Regular,
  Wrench20Regular,
} from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { useDiagnosticsStore } from "../state/useDiagnosticsStore";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXXL),
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalL,
  },
  headerTitleContainer: {
    display: "flex",
    flexDirection: "column",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
    marginBottom: tokens.spacingVerticalXXL,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
    ...shorthands.padding(tokens.spacingVerticalL),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    ...shorthands.gap(tokens.spacingHorizontalM, tokens.spacingVerticalM),
  },
  statusItem: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginTop: tokens.spacingVerticalS,
  },
  errorList: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  errorItem: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderLeft("4px", "solid", tokens.colorPaletteRedBorderActive),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  repairGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    ...shorthands.gap(tokens.spacingHorizontalM, tokens.spacingVerticalM),
  },
  repairCard: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  manifestBox: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
    ...shorthands.padding(tokens.spacingVerticalM),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  manifestTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
});

export const DiagnosticsShellView: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();

  const {
    summary,
    recentErrors,
    preview,
    lastExportManifest,
    isLoading,
    isExporting,
    isRecovering,
    isRepairing,
    error,
    successMessage,
    loadDiagnostics,
    loadPreview,
    exportDiagnostics,
    recoverBackend,
    repairSettingsSection,
    clearMessages,
  } = useDiagnosticsStore();

  const [confirmRepairSection, setConfirmRepairSection] = useState<string | null>(null);

  useEffect(() => {
    void loadDiagnostics();
    void loadPreview();
  }, [loadDiagnostics, loadPreview]);

  const handleBack = () => {
    navigate(-1);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <main className={styles.container} aria-label="Diagnostics and Recovery">
      {/* Header */}
      <header className={styles.header}>
        <Button
          appearance="subtle"
          icon={<ArrowLeft20Regular />}
          onClick={handleBack}
          aria-label="Navigate back"
        />
        <div className={styles.headerTitleContainer}>
          <Title1 as="h1">Diagnostics &amp; System Recovery</Title1>
          <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
            Inspect system health, review sanitized error logs, export diagnostics, and safely recover components.
          </Text>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>
            <MessageBarTitle>Error</MessageBarTitle>
            {error}
          </MessageBarBody>
          <Button
            appearance="transparent"
            icon={<Dismiss20Regular />}
            onClick={clearMessages}
            aria-label="Dismiss error"
          />
        </MessageBar>
      )}

      {successMessage && (
        <MessageBar intent="success" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>
            <MessageBarTitle>Success</MessageBarTitle>
            {successMessage}
          </MessageBarBody>
          <Button
            appearance="transparent"
            icon={<Dismiss20Regular />}
            onClick={clearMessages}
            aria-label="Dismiss success message"
          />
        </MessageBar>
      )}

      {/* 1. System & Backend Health Card */}
      <section className={styles.section} aria-labelledby="section-backend-health">
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <HeartPulse20Regular />
              <Title2 as="h2" id="section-backend-health">Backend Health &amp; Recovery</Title2>
            </div>
            <Button
              appearance="subtle"
              icon={<ArrowSync20Regular />}
              onClick={() => {
                void loadDiagnostics();
                void loadPreview();
              }}
              disabled={isLoading}
              aria-label="Refresh status"
            >
              Refresh
            </Button>
          </div>
          <Divider />

          {summary ? (
            <>
              <div className={styles.statusGrid}>
                <div className={styles.statusItem}>
                  <Text size={200} weight="semibold">Lifecycle State</Text>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Badge
                      appearance="filled"
                      color={
                        summary.backendStatus.state === "ready"
                          ? "success"
                          : summary.backendStatus.state === "faulted"
                          ? "danger"
                          : "warning"
                      }
                    >
                      {summary.backendStatus.state.toUpperCase()}
                    </Badge>
                    <Text size={300}>{summary.backendStatus.ready ? "Ready" : "Not Ready"}</Text>
                  </div>
                </div>

                <div className={styles.statusItem}>
                  <Text size={200} weight="semibold">Backend Version</Text>
                  <Text size={300}>{summary.backendStatus.backendVersion || "Unknown"}</Text>
                </div>

                <div className={styles.statusItem}>
                  <Text size={200} weight="semibold">Circuit Breaker</Text>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Badge
                      appearance="filled"
                      color={summary.backendStatus.circuitOpen ? "danger" : "success"}
                    >
                      {summary.backendStatus.circuitOpen ? "CIRCUIT OPEN" : "NORMAL"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className={styles.actionsRow}>
                <Button
                  appearance="primary"
                  icon={isRecovering ? <Spinner size="tiny" /> : <ArrowReset20Regular />}
                  onClick={() => void recoverBackend()}
                  disabled={isRecovering}
                  aria-label="Recover backend process"
                >
                  {isRecovering ? "Recovering..." : "Recover Backend"}
                </Button>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  Restores sidecar process readiness. Circuit breaker limits apply. Interrupted tasks are marked Interrupted and will not be replayed automatically.
                </Text>
              </div>
            </>
          ) : (
            <Spinner label="Loading health status..." />
          )}
        </Card>
      </section>

      {/* 2. Storage & Retention Card */}
      <section className={styles.section} aria-labelledby="section-retention">
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <ShieldCheckmark20Regular />
              <Title2 as="h2" id="section-retention">Storage &amp; Retention Policy</Title2>
            </div>
            <Badge appearance="tint" color="informative">
              Privacy Enforced
            </Badge>
          </div>
          <Divider />

          {summary && (
            <div className={styles.statusGrid}>
              <div className={styles.statusItem}>
                <Text size={200} weight="semibold">In-Memory Records</Text>
                <Text size={300}>
                  {summary.totalRecords} / {summary.ringBufferCapacity} records
                </Text>
              </div>
              <div className={styles.statusItem}>
                <Text size={200} weight="semibold">Log Storage on Disk</Text>
                <Text size={300}>
                  {formatBytes(summary.logFileBytes)} / {formatBytes(summary.maxLogBytes)} max
                </Text>
              </div>
              <div className={styles.statusItem}>
                <Text size={200} weight="semibold">Retention Bound</Text>
                <Text size={300}>{summary.retentionPolicy}</Text>
              </div>
            </div>
          )}

          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Sanitization guarantee: All log messages and error records strictly redact native file paths, URLs, tokens, passwords, and user document content before retention or display.
          </Text>
        </Card>
      </section>

      {/* 3. Recent Safe Errors Card */}
      <section className={styles.section} aria-labelledby="section-errors">
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Warning20Regular />
              <Title2 as="h2" id="section-errors">Recent Safe Errors</Title2>
            </div>
            <Badge appearance="tint" color={recentErrors.length > 0 ? "warning" : "success"}>
              {recentErrors.length} Recorded
            </Badge>
          </div>
          <Divider />

          {recentErrors.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 0" }}>
              <CheckmarkCircle20Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
              <Text size={300}>No recent errors recorded. System is operating normally.</Text>
            </div>
          ) : (
            <div className={styles.errorList}>
              {recentErrors.map((err, idx) => (
                <div key={`${err.code}-${idx}`} className={styles.errorItem}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text size={300} weight="semibold">{err.code}</Text>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{err.timestamp}</Text>
                  </div>
                  <Text size={300}>{err.message}</Text>
                  {err.userRecoveryHint && (
                    <Text size={200} style={{ color: tokens.colorPaletteBlueForeground2 }}>
                      Hint: {err.userRecoveryHint}
                    </Text>
                  )}
                  {err.traceId && (
                    <Text size={100} style={{ color: tokens.colorNeutralForeground4 }}>
                      Trace ID: {err.traceId}
                    </Text>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* 4. Settings Integrity & Targeted Repair Card */}
      <section className={styles.section} aria-labelledby="section-settings-repair">
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Wrench20Regular />
              <Title2 as="h2" id="section-settings-repair">Settings Integrity &amp; Repair</Title2>
            </div>
            {summary?.settingsStatus && (
              <Badge
                appearance="filled"
                color={summary.settingsStatus.state === "healthy" ? "success" : "warning"}
              >
                {summary.settingsStatus.state.toUpperCase()}
              </Badge>
            )}
          </div>
          <Divider />

          <Text size={300}>
            Targeted repair resets a single settings section to its default values without modifying or corrupting other valid sections.
          </Text>

          <div className={styles.repairGrid}>
            {[
              { id: "appearance", name: "Appearance", desc: "Theme mode, accent color, density, and window material." },
              { id: "layout", name: "Layout & Shell", desc: "Sidebar and inspector widths, panel ratios, and open states." },
              { id: "documentAnalysis", name: "Document Analysis", desc: "Maximum top terms and analysis preferences." },
              { id: "textUtility", name: "Text Utility", desc: "Default transformation mode." },
            ].map((section) => (
              <div key={section.id} className={styles.repairCard}>
                <Text size={300} weight="semibold">{section.name}</Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{section.desc}</Text>
                <div style={{ marginTop: "auto", paddingTop: "8px" }}>
                  {confirmRepairSection === section.id ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <Button
                        appearance="primary"
                        size="small"
                        disabled={isRepairing}
                        onClick={() => {
                          setConfirmRepairSection(null);
                          void repairSettingsSection(section.id);
                        }}
                      >
                        Confirm Reset
                      </Button>
                      <Button
                        appearance="subtle"
                        size="small"
                        onClick={() => setConfirmRepairSection(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      appearance="secondary"
                      size="small"
                      disabled={isRepairing}
                      onClick={() => setConfirmRepairSection(section.id)}
                    >
                      Repair Section
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* 5. User-Controlled Diagnostics Export Card */}
      <section className={styles.section} aria-labelledby="section-export">
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <DocumentArrowDown20Regular />
              <Title2 as="h2" id="section-export">Diagnostics Bundle Export</Title2>
            </div>
            {preview && (
              <Badge
                appearance="filled"
                color={preview.redactionVerified ? "success" : "danger"}
              >
                {preview.redactionVerified ? "Redaction Verified: Pass" : "Redaction Check Failed"}
              </Badge>
            )}
          </div>
          <Divider />

          <Text size={300}>
            Diagnostics bundles contain only allowlisted safe files and structured logs. Preview the contents below before exporting to a destination of your choice.
          </Text>

          {/* Preview Table */}
          {preview ? (
            <div className={styles.manifestBox}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Title3 as="h3">Export Preview ({preview.entryCount} Files, ~{formatBytes(preview.totalEstimatedBytes)})</Title3>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  Snapshot Time: {preview.generatedAt}
                </Text>
              </div>

              <Table className={styles.manifestTable} aria-label="Export bundle files preview">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>File Name</TableHeaderCell>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Record Count</TableHeaderCell>
                    <TableHeaderCell>Estimated Size</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.entries.map((entry) => (
                    <TableRow key={entry.name}>
                      <TableCell><Text weight="semibold">{entry.name}</Text></TableCell>
                      <TableCell><Text size={200}>{entry.role}</Text></TableCell>
                      <TableCell><Text size={200}>{entry.recordCount}</Text></TableCell>
                      <TableCell><Text size={200}>{formatBytes(entry.estimatedBytes)}</Text></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Spinner label="Loading export preview..." />
          )}

          <div className={styles.actionsRow}>
            <Button
              appearance="primary"
              icon={isExporting ? <Spinner size="tiny" /> : <DocumentArrowDown20Regular />}
              onClick={() => void exportDiagnostics()}
              disabled={isExporting || (preview ? !preview.redactionVerified : false)}
              aria-label="Export diagnostics bundle to ZIP"
            >
              {isExporting ? "Exporting..." : "Export Diagnostics..."}
            </Button>
            <Button
              appearance="subtle"
              icon={<Eye20Regular />}
              onClick={() => void loadPreview()}
              disabled={isExporting}
            >
              Update Preview
            </Button>
          </div>

          {lastExportManifest && (
            <div className={styles.manifestBox} style={{ marginTop: tokens.spacingVerticalM }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckmarkCircle20Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
                <Title3 as="h3">Last Export Manifest (Version {lastExportManifest.manifestVersion})</Title3>
              </div>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                Created At: {lastExportManifest.createdAt} | App: {lastExportManifest.appVersion} | Target: {lastExportManifest.targetOs}-{lastExportManifest.targetArch}
              </Text>
              <Table className={styles.manifestTable} aria-label="Exported manifest files">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>File</TableHeaderCell>
                    <TableHeaderCell>Size</TableHeaderCell>
                    <TableHeaderCell>SHA-256 Digest</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastExportManifest.entries.map((entry) => (
                    <TableRow key={entry.name}>
                      <TableCell><Text weight="semibold">{entry.name}</Text></TableCell>
                      <TableCell><Text size={200}>{formatBytes(entry.sizeBytes)}</Text></TableCell>
                      <TableCell><Text size={100} font="monospace">{entry.sha256.substring(0, 16)}...</Text></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </section>
    </main>
  );
};
