import warnings

# Suppress expected architecture deprecation FutureWarnings from the shared-kernel
# deprecation shims (apps.core.models.bases.scopes / ownership / project / BaseModel).
# These are documented and tracked; they are not actionable in every test/run and
# would otherwise pollute pytest/management command output. The underlying warnings
# remain available when running with -W always::FutureWarning if needed.
warnings.filterwarnings("ignore", category=FutureWarning, module=r"apps\.core\..*")
