import pandas as pd
from decimal import Decimal
import os

def mock_sync_test(file_path):
    print(f"Testing sync from: {file_path}")
    try:
        df = pd.read_excel(file_path)
        print("Columns found:", df.columns.tolist())
        
        test_results = []
        for index, row in df.head(10).iterrows():
            mnemonic = str(row['mnemonic']).strip()
            voltage = Decimal(str(row['voltage']))
            
            # ID Generation Logic
            voltage_str = str(int(voltage)) if voltage % 1 == 0 else str(voltage)
            substation_id = f"{mnemonic}{voltage_str}"
            sld_filename = f"{substation_id}.pdf"
            
            test_results.append({
                "mnemonic": mnemonic,
                "voltage": float(voltage),
                "generated_id": substation_id,
                "generated_sld": sld_filename,
                "name": str(row['name']).strip()
            })
            
        print("\nSample Generated Data:")
        for res in test_results:
            print(f"ID: {res['generated_id']} | SLD: {res['generated_sld']} | Name: {res['name']}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    target_file = "source/susbtation.xlsx"
    if os.path.exists(target_file):
        mock_sync_test(target_file)
    else:
        print(f"File not found: {target_file}")
