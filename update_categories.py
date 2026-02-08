#!/usr/bin/env python3
"""
Script to update transaction categories in chequing CSV files
based on the merchant_category_mapping.csv file.
"""

import csv
import os
from pathlib import Path


def load_merchant_mapping(mapping_file: str) -> dict:
    """Load merchant to category mapping from CSV file."""
    mapping = {}
    with open(mapping_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            merchant = row['Merchant'].strip()
            category = row['Category'].strip()
            if merchant and category:
                # Store both exact match and lowercase for flexible matching
                mapping[merchant] = category
                mapping[merchant.lower()] = category
    return mapping


def update_csv_categories(csv_file: str, mapping: dict) -> int:
    """Update categories in a CSV file based on merchant mapping.

    Returns the number of rows updated.
    """
    rows = []
    updated_count = 0

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        for row in reader:
            description = row.get('description', '').strip()
            current_category = row.get('category', '').strip()

            # Only update if currently Uncategorized
            if current_category == 'Uncategorized' and description:
                # Try exact match first
                if description in mapping:
                    row['category'] = mapping[description]
                    updated_count += 1
                # Try lowercase match
                elif description.lower() in mapping:
                    row['category'] = mapping[description.lower()]
                    updated_count += 1
                # Try partial match (description starts with merchant name)
                else:
                    for merchant, category in mapping.items():
                        if description.lower().startswith(merchant.lower()):
                            row['category'] = category
                            updated_count += 1
                            break

            rows.append(row)

    # Write updated rows back to the file
    if updated_count > 0:
        with open(csv_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
            writer.writeheader()
            writer.writerows(rows)

    return updated_count


def main():
    # Paths
    base_dir = Path(__file__).parent
    mapping_file = base_dir / 'merchant_category_mapping.csv'
    chequing_dir = base_dir / 'data' / 'wealthsimple' / 'chequing'

    # Load merchant mapping
    print(f"Loading merchant mapping from {mapping_file}")
    mapping = load_merchant_mapping(mapping_file)
    print(f"Loaded {len(mapping) // 2} merchant mappings")  # Divided by 2 because we store both cases

    # Process each CSV file in chequing directory
    total_updated = 0
    csv_files = sorted(chequing_dir.glob('*.csv'))

    for csv_file in csv_files:
        updated = update_csv_categories(str(csv_file), mapping)
        if updated > 0:
            print(f"Updated {updated} rows in {csv_file.name}")
        total_updated += updated

    print(f"\nTotal rows updated: {total_updated}")


if __name__ == '__main__':
    main()
