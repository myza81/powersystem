
import sys

def count_isolated_buses(file_path):
    try:
        with open(file_path, 'r', encoding='latin-1') as f:
            lines = f.readlines()
        
        bus_section = False
        isolated_count = 0
        total_buses = 0
        
        for line in lines:
            line = line.strip()
            if "BEGIN BUS DATA" in line:
                bus_section = True
                continue
            if "END OF BUS DATA" in line:
                break
            
            if bus_section:
                parts = line.split(',')
                if len(parts) > 3:
                    try:
                        ide = int(parts[3].strip())
                        total_buses += 1
                        if ide == 4:
                            isolated_count += 1
                    except ValueError:
                        pass
                        
        with open('debug_output.txt', 'w') as out:
            out.write(f"Total Buses: {total_buses}\n")
            out.write(f"Isolated (Type 4) Buses: {isolated_count}\n")
            
    except Exception as e:
        with open('debug_output.txt', 'w') as out:
            out.write(f"Error: {str(e)}")

count_isolated_buses('/Volumes/externalDrive/code-gym/powersystem/source/110226n.raw')
