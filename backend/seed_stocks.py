import csv
import os
import sys
from datetime import datetime

# Add parent directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db, RLSBypass

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

INDEX_FILES = [
    ("nifty50.csv", "nifty50"),
    ("next50.csv", "next50"),
    ("midcap100.csv", "midcap100"),
]

def seed_constituents():
    print("=" * 70)
    print("SEEDING NSE STOCKS UNIVERSE (Nifty 50, Next 50, Midcap 100)")
    print("=" * 70)

    conn = db.get_connection()
    ph = "%s" if db.is_mysql else "?"
    inserted_count = 0
    updated_count = 0

    try:
        cur = conn.cursor()
        with RLSBypass():
            for filename, index_group in INDEX_FILES:
                file_path = os.path.join(DATA_DIR, filename)
                if not os.path.exists(file_path):
                    print(f"[WARN] File not found: {file_path}")
                    continue

                with open(file_path, mode="r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        raw_symbol = row["Symbol"].strip()
                        # Append .NS suffix for NSE
                        symbol = f"{raw_symbol}.NS"
                        company_name = row["Company Name"].strip()
                        sector = row["Industry"].strip()
                        exchange = "NSE"

                        # Check if stock exists
                        cur.execute(f"SELECT id FROM stocks WHERE symbol = {ph}", (symbol,))
                        existing = cur.fetchone()

                        if existing:
                            # Update metadata & index_group
                            cur.execute(f"""
                            UPDATE stocks
                            SET company_name = {ph}, sector = {ph}, exchange = {ph}, index_group = {ph}, is_active = 1
                            WHERE symbol = {ph}
                            """, (company_name, sector, exchange, index_group, symbol))
                            updated_count += 1
                        else:
                            # Insert new stock
                            cur.execute(f"""
                            INSERT INTO stocks 
                            (symbol, exchange, company_name, sector, is_active, index_group, last_price, last_updated)
                            VALUES ({ph}, {ph}, {ph}, {ph}, 1, {ph}, 0.0, {ph})
                            """, (symbol, exchange, company_name, sector, index_group, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
                            inserted_count += 1

            if not db.is_mysql:
                conn.commit()

        print(f"✓ Seed complete: {inserted_count} new stocks inserted, {updated_count} updated.")
        
        # Verify total stocks in database
        cur.execute("SELECT count(*), index_group FROM stocks GROUP BY index_group")
        counts = cur.fetchall()
        for c in counts:
            count_val = c[0]
            group_name = c[1]
            print(f"   - {group_name}: {count_val} stocks")

    finally:
        conn.close()

if __name__ == "__main__":
    seed_constituents()
