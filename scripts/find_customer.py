from pymongo import MongoClient
c=MongoClient('mongodb://localhost:27017')
search_ids=['cust_001','cust_496d400591a6']
for dbname in c.list_database_names():
    db=c[dbname]
    for sid in search_ids:
        try:
            doc=db.customers.find_one({'customer_id':sid})
        except Exception:
            doc=None
        if doc:
            print('found', sid, 'in', dbname)
            print(doc)
