import django, os, sys, json
os.environ.setdefault("DJANGO_SETTINGS_MODULE","config.settings.testing")
django.setup()
from django.urls import get_resolver, URLResolver
seen={}
def walk(pats):
    for p in pats:
        if isinstance(p, URLResolver): walk(p.url_patterns); continue
        cb=p.callback; cls=getattr(cb,"cls",None) or getattr(cb,"view_class",None)
        if not cls or not cls.__module__.startswith("apps."): continue
        k=cls.__module__+"."+cls.__name__
        if k in seen: continue
        def n(x):
            if x is None: return None
            if isinstance(x,(list,tuple)): return [getattr(i,"__name__",str(i)) for i in x]
            return getattr(x,"__name__",str(x))
        fs=getattr(cls,"filterset_class",None)
        fsf=None
        if fs is not None:
            try: fsf=sorted(fs.base_filters.keys())
            except Exception: fsf="?"
        sc=getattr(cls,"serializer_class",None)
        sca={}
        for attr in ("serializer_action_classes","action_serializers","serializer_classes","read_serializer_class","write_serializer_class","list_serializer_class","create_serializer_class","update_serializer_class","detail_serializer_class"):
            v=getattr(cls,attr,None)
            if v: sca[attr]={a:n(s) for a,s in v.items()} if isinstance(v,dict) else n(v)
        seen[k]=dict(
            perms=n(getattr(cls,"permission_classes",None)),
            permission_map=getattr(cls,"permission_map",None),
            required_permission=getattr(cls,"required_permission",None),
            auth=n(getattr(cls,"authentication_classes",None)),
            serializer=n(sc), serializers=sca,
            filterset=n(fs), filterset_fields=getattr(cls,"filterset_fields",None), filters=fsf,
            search=getattr(cls,"search_fields",None), ordering_fields=getattr(cls,"ordering_fields",None), ordering=getattr(cls,"ordering",None),
            pagination=n(getattr(cls,"pagination_class",None)),
            lookup=getattr(cls,"lookup_field",None),
            throttle=getattr(cls,"throttle_scope",None),
            parsers=n(getattr(cls,"parser_classes",None)),
            renderers=n(getattr(cls,"renderer_classes",None)),
            http=getattr(cls,"http_method_names",None),
        )
walk(get_resolver().url_patterns)
json.dump(seen, open(sys.argv[1],"w"), indent=1, default=str)
print(len(seen))
