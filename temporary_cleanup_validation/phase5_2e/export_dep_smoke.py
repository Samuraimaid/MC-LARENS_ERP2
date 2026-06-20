import json
import os
import sys

def check_export_deps():
    results = {}
    deps = ["pandas", "openpyxl", "reportlab"]
    for dep in deps:
        try:
            __import__(dep)
            results[dep] = True
        except ImportError:
            results[dep] = False
    return results

if __name__ == "__main__":
    print(json.dumps(check_export_deps()))
