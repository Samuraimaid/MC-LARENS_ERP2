import os
import re

base_dir = os.path.abspath('frontend/src')

def check_file_tdz(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    declared = set()
    imports = set()
    violations = []

    # First pass: collect imports
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('import '):
            for m in re.finditer(r'import\s+(?:(\w+)|\{([^}]+)\}|(\*\s+as\s+\w+))\s+from', stripped):
                if m.group(1):
                    imports.add(m.group(1).strip())
                if m.group(2):
                    for item in m.group(2).split(','):
                        part = item.strip().split(' as ')
                        imports.add(part[-1].strip())
                if m.group(3):
                    imports.add(m.group(3).split(' as ')[-1].strip())

    GLOBALS = {
        'React', 'window', 'document', 'console', 'localStorage', 'sessionStorage',
        'Date', 'Math', 'Number', 'String', 'Boolean', 'Array', 'Object', 'Set', 'Map', 'JSON',
        'RegExp', 'Intl', 'URL', 'URLSearchParams', 'navigator', 'location', 'history',
        'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'encodeURIComponent', 'decodeURIComponent'
    }

    in_top_level_function = False
    brace_depth = 0

    for idx, line in enumerate(lines):
        line_num = idx + 1
        stripped = line.strip()
        if not stripped or stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
            continue

        # Check for top-level declaration
        # e.g. const X = ..., let Y = ...
        if brace_depth == 0:
            decl_match = re.match(r'^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=', stripped)
            if decl_match:
                var_name = decl_match.group(1)
                # Check the right hand side for tokens that are declared LATER in top-level
                rhs = stripped[decl_match.end():]
                # Look for identifiers in rhs
                tokens = re.findall(r'\b([A-Za-z0-9_$]+)\b', rhs)
                for t in tokens:
                    if t not in declared and t not in imports and t not in GLOBALS and t != var_name:
                        # Check if t is declared later at top level
                        later = False
                        for later_line in lines[idx+1:]:
                            if re.match(r'^(?:export\s+)?(?:const|let|var|function|class)\s+' + re.escape(t) + r'\b', later_line.strip()):
                                later = True
                                break
                        if later:
                            violations.append((line_num, var_name, t))

                declared.add(var_name)
            
            fn_match = re.match(r'^(?:export\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)', stripped)
            if fn_match:
                declared.add(fn_match.group(1))

        brace_depth += line.count('{') - line.count('}')
        brace_depth = max(0, brace_depth)

    return violations

print("=== Scanning for Top-Level TDZ Violations in All Files ===")
total_v = 0
for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.jsx', '.js')):
            fp = os.path.join(root, f)
            v = check_file_tdz(fp)
            if v:
                total_v += len(v)
                rel = os.path.relpath(fp, base_dir)
                print(f"\nFile: {rel}")
                for line_num, var_name, used in v:
                    print(f"  Line {line_num}: '{var_name}' accesses '{used}' before '{used}' is declared!")

print(f"\nTotal violations found: {total_v}")
