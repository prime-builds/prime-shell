from __future__ import annotations

import json
import sys
import threading
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "services" / "python-backend" / "src"
sys.path.insert(0, str(SOURCE))

from prime_shell_backend.protocol import handle_request  # noqa: E402


class DocumentAnalysisUnitTests(unittest.TestCase):
    def test_shared_valid_doc_analyze_fixture(self) -> None:
        fixture_path = (
            ROOT
            / "packages"
            / "app-contracts"
            / "fixtures"
            / "valid"
            / "doc-analyze-request.json"
        )
        request = json.loads(fixture_path.read_text(encoding="utf-8"))
        response = handle_request(request)
        self.assertIsNotNone(response)
        self.assertEqual(response["kind"], "result")
        self.assertEqual(response["operation"], "doc.analyze")
        metrics = response["payload"]["metrics"]
        self.assertEqual(metrics["wordCount"], 15)
        self.assertEqual(metrics["characterCount"], 80)
        self.assertEqual(metrics["sentenceCount"], 2)
        self.assertEqual(metrics["lineCount"], 1)
        self.assertGreater(metrics["readingTimeSeconds"], 0)
        self.assertGreater(metrics["lexicalDiversity"], 0)
        self.assertIsInstance(metrics["topTerms"], list)
        self.assertEqual(metrics["topTerms"][0]["term"], "quick")
        self.assertEqual(metrics["topTerms"][0]["count"], 2)
        self.assertEqual(len(metrics["keywordMatches"]), 1)
        self.assertEqual(metrics["keywordMatches"][0]["count"], 2)

    def test_unicode_text_analysis(self) -> None:
        text = "Hello world!\nمرحبا بالعالم!\nこんにちは世界！\n👋 🌍"
        request = {
            "protocol": "generic-app",
            "kind": "request",
            "requestId": "req-unicode",
            "traceId": "trace-unicode",
            "operation": "doc.analyze",
            "payload": {
                "text": text,
                "query": "world",
                "maxTopTerms": 5,
            },
        }
        response = handle_request(request)
        self.assertIsNotNone(response)
        self.assertEqual(response["kind"], "result")
        metrics = response["payload"]["metrics"]
        self.assertEqual(metrics["lineCount"], 4)
        self.assertEqual(metrics["characterCount"], len(text))
        self.assertGreater(metrics["wordCount"], 0)
        self.assertEqual(len(metrics["keywordMatches"]), 1)
        self.assertEqual(metrics["keywordMatches"][0]["count"], 1)

    def test_empty_text_analysis(self) -> None:
        request = {
            "protocol": "generic-app",
            "kind": "request",
            "requestId": "req-empty",
            "traceId": "trace-empty",
            "operation": "doc.analyze",
            "payload": {"text": ""},
        }
        response = handle_request(request)
        self.assertIsNotNone(response)
        self.assertEqual(response["kind"], "result")
        metrics = response["payload"]["metrics"]
        self.assertEqual(metrics["wordCount"], 0)
        self.assertEqual(metrics["characterCount"], 0)
        self.assertEqual(metrics["lineCount"], 0)
        self.assertEqual(metrics["sentenceCount"], 0)
        self.assertEqual(metrics["readingTimeSeconds"], 0.0)
        self.assertEqual(metrics["lexicalDiversity"], 0.0)
        self.assertEqual(metrics["topTerms"], [])
        self.assertEqual(metrics["keywordMatches"], [])

    def test_invalid_max_top_terms_rejected(self) -> None:
        request = {
            "protocol": "generic-app",
            "kind": "request",
            "requestId": "req-invalid",
            "traceId": "trace-invalid",
            "operation": "doc.analyze",
            "payload": {
                "text": "sample text",
                "maxTopTerms": 200,
            },
        }
        response = handle_request(request)
        self.assertIsNotNone(response)
        self.assertEqual(response["kind"], "error")
        self.assertEqual(response["error"]["code"], "VALIDATION_ERROR")

    def test_cancellation_is_handled(self) -> None:
        cancel_event = threading.Event()
        cancel_event.set()
        request = {
            "protocol": "generic-app",
            "kind": "request",
            "requestId": "req-cancel",
            "traceId": "trace-cancel",
            "operation": "doc.analyze",
            "payload": {"text": "A quick test of cancellation support."},
        }
        response = handle_request(request, cancel_event=cancel_event)
        self.assertIsNotNone(response)
        self.assertEqual(response["kind"], "error")
        self.assertEqual(response["error"]["code"], "TASK_CANCELLED")


if __name__ == "__main__":
    unittest.main()
