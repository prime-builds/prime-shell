import { create } from "zustand";
import {
  cancelTask,
  openDocumentIntent,
  readDocumentContent,
  revokeDocumentRef,
  startDocumentAnalysisTask,
  toSafeError,
} from "../../backend";
import type {
  DocumentAnalysisMetrics,
  DocumentRef,
  TaskEvent,
  TaskState,
} from "../../contracts";

export const DEFAULT_MAX_TOP_TERMS = 20;

interface DocumentAnalysisState {
  // Document state
  selectedDocument: DocumentRef | null;
  documentContent: string | null;
  isLoadingDocument: boolean;
  documentError: string | null;

  // Search state
  searchQuery: string;
  currentMatchIndex: number;

  // Analysis state
  activeTaskId: string | null;
  taskStatus: TaskState | null;
  taskProgress: number;
  taskMessage: string;
  analysisError: string | null;
  metrics: DocumentAnalysisMetrics | null;
  isAnalyzing: boolean;
  isCancelling: boolean;

  // Feature setting (maxTopTerms)
  maxTopTerms: number;

  // Actions
  openDocument: () => Promise<void>;
  closeDocument: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setCurrentMatchIndex: (index: number) => void;
  runAnalysis: () => Promise<void>;
  cancelAnalysis: () => Promise<void>;
  setMaxTopTerms: (count: number) => void;
  resetSetting: () => void;
  reset: () => void;
  handleTaskEvent: (event: TaskEvent) => void;
}

export const useDocumentAnalysisStore = create<DocumentAnalysisState>((set, get) => ({
  selectedDocument: null,
  documentContent: null,
  isLoadingDocument: false,
  documentError: null,

  searchQuery: "",
  currentMatchIndex: 0,

  activeTaskId: null,
  taskStatus: null,
  taskProgress: 0,
  taskMessage: "",
  analysisError: null,
  metrics: null,
  isAnalyzing: false,
  isCancelling: false,

  maxTopTerms: DEFAULT_MAX_TOP_TERMS,

  openDocument: async () => {
    set({ isLoadingDocument: true, documentError: null });
    try {
      const docRef = await openDocumentIntent();
      if (!docRef) {
        // Picker was cancelled by user
        set({ isLoadingDocument: false });
        return;
      }

      // Revoke any previous document ref
      const prevDoc = get().selectedDocument;
      if (prevDoc) {
        await revokeDocumentRef(prevDoc.id);
      }

      // Read bounded content safely
      const content = await readDocumentContent(docRef.id);
      set({
        selectedDocument: docRef,
        documentContent: content,
        isLoadingDocument: false,
        documentError: null,
        metrics: null,
        taskStatus: null,
        taskProgress: 0,
        taskMessage: "",
        analysisError: null,
        searchQuery: "",
        currentMatchIndex: 0,
      });
    } catch (err) {
      const safe = toSafeError(err);
      set({
        isLoadingDocument: false,
        documentError: safe.message,
      });
    }
  },

  closeDocument: async () => {
    const doc = get().selectedDocument;
    if (doc) {
      await revokeDocumentRef(doc.id);
    }
    set({
      selectedDocument: null,
      documentContent: null,
      documentError: null,
      metrics: null,
      activeTaskId: null,
      taskStatus: null,
      taskProgress: 0,
      taskMessage: "",
      analysisError: null,
      searchQuery: "",
      currentMatchIndex: 0,
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query, currentMatchIndex: 0 });
  },

  setCurrentMatchIndex: (index: number) => {
    set({ currentMatchIndex: index });
  },

  runAnalysis: async () => {
    const { selectedDocument, searchQuery, maxTopTerms } = get();
    if (!selectedDocument) return;

    set({
      isAnalyzing: true,
      analysisError: null,
      taskStatus: "Running",
      taskProgress: 0,
      taskMessage: "Starting document analysis...",
    });

    try {
      const taskId = await startDocumentAnalysisTask(
        selectedDocument.id,
        searchQuery || undefined,
        maxTopTerms,
      );
      set({
        activeTaskId: taskId,
        taskMessage: `Analysis task ${taskId} in progress...`,
      });
    } catch (err) {
      const safe = toSafeError(err);
      set({
        isAnalyzing: false,
        analysisError: safe.message,
        taskStatus: "Failed",
        taskMessage: `Analysis failed: ${safe.message}`,
      });
    }
  },

  cancelAnalysis: async () => {
    const { activeTaskId, isCancelling } = get();
    if (!activeTaskId || isCancelling) return;

    set({ isCancelling: true, taskMessage: "Requesting cancellation..." });
    try {
      await cancelTask(activeTaskId);
      set({ taskMessage: "Cancellation requested. Waiting for backend..." });
    } catch (err) {
      const safe = toSafeError(err);
      set({
        isCancelling: false,
        analysisError: safe.message,
      });
    }
  },

  setMaxTopTerms: (count: number) => {
    const clamped = Math.max(1, Math.min(100, Math.round(count)));
    set({ maxTopTerms: clamped });
  },

  resetSetting: () => {
    set({ maxTopTerms: DEFAULT_MAX_TOP_TERMS });
  },

  reset: () => {
    set({
      selectedDocument: null,
      documentContent: null,
      isLoadingDocument: false,
      documentError: null,
      searchQuery: "",
      currentMatchIndex: 0,
      activeTaskId: null,
      taskStatus: null,
      taskProgress: 0,
      taskMessage: "",
      analysisError: null,
      metrics: null,
      isAnalyzing: false,
      isCancelling: false,
      maxTopTerms: DEFAULT_MAX_TOP_TERMS,
    });
  },

  handleTaskEvent: (event: TaskEvent) => {
    const { event: eventType, payload, taskId } = event;
    const { activeTaskId } = get();

    if (activeTaskId && activeTaskId !== taskId) return;

    if (eventType === "progress") {
      const cur = payload.current ?? 0;
      set({
        taskProgress: cur,
        taskStatus: "Running",
        taskMessage: payload.message || `Analyzing document... ${cur}%`,
      });
    } else if (eventType === "terminal") {
      const finalStatus = payload.status ?? "Succeeded";
      const isSucceeded = finalStatus === "Succeeded";
      const result = payload.result as { metrics?: DocumentAnalysisMetrics } | undefined;
      set({
        isAnalyzing: false,
        isCancelling: false,
        activeTaskId: null,
        taskStatus: finalStatus,
        taskProgress: isSucceeded ? 100 : (payload.completed ?? get().taskProgress),
        taskMessage: payload.message || `Analysis finished: ${finalStatus}`,
        ...(result?.metrics ? { metrics: result.metrics } : {}),
      });
    }
  },
}));
