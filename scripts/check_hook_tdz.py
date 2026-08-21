import re

with open('frontend/src/components/sales/SaleForm.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Let's find where functions are declared as `const name = (...) =>` or `const name = function`
const_funcs = {}
for m in re.finditer(r'const\s+([A-Za-z0-9_$]+)\s*=\s*(?:useCallback\s*\(\s*)?(?:\((?:[^)]*)\)|[A-Za-z0-9_$]+)\s*=>', code):
    name = m.group(1)
    line = code[:m.start()].count('\n') + 1
    const_funcs[name] = line

print(f"Found {len(const_funcs)} const functions in SaleForm.jsx")

# Now let's check where each function is CALLED (with `name(`) in top-level component scope (not inside another function body)
# To find top-level calls vs inside function calls, let's look at useMemo / useState initializers
for m in re.finditer(r'const\s+\[?\w+\]?\s*=\s*(?:useState|useMemo)\s*\((.*?)\);', code, re.DOTALL):
    init_expr = m.group(1)
    call_line = code[:m.start()].count('\n') + 1
    for func_name, decl_line in const_funcs.items():
        if re.search(r'\b' + re.escape(func_name) + r'\s*\(', init_expr):
            if call_line < decl_line:
                print(f"CRITICAL TDZ in Hook on line {call_line}: calls '{func_name}' which is declared later on line {decl_line}!")
