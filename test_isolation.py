import os
import django
import sys
import logging

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem.settings')
django.setup()

from core.models import NetworkSnapshot, NetworkBus
from services.topology_service import TopologyService

def test_isolation():
    output_path = '/Volumes/externalDrive/code-gym/powersystem/isolation_report.txt'
    print(f"Writing to {output_path}")
    
    with open(output_path, 'w') as f:
        f.write("--- Starting Isolation Test ---\n")
        
        try:
            # 1. Create two snapshots
            snap_a = NetworkSnapshot.objects.create(name="Snapshot A")
            snap_b = NetworkSnapshot.objects.create(name="Snapshot B")
            msg = f"Created Snapshot A ({snap_a.id}) and Snapshot B ({snap_b.id})\n"
            print(msg)
            f.write(msg)

            # 2. Add identical buses to both
            bus_a = NetworkBus.objects.create(
                snapshot=snap_a,
                bus_number=99999,
                bus_name="ISOLATION_TEST_BUS",
                base_kv=132.0,
                voltage_mag=1.0,
                voltage_angle=0.0
            )
            bus_b = NetworkBus.objects.create(
                snapshot=snap_b,
                bus_number=99999,
                bus_name="ISOLATION_TEST_BUS",
                base_kv=132.0,
                voltage_mag=1.0,
                voltage_angle=0.0
            )
            f.write(f"Created identical bus 99999 in both snapshots.\n")

            # 3. Verify existence
            exists_a = NetworkBus.objects.filter(snapshot=snap_a, bus_number=99999).exists()
            exists_b = NetworkBus.objects.filter(snapshot=snap_b, bus_number=99999).exists()
            f.write(f"Pre-delete Check: Bus in A: {exists_a}, Bus in B: {exists_b}\n")
            
            if not (exists_a and exists_b):
                f.write("FAILURE: Setup failed.\n")
            else:
                # 4. Delete Bus from Snapshot A using TopologyService
                f.write("Deleting Bus from Snapshot A...\n")
                service_a = TopologyService(snap_a)
                deleted_count = service_a.delete_buses([bus_a.id])
                f.write(f"Deleted {deleted_count} items from Snapshot A.\n")

                # 5. Verify Isolation
                exists_a_after = NetworkBus.objects.filter(snapshot=snap_a, bus_number=99999).exists()
                exists_b_after = NetworkBus.objects.filter(snapshot=snap_b, bus_number=99999).exists()
                
                f.write(f"Post-delete Check: Bus in A: {exists_a_after} (Should be False)\n")
                f.write(f"Post-delete Check: Bus in B: {exists_b_after} (Should be True)\n")

                if not exists_a_after and exists_b_after:
                    f.write("SUCCESS: Snapshot isolation verified. Deletion in A did not affect B.\n")
                else:
                    f.write("FAILURE: Isolation test failed.\n")

            # Cleanup
            snap_a.delete()
            snap_b.delete()
            f.write("Cleaned up test snapshots.\n")
            
        except Exception as e:
            f.write(f"ERROR: {str(e)}\n")
            print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    test_isolation()
