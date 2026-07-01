"""
Logging filters.
"""

import logging

from . import context


class RequestContextFilter(
    logging.Filter,
):
    """
    Inject request context.
    """

    def filter(
        self,
        record,
    ):

        record.request_id = context.request_id.get()

        record.organization = context.organization.get()

        record.user = context.user.get()

        return True
