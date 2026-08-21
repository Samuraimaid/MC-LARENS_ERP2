import os
import re

base_dir = os.path.abspath('frontend/src')

def check_props_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Find all props passed like name={variable}
    # Pattern: \b([a-zA-Z0-9_]+)=\{([a-zA-Z0-9_]+)\}
    prop_vars = re.findall(r'\b[a-zA-Z0-9_]+\s*=\s*\{([a-zA-Z0-9_]+)\}', content)
    
    # Extract declared tokens
    declared = set(re.findall(r'(?:function|class|const|let|var|import)\s+([A-Za-z0-9_$]+)', content))
    # Also find destructured const { a, b } or ( { a, b } )
    for m in re.finditer(r'\{([^}]+)\}\s*=', content):
        for item in m.group(1).split(','):
            declared.add(item.strip().split(':')[-1].split('=')[0].strip())
    for m in re.finditer(r'\(([^)]+)\)\s*=>', content):
        for item in m.group(1).split(','):
            declared.add(item.strip().split(':')[-1].split('=')[0].strip())

    GLOBALS = {
        'true', 'false', 'null', 'undefined', 'window', 'document', 'console',
        'Date', 'Math', 'Number', 'String', 'Boolean', 'Array', 'Object', 'Set', 'Map', 'JSON',
        'undefined', 'NaN', 'Infinity'
    }

    missing = []
    for var in prop_vars:
        if var not in declared and var not in GLOBALS and not re.search(r'\b' + re.escape(var) + r'\b', content[:content.find(f'={{{var}}}')]):
            # Check if declared anywhere in file
            if not re.search(r'\b(?:const|let|var|function|import)\s+[^;]*\b' + re.escape(var) + r'\b', content):
                missing.append(var)

    return list(set(missing))

print("=== Checking all JSX prop expressions ===")
for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.jsx', '.js')) and not f.endswith(('.test.js', '.test.jsx')):
            fp = os.path.join(root, f)
            m = check_props_in_file(fp)
            if m:
                rel = os.path.relpath(fp, base_dir)
                print(f"File: {rel}")
                for v in m:
                    print(f"  -> Potential undeclared prop variable: {v}")
