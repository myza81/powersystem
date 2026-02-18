import os
print(f"CWD: {os.getcwd()}")
try:
    with open('test_output_simple.txt', 'w') as f:
        f.write("Hello from test script")
    print("File written successfully")
except Exception as e:
    print(f"Error writing file: {e}")
