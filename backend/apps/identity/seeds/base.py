class BaseSeeder:
    """
    Base class for all seeders.
    """

    @classmethod
    def run(cls):
        raise NotImplementedError
