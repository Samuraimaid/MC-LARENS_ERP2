from pymongo import MongoClient
c=MongoClient('mongodb://localhost:27017')
for name in c.list_database_names():
    try:
        n=c[name].customers.count_documents({})
    except Exception:
        n='N/A'
    print(name, n)
