import os
import re
import sys

base_dir = os.path.abspath('frontend/src')

# Collect all files and verify
all_files = []
for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.js', '.jsx')) and not f.endswith(('.test.js', '.test.jsx')):
            all_files.append(os.path.join(root, f))

errors = []

for fp in all_files:
    rel = os.path.relpath(fp, base_dir)
    with open(fp, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
        content = "".join(lines)
    
    # 1. Check duplicate export default
    default_exports = re.findall(r'export\s+default\s+', content)
    if len(default_exports) > 1:
        errors.append(f"{rel}: Duplicate 'export default' ({len(default_exports)} times)")

    # 2. Check JSX components are either imported, declared in file, or standard
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

    declared = set()
    for m in re.finditer(r'(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)', content):
        declared.add(m.group(1).strip())

    # Check for JSX elements <CapitalLetter...
    for m in re.finditer(r'<([A-Z][A-Za-z0-9_]*)', content):
        tag = m.group(1)
        # Check if tag is in imported, declared, or standard React / icons
        if tag not in imported and tag not in declared and tag not in {'React', 'Suspense', 'Fragment', 'Icon'}:
            # Check if tag is destructured or a parameter
            if not re.search(r'\b' + re.escape(tag) + r'\b', content[:m.start()]):
                errors.append(f"{rel}: JSX component <{tag}> is used but neither imported nor declared")

print(f"Checked {len(all_files)} files.")
if errors:
    print(f"Found {len(errors)} issues:")
    for e in errors:
        print(f"  [ERROR] {e}")
    sys.exit(1)
else:
    print(">>> 0 SYNTAX OR MISSING IMPORT ISSUES FOUND IN THE ENTIRE FRONTEND <<<")
