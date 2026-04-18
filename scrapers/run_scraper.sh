#!/bin/bash
echo "Starting product scraper..."
echo "Log: scrapers/scrape_log.txt"
echo "Output: scrapers/awdp_products_scraped.csv"
echo "Press Ctrl+C to stop."
echo ""
python3 -u scrapers/scrape_products.py
