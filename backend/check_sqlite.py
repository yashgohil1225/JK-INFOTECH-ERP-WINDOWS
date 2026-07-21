import sqlite3

def check_sqlite():
    conn = sqlite3.connect(r"y:\JK Infotech ERP\backend\erp.db")
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cur.fetchall()
    print("Tables in erp.db:", [t[0] for t in tables])
    
    for t in [t[0] for t in tables]:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            count = cur.fetchone()[0]
            print(f"  Table '{t}': {count} rows")
        except Exception as e:
            print(f"  Table '{t}': Error {e}")

    # Check companies table
    if ("companies",) in tables or ("companies" in [t[0] for t in tables]):
        cur.execute("SELECT * FROM companies")
        rows = cur.fetchall()
        print("\nCOMPANIES IN erp.db:")
        for r in rows:
            print("  ", r)

if __name__ == "__main__":
    check_sqlite()
