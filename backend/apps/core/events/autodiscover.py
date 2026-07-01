import importlib

from django.apps import apps


def autodiscover_events():
    for app in apps.get_app_configs():
        try:
            module = importlib.import_module(f"{app.name}.events")

            if hasattr(module, "register_events"):
                module.register_events()

        except ModuleNotFoundError:
            continue
