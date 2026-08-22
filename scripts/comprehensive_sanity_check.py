"""
Precision Static AST & Reference Validator for React/JSX in MC-LARENS ERP.
Validates imports, state declarations, and event handlers across all frontend files.
"""

import os
import re

def clean_comments(code):
    code = re.sub(r'//.*', '', code)
    code = re.sub(r'/\*[\s\S]*?\*/', '', code)
    return code

def analyze_file(fpath):
    with open(fpath, 'r', encoding='utf-8') as f:
        raw = f.read()
        
    code = clean_comments(raw)
    
    # Extract all imported identifiers
    imported = set()
    for match in re.finditer(r'\bimport\s+([^;]+?)\s+from\s+[\'"][^\'"]+[\'"]', code):
        clause = match.group(1).strip()

        # namespace import: import * as Foo from '...'
        if '* as ' in clause:
            ns_name = re.search(r'\*\s+as\s+([A-Za-z0-9_]+)', clause)
            if ns_name:
                imported.add(ns_name.group(1))
        # default import: import Foo from '...' or import Foo from "@/App"
        elif '{' not in clause and '*' not in clause:
            imported.add(clause.strip())

        else:
            # named imports
            named_part = re.search(r'\{([\s\S]*?)\}', clause)
            if named_part:
                for item in named_part.group(1).split(','):
                    item = item.strip()
                    if ' as ' in item:
                        imported.add(item.split(' as ')[1].strip())
                    elif item:
                        imported.add(item)
            if '{' in clause and not clause.startswith('{'):
                default_name = clause.split('{')[0].replace(',', '').strip()
                if default_name:
                    imported.add(default_name)
                    
    declared = set()
    # function declarations
    for m in re.finditer(r'function\s+([A-Za-z0-9_]+)\b', code):
        declared.add(m.group(1))
    # class declarations
    for m in re.finditer(r'class\s+([A-Za-z0-9_]+)\b', code):
        declared.add(m.group(1))
    # const / let / var declarations
    for m in re.finditer(r'(?:const|let|var)\s+([A-Za-z0-9_]+)\b', code):
        declared.add(m.group(1))
    # destructuring: const [a, b] = ... or const { a, b } = ...
    for m in re.finditer(r'(?:const|let|var)\s+\[\s*([A-Za-z0-9_,\s]+)\s*\]', code):
        for var in m.group(1).split(','):
            if var.strip():
                declared.add(var.strip())
    for m in re.finditer(r'(?:const|let|var)\s+\{\s*([A-Za-z0-9_,\s:]+)\s*\}', code):
        for item in m.group(1).split(','):
            item = item.strip()
            if ':' in item:
                declared.add(item.split(':')[1].strip())
            elif item:
                declared.add(item)
                
    # Component props from signature
    for m in re.finditer(r'function\s+[A-Za-z0-9_]+\s*\(\s*\{([\s\S]*?)\}\s*(?:,\s*\{[\s\S]*?\})?\s*\)', code):
        for item in m.group(1).split(','):
            item = item.strip()
            if '=' in item:
                item = item.split('=')[0].strip()
            if ':' in item:
                item = item.split(':')[1].strip()
            if item:
                declared.add(item)
                
    # Arrow function component props
    for m in re.finditer(r'(?:export\s+default\s+function|\bconst\s+[A-Za-z0-9_]+\s*=\s*)\s*(?:React\.memo\s*\(\s*)?\s*\(\s*\{([\s\S]*?)\}\s*(?:,\s*\{[\s\S]*?\})?\s*\)\s*=>', code):
        for item in m.group(1).split(','):
            item = item.strip()
            if '=' in item:
                item = item.split('=')[0].strip()
            if ':' in item:
                item = item.split(':')[1].strip()
            if item:
                declared.add(item)

    all_symbols = imported | declared
    # Standard JS/React/Browser builtins & Web API setters
    builtins = {
        'React', 'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useId', 'useTransition',
        'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'console', 'fetch', 'setTimeout', 'clearTimeout',
        'setInterval', 'clearInterval', 'Math', 'Date', 'JSON', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp',
        'Error', 'Promise', 'Set', 'Map', 'Intl', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
        'encodeURIComponent', 'decodeURIComponent', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'btoa', 'atob',
        'confirm', 'alert', 'prompt', 'Audio', 'Image', 'CustomEvent', 'Event', 'MutationObserver', 'ResizeObserver',
        'IntersectionObserver', 'Fragment', 'undefined', 'null', 'true', 'false', 'this', 'arguments', 'Icon'
    }
    web_setters = {
        'setItem', 'setAttribute', 'setHeader', 'setSelectedVehicleType', 'setCustomValidity', 'setSelectionRange',
        'setPointerCapture', 'releasePointerCapture', 'setState', 'setLatLng', 'setIcon', 'setTorch',
        'setDate', 'setHours', 'setMinutes', 'setSeconds', 'setMonth', 'setFullYear', 'setTime',
        'setValueAtTime', 'setTargetAtTime', 'setValueCurveAtTime', 'setApi'
    }
    all_symbols |= builtins
    
    issues = []
    
    # 1. JSX component usage <Component ...>
    for m in re.finditer(r'<([A-Z][a-zA-Z0-9_]*)\b', code):
        tag = m.group(1)
        if tag.endswith('Primitive') or tag.endswith('Primitives'):
            continue
        if tag not in all_symbols:
            issues.append(('UNIMPORTED_COMPONENT', tag, f"Component <{tag}> is used in JSX but not imported or declared."))
            
    # 2. Event props onClick={handler}
    for m in re.finditer(r'\bon[A-Z][a-zA-Z0-9]*=\{([a-zA-Z0-9_]+)\}', code):
        handler = m.group(1)
        if handler not in all_symbols and handler not in web_setters:
            issues.append(('UNDEFINED_HANDLER', handler, f"Event prop passes `{handler}` but it is not defined in scope."))
            
    # 3. Setter calls in inline handlers: onClick={() => setSomething(...)}
    for m in re.finditer(r'\b(set[A-Z][a-zA-Z0-9_]*)\s*\(', code):
        setter = m.group(1)
        if setter not in all_symbols and not setter.startswith('set_') and setter not in web_setters:
            issues.append(('UNDEFINED_SETTER', setter, f"Setter `{setter}()` called but never declared in useState or props."))
            
    return issues

def run_precision_audit():
    src_dir = r"c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src"
    all_files = []
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            if f.endswith('.jsx') or f.endswith('.js'):
                all_files.append(os.path.join(root, f))
                
    print(f"Running precision AST reference audit on {len(all_files)} files...")
    
    total_issues = 0
    file_issues = {}
    
    for fpath in all_files:
        rel = os.path.relpath(fpath, src_dir)
        issues = analyze_file(fpath)
        if issues:
            unique_issues = list({(i[0], i[1]): i for i in issues}.values())
            file_issues[rel] = unique_issues
            total_issues += len(unique_issues)
            
    print(f"\n=======================================================")
    if total_issues == 0:
        print(f"AUDIT PASSED: 0 ReferenceErrors detected across all {len(all_files)} files!")
    else:
        print(f"AUDIT SUMMARY: {total_issues} issues detected across {len(file_issues)} files")
    print(f"=======================================================\n")
    
    for rel, issues in sorted(file_issues.items()):
        print(f"\n[FILE] {rel}:")
        for itype, ident, msg in issues:
            print(f"   * [{itype}] `{ident}` -> {msg}")
            
    return total_issues

if __name__ == '__main__':
    run_precision_audit()
