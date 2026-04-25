import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import os

BASE_URL = "https://www.biltbestwindowparts.com/research-pdfs"
DOMAIN = "https://www.biltbestwindowparts.com"
SAVE_DIR = "biltbest_pdfs"

os.makedirs(SAVE_DIR, exist_ok=True)

print("Fetching page...")
r = requests.get(BASE_URL)
soup = BeautifulSoup(r.text, "html.parser")

pdf_links = []

for link in soup.find_all("a"):
    href = link.get("href", "")
    if href.lower().endswith(".pdf"):
        pdf_links.append(urljoin(DOMAIN, href))

print(f"Found {len(pdf_links)} PDFs")

for pdf_url in pdf_links:
    filename = pdf_url.split("/")[-1]
    path = os.path.join(SAVE_DIR, filename)
    print("Downloading:", filename)
    data = requests.get(pdf_url).content
    with open(path, "wb") as f:
        f.write(data)

print("Done! PDFs saved to:", SAVE_DIR)
