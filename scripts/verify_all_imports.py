import os
import re
import sys

base_dir = os.path.abspath('frontend/src')

# Builtin / global identifiers in browser & React JSX
GLOBALS = {
    'React', 'window', 'document', 'console', 'localStorage', 'sessionStorage',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
    'cancelAnimationFrame', 'Date', 'Math', 'Number', 'String', 'Boolean', 'Array',
    'Object', 'Set', 'Map', 'JSON', 'Error', 'TypeError', 'ReferenceError', 'Promise',
    'encodeURIComponent', 'decodeURIComponent', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'URL', 'URLSearchParams', 'FormData', 'Blob', 'File', 'FileReader', 'Event', 'CustomEvent',
    'location', 'navigator', 'history', 'process', 'import', 'export', 'default', 'null', 'undefined',
    'true', 'false', 'this', 'arguments', 'Symbol', 'RegExp', 'Intl', 'fetch', 'Headers', 'Request', 'Response'
}

HTML_TAGS = {
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'input', 'select', 'option',
    'textarea', 'label', 'form', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'ul', 'ol', 'li',
    'a', 'img', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'defs', 'clippath',
    'nav', 'header', 'footer', 'main', 'section', 'article', 'aside', 'details', 'summary', 'dialog',
    'code', 'pre', 'b', 'i', 'strong', 'em', 'small', 'hr', 'br', 'iframe', 'canvas', 'audio', 'video'
}

def check_file_jsx_tags(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Find imported identifiers
    imported = set()
    for m in re.finditer(r'import\s+(?:(\w+)|\{([^}]+)\}|(\*\s+as\s+\w+))\s+from', content):
        if m.group(1):
            imported.add(m.group(1).strip())
        if m.group(2):
            for item in m.group(2).split(','):
                part = item.strip().split(' as ')
                imported.add(part[-1].strip())
        if m.group(3):
            imported.add(m.group(3).split(' as ')[-1].strip())

    # Find declared identifiers (functions, consts, classes, lets, vars)
    declared = set()
    for m in re.finditer(r'(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)', content):
        declared.add(m.group(1).strip())

    # Find all JSX tags <ComponentName
    jsx_tags = set(re.findall(r'<([A-Z][A-Za-z0-9_$.]*)', content))
    
    missing = []
    for tag in jsx_tags:
        root_tag = tag.split('.')[0]
        if root_tag not in imported and root_tag not in declared and root_tag not in GLOBALS:
            missing.append(tag)
    
    return missing

all_missing = {}
for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.jsx', '.js')) and not f.endswith(('.test.js', '.test.jsx')):
            fp = os.path.join(root, f)
            m = check_file_jsx_tags(fp)
            if m:
                rel = os.path.relpath(fp, base_dir)
                all_missing[rel] = m

print(f"Checked all files for undefined JSX tags. Found {len(all_missing)} files with missing components:")
for rel, missing in all_missing.items():
    print(f"\nFile: {rel}")
    for tag in missing:
        print(f"  -> Missing JSX component: <{tag}>")
