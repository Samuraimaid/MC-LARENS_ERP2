import os

file_path = r'C:\Users\Xinon\.gemini\antigravity-ide\brain\972af972-50af-44f8-852b-45ccfb6a178b\.system_generated\steps\1677\content.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Total bundle length: {len(content)}")

# Look around 86646
target_pos = 86646
start = max(0, target_pos - 500)
end = min(len(content), target_pos + 500)
print("\n--- Snippet around char 86646 ---")
print(content[start:end])

# Search for the function `tu` definition and around 70260
target_pos_2 = 70260
start_2 = max(0, target_pos_2 - 500)
end_2 = min(len(content), target_pos_2 + 500)
print("\n--- Snippet around char 70260 ---")
print(content[start_2:end_2])

# Search for `_` variable declarations or uses
import re
print("\n--- Occurrences of `Cannot access` or `_` near 86646 ---")
for m in re.finditer(r'\b_\b', content[start:end]):
    pos = start + m.start()
    print(f"Char {pos}: {content[max(0, pos-40):min(len(content), pos+40)]}")
