#!/usr/bin/env python3
import os
import json
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('MONGO_DB', os.environ.get('DB_NAME', 'mundo_accesorios_erp'))

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

now = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
out_dir = os.path.join(os.path.dirname(__file__), 'backups')
if not os.path.exists(out_dir):
    os.makedirs(out_dir)

def dump_collection(name):
    docs = list(db[name].find())
    # convert ObjectId and other non-serializable types
    def conv(o):
        if hasattr(o, 'isoformat'):
            return o.isoformat()
        if isinstance(o, ObjectId):
            return str(o)
        return o
    safe_docs = json.loads(json.dumps(docs, default=conv))
    path = os.path.join(out_dir, f"{name}_backup_{now}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(safe_docs, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(safe_docs)} docs to {path}")
    return path

if __name__ == '__main__':
    print(f"Connecting to {MONGO_URL} db={DB_NAME}")
    c1 = dump_collection('customers')
    c2 = dump_collection('vehicles')
    print('Backup completed:')
    print(' ', c1)
    print(' ', c2)
