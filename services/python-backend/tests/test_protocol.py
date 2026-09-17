from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import threading
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "services" / "python-backend" / "src"
sys.path.insert(0, str(SOURCE))

from prime_shell_backend.protocol import (  # noqa: E402
    FRAME_MAX_BYTES,
    SUPPORTED_OPERATIONS,
    BoundedLineReader,
    FrameTooLarge,
    handle_request,
    hello,
)


class ProtocolUnitTests(unittest.TestCase):
    def test_shared_valid_echo_fixture(self) -> None:
        fixture_path = (
            ROOT
            / "packages"
            / "app-contracts"
            / "fixtures"
            / "valid"
            / "echo-request.json"
        )
        request = json.loads(fixture_path.read_text(encoding="utf-8"))
        response = handle_request(request)
        self.assertEqual(response["kind"], "result")
        self.assertEqual(response["payload"], request["payload"])

    def test_shared_unknown_operation_fixture(self) -> None:
        fixture_path = (
            ROOT
            / "packages"
            / "app-contracts"
            / "fixtures"
            / "invalid"
            / "unknown-operation.json"
        )
        request = json.loads(fixture_path.read_text(encoding="utf-8"))
        response = handle_request(request)
        self.assertEqual(response["error"]["code"], "VALIDATION_ERROR")

    def test_handshake_has_all_five_operations(self) -> None:
        value = hello()
        self.assertEqual(value["kind"], "hello")
        self.assertEqual(
            value["supportedOperations"],
            [
                "spike.echo",
                "spike.count",
                "spike.crash",
                "spike.hang",
                "spike.largeRejected",
            ],
        )

    def test_unicode_echo_is_exact(self) -> None:
        text = "Hello — مرحبا — こんにちは 👋"
        response = handle_request(
            {
                "protocol": "generic-app",
                "kind": "request",
                "requestId": "request-1",
                "traceId": "trace-1",
                "operation": "spike.echo",
                "payload": {"text": text},
            }
        )
        self.assertIsNotNone(response)
        self.assertEqual(response["payload"]["text"], text)

    def test_unknown_operation_is_rejected(self) -> None:
        response = handle_request(
            {
                "protocol": "generic-app",
                "kind": "request",
                "requestId": "request-2",
                "traceId": "trace-2",
                "operation": "spike.future",
                "payload": {},
            }
        )
        self.assertEqual(response["kind"], "error")
        self.assertEqual(response["error"]["code"], "VALIDATION_ERROR")

    def test_count_operation_succeeds(self) -> None:
        response = handle_request(
            {
                "protocol": "generic-app",
                "kind": "request",
                "requestId": "count-1",
                "traceId": "trace-count-1",
                "operation": "spike.count",
                "payload": {"target": 3, "delayMs": 5},
            }
        )
        self.assertEqual(response["kind"], "result")
        self.assertEqual(response["payload"]["completed"], 3)

    def test_count_operation_cooperative_cancellation(self) -> None:
        cancel_event = threading.Event()
        # Trigger cancel after 20ms
        timer = threading.Timer(0.02, cancel_event.set)
        timer.start()
        response = handle_request(
            {
                "protocol": "generic-app",
                "kind": "request",
                "requestId": "count-2",
                "traceId": "trace-count-2",
                "operation": "spike.count",
                "payload": {"target": 100, "delayMs": 50},
            },
            cancel_event=cancel_event,
            task_id="task-count-2",
        )
        timer.cancel()
        self.assertEqual(response["kind"], "error")
        self.assertEqual(response["error"]["code"], "TASK_CANCELLED")

    def test_large_rejected_operation(self) -> None:
        response = handle_request(
            {
                "protocol": "generic-app",
                "kind": "request",
                "requestId": "large-1",
                "traceId": "trace-large-1",
                "operation": "spike.largeRejected",
                "payload": {},
            }
        )
        self.assertEqual(response["kind"], "error")
        self.assertEqual(response["error"]["code"], "RESOURCE_EXHAUSTED")

    def test_crlf_is_accepted(self) -> None:
        reader = BoundedLineReader(io.BytesIO(b'{"kind":"test"}\r\n'))
        self.assertEqual(reader.read_line(64), b'{"kind":"test"}')

    def test_oversized_frame_is_bounded(self) -> None:
        reader = BoundedLineReader(io.BytesIO(b"x" * (FRAME_MAX_BYTES + 8193)))
        with self.assertRaises(FrameTooLarge):
            reader.read_line(FRAME_MAX_BYTES)

    def test_server_process_count_and_cancel_flow(self) -> None:
        environment = {
            "PYTHONPATH": str(SOURCE),
            "PYTHONIOENCODING": "utf-8",
            "PYTHONUNBUFFERED": "1",
        }
        process = subprocess.Popen(
            [sys.executable, "-m", "prime_shell_backend"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=environment,
            cwd=ROOT,
        )
        assert process.stdin is not None
        assert process.stdout is not None
        # Read hello frame
        hello_line = process.stdout.readline()
        hello_data = json.loads(hello_line)
        self.assertEqual(hello_data["kind"], "hello")
        self.assertEqual(len(hello_data["supportedOperations"]), 5)

        # Start a count task with 10 steps, 100ms delay
        req = {
            "protocol": "generic-app",
            "kind": "request",
            "requestId": "proc-count-1",
            "traceId": "proc-trace-1",
            "operation": "spike.count",
            "payload": {"target": 10, "delayMs": 80},
        }
        process.stdin.write(json.dumps(req).encode("utf-8") + b"\n")
        process.stdin.flush()

        # Read first progress event
        evt1 = json.loads(process.stdout.readline())
        self.assertEqual(evt1["kind"], "event")
        self.assertEqual(evt1["event"], "progress")

        # Send cancel request
        cancel_req = {
            "protocol": "generic-app",
            "kind": "cancel",
            "requestId": "proc-cancel-1",
            "traceId": "proc-trace-2",
            "taskId": "proc-count-1",
        }
        process.stdin.write(json.dumps(cancel_req).encode("utf-8") + b"\n")
        process.stdin.flush()

        # Should receive cancellation ack
        ack = json.loads(process.stdout.readline())
        self.assertEqual(ack["kind"], "ack")
        self.assertEqual(ack["status"], "cancelling")

        # Next should be terminal event with status Cancelled
        term = json.loads(process.stdout.readline())
        self.assertEqual(term["kind"], "event")
        self.assertEqual(term["event"], "terminal")
        self.assertEqual(term["payload"]["status"], "Cancelled")

        # And safe error result
        err = json.loads(process.stdout.readline())
        self.assertEqual(err["error"]["code"], "TASK_CANCELLED")

        # Shutdown cleanly
        process.stdin.write(b'{"protocol":"generic-app","kind":"shutdown"}\n')
        process.stdin.flush()
        process.stdin.close()
        self.assertEqual(process.wait(timeout=2), 0)
        process.stdout.close()
        assert process.stderr is not None
        process.stderr.close()


if __name__ == "__main__":
    unittest.main()
