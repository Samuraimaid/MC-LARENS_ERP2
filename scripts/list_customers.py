#!/usr/bin/env python3
import os
import json
from pymongo import MongoClient

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('MONGO_DB', os.environ.get('DB_NAME', 'mundo_accesorios_erp'))

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

cursor = db.customers.find().limit(10)
rows = []
for c in cursor:
    rows.append({
        'customer_id': c.get('customer_id'),
        'name': c.get('name'),
        'phone': c.get('phone'),
        'created_at': c.get('created_at')
    })
print(json.dumps(rows, ensure_ascii=False, indent=2))
print('\nTotal customers in DB:', db.customers.count_documents({}))
