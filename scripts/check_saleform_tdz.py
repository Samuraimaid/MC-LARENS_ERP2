import re

with open('frontend/src/components/sales/SaleForm.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Collect all const/let declarations inside SaleForm component
declarations = {} # name -> line_number
usages = {} # name -> [line_numbers]

for i, line in enumerate(lines, 1):
    # Match const x = or let x = or function x(
    for m in re.finditer(r'(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=', line):
        var_name = m.group(1)
        if var_name not in declarations:
            declarations[var_name] = i

# Now find all identifiers used on each line
for i, line in enumerate(lines, 1):
    # Ignore comments and strings
    cleaned = re.sub(r'//.*', '', line)
    cleaned = re.sub(r'"[^"]*"', '""', cleaned)
    cleaned = re.sub(r"'[^']*'", "''", cleaned)
    for m in re.finditer(r'\b([A-Za-z0-9_$]+)\b', cleaned):
        name = m.group(1)
        if name in declarations:
            dec_line = declarations[name]
            if i < dec_line:
                # Used BEFORE declaration!
                # Is it inside a callback/function or evaluated immediately?
                print(f"Variable '{name}' declared on line {dec_line} is used BEFORE on line {i}: {line.strip()}")
