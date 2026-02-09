
import os
import sys

# Try to run python command via os.system
print("Running command via os.system...")
exit_code = os.system('python3 -c "print(\'Hello from os.system\')"')
print(f"Exit code: {exit_code}")

if exit_code != 0:
    print("Trying python instead of python3...")
    exit_code = os.system('python -c "print(\'Hello from os.system python\')"')
    print(f"Exit code: {exit_code}")
