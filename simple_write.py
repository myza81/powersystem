try:
    with open('/Volumes/externalDrive/code-gym/powersystem/simple_test.txt', 'w') as f:
        f.write("PYTHON WORKS")
except Exception as e:
    # Just in case stderr works
    print(e)
