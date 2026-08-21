import os
import re
import sys

def parse_imports(filepath, base_dir):
    imports = []
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception:
        return imports

    # Find import ... from "..." or require("...")
    patterns = [
        r'import\s+.*?from\s+[\'"]([^\'"]+)[\'"]',
        r'import\s*\([\'"]([^\'"]+)[\'"]\)',
        r'export\s+.*?from\s+[\'"]([^\'"]+)[\'"]'
    ]
    
    file_dir = os.path.dirname(filepath)
    for p in patterns:
        for match in re.findall(p, content):
            if match.startswith('.'):
                resolved = os.path.normpath(os.path.join(file_dir, match))
            elif match.startswith('@/'):
                resolved = os.path.normpath(os.path.join(base_dir, match[2:]))
            else:
                continue
            
            # Check extensions
            for ext in ['', '.js', '.jsx', '.json', '/index.js', '/index.jsx']:
                candidate = resolved + ext
                if os.path.isfile(candidate):
                    imports.append(candidate)
                    break
    return imports

def find_cycles(graph):
    cycles = []
    visited = set()
    stack = []

    def dfs(node):
        visited.add(node)
        stack.append(node)
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                dfs(neighbor)
            elif neighbor in stack:
                cycle_start = stack.index(neighbor)
                cycles.append(stack[cycle_start:] + [neighbor])
        stack.pop()

    for node in list(graph.keys()):
        if node not in visited:
            dfs(node)
    return cycles

base_dir = os.path.abspath('frontend/src')
graph = {}

for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.js', '.jsx')) and not f.endswith(('.test.js', '.test.jsx')):
            path = os.path.abspath(os.path.join(root, f))
            graph[path] = parse_imports(path, base_dir)

cycles = find_cycles(graph)
print(f"Found {len(cycles)} circular dependency chains:")
for i, c in enumerate(cycles):
    print(f"\n--- Cycle {i+1} ---")
    for step in c:
        rel = os.path.relpath(step, base_dir)
        print(f"  -> {rel}")
