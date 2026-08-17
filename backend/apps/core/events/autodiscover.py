import importlib

from django.apps import apps


def autodiscover_events():
    """
    Discover and register event handlers for every installed app.

    For each app we import two optional modules:

    * ``{app.name}.events`` — may expose a ``register_events()`` callable
      that explicitly subscribes handlers.
    * ``{app.name}.handlers`` — may contain handlers decorated with
      ``@listens_to``, which self-register on import.

    Missing modules are ignored so apps without events are unaffected.
    """
    for app in apps.get_app_configs():
        _import_and_register(f"{app.name}.events")
        _import_and_register(f"{app.name}.handlers")


def _import_and_register(module_name: str) -> None:
    try:
        module = importlib.import_module(module_name)
    except ModuleNotFoundError:
        return

    register = getattr(module, "register_events", None)
    if callable(register):
        register()
