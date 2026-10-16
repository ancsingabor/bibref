"""Rebuild catalogue from pinned TeXmacs source; PDF is used only for page auditing.
Usage: bundled-python server/scripts/build-book-catalogue.py /path/to/reference.pdf
"""
import ast, hashlib, json, re, sys, unicodedata
from pathlib import Path
from pypdf import PdfReader
ROOT = Path(__file__).resolve().parents[1]
s = (ROOT / 'book/bibref-hu.tm').read_text(encoding='latin1')
pages = [p.extract_text() for p in PdfReader(sys.argv[1]).pages]
greek_names = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega'.split()
greek = dict(zip(greek_names, 'αβγδεζηθικλμνξοπρστυφχψω'))
greek.update(varepsilon='ε', varphi='φ', vartheta='θ', varsigma='ς')
def entity(m):
    name = m[1]
    if name.startswith('#'): return chr(int(name[1:],16))
    if name.lower() in greek:
        char = greek[name.lower()]
        return char.upper() if name[0].isupper() else char
    return {'gtr':'>','less':'<','less-equal':'<=','gtr-equal':'>=','neq':'!=','times':'*'}.get(name, '\\<'+name+'\\>')
def clean(v):
    v = re.sub(r'\\<([^>]+)\\>', entity, v)
    v = v.replace('\\ ', ' ').replace('\\;', ' ').replace('\\|', '|')
    # TeXmacs inline formatting: keep the rendered final argument.
    for _ in range(20):
        newer = re.sub(r'<[^<>|]+\|([^<>]*)>', lambda m:m[1].split('|')[-1], v)
        if newer == v: break
        v = newer
    # TeXmacs wraps internal a-z encodings with printable hyphens.
    v = re.sub(r'(?<=[a-z])-\s+(?=[a-z])', '', v)
    return ' '.join(v.split())
# PDF uses Greek font notation in its text layer.
font = dict(zip('αβγδεζηθικλμνξοπρστυφχψως', 'abgdezhjiklmnxoprstufqywc'))
def compact(v):
    v = ''.join(font.get(c.lower(),c.lower()) for c in v)
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD',v))
normalized = [compact(p) for p in pages]
entries=[]; setters={}; chapter=''; section=''; last_page=10; exercises=0; chapter_no=0; in_solution=False; in_exercise=False
# Sessions can be nested inside explanatory output. Extract every session,
# removing child sessions from its parent's output before reading inputs.
stack=[]; sessions=[]
for token in re.finditer(r'<\\session\|(bibref|python)\|default>|</session>',s):
    if token[1]: stack.append({'start':token.start(),'body':token.end(),'runtime':token[1],'children':[]})
    else:
        item=stack.pop(); raw=s[item['body']:token.start()]
        for a,b in reversed(item['children']): raw=raw[:a-item['body']]+raw[b-item['body']:]
        sessions.append((item['start'], 'session', item['runtime'],raw))
        if stack: stack[-1]['children'].append((item['start'],token.end()))
events=sessions+[(m.start(),m[1],clean(m[2]),'') for m in re.finditer(r'<(chapter|section|subsection|appendix)\|([^<>]*)>',s)]
events += [(m.start(),m[0],'','') for m in re.finditer(r'<\\exercise>|</exercise>|<\\solution\*>|</solution\*>',s)]
for position,event,value,raw in sorted(events):
    if event in ('chapter','section','subsection','appendix'):
        if event in ('chapter','appendix'):
            chapter=value; chapter_no+=1; exercises=0
        section=value; continue
    if event=='<\\exercise>': exercises+=1; in_exercise=True; continue
    if event=='</exercise>': in_exercise=False; continue
    if event=='<\\solution*>': in_solution=True; continue
    if event=='</solution*>': in_solution=False; continue
    runtime=value
    inputs=[]
    for part in re.finditer(r'<\\(unfolded-io|folded-io|input)>(.*?)</\1>',raw,re.S):
        chunks=part[2].split('<|'+part[1]+'>')
        if len(chunks)>1: inputs.append(clean(chunks[1]))
    if not inputs: continue
    diagram=any(re.match('statement\\b',x,re.I) for x in inputs)
    # Both Python sessions have already been transcribed and verified in examples.js.
    if runtime=='python':
        text=(ROOT/'public/python/examples.js').read_text()
        key='names' if len([e for e in entries if e['runtime']=='python'])==0 else 'nearest'
        source=re.search(r'\b'+key+r':\s*`(.*?)`',text,re.S)[1]
        ast.parse(source)
        commands=[]; prerequisites=[]
    else:
        commands=[('diagram svg' if re.match(r'diagram\s+(eps|ps|svg)$',x) else x) for x in inputs if x!='addbooks']
        prerequisites=[]; local=dict(setters)
        for cmd in commands:
            name=cmd.split()[0]
            needed=set()
            if re.match(r'(find|length|minunique)[12]$',name): needed.add(name[-1])
            if name in ('compare12','jaccard12','nearest12'): needed.update('12')
            for n in sorted(needed):
                if n in local and local[n] not in commands[:commands.index(cmd)] and local[n] not in prerequisites:
                    prerequisites.append(local[n])
            if re.match(r'(text|latintext|lookup|raw)[12]$',name): local[name[-1]]=cmd
        if 'maxresults' in setters and not any(c.startswith('maxresults ') for c in commands): prerequisites.insert(0,setters['maxresults'])
        if diagram and 'diagram svg' not in commands: prerequisites.insert(0,'diagram svg')
        source='\n'.join(prerequisites+commands)
        for cmd in commands:
            if re.match(r'(text|latintext|lookup|raw)[12]\b',cmd): setters[cmd.split()[0][-1]]=cmd
            if cmd.startswith('maxresults '): setters['maxresults']=cmd
    probes=[]
    primary=[c for c in inputs if c.lower().startswith('statement')] if diagram else inputs
    for cmd in primary:
        c=compact(cmd)
        if len(c)>6: probes.append(c[:110])
    candidates=[i+1 for i,p in enumerate(normalized) if any(c in p for c in probes)]
    later=[p for p in candidates if p>=last_page-1]
    candidates_for_choice=later or candidates
    if diagram and candidates_for_choice:
        full=compact(primary[0]); windows=[full[i:i+60] for i in range(0,len(full)-59,30)]
        page=max(candidates_for_choice,key=lambda p:(sum(w in normalized[p-1] for w in windows),-abs(p-last_page)))
    else:
        page=min(candidates_for_choice,key=lambda p:abs(p-last_page)) if candidates_for_choice else last_page
    last_page=max(last_page,page)
    if runtime=='python': page=22 if key=='names' else 45
    title=section+' — '+(next((x.split('connects')[0] for x in inputs if x.lower().startswith('statement')), inputs[0])[:100])
    if runtime=='python': title=section+' — '+('Names in Matthew 1' if key=='names' else 'Nearest passages in Moses')
    modules=sorted(set(re.findall(r'\b(?:LXX|SBLGNT|StatResGNT|HunRUF|KJV|Aleppo)\b',source)))
    unavailable=''
    if any(re.search(r'getrefs.*\b(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\s+1:1\b',x) for x in inputs): unavailable='Whole-book searches may exceed browser memory and execution limits. Download to run locally.'
    if any('\\<' in x or '<\\' in x for x in inputs): unavailable='This source block needs a manual transcription before browser execution.'
    entries.append(dict(id='book-'+hashlib.sha256((runtime+'\n'+'\n'.join(inputs)).encode()).hexdigest()[:12],title=title,chapter=chapter,section=section,page=page,pageVerified=bool(candidates) or runtime=='python',exercise=(f'{"A" if chapter_no>2 else chapter_no}.{exercises}' if in_solution or in_exercise else None),runtime=runtime,kind='python' if runtime=='python' else 'diagrams' if diagram else 'commands',modules=modules,prerequisites=prerequisites,commands=commands,source=source,unavailable=unavailable,hungarian=sorted(set(re.findall(r'lookup HunRUF ([A-Za-z_]+ \d+:\d+)',source)))))
# The appendix also refers to this downloadable full-corpus shell example.
entries.append(dict(id='book-getrefs-all',title='Betűhelyes egyezések keresése — Full-corpus search',chapter='Algoritmikus leírás',section='Betűhelyes egyezések keresése',page=168,pageVerified=True,exercise=None,runtime='shell',kind='commands',modules=['LXX','StatResGNT'],prerequisites=[],commands=[],source=(ROOT.parent/'examples/getrefs-all.sh').read_text(),unavailable='This shell script takes several hours and recommends at least 24 GB RAM. Download it and run from the examples directory of a local bibref checkout; it exceeds browser execution limits.',hungarian=[]))
# Duplicate sessions remain reachable under a unique, stable occurrence suffix.
seen={}
for e in entries:
    n=seen.get(e['id'],0);seen[e['id']]=n+1
    if n:e['id']+=f'-{n+1}'
# Only expose Hungarian context for attested lookup references. Psalms has
# explicit chapter pairs, never a blanket chapter offset or a Greek-fragment translation.
hungarian=set(ref for e in entries for ref in e['hungarian'])
context_mappings={}
for ref in sorted(hungarian):
    book,verse=ref.split()
    nt_books={'Matthew','Mark','Luke','John','Acts','Romans','I_Corinthians','II_Corinthians','Galatians','Ephesians','Hebrews','James','I_Peter','Revelation_of_John'}
    same_numbering_ot={'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Isaiah','Hosea','Micah','Zechariah','Malachi','Proverbs','Job','II_Samuel'}
    editions=('StatResGNT','SBLGNT') if book in nt_books else ('LXX',) if book in same_numbering_ot else ()
    for edition in editions: context_mappings[f'{edition} {ref}']=[ref]
# Verified chapter pairs used by the book; split/merged psalms are omitted.
psalm_pairs={2:2,8:8,13:14,15:16,18:19,21:22,30:31,33:34,34:35,39:40,40:41,43:44,44:45,46:47,50:51,68:69,69:70,77:78,81:82,82:83,86:87,90:91,93:94,94:95,101:102,103:104,109:110,116:117,117:118}
for greek_chapter,hu_chapter in psalm_pairs.items():
    for ref in sorted(hungarian):
        if ref.startswith(f'Psalms {hu_chapter}:'):
            verse=ref.split(':')[1]
            context_mappings[f'LXX Psalms {greek_chapter}:{verse}']=[ref]
if 'Jeremiah 31:15' in hungarian: context_mappings['LXX Jeremiah 38:15']=['Jeremiah 31:15']
output={'edition':'bibref-hu-20260812+.pdf','sourceCommit':'2bc9dd264a272762cdde5831ed4ce4e925d2b3ef','examples':entries,'contextMappings':context_mappings}
(ROOT/'public/book-examples.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
audit={'terminalSessions':sum(e['runtime']=='bibref' for e in entries),'pythonSessions':sum(e['runtime']=='python' for e in entries),'unmatchedPages':[{'id':e['id'],'title':e['title'],'estimatedPage':e['page']} for e in entries if not e['pageVerified']], 'transcriptionRequired':[e['id'] for e in entries if 'transcription' in e['unavailable']]}
(ROOT/'book/coverage.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(audit,ensure_ascii=False))
