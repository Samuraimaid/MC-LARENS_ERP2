import os
import re

base_dir = os.path.abspath('frontend/src')

def get_imports(filepath):
    imports = []
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    for m in re.finditer(r'import\s+(?:(?:\w+|\{[^}]+\}|\*\s+as\s+\w+)\s+from\s+)?[\'"]([^\'"]+)[\'"]', content):
        target = m.group(1)
        if target.startswith('.'):
            # relative import
            dir_path = os.path.dirname(filepath)
            resolved = os.path.normpath(os.path.join(dir_path, target))
            for ext in ['', '.jsx', '.js', '/index.js', '/index.jsx']:
                if os.path.isfile(resolved + ext):
                    imports.append(resolved + ext)
                    break
        elif target.startswith('@/'):
            resolved = os.path.normpath(os.path.join(base_dir, target[2:]))
            for ext in ['', '.jsx', '.js', '/index.js', '/index.jsx']:
                if os.path.isfile(resolved + ext):
                    imports.append(resolved + ext)
                    break
    return imports

# Build graph
graph = {}
for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.jsx', '.js')):
            fp = os.path.normpath(os.path.join(root, f))
            graph[fp] = get_imports(fp)

# Find cycles
def find_cycles(node, path, visited):
    if node in path:
        cycle = path[path.index(node):] + [node]
        return [cycle]
    if node in visited:
        return []
    visited.add(node)
    path.append(node)
    cycles = []
    for neighbor in graph.get(node, []):
        cycles.extend(find_cycles(neighbor, list(path), visited))
    return cycles

all_cycles = []
visited = set()
for node in graph:
    cycles = find_cycles(node, [], set())
    for c in cycles:
        c_rel = [os.path.relpath(p, base_dir) for p in c]
        if c_rel not in all_cycles and c_rel[::-1] not in all_cycles:
            all_cycles.append(c_rel)

print(f"Total circular dependency cycles found: {len(all_cycles)}")
for i, c in enumerate(all_cycles, 1):
    print(f"\nCycle {i}:")
    print(" -> ".join(c))
