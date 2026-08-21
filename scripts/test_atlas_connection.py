import os
from pymongo import MongoClient

uri = "mongodb+srv://dayavar18_db_user:M8vqN8JORBjwWcaN@mclarens-db.nkdcim8.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority"
print(f"Connecting to Atlas: {uri[:40]}...")
client = MongoClient(uri, serverSelectionTimeoutMS=10000)
try:
    ping = client.admin.command('ping')
    print("PING SUCCESSFUL:", ping)
    dbs = client.list_database_names()
    print("Remote Databases available:", dbs)
except Exception as e:
    print("Connection failed:", e)
