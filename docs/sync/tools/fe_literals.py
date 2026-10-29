import re, sys, os, json, collections
root=sys.argv[1]; routes=[l.split('\t') for l in open(sys.argv[2]).read().splitlines()]
br=[]
for r in routes:
    p=r[0]
    if p.startswith('api/'):
        br.append((re.compile('^/'+re.sub(r'\\\{[^}]+\\\}','[^/]+',re.escape(p.rstrip('/')))+'/?$'),p))
LIT=re.compile(r'[`\'"](/api/(?:v1/)?[A-Za-z0-9_/{}$.\-]*(?:\$\{[^}`]*\}[A-Za-z0-9_/.\-]*)*)')
rows=[]
for dp,_,fs in os.walk(root):
    if 'generated' in dp: continue
    for f in fs:
        if not f.endswith(('.ts','.tsx')): continue
        fp=os.path.join(dp,f); src=open(fp,encoding='utf-8').read()
        test=('__tests__' in fp) or ('.test.' in f) or ('core/testing' in fp)
        for m in LIT.finditer(src):
            u=m.group(1); norm=re.sub(r'\$\{[^}]*\}','X',u).split('?')[0]
            norm=re.sub(r'/+','/',norm)
            cand=norm.replace('X','00000000-0000-0000-0000-000000000000')
            # literal prefix (ends with /) may be a base: accept if any route startswith
            hit=any(rx.match(cand) for rx,_ in br)
            prefix=False
            if not hit:
                c2=cand.rstrip('/')
                prefix=any(('/'+p).startswith(c2+'/') for _,p in br)
            rows.append(dict(file=os.path.relpath(fp,root),line=src.count('\n',0,m.start())+1,url=u,norm=norm,test=test,
                status='OK' if hit else ('PREFIX' if prefix else 'NO_ROUTE')))
json.dump(rows,open(sys.argv[3],'w'),indent=1)
print(collections.Counter((r['status'],r['test']) for r in rows))
