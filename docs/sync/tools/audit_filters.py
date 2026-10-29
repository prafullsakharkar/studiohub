import django, os
os.environ.setdefault("DJANGO_SETTINGS_MODULE","config.settings.testing")
django.setup()
from apps.audit.api.viewsets import activity, audit_log, change_log, api_request, background_job, error_log, track
for mod in (activity, audit_log, change_log, api_request, background_job, error_log, track):
    for name in dir(mod):
        cls=getattr(mod,name)
        if isinstance(cls,type) and name.endswith("ViewSet") and getattr(cls,"filter_class",None):
            print(name, sorted(cls.filter_class.base_filters.keys()))
