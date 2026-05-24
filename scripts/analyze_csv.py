import csv
import os

# Analyze truthentrygard CSV
truth_file = 'attached_assets/truthentrygard_full_products_1776317786975.csv'
if os.path.exists(truth_file):
    with open(truth_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
        print(f"TruthEntryGard CSV: {len(rows)} rows (including header)")
        if rows:
            print(f"Headers: {rows[0]}")
            print(f"Sample row: {rows[1] if len(rows) > 1 else 'No data rows'}")

# Analyze allbrand CSV
allbrand_file = 'attached_assets/allbrand_products_1776979015894.csv'
if os.path.exists(allbrand_file):
    with open(allbrand_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
        print(f"\nAllBrand CSV: {len(rows)} rows (including header)")
        if rows:
            print(f"Headers: {rows[0]}")
            print(f"Sample row: {rows[1] if len(rows) > 1 else 'No data rows'}")
