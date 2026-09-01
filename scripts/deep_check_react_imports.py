import os, glob, re

src_dir = r'c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src'
files = glob.glob(os.path.join(src_dir, '**', '*.jsx'), recursive=True) + glob.glob(os.path.join(src_dir, '**', '*.js'), recursive=True)

# Common React hooks & symbols
react_exports = {
    'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo',
    'useRef', 'useImperativeHandle', 'useLayoutEffect', 'useDebugValue', 'useTransition',
    'useId', 'useDeferredValue', 'createContext', 'forwardRef', 'memo', 'lazy', 'Suspense',
    'Fragment', 'Children', 'cloneElement', 'createElement', 'isValidElement'
}

router_exports = {
    'useNavigate', 'useLocation', 'useParams', 'useSearchParams', 'useMatch',
    'Link', 'NavLink', 'Navigate', 'Outlet', 'Routes', 'Route'
}

issues = []

for fpath in files:
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Collect all imported symbols properly
    imported = set()
    for line in content.splitlines():
        line = line.strip()
        if not line.startswith('import'):
            continue
        # Check if React default is imported
        if re.search(r'import\s+React\b', line):
            imported.add('React')
        # Extract named imports inside { ... }
        match_braces = re.search(r'\{([^}]+)\}', line)
        if match_braces:
            for item in match_braces.group(1).split(','):
                item = item.strip()
                if ' as ' in item:
                    item = item.split(' as ')[1].strip()
                if item:
                    imported.add(item)
        # Default or star import: import Def from '...' or import * as Def from '...'
        match_default = re.search(r'import\s+([a-zA-Z0-9_$]+)\s+from', line)
        if match_default:
            imported.add(match_default.group(1).strip())
        match_star = re.search(r'import\s+\*\s+as\s+([a-zA-Z0-9_$]+)\s+from', line)
        if match_star:
            imported.add(match_star.group(1).strip())

    # Check for missing React hooks
    for hook in react_exports:
        pattern = rf'(?<!\.)\b{hook}\s*\('
        if re.search(pattern, content):
            if hook not in imported and 'React' not in imported:
                if not re.search(rf'\b(?:const|let|var|function)\s+{hook}\b', content):
                    issues.append({
                        'file': fpath,
                        'type': 'Missing React Import',
                        'symbol': hook,
                        'detail': f"'{hook}' is called but neither '{hook}' nor 'React' is imported."
                    })

    # Check for missing Router exports
    for sym in router_exports:
        if re.search(rf'<{sym}\b|(?<!\.)\b{sym}\s*\(', content):
            if sym not in imported:
                if not re.search(rf'\b(?:const|let|var|function|class)\s+{sym}\b', content):
                    issues.append({
                        'file': fpath,
                        'type': 'Missing Router Import',
                        'symbol': sym,
                        'detail': f"'{sym}' is used in JSX/calls but not imported from 'react-router-dom'."
                    })

print(f"Scanned {len(files)} files.")
if issues:
    print(f"FOUND {len(issues)} ISSUES:")
    for iss in issues:
        print(f"  [{iss['type']}] {os.path.basename(iss['file'])} -> {iss['symbol']}: {iss['detail']}")
else:
    print("ALL CLEAN: 0 missing React hooks, 0 missing router hooks across the entire codebase!")
