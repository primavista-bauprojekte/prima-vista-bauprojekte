"""Losslessly reorder catalogue PDFs for range loading. Needs PyMuPDF.
Usage: python3 scripts/optimise-catalogues.py IN_DIR OUT_DIR"""
import sys
import fitz,os,re,zlib,struct,collections
fitz.TOOLS.mupdf_display_errors(False)
REF=re.compile(r'(?<![\w.])(\d+) (\d+) R(?![\w])')
def optimise(src,dst):
  # dedupe identical objects; image streams are never re-encoded
  tmp=dst+'.tmp'; d=fitz.open(src); d.save(tmp,garbage=4,deflate=False); d.close()
  d=fitz.open(tmp); N=d.xref_length(); body={}; stream={}
  for x in range(1,N):
    try: o=d.xref_object(x,compressed=True,ascii=True)
    except Exception: continue
    if not o or o=='null': continue
    if d.xref_is_stream(x):
      if d.xref_get_key(x,'Type')[1] in('/ObjStm','/XRef'): continue
      raw=d.xref_stream_raw(x)
      flt=d.xref_get_key(x,'Filter')[0]
      extra=''
      if flt=='null' and len(raw)>64:
        z=zlib.compress(raw,9)
        if len(z)<len(raw): raw=z; extra='/Filter/FlateDecode'
      stream[x]=(raw,extra)
    body[x]=o
  def refs(x): return [int(m[0]) for m in REF.findall(re.sub(r'\((?:\\.|[^\\()])*\)','()',body[x]))]
  pages=[d.page_xref(i) for i in range(len(d))]; pset=set(pages)
  owners=collections.defaultdict(set); porder=[]
  for i,p in enumerate(pages):
    seen=set(); order=[]; st=[p]
    while st:
      x=st.pop()
      if x in seen or x not in body or (x!=p and x in pset) or '/Type/Pages' in body[x]: continue
      seen.add(x); order.append(x); st.extend(reversed(refs(x)))
    for x in order: owners[x].add(i)
    # content first, then the rest in reading order
    porder.append([x for x in order if x in stream])
  shared=[x for x in stream if len(owners[x])>2]
  done=set(shared); seq=[]
  for o in porder:
    for x in o:
      if x not in done: done.add(x); seq.append(x)
  rest=[x for x in stream if x not in done]
  rootn=d.pdf_catalog(); info=d.xref_get_key(-1,'Info')
  ids=d.xref_get_key(-1,'ID')
  out=bytearray(b'%PDF-1.7\n%\xe2\xe3\xcf\xd3\n'); off={}
  def put(x):
    raw,extra=stream[x]; o=body[x]
    assert o.startswith('<<') and o.endswith('>>'),o[:80]
    o2=re.sub(r'/Length \d+( \d+ R)?(?=[/>\s])','',o,count=0) if '/Length ' in o else o
    off[x]=len(out); out.extend(f'{x} 0 obj\n{o2[:-2]}{extra}/Length {len(raw)}>>stream\n'.encode('latin1')); out.extend(raw); out.extend(b'\nendstream\nendobj\n')
  # unreferenced-by-pages data first page-wise, then shared resources close to the index
  for x in seq+rest+shared: put(x)
  plain=[x for x in body if x not in stream]
  first=[rootn]+[x for x in plain if '/Type/Pages' in body[x]]+pages
  plain=list(dict.fromkeys(first+plain)); nxt=N; inst={}
  for k in range(0,len(plain),200):
    part=plain[k:k+200]; num=nxt; nxt+=1; head=[];data=bytearray()
    for j,x in enumerate(part):
      head.append(f'{x} {len(data)}'); data+=body[x].encode('latin1')+b'\n'; inst[x]=(num,j)
    h=(' '.join(head)+'\n').encode(); z=zlib.compress(h+bytes(data),9)
    off[num]=len(out); out.extend(f'{num} 0 obj\n<</Type/ObjStm/N {len(part)}/First {len(h)}/Filter/FlateDecode/Length {len(z)}>>stream\n'.encode()); out.extend(z); out.extend(b'\nendstream\nendobj\n')
  xr=nxt; off[xr]=len(out); rows=bytearray()
  for x in range(xr+1):
    if x in inst: rows+=struct.pack('>BIH',2,*inst[x])
    elif x in off: rows+=struct.pack('>BIH',1,off[x],0)
    else: rows+=struct.pack('>BIH',0,0,65535 if x==0 else 0)
  z=zlib.compress(bytes(rows),9); t=f'/Root {rootn} 0 R'
  if info[0]=='xref': t+=f'/Info {info[1]}'
  if ids[0]=='array' and 'x' not in ids[0]:
    b=d.xref_get_key(-1,'ID')[1]
    if re.fullmatch(r'\[\s*<[0-9A-Fa-f]*>\s*<[0-9A-Fa-f]*>\s*\]',b): t+='/ID'+b
  out.extend(f'{xr} 0 obj\n<</Type/XRef/Size {xr+1}/W[1 4 2]{t}/Filter/FlateDecode/Length {len(z)}>>stream\n'.encode()); out.extend(z); out.extend(f'\nendstream\nendobj\nstartxref\n{off[xr]}\n%%EOF\n'.encode())
  open(dst,'wb').write(out); d.close(); os.remove(tmp)
  sh=sum(len(stream[x][0]) for x in shared)
  idx=len(out)-min(off[inst[x][0]] for x in inst)
  print(os.path.basename(src),os.path.getsize(src),'->',len(out),'shared',sh,'index',idx)
os.makedirs(sys.argv[2],exist_ok=True)
import glob
for f in sorted(glob.glob(sys.argv[1]+'/*.pdf')): optimise(f,os.path.join(sys.argv[2],os.path.basename(f)))
