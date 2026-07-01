"""
Logging formatters.
"""

import logging


class StandardFormatter(
    logging.Formatter,
):

    def __init__(self):

        super().__init__(
            fmt=(
                "%(asctime)s "
                "%(levelname)s "
                "[%(request_id)s] "
                "%(name)s "
                "%(message)s"
            )
        )
