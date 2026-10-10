#!/usr/bin/env python3
"""Structural design audit only. Does not launch a browser or certify accessibility."""
from pathlib import Path
from html.parser import HTMLParser
import json, hashlib, os
ROOT=Path(__file__).resolve().parent
assert os.getuid()==1002 and ROOT==Path('/srv/dental-lab/docs/design')
class Audit(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=set();self.labels=[];self.controls=[];self.refs=[];self.scripts=[];self.language=None;self.viewport=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:
            assert a['id'] not in self.ids, ('duplicate',a['id'])
            self.ids.add(a['id'])
        if tag=='html':self.language=a.get('lang')
        if tag=='meta' and a.get('name')=='viewport':self.viewport=True
        if tag=='label':self.labels.append(a.get('for'))
        if tag in ('input','textarea','select'):
            assert 'disabled' in a, ('active input',a)
            self.controls.append(a.get('id'));assert 'value' not in a
        if tag=='button':assert a.get('type')=='button'
        if tag=='script':self.scripts.append(a.get('src'))
        if tag in ('iframe','form'):raise AssertionError(('forbidden resource',tag))
        for k in ('href','src'):
            if k in a:self.refs.append(a[k])
        for k in ('aria-labelledby','aria-describedby'):
            if k in a:self.refs.extend('#'+v for v in a[k].split())
def luminance(value):
    rgb=[int(value[i:i+2],16)/255 for i in (1,3,5)]
    rgb=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in rgb]
    return sum(x*y for x,y in zip(rgb,(.2126,.7152,.0722)))
def contrast(a,b):
    x,y=sorted((luminance(a),luminance(b)),reverse=True)
    return (x+.05)/(y+.05)
tokens=json.loads((ROOT/'tokens.json').read_text())
c=tokens['colors'];pairs=[('text','surface',4.5),('secondary','surface',4.5),('on_primary','primary',4.5),('warning','warning_bg',4.5),('danger','danger_bg',4.5),('success','success_bg',4.5),('focus','surface',3),('input_border','surface',3)]
ratios={}
for fg,bg,minimum in pairs:
    ratio=contrast(c[fg],c[bg]);assert ratio>=minimum,(fg,bg,ratio)
    ratios[fg+'/'+bg]=round(ratio,2)
assert tokens['font']['body_px']==16 and tokens['touch_target_px']>=44
results=[]
for p in sorted(ROOT.glob('*preview.html')):
    assert not p.is_symlink() and p.stat().st_uid==1002 and p.stat().st_mode&0o777==0o600
    source=p.read_text();a=Audit();a.feed(source)
    assert a.language=='sq' and a.viewport,p.name
    assert set(a.controls)<=set(a.labels),(p.name,a.controls)
    assert 'min-height:44px' in source and '@media' in source,p.name
    for ref in a.refs:
        assert not ref.startswith(('http:','https:','//','data:','javascript:')),ref
        if ref.startswith('#'):assert ref[1:] in a.ids,(p.name,ref)
        else:
            file,_,anchor=ref.partition('#')
            assert (ROOT/file).is_file() and not (ROOT/file).is_symlink(),(p.name,ref)
    if p.name=='fdi-preview.html':
        assert a.scripts==['fdi-model.js',None]
        assert source.count('data-fdi=')==32
    else:assert not a.scripts,p.name
    results.append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'structural':'passed','browser':'not_executed'})
report={'scope':'synthetic static design only','structural_previews':results,'contrast_calculated':ratios,'browser':'not_executed','touch':'not_executed','keyboard':'not_executed','screen_reader':'not_executed','certification':False,'point_4_4':'pending_real_acceptance','point_4_14':'blocked_real_acceptance'}
path=ROOT/'design-validation.json'
assert not path.is_symlink()
fd=os.open(path,os.O_CREAT|os.O_WRONLY|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f:json.dump(report,f,ensure_ascii=False,indent=2);f.write('\n')
print('Structural previews:',len(results),'OK; calculated contrasts:',ratios)
print('No browser/touch/keyboard/screen-reader test executed. Points4.4/4.14 not closed.')
