#!/usr/bin/env python3
"""Jarvis local ASR sidecar — faster-whisper behind a tiny HTTP API.

POST /asr  (body: WAV bytes)  → {"text": "..."}
GET  /health                  → ok

Loads the model once (default: small, int8). 中英混说 via language=None autodetect.
"""
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

MODEL_NAME = os.environ.get("JARVIS_WHISPER_MODEL", "small")
PORT = int(os.environ.get("JARVIS_ASR_PORT", "8898"))

print(f"[voiced] loading faster-whisper '{MODEL_NAME}' (int8)…", flush=True)
from faster_whisper import WhisperModel  # noqa: E402

model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
print("[voiced] model ready", flush=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet
        pass

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/asr":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        wav = self.rfile.read(length)
        try:
            import io

            segments, _info = model.transcribe(
                io.BytesIO(wav), language=None, beam_size=2, vad_filter=True
            )
            text = "".join(s.text for s in segments).strip()
            body = json.dumps({"text": text}, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
            print(f"[voiced] asr: '{text}'", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[voiced] asr error: {e}", flush=True)
            self.send_error(500, str(e))


if __name__ == "__main__":
    print(f"[voiced] listening on 127.0.0.1:{PORT}", flush=True)
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
