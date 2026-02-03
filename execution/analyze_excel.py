import pandas as pd
import sys
import json

def analyze_excel(file_path):
    try:
        # Read only the first few rows to understand structure
        df = pd.read_excel(file_path, nrows=5)
        analysis = {
            "columns": df.columns.tolist(),
            "sample_data": df.to_dict(orient='records'),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()}
        }
        print(json.dumps(analysis, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_excel(sys.argv[1])
    else:
        print("Please provide a file path.")
