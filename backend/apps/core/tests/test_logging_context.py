from django.test import SimpleTestCase

from apps.core.logging.logger import get_logger as get_core_logger
from apps.core.utils.logger import get_logger as get_utils_logger


class TestLoggingFactory(SimpleTestCase):
    def test_get_logger_returns_adapter(self):
        core_logger = get_core_logger(__name__)
        utils_logger = get_utils_logger(__name__)

        # Both factories should return objects with a process method (LoggerAdapter)
        self.assertTrue(hasattr(core_logger, "process"))
        self.assertTrue(hasattr(utils_logger, "process"))

        # Names should delegate to the underlying logger object
        self.assertEqual(core_logger.logger.name, __name__)
        self.assertEqual(utils_logger.logger.name, __name__)
