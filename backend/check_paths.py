import os
import psycopg2

paths = [
    r"C:\Users\yashg\AppData\Roaming\frontend\data",
    r"y:\JK Infotech ERP\pg_data_bak"
]

for p in paths:
    print(f"Path: {p} exists? {os.path.exists(p)}")
