"""Native integration: run in the engine image from /source/build.
python3 /source/server/test/book-native.py
"""
import json, re, subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
catalogue=json.loads(Path('/source/server/public/book-examples.json').read_text())
state={'text':['',''],'textset':[False,False],'diagram':'svg','maxresults':100,'colors':False}
seen=set(); outputs=[]
# Simple match; multiple OT sources; overlapping fragments; uncovered intervals.
for identifier in ('Matthew-1,23 ', 'Matthew-2,6 ', 'Matthew-15,4+23 ', 'John-1,23+6y '):
    command=next(c for e in catalogue['examples'] for c in e['commands'] if c.startswith('Statement '+identifier))
    run=subprocess.run(['/usr/local/bin/bibref','--json'], input=json.dumps({'command':command,'state':state}),text=True,capture_output=True,check=True)
    events=[json.loads(line) for line in run.stdout.splitlines()]
    assert events[-1]['ok'], (identifier,events)
    svg=next(e for e in events if e.get('kind')=='svg')
    fragments=svg['fragments']; ids={f['id'] for f in fragments}
    assert len(ids)==len(fragments), identifier
    svg_ids={node.get('id') for node in ET.fromstring(svg['text']).iter()}
    for fragment in fragments:
        assert fragment['id'] in svg_ids, (identifier,fragment['id'],svg_ids)
        assert len(fragment['greek'])==fragment['length']
        assert fragment['end']-fragment['start']+1==fragment['length']
        assert re.fullmatch(r'\d+:\d+(?:\+\d+)? \d+:\d+(?:-\d+)?',fragment['reference'])
        assert set(fragment['matches'])<=ids
        seen.add(fragment['kind'])
    if identifier=='Matthew-1,23 ':
        intro=next(f for f in fragments if f['kind']=='introduction')
        assert intro['reference']=='1:22 1:22'
        assert intro['length']==66
        ot=next(f for f in fragments if f['module']=='LXX')
        assert ot['reference']=='7:14+35 7:14'
        assert ot['length']==71
    outputs.append({'statement':identifier.strip(),'blocks':len(fragments),'kinds':sorted({f['kind'] for f in fragments})})
assert {'quotation','introduction','unquoted'}<=seen, seen
print(json.dumps(outputs,ensure_ascii=False))
