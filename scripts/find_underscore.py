import re

with open('frontend/src/components/sales/SaleForm.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find all occurrences of `_` as a whole word in SaleForm.jsx
matches = list(re.finditer(r'\b_\b', content))
print(f"Total occurrences of '_' as a standalone identifier in SaleForm.jsx: {len(matches)}")
for m in matches[:30]:
    start = max(0, m.start() - 40)
    end = min(len(content), m.end() + 40)
    line_num = content[:m.start()].count('\n') + 1
    print(f"Line {line_num}: ... {content[start:end].replace(chr(10), ' ')} ...")
