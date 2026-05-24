import json
from collections import Counter

# Load data
with open('scrapers/awdp_output/awdp-products.json', 'r') as f:
    products = json.load(f)

with open('scrapers/awdp_output/awdp-variations.json', 'r') as f:
    variations = json.load(f)

# Count variations per parent
parent_variation_counts = Counter(v['parent_id'] for v in variations)

# Show distribution
distribution = Counter(parent_variation_counts.values())
print("Variation distribution:")
for count, num_parents in sorted(distribution.items()):
    print(f"  {num_parents} parents have {count} variation(s)")

# Show some examples of parents with multiple variations
print("\nParents with multiple variations:")
for parent_id, count in parent_variation_counts.most_common(5):
    if count > 1:
        parent = next(p for p in products if p['id'] == parent_id)
        print(f"\n{parent['name']} ({count} variations)")
        parent_vars = [v for v in variations if v['parent_id'] == parent_id]
        for var in parent_vars[:3]:  # Show first 3
            print(f"  - {var['attributes']}")
