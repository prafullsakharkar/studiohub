import django, os, sys, json
os.environ.setdefault("DJANGO_SETTINGS_MODULE","config.settings.testing")
django.setup()
from django.urls import get_resolver, URLPattern, URLResolver
out=[]
def walk(pats, prefix=""):
    for p in pats:
        if isinstance(p, URLResolver):
            walk(p.url_patterns, prefix+str(p.pattern))
        else:
            cb=p.callback
            cls=getattr(cb,"cls",None) or getattr(cb,"view_class",None)
            actions=getattr(cb,"actions",None)
            out.append(dict(path=prefix+str(p.pattern), name=p.name,
                view=(cls.__module__+"."+cls.__name__) if cls else cb.__module__+"."+cb.__name__,
                actions=actions,
                perms=[x.__name__ for x in getattr(cls,"permission_classes",[])] if cls else None))
walk(get_resolver().url_patterns)
json.dump(out, open(sys.argv[1],"w"), indent=1, default=str)
print(len(out))
