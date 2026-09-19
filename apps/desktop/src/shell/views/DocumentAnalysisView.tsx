import React, { useEffect, useMemo, useRef } from "react";
import {
  Badge,
  Button,
  Input,
  makeStyles,
  ProgressBar,
  Text,
  Title1,
  Title2,
  Title3,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import {
  ArrowClockwise20Regular,
  ArrowLeft16Regular,
  ArrowRight16Regular,
  Dismiss20Regular,
  DocumentAdd24Regular,
  DocumentBulletList24Regular,
  ErrorCircle20Filled,
  Play24Regular,
  Search20Regular,
  Stop24Regular,
  TextFont24Regular,
  TextWordCount24Regular,
  Timer24Regular,
} from "@fluentui/react-icons";
import { listenToTaskEvents } from "../../backend";
import { useDocumentAnalysisStore } from "../state/useDocumentAnalysisStore";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "24px",
    width: "100%",
    maxWidth: "1100px",
    margin: "0 auto",
    boxSizing: "border-box",
    minHeight: 0,
    overflowY: "auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
  },
  headerTitleGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  metaCard: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },
  metaItem: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
  },
  statCard: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "14px",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow2,
  },
  statHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: tokens.colorNeutralForeground3,
  },
  statValue: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorCompoundBrandForeground1,
  },
  statLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  searchInput: {
    flexGrow: 1,
    minWidth: "220px",
  },
  previewCard: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    minHeight: "220px",
    maxHeight: "360px",
  },
  previewContent: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowY: "auto",
    padding: "12px",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
    flexGrow: 1,
  },
  highlight: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    color: tokens.colorNeutralForeground1,
    borderRadius: "2px",
    padding: "0 2px",
  },
  highlightActive: {
    backgroundColor: tokens.colorPaletteDarkOrangeBackground2,
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightBold,
    borderRadius: "2px",
    padding: "0 2px",
    outline: `2px solid ${tokens.colorCompoundBrandStroke}`,
  },
  termsCard: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  termsList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  termRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  termName: {
    width: "120px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: tokens.fontWeightMedium,
    fontSize: tokens.fontSizeBase200,
  },
  termBarContainer: {
    flexGrow: 1,
    height: "12px",
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: "6px",
    overflow: "hidden",
  },
  termBar: {
    height: "100%",
    backgroundColor: tokens.colorCompoundBrandBackground,
    borderRadius: "6px",
  },
  termCount: {
    width: "40px",
    textAlign: "right",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    gap: "16px",
    textAlign: "center",
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusLarge,
    border: `2px dashed ${tokens.colorNeutralStroke2}`,
  },
  taskBanner: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "14px 16px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  taskBannerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  errorBanner: {
    padding: "12px 16px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
});

export const DocumentAnalysisView: React.FC = () => {
  const styles = useStyles();

  const selectedDocument = useDocumentAnalysisStore((s) => s.selectedDocument);
  const documentContent = useDocumentAnalysisStore((s) => s.documentContent);
  const isLoadingDocument = useDocumentAnalysisStore((s) => s.isLoadingDocument);
  const documentError = useDocumentAnalysisStore((s) => s.documentError);

  const searchQuery = useDocumentAnalysisStore((s) => s.searchQuery);
  const currentMatchIndex = useDocumentAnalysisStore((s) => s.currentMatchIndex);
  const setSearchQuery = useDocumentAnalysisStore((s) => s.setSearchQuery);
  const setCurrentMatchIndex = useDocumentAnalysisStore((s) => s.setCurrentMatchIndex);

  const activeTaskId = useDocumentAnalysisStore((s) => s.activeTaskId);
  const taskStatus = useDocumentAnalysisStore((s) => s.taskStatus);
  const taskProgress = useDocumentAnalysisStore((s) => s.taskProgress);
  const taskMessage = useDocumentAnalysisStore((s) => s.taskMessage);
  const analysisError = useDocumentAnalysisStore((s) => s.analysisError);
  const metrics = useDocumentAnalysisStore((s) => s.metrics);
  const isAnalyzing = useDocumentAnalysisStore((s) => s.isAnalyzing);
  const isCancelling = useDocumentAnalysisStore((s) => s.isCancelling);

  const openDocument = useDocumentAnalysisStore((s) => s.openDocument);
  const closeDocument = useDocumentAnalysisStore((s) => s.closeDocument);
  const runAnalysis = useDocumentAnalysisStore((s) => s.runAnalysis);
  const cancelAnalysis = useDocumentAnalysisStore((s) => s.cancelAnalysis);
  const handleTaskEvent = useDocumentAnalysisStore((s) => s.handleTaskEvent);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to real-time task events from Rust backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenToTaskEvents((event) => {
      handleTaskEvent(event);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [handleTaskEvent]);

  // Compute search match positions within loaded content
  const matches = useMemo(() => {
    if (!documentContent || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const text = documentContent.toLowerCase();
    const indices: number[] = [];
    let pos = 0;
    while ((pos = text.indexOf(q, pos)) !== -1) {
      indices.push(pos);
      pos += Math.max(1, q.length);
    }
    return indices;
  }, [documentContent, searchQuery]);

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(nextIdx);
  };

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIdx);
  };

  // Safe highlighted text segmentation (0 raw HTML, 0 script injection)
  const renderedContent = useMemo(() => {
    if (!documentContent) return null;
    if (!searchQuery.trim() || matches.length === 0) {
      return documentContent;
    }

    const qLen = searchQuery.length;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((matchStart, i) => {
      if (matchStart > lastIndex) {
        elements.push(documentContent.slice(lastIndex, matchStart));
      }
      const isCurrent = i === currentMatchIndex;
      elements.push(
        <span
          key={`match-${matchStart}-${i}`}
          className={isCurrent ? styles.highlightActive : styles.highlight}
          aria-current={isCurrent ? "true" : undefined}
        >
          {documentContent.slice(matchStart, matchStart + qLen)}
        </span>,
      );
      lastIndex = matchStart + qLen;
    });

    if (lastIndex < documentContent.length) {
      elements.push(documentContent.slice(lastIndex));
    }

    return elements;
  }, [documentContent, searchQuery, matches, currentMatchIndex, styles.highlight, styles.highlightActive]);

  const maxTermCount = useMemo(() => {
    if (!metrics || metrics.topTerms.length === 0) return 1;
    return Math.max(...metrics.topTerms.map((t) => t.count), 1);
  }, [metrics]);

  return (
    <div className={styles.container} data-testid="document-analysis-view">
      {/* 1. Header */}
      <header className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <Title1 as="h1">Document Analysis</Title1>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Inspect, search, and compute deterministic text metrics for local documents.
          </Text>
        </div>

        <div className={styles.headerActions}>
          <Tooltip content="Select and open a local text document" relationship="label">
            <Button
              appearance="primary"
              icon={<DocumentAdd24Regular />}
              onClick={() => void openDocument()}
              disabled={isLoadingDocument || isAnalyzing}
              data-testid="open-document-btn"
            >
              {selectedDocument ? "Open Different..." : "Open Document"}
            </Button>
          </Tooltip>

          {selectedDocument && (
            <Tooltip content="Close active document" relationship="label">
              <Button
                appearance="subtle"
                icon={<Dismiss20Regular />}
                onClick={() => void closeDocument()}
                disabled={isAnalyzing}
                aria-label="Close document"
              />
            </Tooltip>
          )}
        </div>
      </header>

      {/* 2. Error Display */}
      {documentError && (
        <div className={styles.errorBanner} role="alert">
          <ErrorCircle20Filled />
          <Text weight="medium">{documentError}</Text>
        </div>
      )}

      {/* 3. Empty State */}
      {!selectedDocument && !isLoadingDocument && (
        <div className={styles.emptyState} data-testid="empty-document-state">
          <DocumentBulletList24Regular style={{ fontSize: "48px", color: tokens.colorNeutralForeground4 }} />
          <div>
            <Title3 as="h2">No Document Selected</Title3>
            <Text size={300} style={{ display: "block", color: tokens.colorNeutralForeground3, marginTop: "4px" }}>
              Select a UTF-8 text file (.txt, .md, .json) to preview content and analyze text statistics.
            </Text>
          </div>
          <Button
            appearance="primary"
            icon={<DocumentAdd24Regular />}
            onClick={() => void openDocument()}
          >
            Choose File
          </Button>
        </div>
      )}

      {/* 4. Active Document Loaded */}
      {selectedDocument && (
        <>
          {/* Safe Metadata Card (Strictly NO native paths) */}
          <div className={styles.metaCard} data-testid="document-metadata-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Title2 as="h2" style={{ fontSize: tokens.fontSizeBase400 }}>
                {selectedDocument.displayName}
              </Title2>
              <Badge appearance="tint" color="brand">
                {selectedDocument.mediaType || "text/plain"}
              </Badge>
            </div>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>File Size</Text>
                <Text weight="semibold">{(selectedDocument.size / 1024).toFixed(1)} KB ({selectedDocument.size} bytes)</Text>
              </div>
              <div className={styles.metaItem}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Reference ID</Text>
                <Text weight="semibold" style={{ fontFamily: tokens.fontFamilyMonospace }}>
                  {selectedDocument.id}
                </Text>
              </div>
              <div className={styles.metaItem}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Encoding</Text>
                <Text weight="semibold">UTF-8 Validated</Text>
              </div>
            </div>
          </div>

          {/* Analysis Action & Live Task Status Banner */}
          <div className={styles.taskBanner} role="region" aria-label="Analysis Controls and Status">
            <div className={styles.taskBannerRow}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {!isAnalyzing && (
                  <Button
                    appearance="primary"
                    icon={<Play24Regular />}
                    onClick={() => void runAnalysis()}
                    data-testid="run-analysis-btn"
                  >
                    Analyze Document
                  </Button>
                )}
                {isAnalyzing && (
                  <Button
                    appearance="secondary"
                    icon={<Stop24Regular />}
                    onClick={() => void cancelAnalysis()}
                    disabled={isCancelling}
                    data-testid="cancel-analysis-btn"
                  >
                    {isCancelling ? "Cancelling..." : "Cancel"}
                  </Button>
                )}
                {taskStatus && !isAnalyzing && (
                  <Badge
                    appearance="filled"
                    color={
                      taskStatus === "Succeeded"
                        ? "success"
                        : taskStatus === "Cancelled"
                        ? "warning"
                        : "danger"
                    }
                  >
                    {taskStatus}
                  </Badge>
                )}
              </div>

              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {taskMessage || (activeTaskId ? `Task ${activeTaskId} in progress...` : "Ready to compute metrics")}
              </Text>
            </div>

            {isAnalyzing && (
              <ProgressBar
                value={taskProgress}
                max={100}
                shape="rounded"
                aria-label={`Analysis progress: ${taskProgress}%`}
              />
            )}

            {analysisError && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: tokens.colorPaletteRedForeground1, marginTop: "4px" }}>
                <ErrorCircle20Filled />
                <Text size={200} weight="medium">{analysisError}</Text>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<ArrowClockwise20Regular />}
                  onClick={() => void runAnalysis()}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>

          {/* Stats Grid (Calculated Metrics) */}
          {metrics && (
            <div className={styles.statsGrid} data-testid="stats-grid" role="region" aria-label="Document Metrics">
              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <Text size={200} weight="medium">Words</Text>
                  <TextWordCount24Regular />
                </div>
                <div className={styles.statValue} data-testid="stat-word-count">
                  {metrics.wordCount.toLocaleString()}
                </div>
                <div className={styles.statLabel}>Total word tokens</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <Text size={200} weight="medium">Characters</Text>
                  <TextFont24Regular />
                </div>
                <div className={styles.statValue} data-testid="stat-char-count">
                  {metrics.characterCount.toLocaleString()}
                </div>
                <div className={styles.statLabel}>Unicode code points</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <Text size={200} weight="medium">Lines</Text>
                  <DocumentBulletList24Regular />
                </div>
                <div className={styles.statValue} data-testid="stat-line-count">
                  {metrics.lineCount.toLocaleString()}
                </div>
                <div className={styles.statLabel}>Newline breaks</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <Text size={200} weight="medium">Sentences</Text>
                  <DocumentBulletList24Regular />
                </div>
                <div className={styles.statValue} data-testid="stat-sentence-count">
                  {metrics.sentenceCount.toLocaleString()}
                </div>
                <div className={styles.statLabel}>Sentence boundaries</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <Text size={200} weight="medium">Reading Time</Text>
                  <Timer24Regular />
                </div>
                <div className={styles.statValue} data-testid="stat-reading-time">
                  {metrics.readingTimeSeconds < 60
                    ? `${metrics.readingTimeSeconds}s`
                    : `${(metrics.readingTimeSeconds / 60).toFixed(1)}m`}
                </div>
                <div className={styles.statLabel}>At 200 WPM</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <Text size={200} weight="medium">Diversity</Text>
                  <TextFont24Regular />
                </div>
                <div className={styles.statValue} data-testid="stat-lexical-diversity">
                  {(metrics.lexicalDiversity * 100).toFixed(1)}%
                </div>
                <div className={styles.statLabel}>Unique / total words</div>
              </div>
            </div>
          )}

          {/* Local Document Search */}
          <div className={styles.searchBar} role="search" aria-label="Document Search">
            <Input
              ref={searchInputRef}
              className={styles.searchInput}
              contentBefore={<Search20Regular />}
              placeholder="Search in document..."
              value={searchQuery}
              onChange={(_, d) => setSearchQuery(d.value)}
              aria-label="Search text in document"
              data-testid="document-search-input"
            />
            {searchQuery && (
              <Badge appearance="tint" color={matches.length > 0 ? "brand" : "danger"}>
                {matches.length === 0
                  ? "No matches"
                  : `Match ${currentMatchIndex + 1} of ${matches.length}`}
              </Badge>
            )}
            <Tooltip content="Previous Match (Shift+Enter)" relationship="label">
              <Button
                appearance="subtle"
                icon={<ArrowLeft16Regular />}
                onClick={handlePrevMatch}
                disabled={matches.length === 0}
                aria-label="Previous Match"
              />
            </Tooltip>
            <Tooltip content="Next Match (Enter)" relationship="label">
              <Button
                appearance="subtle"
                icon={<ArrowRight16Regular />}
                onClick={handleNextMatch}
                disabled={matches.length === 0}
                aria-label="Next Match"
              />
            </Tooltip>
          </div>

          {/* Document Content Safe Preview */}
          <div className={styles.previewCard} role="region" aria-label="Document Content Preview">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Title3 as="h3">Document Content</Title3>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {documentContent ? `${documentContent.length} characters` : ""}
              </Text>
            </div>
            <div className={styles.previewContent} data-testid="document-content-preview">
              {renderedContent}
            </div>
          </div>

          {/* Term Frequency Histogram */}
          {metrics && metrics.topTerms.length > 0 && (
            <div className={styles.termsCard} role="region" aria-label="Top Term Frequencies">
              <Title3 as="h3">Top Term Frequencies</Title3>
              <div className={styles.termsList} data-testid="term-frequency-list">
                {metrics.topTerms.map((termItem) => (
                  <div key={termItem.term} className={styles.termRow}>
                    <span className={styles.termName} title={termItem.term}>
                      {termItem.term}
                    </span>
                    <div className={styles.termBarContainer}>
                      <div
                        className={styles.termBar}
                        style={{ width: `${(termItem.count / maxTermCount) * 100}%` }}
                      />
                    </div>
                    <span className={styles.termCount}>{termItem.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
