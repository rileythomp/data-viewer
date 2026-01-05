#!/usr/bin/env python3
"""Generate mock transaction datasets with realistic data."""

import json
import csv
import random
from datetime import datetime, timedelta
from typing import List, Dict

# Transaction templates for realistic descriptions
TRANSACTION_TEMPLATES = {
    "debit": [
        ("GROCERY", ["WHOLE FOODS", "TRADER JOE'S", "SAFEWAY", "KROGER", "COSTCO"]),
        ("RESTAURANT", ["STARBUCKS", "CHIPOTLE", "MCDONALD'S", "SUBWAY", "PANERA BREAD"]),
        ("GAS", ["SHELL", "CHEVRON", "EXXON", "BP", "MOBIL"]),
        ("UTILITY", ["ELECTRIC CO", "WATER DEPT", "GAS COMPANY", "INTERNET PROVIDER"]),
        ("SUBSCRIPTION", ["NETFLIX", "SPOTIFY", "AMAZON PRIME", "APPLE ICLOUD", "YOUTUBE PREMIUM"]),
        ("SHOPPING", ["AMAZON", "TARGET", "WALMART", "BEST BUY", "HOME DEPOT"]),
        ("TRANSFER", ["E-TRANSFER TO", "WIRE TRANSFER", "INTERAC SEND"]),
        ("WITHDRAWAL", ["ATM WITHDRAWAL", "CASH ADVANCE"]),
    ],
    "credit": [
        ("DEPOSIT", ["PAYROLL DEPOSIT", "DIRECT DEPOSIT", "SALARY"]),
        ("TRANSFER", ["E-TRANSFER FROM", "WIRE RECEIVED", "INTERAC RECEIVED"]),
        ("REFUND", ["REFUND FROM", "CREDIT ADJUSTMENT", "CASHBACK REWARD"]),
        ("INTEREST", ["INTEREST PAYMENT", "SAVINGS INTEREST"]),
    ]
}

CURRENCIES = ["CAD", "USD"]

def generate_transactions(
    num_transactions: int = 50,
    start_date: datetime = None,
    initial_balance: float = 5000.00,
    currency: str = "CAD"
) -> List[Dict]:
    """Generate a list of realistic mock transactions."""

    if start_date is None:
        start_date = datetime.now() - timedelta(days=90)

    transactions = []
    current_balance = initial_balance
    current_date = start_date

    for _ in range(num_transactions):
        # Randomly decide if credit or debit (weighted towards debits)
        is_credit = random.random() < 0.25

        if is_credit:
            category, merchants = random.choice(TRANSACTION_TEMPLATES["credit"])
            merchant = random.choice(merchants)

            # Credit amounts vary by type
            if category == "DEPOSIT":
                amount = round(random.uniform(1500, 4000), 2)
            elif category == "REFUND":
                amount = round(random.uniform(10, 200), 2)
            elif category == "INTEREST":
                amount = round(random.uniform(0.50, 15.00), 2)
            else:
                amount = round(random.uniform(50, 500), 2)

            transaction_type = "Credit"
            description = f"{merchant}"
            amount_value = amount
        else:
            category, merchants = random.choice(TRANSACTION_TEMPLATES["debit"])
            merchant = random.choice(merchants)

            # Debit amounts vary by category
            if category == "GROCERY":
                amount = round(random.uniform(25, 200), 2)
            elif category == "RESTAURANT":
                amount = round(random.uniform(5, 75), 2)
            elif category == "GAS":
                amount = round(random.uniform(30, 80), 2)
            elif category == "UTILITY":
                amount = round(random.uniform(50, 200), 2)
            elif category == "SUBSCRIPTION":
                amount = round(random.uniform(5, 25), 2)
            elif category == "SHOPPING":
                amount = round(random.uniform(20, 300), 2)
            elif category == "TRANSFER":
                amount = round(random.uniform(50, 500), 2)
            elif category == "WITHDRAWAL":
                amount = round(random.uniform(40, 300), 2)
            else:
                amount = round(random.uniform(10, 100), 2)

            transaction_type = "Debit"
            description = f"{merchant} #{random.randint(1000, 9999)}"
            amount_value = -amount

        # Update balance
        new_balance = round(current_balance + amount_value, 2)

        # Ensure we don't go too negative (add a deposit if needed)
        if new_balance < -500:
            # Force a deposit
            category, merchants = random.choice(TRANSACTION_TEMPLATES["credit"])
            merchant = random.choice(merchants)
            amount = round(random.uniform(2000, 4000), 2)
            transaction_type = "Credit"
            description = f"{merchant}"
            amount_value = amount
            new_balance = round(current_balance + amount_value, 2)

        transaction = {
            "date": current_date.strftime("%Y-%m-%d"),
            "transaction_type": transaction_type,
            "description": description,
            "amount": abs(amount_value),
            "balance": new_balance,
            "currency": currency
        }

        transactions.append(transaction)
        current_balance = new_balance

        # Advance date by 0-3 days
        current_date += timedelta(days=random.randint(0, 3), hours=random.randint(0, 23))

    return transactions


def export_to_json(transactions: List[Dict], filename: str) -> None:
    """Export transactions to a JSON file."""
    with open(filename, 'w') as f:
        json.dump(transactions, f, indent=2)
    print(f"Exported {len(transactions)} transactions to {filename}")


def export_to_csv(transactions: List[Dict], filename: str) -> None:
    """Export transactions to a CSV file."""
    if not transactions:
        return

    fieldnames = ["date", "transaction_type", "description", "amount", "balance", "currency"]

    with open(filename, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(transactions)
    print(f"Exported {len(transactions)} transactions to {filename}")


def main():
    # Generate JSON datasets (random each time)
    json_transactions_1 = generate_transactions(
        num_transactions=75,
        start_date=datetime(2025, 8, 1),
        initial_balance=3500.00,
        currency="CAD"
    )

    json_transactions_2 = generate_transactions(
        num_transactions=75,
        start_date=datetime(2025, 8, 1),
        initial_balance=3500.00,
        currency="CAD"
    )

    # Generate CSV datasets (different from JSON)
    csv_transactions_1 = generate_transactions(
        num_transactions=75,
        start_date=datetime(2025, 8, 1),
        initial_balance=3500.00,
        currency="CAD"
    )

    csv_transactions_2 = generate_transactions(
        num_transactions=75,
        start_date=datetime(2025, 8, 1),
        initial_balance=3500.00,
        currency="CAD"
    )

    # Export to JSON
    export_to_json(json_transactions_1, "mock_trans_1.json")
    export_to_json(json_transactions_2, "mock_trans_2.json")

    # Export to CSV
    export_to_csv(csv_transactions_1, "mock_trans_1.csv")
    export_to_csv(csv_transactions_2, "mock_trans_2.csv")

    print("\nSample transactions from JSON dataset 1:")
    for t in json_transactions_1[:5]:
        print(f"  {t['date']} | {t['transaction_type']:6} | {t['description']:30} | {t['amount']:>8.2f} | Balance: {t['balance']:>10.2f} {t['currency']}")


if __name__ == "__main__":
    main()
