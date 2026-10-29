import django, os, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE","config.settings.testing")
django.setup()
from django.apps import apps
LOCAL={"core","identity","settings","audit","production","deliveries","publishing","scheduling","masterdata"}
BASE_SKIP={"id","created_at","updated_at","created_by","updated_by","is_deleted","deleted_at","deleted_by","uuid","metadata"}
out=[]
for m in apps.get_models():
    if m._meta.app_label not in LOCAL or m._meta.abstract: continue
    fields=[f.name for f in m._meta.get_fields() if getattr(f,"concrete",False)]
    soft="is_deleted" in fields
    arch=[x for x in ("is_archived","archived_at","status","is_active") if x in fields]
    rels=[]; keyf=[]; ch=[]
    for f in m._meta.get_fields():
        if not getattr(f,"concrete",False) and not f.many_to_many: continue
        if f.name in BASE_SKIP: continue
        if f.is_relation and f.related_model:
            od=getattr(getattr(f,"remote_field",None),"on_delete",None)
            rels.append(f"{f.name}->{f.related_model._meta.label}{'[M2M]' if f.many_to_many else ''}{'('+od.__name__+')' if od else ''}")
        else:
            t=f.get_internal_type().replace("Field","")
            extra=""
            if getattr(f,"max_length",None) and t in("Char","Slug","Email","URL"): extra=f"({f.max_length})"
            if getattr(f,"unique",False): extra+="!u"
            keyf.append(f"{f.name}:{t}{extra}")
            if f.choices: ch.append(f"{f.name}=[{','.join(str(c[0]) for c in f.choices)[:160]}]")
    out.append(f"### {m._meta.label}{' (soft-delete)' if soft else ''}{' lifecycle:'+','.join(arch) if arch else ''}\n- fields: {', '.join(keyf)}\n- relations: {', '.join(rels) or '—'}\n"+(f"- choices: {'; '.join(ch)}\n" if ch else ""))
open(sys.argv[1],"w").write("\n".join(out)); print(len(out))
