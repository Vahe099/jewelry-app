# backend/db.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DB_URL = "mysql+mysqlconnector://root:Vahe1996.@127.0.0.1:3306/jewelry"


engine = create_engine(DB_URL, pool_pre_ping=True, future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

