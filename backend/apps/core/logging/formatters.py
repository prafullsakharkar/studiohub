from __future__ import annotations

import json
import logging


class JSONFormatter(logging.Formatter):
    """
    Structured JSON logs.
    """

    def format(self, record):
        payload = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }

        return json.dumps(payload)
