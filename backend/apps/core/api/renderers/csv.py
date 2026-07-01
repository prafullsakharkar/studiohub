"""
CSV renderer.
"""

import csv
from io import StringIO

from rest_framework.renderers import BaseRenderer


class CSVRenderer(BaseRenderer):
    media_type = "text/csv"
    format = "csv"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if not data:
            return ""

        rows = data if isinstance(data, list) else data.get("data", [])

        if not rows:
            return ""

        output = StringIO()

        writer = csv.DictWriter(
            output,
            fieldnames=rows[0].keys(),
        )

        writer.writeheader()

        writer.writerows(rows)

        return output.getvalue()
