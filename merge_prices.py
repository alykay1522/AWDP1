import csv
import os
import re

# -----------------------------
# UTILS
# -----------------------------

def clean_text(t):
    if not t:
        return ""
    return re.sub(r"\s+", " ", t).strip()

def normalize_title(t):
    t = clean_text(t).lower()
    t = re.sub(r"[^a-z0-9 ]", "", t)
    return t.strip()

# -----------------------------
# ALWAYS FIND PROJECT ROOT
# -----------------------------

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# -----------------------------
# AUTO-DETECT MASTER BATCH FILES
# -----------------------------

def detect_master_batches():
    batch_files = []
    for file in os.listdir(PROJECT_ROOT):
        if file.startswith("Pasted-Category-Subcategory-Original-Title-AWDP-Title-Length-W_") and file.endswith(".txt"):
            batch_files.append(os.path.join(PROJECT_ROOT, file))

    if not batch_files:
        raise FileNotFoundError(f"No AWDP batch files detected in: {PROJECT_ROOT}")

    return batch_files

master_batches = detect_master_batches()
print(f"[OK] Detected {len(master_batches)} AWDP batch files.")

# -----------------------------
# LOAD MASTER LIST FROM ALL BATCH FILES
# -----------------------------

master = []

for file in master_batches:
    with open(file, encoding="utf-8") as f:
        r = csv.DictReader(f, delimiter=",")
        for row in r:
            master.append(row)

print(f"[OK] Loaded {len(master)} total AWDP master rows.")

# -----------------------------
# AUTO-DETECT SCRAPED PRICE FILES
# -----------------------------

def find_csv(keyword):
    for file in os.listdir(PROJECT_ROOT):
        if keyword.lower() in file.lower() and file.lower().endswith(".csv"):
            return os.path.join(PROJECT_ROOT, file)
    return None

bilt_file = find_csv("biltbest")
truth_file = find_csv("truth")
wefix_file = find_csv("wefix")

if not all([bilt_file, truth_file, wefix_file]):
    raise FileNotFoundError("One or more scraped price files could not be detected.")

print(f"[OK] BiltBest file: {os.path.basename(bilt_file)}")
print(f"[OK] TruthEntryGard file: {os.path.basename(truth_file)}")
print(f"[OK] WeFixItUSA file: {os.path.basename(wefix_file)}")

# -----------------------------
# LOAD SCRAPED PRICE FILES
# -----------------------------

def load_prices(path):
    data = {}
    with open(path, encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            norm = normalize_title(row.get("Normalized Title", ""))
            data[norm] = {
                "title": row.get("Title", ""),
                "price": row.get("Price", ""),
                "url": row.get("URL", "")
            }
    return data

bilt = load_prices(bilt_file)
truth = load_prices(truth_file)
wefix = load_prices(wefix_file)

# -----------------------------
# MERGE PRICES USING HYBRID MATCHING
# -----------------------------

output = []

for item in master:
    original = item.get("Original Title", "")
    awdp_title = item.get("AWDP Title", "")

    norm_awdp = normalize_title(awdp_title)
    norm_orig = normalize_title(original)

    match_key = None
    if norm_awdp in bilt or norm_awdp in truth or norm_awdp in wefix:
        match_key = norm_awdp
    elif norm_orig in bilt or norm_orig in truth or norm_orig in wefix:
        match_key = norm_orig

    price_bilt = bilt.get(match_key, {}).get("price", "")
    price_truth = truth.get(match_key, {}).get("price", "")
    price_wefix = wefix.get(match_key, {}).get("price", "")

    def to_num(p):
        if not p:
            return 0
        p = p.replace("$", "").replace(",", "")
        try:
            return float(p)
        except:
            return 0

    pb = to_num(price_bilt)
    pt = to_num(price_truth)
    pw = to_num(price_wefix)

    highest = max(pb, pt, pw)

    if highest == pb:
        src = "BiltBest"
    elif highest == pt:
        src = "TruthEntryGard"
    elif highest == pw:
        src = "WeFixItUSA"
    else:
        src = ""

    output.append({
        "Original Title": original,
        "AWDP Title": awdp_title,
        "Category": item.get("Category", ""),
        "Subcategory": item.get("Subcategory", ""),
        "Price_BiltBest": price_bilt,
        "Price_TruthEntryGard": price_truth,
        "Price_WeFixItUSA": price_wefix,
        "AWDP_FinalPrice": f"${highest:.2f}" if highest > 0 else "",
        "Price_Source": src,
        "Notes": "" if match_key else "No match found"
    })

# -----------------------------
# SAVE FINAL AWDP PRICING CSV
# -----------------------------

output_path = os.path.join(PROJECT_ROOT, "AWDP_FinalPricing.csv")

with open(output_path, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=output[0].keys())
    w.writeheader()
    w.writerows(output)

print("\nDONE — AWDP_FinalPricing.csv generated successfully.")
print(f"Saved to: {output_path}")
