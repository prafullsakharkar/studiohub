class ImmutableLedgerError(RuntimeError):
    """An append-only ledger row was asked to change or disappear."""
