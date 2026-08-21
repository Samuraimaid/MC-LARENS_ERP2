import re

with open('frontend/src/components/sales/SaleForm.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Collect all const/let declarations inside SaleForm
declarations = {}
for i, line in enumerate(lines, 1):
    for m in re.finditer(r'(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=', line):
        name = m.group(1)
        if name not in declarations:
            declarations[name] = i

print(f"Total declarations found: {len(declarations)}")

# Now find all useMemo, useCallback, useEffect dependency arrays
# Check if any identifier in the dependency array is declared AFTER the hook line
for i, line in enumerate(lines, 1):
    # Match dependency arrays: ], [a, b, c])
    # Or multiline
    pass

full_text = ''.join(lines)
for m in re.finditer(r'use(?:Callback|Memo|Effect)\s*\((.*?)\s*,\s*\[(.*?)\]\s*\)', full_text, re.DOTALL):
    hook_start_pos = m.start()
    hook_line = full_text[:hook_start_pos].count('\n') + 1
    deps_text = m.group(2)
    # Find all identifiers in deps_text
    deps = re.findall(r'\b([A-Za-z0-9_$]+)\b', deps_text)
    for dep in deps:
        if dep in declarations:
            dec_line = declarations[dep]
            if hook_line < dec_line:
                print(f"CRITICAL TDZ in dependency array on line {hook_line}: dependency '{dep}' is declared on line {dec_line}!")
