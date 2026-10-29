import django, os, sys, json
os.environ.setdefault("DJANGO_SETTINGS_MODULE","config.settings.testing")
django.setup()
from apps.core.management.commands import init_platform as ip
codes={c for c,_,_ in ip.PERMISSION_SPECS}|set(getattr(ip,"OPT_IN_PERMISSION_CODES",()))
roles={r["code"]:(sorted(r["permissions"]) if r.get("permissions") is not None else ["<ALL>"]) for r in ip.ROLE_SPECS}
# also every permission referenced by viewsets
vm=json.load(open(sys.argv[1]))
used=set()
for v in vm.values():
    for p in (v.get("permission_map") or {}).values():
        if isinstance(p,(list,tuple)): used|=set(p)
        elif isinstance(p,str): used.add(p)
json.dump({"catalog":sorted(codes),"used_by_views":sorted(used),"roles":{k:len(v) for k,v in roles.items()}, "role_perms":roles},open(sys.argv[2],"w"),indent=1)
print(len(codes),len(used), sorted(used-codes)[:40])
