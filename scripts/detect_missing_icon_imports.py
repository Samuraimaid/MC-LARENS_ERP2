import os, glob, re

src_dir = r'c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src'
files = glob.glob(os.path.join(src_dir, '**', '*.jsx'), recursive=True) + glob.glob(os.path.join(src_dir, '**', '*.js'), recursive=True)

# List of common Lucide icons that might be used
lucide_icons = set([
    'Percent', 'PercentCircle', 'Check', 'X', 'Plus', 'Trash', 'Trash2', 'Edit', 'Edit2', 'Edit3', 'Copy',
    'Eye', 'EyeOff', 'Lock', 'Unlock', 'Key', 'Search', 'Filter', 'Download', 'Upload', 'RefreshCw', 'RefreshCcw',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ChevronLeft', 'ChevronRight', 'ChevronUp', 'ChevronDown',
    'AlertCircle', 'AlertTriangle', 'CheckCircle', 'CheckCircle2', 'XCircle', 'Info', 'HelpCircle',
    'Settings', 'Settings2', 'User', 'Users', 'UserPlus', 'UserCheck', 'UserX', 'Calendar', 'Clock',
    'DollarSign', 'CreditCard', 'Wallet', 'Receipt', 'ReceiptText', 'FileText', 'File', 'Files',
    'Camera', 'Video', 'Volume2', 'VolumeX', 'Printer', 'QrCode', 'Barcode', 'Sliders', 'SlidersHorizontal',
    'Shield', 'ShieldAlert', 'ShieldCheck', 'Moon', 'Sun', 'Monitor', 'Smartphone', 'Tablet', 'Laptop',
    'Server', 'Database', 'HardDrive', 'Wifi', 'WifiOff', 'Signal', 'Radio', 'MapPin', 'Navigation',
    'Car', 'Truck', 'Bus', 'Bike', 'Package', 'Box', 'Boxes', 'Layers', 'Grid', 'List', 'Table',
    'Activity', 'BarChart', 'BarChart2', 'BarChart3', 'TrendingUp', 'TrendingDown', 'PieChart',
    'Share2', 'ExternalLink', 'Link', 'Unlink', 'Maximize2', 'Minimize2', 'Sparkles', 'Wand2',
    'Flame', 'Zap', 'Bell', 'BellOff', 'Mail', 'MessageSquare', 'MessageSquareText', 'Phone', 'Send',
    'ShoppingBag', 'ShoppingCart', 'Tag', 'Tags', 'Scissors', 'Wrench', 'Hammer', 'Power', 'LogOut', 'LogIn',
    'Play', 'Pause', 'Square', 'Circle', 'Disc', 'Music', 'Headphones', 'Award', 'BadgeAlert', 'BadgeCheck'
])

missing_imports = []

for fpath in files:
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    # Extract all JSX tags: <IconName
    jsx_tags = set(re.findall(r'<([A-Z][a-zA-Z0-9]+)\b', content))
    
    # Extract all imported symbols: import { ... } from "..."
    # or const ... = ...
    imported_symbols = set()
    import_matches = re.findall(r'import\s+(?:\{([^}]+)\}|([a-zA-Z0-9_]+))\s+from', content)
    for named, default in import_matches:
        if named:
            for s in named.split(','):
                s = s.strip()
                if ' as ' in s:
                    s = s.split(' as ')[1].strip()
                imported_symbols.add(s)
        if default:
            imported_symbols.add(default.strip())
            
    # Also find local declarations: const/let/var/function/class
    local_decls = set(re.findall(r'(?:const|let|var|function|class)\s+([A-Z][a-zA-Z0-9_]+)\b', content))
    
    declared_or_imported = imported_symbols.union(local_decls)
    
    for tag in jsx_tags:
        if tag in lucide_icons and tag not in declared_or_imported:
            missing_imports.append((fpath, tag))

print(f"Scanned {len(files)} files.")
if missing_imports:
    print(f"Found {len(missing_imports)} missing icon imports:")
    for fp, icon in missing_imports:
        print(f"  {os.path.basename(fp)}: <{icon}> is used but NOT imported!")
else:
    print("No missing Lucide icon imports found across the entire frontend!")
