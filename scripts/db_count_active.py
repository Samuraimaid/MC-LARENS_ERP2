from pymongo import MongoClient
c=MongoClient('mongodb://localhost:27017')
print('mundo is_active true:', c['mundo_accesorios_erp'].customers.count_documents({'is_active': True}))
print('mundo total:', c['mundo_accesorios_erp'].customers.count_documents({}))
print('erp total:', c['erp'].customers.count_documents({}))
