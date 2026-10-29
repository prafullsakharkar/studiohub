import re, os, sys, json, collections
root=sys.argv[1]; routes=[l.split('\t') for l in open(sys.argv[2]).read().splitlines()]
lits=json.load(open(sys.argv[3]))
srcs={}
for dp,_,fs in os.walk(root):
    if 'generated' in dp or '__tests__' in dp or 'core/testing' in dp: continue
    for f in fs:
        if f.endswith(('.ts','.tsx')) and '.test.' not in f:
            fp=os.path.join(dp,f); srcs[os.path.relpath(fp,root)]=open(fp,encoding='utf-8').read()
fe_norm=set(r['norm'].rstrip('/') for r in lits if not r['test'])
out=[]
for r in routes:
    p=r[0]
    if not p.startswith('api/v1/') and not p.startswith('api/organizations'): continue
    if not p.endswith('/') and p+'/' in {x[0] for x in routes}: continue
    acts=json.loads(r[3]) if len(r)>3 and r[3] else {}
    segs=p.rstrip('/').split('/')
    # base = path up to first param or the full static path
    base='/'+'/'.join(segs[:next((i for i,s in enumerate(segs) if s.startswith('{')),len(segs))])
    tail=[s for s in segs[len(base.strip('/').split('/')):] if not s.startswith('{')]
    files=[f for f,s in srcs.items() if base in s or base.replace('/api/v1','') + '/' in s]
    if tail:
        act=tail[-1]
        used=any(("/"+act) in srcs[f] or (act+"/") in srcs[f] for f in files)
    else:
        used=bool(files)
    out.append((p, r[2], ','.join(f"{k.upper()}:{v}" for k,v in acts.items()) if acts else '', 'USED' if used else 'UNUSED', files[:3]))
# second pass: calls built as base + segment (e.g. ${this.basePath}bulk-create/)
refined=[]
for p,v,a,u,files in out:
    if u=='UNUSED':
        static=[s for s in p.rstrip('/').split('/') if not s.startswith('{')]
        rx=re.compile("[/'\"`}]"+re.escape(static[-1])+"[/'\"`]")
        hit=[]
        for k in range(len(static)-1,2,-1):
            anc='/'+'/'.join(static[:k])
            hit=[f for f,s in srcs.items() if any(anc+q in s for q in ("'",'/','`','"')) and rx.search(s)]
            if hit: break
        if hit: u,files='USED?',hit[:3]
    refined.append((p,v,a,u,files))
out=refined
json.dump(out,open(sys.argv[4],'w'),indent=1)
c=collections.Counter(o[3] for o in out); print(c)
