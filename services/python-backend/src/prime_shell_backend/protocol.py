from __future__ import annotations

import json
import os
import queue
import sys
import threading
import time
from dataclasses import dataclass
from typing import Any, BinaryIO

from . import __version__
from .metadata import load_build_info

HANDSHAKE_MAX_BYTES = 64 * 1024
FRAME_MAX_BYTES = 1024 * 1024
LOG_MAX_BYTES = 64 * 1024
TEXT_MAX_CHARACTERS = 262_144
PROTOCOL = "generic-app"
SUPPORTED_OPERATIONS = (
    "spike.echo",
    "spike.count",
    "spike.crash",
    "spike.hang",
    "spike.largeRejected",
)

_STDOUT_LOCK = threading.Lock()
_STDERR_LOCK = threading.Lock()


class FrameTooLarge(ValueError):
    pass


@dataclass
class BoundedLineReader:
    stream: BinaryIO
    buffer: bytearray

    def __init__(self, stream: BinaryIO) -> None:
        self.stream = stream
        self.buffer = bytearray()

    def read_line(self, maximum: int) -> bytes | None:
        while True:
            newline = self.buffer.find(b"\n")
            if newline >= 0:
                line = bytes(self.buffer[:newline])
                del self.buffer[: newline + 1]
                if line.endswith(b"\r"):
                    line = line[:-1]
                if len(line) > maximum:
                    raise FrameTooLarge("frame exceeds configured maximum")
                return line

            if len(self.buffer) > maximum:
                raise FrameTooLarge("frame exceeds configured maximum")

            read_chunk = getattr(self.stream, "read1", self.stream.read)
            chunk = read_chunk(8192)
            if not chunk:
                if not self.buffer:
                    return None
                line = bytes(self.buffer)
                self.buffer.clear()
                if len(line) > maximum:
                    raise FrameTooLarge("frame exceeds configured maximum")
                return line
            self.buffer.extend(chunk)


def _bounded_json(value: dict[str, Any], maximum: int) -> bytes:
    encoded = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    if len(encoded) > maximum:
        raise FrameTooLarge("outbound frame exceeds configured maximum")
    return encoded


def write_protocol(value: dict[str, Any]) -> None:
    encoded = _bounded_json(value, FRAME_MAX_BYTES)
    with _STDOUT_LOCK:
        sys.stdout.buffer.write(encoded + b"\n")
        sys.stdout.buffer.flush()


def write_log(level: str, event: str, **fields: Any) -> None:
    allowed = {
        "timestamp": None,
        "level": level,
        "component": "python-backend",
        "event": event,
    }
    for key in ("requestId", "traceId", "taskId", "errorCode"):
        candidate = fields.get(key)
        if isinstance(candidate, str):
            allowed[key] = candidate[:128]
    encoded = _bounded_json(allowed, LOG_MAX_BYTES)
    with _STDERR_LOCK:
        sys.stderr.buffer.write(encoded + b"\n")
        sys.stderr.buffer.flush()


def hello() -> dict[str, Any]:
    build = load_build_info()
    return {
        "protocol": PROTOCOL,
        "kind": "hello",
        "protocolMin": 1,
        "protocolMax": 1,
        "backendVersion": __version__,
        "buildId": build["buildId"],
        "targetTriple": build["targetTriple"],
        "pythonVersion": platform_python_version(),
        "schemaHash": build["schemaHash"],
        "supportedOperations": list(SUPPORTED_OPERATIONS),
    }


def platform_python_version() -> str:
    return ".".join(str(part) for part in sys.version_info[:3])


def safe_error(
    code: str,
    message: str,
    request_id: str | None = None,
    trace_id: str = "backend-protocol",
) -> dict[str, Any]:
    return {
        "protocol": PROTOCOL,
        "kind": "error",
        "requestId": request_id,
        "traceId": trace_id[:128],
        "error": {
            "code": code,
            "message": message[:256],
        },
    }


def handle_request(
    value: Any,
    cancel_event: threading.Event | None = None,
    task_id: str | None = None,
) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return safe_error("VALIDATION_ERROR", "Request must be an object.")

    if value.get("protocol") == PROTOCOL and value.get("kind") == "shutdown":
        if set(value) != {"protocol", "kind"}:
            return safe_error(
                "VALIDATION_ERROR", "Shutdown contains unexpected fields."
            )
        return None

    request_id = value.get("requestId")
    trace_id = value.get("traceId")
    safe_request_id = request_id if isinstance(request_id, str) else None
    safe_trace_id = trace_id if isinstance(trace_id, str) else "backend-validation"

    expected_keys = {
        "protocol",
        "kind",
        "requestId",
        "traceId",
        "operation",
        "payload",
    }
    if set(value) != expected_keys:
        return safe_error(
            "VALIDATION_ERROR",
            "Request fields are invalid.",
            safe_request_id,
            safe_trace_id,
        )
    if (
        value["protocol"] != PROTOCOL
        or value["kind"] != "request"
        or not isinstance(request_id, str)
        or not 1 <= len(request_id) <= 128
        or not isinstance(trace_id, str)
        or not 1 <= len(trace_id) <= 128
    ):
        return safe_error(
            "VALIDATION_ERROR",
            "Request envelope is invalid.",
            safe_request_id,
            safe_trace_id,
        )

    operation = value["operation"]
    if operation not in SUPPORTED_OPERATIONS:
        return safe_error(
            "VALIDATION_ERROR",
            "Operation is not supported.",
            request_id,
            trace_id,
        )

    payload = value.get("payload")
    if not isinstance(payload, dict):
        return safe_error(
            "VALIDATION_ERROR",
            "Payload must be an object.",
            request_id,
            trace_id,
        )

    effective_task_id = task_id or request_id

    # 1. spike.echo
    if operation == "spike.echo":
        if (
            set(payload) != {"text"}
            or not isinstance(payload["text"], str)
            or len(payload["text"]) > TEXT_MAX_CHARACTERS
        ):
            return safe_error(
                "VALIDATION_ERROR",
                "Echo payload is invalid.",
                request_id,
                trace_id,
            )

        write_log("info", "echo_completed", requestId=request_id, traceId=trace_id)
        return {
            "protocol": PROTOCOL,
            "kind": "result",
            "requestId": request_id,
            "traceId": trace_id,
            "operation": "spike.echo",
            "payload": {"text": payload["text"]},
        }

    # 2. spike.count
    elif operation == "spike.count":
        target = payload.get("target")
        delay_ms = payload.get("delayMs")
        allowed_keys = {"target", "delayMs", "taskId"}
        payload_keys = set(payload)
        task_id_field = payload.get("taskId")
        if (
            not payload_keys.issubset(allowed_keys)
            or "target" not in payload_keys
            or "delayMs" not in payload_keys
            or not isinstance(target, int)
            or not 1 <= target <= 100_000
            or not isinstance(delay_ms, int)
            or not 0 <= delay_ms <= 5000
            or (task_id_field is not None and (not isinstance(task_id_field, str) or not 1 <= len(task_id_field) <= 128))
        ):
            return safe_error(
                "VALIDATION_ERROR",
                "Count payload is invalid.",
                request_id,
                trace_id,
            )
        effective_task_id = task_id_field or task_id or request_id

        seq = 0
        step_delay = delay_ms / 1000.0
        write_log("info", "count_task_started", requestId=request_id, traceId=trace_id, taskId=effective_task_id)

        for i in range(1, target + 1):
            if cancel_event is not None and cancel_event.is_set():
                seq += 1
                write_protocol({
                    "protocol": PROTOCOL,
                    "kind": "event",
                    "requestId": request_id,
                    "traceId": trace_id,
                    "taskId": effective_task_id,
                    "sequence": seq,
                    "event": "terminal",
                    "payload": {
                        "status": "Cancelled",
                        "completed": i - 1,
                    },
                })
                write_log("info", "count_task_cancelled", requestId=request_id, traceId=trace_id, taskId=effective_task_id)
                return safe_error(
                    "TASK_CANCELLED",
                    "The count task was cancelled.",
                    request_id,
                    trace_id,
                )

            seq += 1
            write_protocol({
                "protocol": PROTOCOL,
                "kind": "event",
                "requestId": request_id,
                "traceId": trace_id,
                "taskId": effective_task_id,
                "sequence": seq,
                "event": "progress",
                "payload": {
                    "current": i,
                    "target": target,
                },
            })

            if step_delay > 0:
                if cancel_event is not None:
                    if cancel_event.wait(step_delay):
                        # Cancelled while waiting
                        seq += 1
                        write_protocol({
                            "protocol": PROTOCOL,
                            "kind": "event",
                            "requestId": request_id,
                            "traceId": trace_id,
                            "taskId": effective_task_id,
                            "sequence": seq,
                            "event": "terminal",
                            "payload": {
                                "status": "Cancelled",
                                "completed": i,
                            },
                        })
                        write_log("info", "count_task_cancelled", requestId=request_id, traceId=trace_id, taskId=effective_task_id)
                        return safe_error(
                            "TASK_CANCELLED",
                            "The count task was cancelled.",
                            request_id,
                            trace_id,
                        )
                else:
                    time.sleep(step_delay)

        seq += 1
        write_protocol({
            "protocol": PROTOCOL,
            "kind": "event",
            "requestId": request_id,
            "traceId": trace_id,
            "taskId": effective_task_id,
            "sequence": seq,
            "event": "terminal",
            "payload": {
                "status": "Succeeded",
                "completed": target,
            },
        })
        write_log("info", "count_task_completed", requestId=request_id, traceId=trace_id, taskId=effective_task_id)

        return {
            "protocol": PROTOCOL,
            "kind": "result",
            "requestId": request_id,
            "traceId": trace_id,
            "operation": "spike.count",
            "payload": {"completed": target},
        }

    # 3. spike.crash
    elif operation == "spike.crash":
        write_log("warning", "deliberate_crash_triggered", requestId=request_id, traceId=trace_id)
        # Flush buffers before termination
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(42)

    # 4. spike.hang
    elif operation == "spike.hang":
        write_log("warning", "deliberate_hang_triggered", requestId=request_id, traceId=trace_id)
        while True:
            time.sleep(1.0)

    # 5. spike.largeRejected
    elif operation == "spike.largeRejected":
        write_log("warning", "large_rejected_triggered", requestId=request_id, traceId=trace_id)
        return safe_error(
            "RESOURCE_EXHAUSTED",
            "The request payload exceeds the configured maximum frame size.",
            request_id,
            trace_id,
        )

    return safe_error("INTERNAL_ERROR", "Unhandled operation.", request_id, trace_id)


def serve(stdin: BinaryIO) -> int:
    write_protocol(hello())
    write_log("info", "backend_ready")

    reader = BoundedLineReader(stdin)
    request_queue: queue.Queue[dict[str, Any] | None] = queue.Queue(maxsize=64)
    active_state_lock = threading.Lock()
    active_task: dict[str, Any] = {"id": None, "cancel_event": None}
    running = threading.Event()
    running.set()

    def worker_loop() -> None:
        while running.is_set():
            try:
                item = request_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            if item is None:
                break

            cancel_event = threading.Event()
            req_id = item.get("requestId", "")
            payload = item.get("payload")
            payload_task_id = payload.get("taskId") if isinstance(payload, dict) else None
            task_id = item.get("taskId") or payload_task_id or req_id

            with active_state_lock:
                active_task["id"] = task_id
                active_task["cancel_event"] = cancel_event

            try:
                response = handle_request(item, cancel_event=cancel_event, task_id=task_id)
                if response is not None:
                    write_protocol(response)
            finally:
                with active_state_lock:
                    active_task["id"] = None
                    active_task["cancel_event"] = None
                request_queue.task_done()

    worker_thread = threading.Thread(target=worker_loop, daemon=True)
    worker_thread.start()

    exit_code = 0
    try:
        while True:
            try:
                line = reader.read_line(FRAME_MAX_BYTES)
            except FrameTooLarge:
                write_protocol(
                    safe_error(
                        "RESOURCE_EXHAUSTED",
                        "Input frame exceeds the 1 MiB limit.",
                    )
                )
                write_log(
                    "error",
                    "frame_rejected",
                    errorCode="RESOURCE_EXHAUSTED",
                )
                exit_code = 2
                break

            if line is None:
                write_log("info", "eof_shutdown")
                break
            if not line:
                write_protocol(safe_error("PROTOCOL_ERROR", "Empty frame."))
                continue

            try:
                decoded = line.decode("utf-8")
                value = json.loads(decoded)
            except (UnicodeDecodeError, json.JSONDecodeError):
                write_protocol(safe_error("PROTOCOL_ERROR", "Malformed UTF-8 JSON."))
                write_log("warning", "malformed_frame", errorCode="PROTOCOL_ERROR")
                continue

            if not isinstance(value, dict):
                write_protocol(safe_error("VALIDATION_ERROR", "Frame must be an object."))
                continue

            kind = value.get("kind")
            protocol = value.get("protocol")

            # Cancellation handling
            if protocol == PROTOCOL and kind == "cancel":
                req_id = value.get("requestId")
                trace_id = value.get("traceId")
                task_id = value.get("taskId")
                if not isinstance(req_id, str) or not isinstance(trace_id, str) or not isinstance(task_id, str):
                    write_protocol(safe_error("VALIDATION_ERROR", "Cancel control fields are invalid.", req_id, trace_id or "cancel-validation"))
                    continue

                with active_state_lock:
                    is_active = (
                        active_task["id"] is not None
                        and (active_task["id"] == task_id or not task_id)
                        and active_task["cancel_event"] is not None
                    )
                    if is_active:
                        active_task["cancel_event"].set()
                        status = "cancelling"
                    else:
                        status = "not_found"

                write_protocol({
                    "protocol": PROTOCOL,
                    "kind": "ack",
                    "requestId": req_id,
                    "traceId": trace_id,
                    "taskId": task_id,
                    "status": status,
                })
                continue

            # Shutdown handling
            if protocol == PROTOCOL and kind == "shutdown":
                write_log("info", "requested_shutdown")
                break

            # Enqueue normal request
            try:
                request_queue.put_nowait(value)
            except queue.Full:
                write_protocol(
                    safe_error(
                        "RESOURCE_EXHAUSTED",
                        "Request queue is full.",
                        value.get("requestId"),
                        value.get("traceId") or "queue-full",
                    )
                )
                write_log(
                    "error",
                    "queue_exhausted",
                    errorCode="RESOURCE_EXHAUSTED",
                )

    finally:
        running.clear()
        request_queue.put(None)
        worker_thread.join(timeout=1.0)

    return exit_code
