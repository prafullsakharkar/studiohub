import re, sys, os, json
root=sys.argv[1]; routes=[l.split('\t') for l in open(sys.argv[2]).read().splitlines()]
# backend route regexes keyed by method set
import collections
br=[]
for r in routes:
    p=r[0]
    if not p.startswith('api/'): continue
    acts=json.loads(r[3]) if len(r)>3 and r[3] else None
    methods=set(m.upper() for m in acts) if acts else {'*'}
    rx='^/'+re.sub(r'\\\{[^}]+\\\}', '[^/]+', re.escape(p.rstrip('/')))+'/?$'
    br.append((re.compile(rx),methods,p,r[2]))
CALL=re.compile(r'\.(get|post|put|patch|delete|upload|download)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\(\s*([`\'"])((?:(?!\2).)*)\2', re.S)
SUPER=re.compile(r'super\(\s*[`\'"]([^`\'"]+)[`\'"]')
rows=[]
for dp,_,fs in os.walk(root):
    if '__tests__' in dp or 'generated' in dp: continue
    for f in fs:
        if not f.endswith(('.ts','.tsx')) or '.test.' in f or '.spec.' in f: continue
        fp=os.path.join(dp,f); src=open(fp,encoding='utf-8').read()
        base=None; m=SUPER.search(src)
        if m: base=m.group(1).rstrip('/')+'/'
        for m in CALL.finditer(src):
            meth=m.group(1).upper(); url=m.group(3)
            if not (url.startswith('/') or url.startswith('${')): continue
            if base: url=url.replace('${this.basePath}',base).replace('${this.baseUrl}',base)
            norm=re.sub(r'\$\{[^}]+\}','{x}',url).split('?')[0]
            norm=re.sub(r'/+','/',norm)
            line=src.count('\n',0,m.start())+1
            hm='GET' if meth=='DOWNLOAD' else ('POST' if meth=='UPLOAD' else meth)
            match=None
            if norm.startswith('/api/'):
                cand=re.sub(r'\{x\}','00000000-0000-0000-0000-000000000000',norm)
                for rx,ms,p,v in br:
                    if rx.match(cand):
                        match=(p,v,'*' in ms or hm in ms); 
                        if match[2]: break
            rows.append(dict(file=os.path.relpath(fp,root),line=line,method=meth,url=url,norm=norm,
                             route=match[0] if match else None, view=match[1] if match else None,
                             status=('OK' if match and match[2] else ('METHOD?' if match else ('UNRESOLVED' if not norm.startswith('/api/') else 'NO_ROUTE')))))
json.dump(rows,open(sys.argv[3],'w'),indent=1)
c=collections.Counter(r['status'] for r in rows); print(len(rows),c)
