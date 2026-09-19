import { create } from "zustand";
import {
  cancelTask,
  getTaskSnapshot,
  startCountTask,
  toSafeError,
} from "../../backend";
import type { TaskEvent, TaskSnapshot, TaskState } from "../../contracts";

const MAX_RECENT_SNAPSHOTS = 5;

interface TaskStoreState {
  // Current Active Task
  activeTaskId: string | null;
  taskState: TaskState | null;
  currentProgress: number;
  targetCount: number;
  taskCompleted: number | null;
  taskMessage: string;
  taskError: string;
  isStarting: boolean;
  isCancelling: boolean;

  // Retained Task History (Bounded)
  recentSnapshots: TaskSnapshot[];

  // Screen Reader Accessibility Announcements
  liveAnnouncement: string;

  // Actions
  startTask: (target: number, delayMs: number) => Promise<string>;
  cancelActiveTask: () => Promise<void>;
  syncWithSnapshot: () => Promise<void>;
  handleTaskEvent: (event: TaskEvent) => void;
  reset: () => void;
}

let lastAnnouncementTime = 0;

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  activeTaskId: null,
  taskState: null,
  currentProgress: 0,
  targetCount: 20,
  taskCompleted: null,
  taskMessage: "",
  taskError: "",
  isStarting: false,
  isCancelling: false,
  recentSnapshots: [],
  liveAnnouncement: "",

  startTask: async (target: number, delayMs: number): Promise<string> => {
    set({
      isStarting: true,
      taskError: "",
      taskMessage: "Starting task...",
      currentProgress: 0,
      targetCount: target,
      taskCompleted: null,
      taskState: "Running",
    });

    try {
      const taskId = await startCountTask(target, delayMs);
      set({
        activeTaskId: taskId,
        taskMessage: `Task ${taskId} accepted and running`,
        isStarting: false,
        liveAnnouncement: `Task started. Target: ${target}`,
      });
      return taskId;
    } catch (err) {
      const safe = toSafeError(err);
      set({
        taskError: safe.message,
        taskMessage: `Failed to start task: ${safe.message}`,
        taskState: "Failed",
        isStarting: false,
        liveAnnouncement: `Task failed: ${safe.message}`,
      });
      throw err;
    }
  },

  cancelActiveTask: async (): Promise<void> => {
    const { activeTaskId, isCancelling } = get();
    if (!activeTaskId || isCancelling) return;

    set({ isCancelling: true, taskMessage: "Requesting cancellation..." });
    try {
      await cancelTask(activeTaskId);
      set({
        taskMessage: "Cancellation acknowledged. Stopping...",
        liveAnnouncement: "Cancellation requested.",
      });
    } catch (err) {
      const safe = toSafeError(err);
      set({
        taskError: safe.message,
        taskMessage: `Cancel failed: ${safe.message}`,
        isCancelling: false,
      });
    }
  },

  syncWithSnapshot: async (): Promise<void> => {
    try {
      const snapshot = await getTaskSnapshot();
      if (!snapshot) return;

      const isTerminalState = [
        "Succeeded",
        "Failed",
        "Cancelled",
        "TimedOut",
        "Interrupted",
      ].includes(snapshot.status);

      set((state) => {
        // Update history
        const existingIdx = state.recentSnapshots.findIndex(
          (s) => s.taskId === snapshot.taskId,
        );
        let updatedSnapshots = [...state.recentSnapshots];
        if (existingIdx >= 0) {
          updatedSnapshots[existingIdx] = snapshot;
        } else {
          updatedSnapshots = [snapshot, ...updatedSnapshots].slice(
            0,
            MAX_RECENT_SNAPSHOTS,
          );
        }

        return {
          activeTaskId: isTerminalState ? null : snapshot.taskId,
          taskState: snapshot.status,
          currentProgress: snapshot.current,
          targetCount: snapshot.target,
          taskCompleted: isTerminalState ? snapshot.current : null,
          taskError: snapshot.error || "",
          taskMessage: isTerminalState
            ? `Task ${snapshot.taskId} finished with state ${snapshot.status}`
            : `Task ${snapshot.taskId} running (${snapshot.current}/${snapshot.target})`,
          isCancelling: snapshot.status === "Cancelling",
          recentSnapshots: updatedSnapshots,
        };
      });
    } catch {
      // Ignored if backend is unavailable or not yet initialized
    }
  },

  handleTaskEvent: (event: TaskEvent): void => {
    const { payload, event: eventType, taskId } = event;
    const now = Date.now();

    if (eventType === "progress") {
      const cur = payload.current ?? 0;
      const tgt = payload.target ?? get().targetCount;

      // Throttle live screen-reader progress announcements to at most once every 1 second
      let announcement = get().liveAnnouncement;
      if (now - lastAnnouncementTime >= 1000) {
        announcement = `Progress: ${cur} of ${tgt}`;
        lastAnnouncementTime = now;
      }

      set({
        activeTaskId: taskId,
        taskState: "Running",
        currentProgress: cur,
        targetCount: tgt,
        liveAnnouncement: announcement,
      });
    } else if (eventType === "terminal") {
      const finalStatus = payload.status ?? "Succeeded";
      const completedCount = payload.completed ?? payload.current ?? get().currentProgress;

      set((state) => {
        const terminalSnapshot: TaskSnapshot = {
          taskId,
          operation: "spike.count",
          status: finalStatus,
          current: completedCount,
          target: payload.target ?? state.targetCount,
          error: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const updatedHistory = [
          terminalSnapshot,
          ...state.recentSnapshots.filter((s) => s.taskId !== taskId),
        ].slice(0, MAX_RECENT_SNAPSHOTS);

        return {
          activeTaskId: null,
          taskState: finalStatus,
          taskCompleted: completedCount,
          currentProgress: completedCount,
          isCancelling: false,
          taskMessage: `Task terminated with state: ${finalStatus}`,
          liveAnnouncement: `Task completed with status: ${finalStatus}`,
          recentSnapshots: updatedHistory,
        };
      });
    }
  },

  reset: (): void => {
    set({
      activeTaskId: null,
      taskState: null,
      currentProgress: 0,
      targetCount: 20,
      taskCompleted: null,
      taskMessage: "",
      taskError: "",
      isStarting: false,
      isCancelling: false,
      recentSnapshots: [],
      liveAnnouncement: "Task state reset.",
    });
  },
}));
