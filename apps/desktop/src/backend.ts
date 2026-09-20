import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  ackEnvelopeSchema,
  appErrorSchema,
  backendStatusSchema,
  echoResponseSchema,
  openDocumentIntentResponseSchema,
  runtimeProbeConfigSchema,
  saveDocumentIntentResponseSchema,
  taskEventSchema,
  taskSnapshotResponseSchema,
  type AckEnvelope,
  type AppError,
  type BackendStatus,
  type DocumentRef,
  type EchoResponse,
  type RuntimeProbeConfig,
  type TaskEvent,
  type TaskSnapshot,
} from "./contracts";

export async function getBackendStatus(): Promise<BackendStatus> {
  return backendStatusSchema.parse(await invoke("backend_status"));
}

export async function echoText(text: string): Promise<EchoResponse> {
  return echoResponseSchema.parse(await invoke("echo_text", { text }));
}

export async function startCountTask(
  target: number,
  delayMs: number,
): Promise<string> {
  const result = await invoke("start_count_task", { target, delayMs });
  return String(result);
}

export async function startDocumentAnalysisTask(
  documentId: string,
  query?: string,
  maxTopTerms?: number,
): Promise<string> {
  const result = await invoke("start_document_analysis_task", {
    documentId,
    query: query || null,
    maxTopTerms: maxTopTerms || null,
  });
  return String(result);
}

export async function cancelTask(taskId: string): Promise<AckEnvelope> {
  return ackEnvelopeSchema.parse(
    await invoke("cancel_task", { taskId }),
  );
}

export async function getTaskSnapshot(taskId?: string): Promise<TaskSnapshot | null> {
  const result = await invoke("get_task_snapshot", { taskId });
  return taskSnapshotResponseSchema.parse(result);
}

export async function triggerCrash(): Promise<void> {
  await invoke("trigger_crash");
}

export async function triggerHang(): Promise<void> {
  await invoke("trigger_hang");
}

export async function triggerLargeRejected(): Promise<void> {
  await invoke("trigger_large_rejected");
}

export async function resetBackend(): Promise<BackendStatus> {
  return backendStatusSchema.parse(await invoke("reset_backend"));
}

export async function listenToTaskEvents(
  callback: (event: TaskEvent) => void,
): Promise<UnlistenFn> {
  if (
    typeof window === "undefined" ||
    (!("__TAURI_INTERNALS__" in window) && import.meta.env.MODE !== "test")
  ) {
    return () => {};
  }
  return listen<unknown>("task-event", (tauriEvent) => {
    const parsed = taskEventSchema.safeParse(tauriEvent.payload);
    if (parsed.success) {
      callback(parsed.data);
    }
  });
}

export async function getRuntimeProbeConfig(): Promise<RuntimeProbeConfig> {
  return runtimeProbeConfigSchema.parse(await invoke("runtime_probe_config"));
}

export async function writeRuntimeEvidence(
  evidence: Record<string, unknown>,
): Promise<void> {
  await invoke("write_runtime_evidence", { evidence });
}

export async function openDocumentIntent(): Promise<DocumentRef | null> {
  const result = await invoke("open_document_intent");
  return openDocumentIntentResponseSchema.parse(result);
}

export async function saveDocumentIntent(
  defaultName?: string,
): Promise<DocumentRef | null> {
  const result = await invoke("save_document_intent", { defaultName });
  return saveDocumentIntentResponseSchema.parse(result);
}

export async function readDocumentContent(id: string): Promise<string> {
  const result = await invoke("read_document_content", { id });
  return String(result);
}

export async function writeDocumentContent(
  id: string,
  content: string,
): Promise<void> {
  await invoke("write_document_content", { id, content });
}

export async function revokeDocumentRef(id: string): Promise<boolean> {
  const result = await invoke("revoke_document_ref", { id });
  return Boolean(result);
}

export function toSafeError(value: unknown): AppError {
  const parsed = appErrorSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    code: "INTERNAL_ERROR",
    message:
      typeof value === "object" && value !== null && "message" in value
        ? String((value as { message: unknown }).message)
        : "The operation could not be completed.",
    traceId: "frontend-unmapped",
  };
}
