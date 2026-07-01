"""
Excel renderer.
"""

from io import BytesIO

from openpyxl import Workbook
from rest_framework.renderers import BaseRenderer


class ExcelRenderer(BaseRenderer):
    media_type = "application/vnd.openxmlformats-officedocument." "spreadsheetml.sheet"

    format = "xlsx"

    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):

        rows = data if isinstance(data, list) else data.get("data", [])

        workbook = Workbook()

        sheet = workbook.active

        if rows:

            sheet.append(list(rows[0].keys()))

            for row in rows:
                sheet.append(list(row.values()))

        stream = BytesIO()

        workbook.save(stream)

        return stream.getvalue()
