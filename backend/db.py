import pymongo
from pymongo import MongoClient
from config import MONGO_URI, DB_NAME

try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    client.admin.command('ping')
except pymongo.errors.ServerSelectionTimeoutError:
    print("⚠️ MongoDB not running. Using in-memory Mongomock database!")
    import mongomock
    client = mongomock.MongoClient()

db = client[DB_NAME]

# Collections
classrooms_col = db["classrooms"]
departments_col = db["departments"]
teachers_col = db["teachers"]
timetable_col = db["timetable"]
users_col = db["users"]
notifications_col = db["notifications"]

# Seed in-memory database automatically on startup if empty!
if "mongomock" in str(type(client)) and users_col.count_documents({}) == 0:
    import seed
    seed.seed()
