import re

with open(r'C:\Users\Xinon\.gemini\antigravity-ide\brain\972af972-50af-44f8-852b-45ccfb6a178b\.system_generated\steps\1757\content.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Look for FB_PUBLIC_LOAD_DATA_ or form items
matches = re.findall(r'FB_PUBLIC_LOAD_DATA_\s*=\s*(.*?);</script>', text)
if matches:
    print("Found FB_PUBLIC_LOAD_DATA_!")
    import json
    data = json.loads(matches[0])
    # Extract questions and options
    form_title = data[1][8] if len(data[1]) > 8 else "Form"
    print(f"Title: {form_title}")
    questions = data[1][1]
    for q in questions:
        q_title = q[1]
        print(f"\nQuestion: {q_title}")
        if len(q) > 4 and q[4]:
            for opt_group in q[4]:
                if len(opt_group) > 1 and opt_group[1]:
                    for opt in opt_group[1]:
                        print(f"  - Option: {opt[0]}")
else:
    # Search for all strings with letters and spaces
    strings = re.findall(r'[\u00C0-\u017F\w\s-]{4,}', text)
    print("Extracted strings:")
    for s in strings:
        if any(w in s.lower() for w in ['polariz', 'trabajo', 'servicio', 'parabrisas', 'visera', 'completo', 'lateral', 'despolariz']):
            print("  ", s.strip())
