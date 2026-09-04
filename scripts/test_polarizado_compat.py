import json
import sys

def test_polarizados():
    with open('./backend/data/seeds/core_seed.json', 'r', encoding='utf-8') as f:
        seed_data = json.load(f)

    products = seed_data.get('collections', {}).get('products', [])
    pol_prods = [p for p in products if str(p.get('sku', '')).startswith('POL-')]
    print(f"Total polarizados in core_seed.json: {len(pol_prods)}")
    for p in pol_prods:
        compat = p.get('compatibility', {}).get('vehicle_types', [])
        print(f"  - SKU: {p.get('sku'):<15} Name: {p.get('name'):<45} Price: ${p.get('price')} Compat: {compat}")

    # Check that all 6 complete polarizado products exist
    required_skus = ['POL-SED-COM', 'POL-HB-COM', 'POL-SUV-COM', 'POL-PCK-COM', 'POL-VAN-COM', 'POL-TRK-COM']
    found_skus = [p.get('sku') for p in pol_prods]
    for req in required_skus:
        assert req in found_skus, f"Missing required polarizado SKU: {req}"

    print("\nALL REQUIRED POLARIZADO PRODUCTS PRESENT AND VALIDATED!")

if __name__ == '__main__':
    test_polarizados()
