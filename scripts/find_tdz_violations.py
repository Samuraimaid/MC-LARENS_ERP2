import os
import re

base_dir = os.path.abspath('frontend/src')

def analyze_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    
    # Track top-level const / let / var declarations and where they are defined
    top_level_defs = {} # name -> line_idx
    
    # Simple regex for top-level const / let declarations
    for idx, line in enumerate(lines):
        match = re.match(r'^(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_$]+)\s*=', line.strip())
        if match:
            var_name = match.group(1)
            top_level_defs[var_name] = idx
    
    # Check if any top-level const is referenced in module scope BEFORE its definition
    issues = []
    in_function_depth = 0
    
    for idx, line in enumerate(lines):
        stripped = line.strip()
        # rough function check
        if stripped.startswith(('function ', 'const ', 'export function ', 'export const ')):
            pass
        
        # For each top level def, if used in a line BEFORE its definition, check if it's evaluated at top level
        for var_name, def_idx in top_level_defs.items():
            if idx < def_idx:
                # Check if var_name is used in this line as a whole word
                pattern = r'\b' + re.escape(var_name) + r'\b'
                if re.search(pattern, line):
                    # Check if this line is a top-level assignment being evaluated immediately
                    # e.g. const X = var_name;
                    decl_match = re.match(r'^(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_$]+)\s*=\s*(.+)', stripped)
                    if decl_match:
                        rhs = decl_match.group(2)
                        # If rhs directly invokes or evaluates var_name (not inside a function body)
                        if not rhs.startswith('(') and not '=>' in rhs and not 'function' in rhs:
                            if re.search(pattern, rhs):
                                issues.append((idx + 1, def_idx + 1, var_name, line.strip()))
    return issues

all_issues = []
for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.js', '.jsx')):
            fp = os.path.join(root, f)
            issues = analyze_file(fp)
            if issues:
                all_issues.append((fp, issues))

print(f"Found {len(all_issues)} files with potential TDZ / top-level forward references:")
for fp, issues in all_issues:
    rel = os.path.relpath(fp, base_dir)
    print(f"\nFile: {rel}")
    for use_line, def_line, var_name, line_content in issues:
        print(f"  Line {use_line} uses '{var_name}' (defined at line {def_line}): {line_content}")
