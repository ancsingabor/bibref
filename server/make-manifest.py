import hashlib
import json
from pathlib import Path
import subprocess

root = Path('/opt/bibref')
root.mkdir(exist_ok=True)
metadata = json.loads(subprocess.check_output(['/usr/local/bin/bibref', '--json'], input=b'{"metadata":true}\n', cwd='/source/build'))
digest = hashlib.sha256(Path('/usr/local/bin/bibref').read_bytes())
modules = []
for config in sorted(Path('/root/.sword/mods.d').glob('*.conf')):
    settings = {}
    for line in config.read_text().splitlines():
        if '=' in line:
            key, value = line.split('=', 1)
            settings[key] = value
        elif line.startswith('[') and line.endswith(']'):
            settings['name'] = line[1:-1]
    modules.append({'name': settings['name'], 'version': settings['Version'], 'license': settings.get('DistributionLicense', ''),
                    'source': f'https://crosswire.org/sword/modules/ModInfo.jsp?modName={settings["name"]}'})
    digest.update(config.read_bytes())
for data in sorted(Path('/root/.sword/modules').rglob('*')):
    if data.is_file():
        digest.update(str(data.relative_to('/root/.sword')).encode())
        digest.update(data.read_bytes())
metadata.pop('type')
metadata.update(engineVersion=digest.hexdigest(), modules=modules)
(root / 'manifest.json').write_text(json.dumps(metadata, ensure_ascii=False))
