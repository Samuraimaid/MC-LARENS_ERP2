#!/usr/bin/env python3
import os
from pymongo import MongoClient

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('MONGO_DB', os.environ.get('DB_NAME', 'mundo_accesorios_erp'))

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

res = db.customers.update_many({"is_active": {"$exists": False}}, {"$set": {"is_active": True}})
print('matched_count', res.matched_count, 'modified_count', res.modified_count)

# Also set is_active True for customers where explicitly False
res2 = db.customers.update_many({"is_active": False}, {"$set": {"is_active": True}})
print('matched_count_false', res2.matched_count, 'modified_count_false', res2.modified_count)

print('Total customers now:', db.customers.count_documents({}))
