import { z } from "zod";

export const appErrorSchema = z.object({
  code: z.enum([
    "VALIDATION_ERROR",
    "BACKEND_UNAVAILABLE",
    "BACKEND_PROTOCOL_MISMATCH",
    "PROTOCOL_ERROR",
    "RESOURCE_EXHAUSTED",
    "IO_ERROR",
    "INTERNAL_ERROR",
    "BACKEND_CRASHED",
    "TASK_CANCELLED",
    "TASK_TIMED_OUT",
    "TASK_INTERRUPTED",
    "AUTHORIZATION_ERROR",
    "VERSION_MISMATCH",
    "REFERENCE_NOT_FOUND",
    "PICKER_CANCELLED",
  ]),
  message: z.string().min(1).max(256),
  traceId: z.string().min(1).max(128),
});

export const backendLifecycleStateSchema = z.enum([
  "stopped",
  "starting",
  "ready",
  "busy",
  "restarting",
  "faulted",
  "stopping",
  "Stopped",
  "Starting",
  "Ready",
  "Busy",
  "Restarting",
  "Stopping",
  "Faulted",
]);

export const backendStatusSchema = z.object({
  state: backendLifecycleStateSchema,
  ready: z.boolean(),
  backendVersion: z.string().max(64).nullable(),
  circuitOpen: z.boolean(),
});

export const taskStateSchema = z.enum([
  "Queued",
  "Running",
  "Cancelling",
  "Succeeded",
  "Failed",
  "Cancelled",
  "TimedOut",
  "Interrupted",
]);

export const taskEventPayloadSchema = z.object({
  current: z.number().optional(),
  target: z.number().optional(),
  status: taskStateSchema.optional(),
  completed: z.number().optional(),
});

export const taskEventSchema = z.object({
  protocol: z.literal("generic-app"),
  kind: z.literal("event"),
  requestId: z.string(),
  traceId: z.string(),
  taskId: z.string(),
  sequence: z.number(),
  event: z.string(),
  payload: taskEventPayloadSchema,
});

export const ackEnvelopeSchema = z.object({
  protocol: z.literal("generic-app"),
  kind: z.literal("ack"),
  requestId: z.string(),
  traceId: z.string(),
  taskId: z.string(),
  status: z.string(),
});

export const echoResponseSchema = z.object({
  text: z.string(),
  traceId: z.string().min(1).max(128),
});

export const runtimeProbeConfigSchema = z.object({
  enabled: z.boolean(),
  evidencePath: z.string().nullable(),
});

export const documentRefSchema = z.object({
  id: z.string().min(1).max(128),
  displayName: z.string().min(1).max(256),
  size: z.number().int().min(0).max(10485760),
  mediaType: z.string().max(64).optional(),
});

export const artifactRefSchema = z.object({
  id: z.string().min(1).max(128),
  displayName: z.string().min(1).max(256),
  size: z.number().int().min(0).max(10485760),
  kind: z.string().max(64),
});

export const openDocumentIntentResponseSchema = documentRefSchema.nullable();
export const saveDocumentIntentResponseSchema = documentRefSchema.nullable();

export const taskSnapshotSchema = z.object({
  taskId: z.string().min(1).max(128),
  operation: z.string().min(1).max(128),
  status: taskStateSchema,
  current: z.number().int().min(0),
  target: z.number().int().min(0),
  error: z.string().max(256).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const taskSnapshotResponseSchema = taskSnapshotSchema.nullable();

export type AppError = z.infer<typeof appErrorSchema>;
export type BackendLifecycleState = z.infer<typeof backendLifecycleStateSchema>;
export type BackendStatus = z.infer<typeof backendStatusSchema>;
export type TaskState = z.infer<typeof taskStateSchema>;
export type TaskEventPayload = z.infer<typeof taskEventPayloadSchema>;
export type TaskEvent = z.infer<typeof taskEventSchema>;
export type TaskSnapshot = z.infer<typeof taskSnapshotSchema>;
export type AckEnvelope = z.infer<typeof ackEnvelopeSchema>;
export type EchoResponse = z.infer<typeof echoResponseSchema>;
export type RuntimeProbeConfig = z.infer<typeof runtimeProbeConfigSchema>;
export type DocumentRef = z.infer<typeof documentRefSchema>;
export type ArtifactRef = z.infer<typeof artifactRefSchema>;

