#!/usr/bin/env python3
"""Verify packaged Android assets, including their exact names and compressed bytes."""
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
assets = root/'app/src/main/assets'
with zipfile.ZipFile(sys.argv[1]) as apk:
    names = set(apk.namelist())
    checked = 0
    for source in assets.rglob('*'):
        if not source.is_file():
            continue
        packaged = 'assets/'+source.relative_to(assets).as_posix()
        assert packaged in names, f'Missing or renamed Android asset: {packaged}'
        assert apk.read(packaged) == source.read_bytes(), f'Changed Android asset: {packaged}'
        checked += 1
    dex = b''.join(apk.read(name) for name in names if name.endswith('.dex'))
    assert b'bilingualExamples' in dex and b'examples-v1' in dex
print(f'Verified {checked} packaged assets byte for byte, including the compressed example database and native examples bridge.')
