from pymongo import MongoClient
c=MongoClient('mongodb://localhost:27017')
print('databases:', c.list_database_names())
for dbname in ['mundo_accesorios_erp','erp']:
    try:
        n=c[dbname].customers.count_documents({})
    except Exception as e:
        n=str(e)
    print(dbname, n)
