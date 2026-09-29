# Generates src/maps/demo.js — fictional "Millbrook" test battlefield at 150-yard hexes (original design).
import json
C,R=32,21
EV=[(1,0),(0,1),(-1,1),(-1,0),(-1,-1),(0,-1)]; OD=[(1,0),(1,1),(0,1),(-1,0),(0,-1),(1,-1)]
def nb(c,r,d): dc,dr=(OD if r&1 else EV)[d]; return c+dc,r+dr
inb=lambda c,r:0<=c<C and 0<=r<R
def cube(c,r): x=c-(r-(r&1))//2; return x,r,-x-r
def dist(p,q): a,b=cube(*p),cube(*q); return max(abs(a[i]-b[i]) for i in range(3))
def path(a,b,avoid=None):
    p=[a]
    while p[-1]!=b:
        cands=[x for x in (nb(*p[-1],d) for d in range(6)) if inb(*x)]
        if avoid: cands=[x for x in cands if x==b or not avoid(x)] or cands
        p.append(min(cands,key=lambda x:(dist(x,b),abs(x[1]-b[1]))))
    return p
def chain(wps,avoid=None):
    out=[wps[0]]
    for w in wps[1:]: out+=path(out[-1],w,avoid)[1:]
    return out
H=[[0]*C for _ in range(R)]; T=[['g']*C for _ in range(R)]
for r in range(R):
    for c in range(C):
        h=0
        if c<=3: h=1+(1 if (c<=2 and r<=8) else 0)
        if 16<=c<=18: h=1
        if c==19: h=2
        if 20<=c<=22: h=3
        if c==23: h=2
        if c>=24: h=1
        if r>=17 and c>=19: h=max(1,h-1)
        H[r][c]=h
for c,r in[(22,1),(23,1),(22,2),(23,2)]: H[r][c]=4
river=chain([(7,0),(6,5),(6,9),(7,12),(6,15),(7,17),(7,20)])
for c,r in river: T[r][c]='w'; H[r][c]=0
for r in range(R):
    for c in range(C):
        if T[r][c]!='g': continue
        if c<=3 and r<=5: T[r][c]='f'
        if 10<=c<=16 and (3<=r<=7 or 12<=r<=17): T[r][c]='c'
        if 25<=c<=28 and (r<=7 or r>=13): T[r][c]='f'
for c,r in[(13,13),(14,13),(13,14),(14,14)]: T[r][c]='o'
T[9][13]='h'
for c,r in[(21,10),(22,10),(21,9),(22,9),(20,10)]: T[r][c]='t'
for c,r in[(22,1),(23,1)]: T[r][c]='k'
T[17][23]='x'
for c,r in[(8,19),(9,19),(10,19),(8,20),(9,20),(10,20),(11,20)]:
    if T[r][c]!='w': T[r][c]='s'; H[r][c]=0
isriver=lambda x:T[x[1]][x[0]] in 'wbd'
pike=[(c,10) for c in range(C)]
for c,r in pike:
    if T[r][c]=='w': T[r][c]='b'
north=chain([(22,9),(22,0)])
south=chain([(21,10),(20,13),(19,16),(22,16),(23,17),(31,16)])
fordx=[x for x in river if x[1]==17][0]; T[17][fordx[0]]='d'
fordroad=chain([(0,17),(fordx[0]-1,17),fordx,(fordx[0]+1,17),(17,16),(19,16)],avoid=lambda x:isriver(x) and x!=fordx)
roads=[{'major':1,'p':pike},{'major':0,'p':north},{'major':0,'p':south},{'major':0,'p':fordroad}]
for rd in roads:
    for (c,r) in rd['p']:
        if T[r][c]=='w': print('WARN road on river',c,r)
sunken=[(19,16),(20,16),(21,16),(22,16)]
for _ in range(6):
    for r in range(R):
        for c in range(C):
            for d in range(6):
                a,b=nb(c,r,d)
                if inb(a,b) and H[b][a]-H[r][c]>2: H[r][c]=H[b][a]-2
edges={}
def add(c,r,d,t):
    a,b=nb(c,r,d)
    if not inb(a,b): return
    k=min((c,r,d),(a,b,(d+3)%6)); edges.setdefault(k,set()).add(t)
for r in range(R):
    for c in range(C):
        for d in range(6):
            a,b=nb(c,r,d)
            if not inb(a,b): continue
            if c==19 and 4<=r<=15 and a<=18: add(c,r,d,'wall')
            if T[r][c]=='c' and T[b][a] not in 'cw': add(c,r,d,'fence')
            if r==5 and 8<=c<=17 and b==6 and T[r][c] not in 'wbd' and T[b][a] not in 'wbd': add(c,r,d,'stream')
E=[[k[0],k[1],k[2],sorted(v)] for k,v in edges.items()]
m={'name':'Millbrook (test battlefield)','scale':'150 yd hexes','cols':C,'rows':R,'terrain':[''.join(x) for x in T],'height':[''.join(map(str,x)) for x in H],
 'roads':roads,'sunken':sunken,'edges':E,'supply':[[0,10,'US'],[0,17,'US'],[31,10,'CS'],[31,16,'CS']],
 'objectives':[[21,10,'Millbrook',20,'CS'],[22,1,'Carrow Knoll',10,'CS'],[7,10,'Stone Bridge',10,'US'],[20,16,'Sunken Lane',10,'CS'],[13,9,'Dunmore Farm',5,None]],
 'labels':[['Carrow Knoll',22,1,-0.3],['Harper Creek',12,5,-0.2],['Millbrook',21,10,0.95],['Stone Bridge',6,10,-0.6],["Lyle's Ford",fordx[0],17,-0.55],['Blackwater Swamp',9,20,0.1],['Fort Reyes',23,17,0.95],['Sunken Lane',20,16,0.65],['Dunmore Farm',13,9,-0.6],['Seminary Ridge',21,5,0.1]]}
open('/home/claude/cwg3/src/maps/demo.js','w').write('window.MAP_DEMO='+json.dumps(m,separators=(',',':'))+';\n')
print('\n'.join(m['terrain']));print(len(E),'edges')
