#!/bin/bash
set -e

echo "======================================"
echo "  AWDP Product Scraper + DB Importer"
echo "======================================"
echo ""

# Step 1: Scrape
echo "[1/2] Scraping products from competitor sites..."
echo "  Output → scrapers/awdp_products_scraped.csv"
echo ""
python3 -u scrapers/scrape_products.py

echo ""
echo "======================================"
echo "Scrape complete."
echo ""

# Step 2: Dry run of import (preview only)
echo "[2/2] Previewing database matches (dry run)..."
echo "      To apply changes, run:"
echo "      python3 scrapers/import_to_db.py --apply"
echo ""
python3 scrapers/import_to_db.py

echo ""
echo "======================================"
echo "Done. Review the matches above."
echo "Then run:  python3 scrapers/import_to_db.py --apply"
echo "======================================"
