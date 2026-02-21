import os
import django
import sys

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import NetworkSnapshot, NetworkTopology, TopologyVersion, TopologyBus, SnapshotBusState
from services.topology_service import TopologyService

def test_isolation():
    output_path = '/Volumes/externalDrive/code-gym/powersystem/isolation_report.txt'
    print(f"Writing to {output_path}")
    
    with open(output_path, 'w') as f:
        f.write("--- Starting Isolation Test ---\n")
        
        try:
            # 1. Create shared topology version
            topology, _ = NetworkTopology.objects.get_or_create(name="Test Topology")
            topo_version = TopologyVersion.objects.create(
                topology=topology,
                version_tag="test",
                signature="test_signature",
            )

            # 2. Create two snapshots using the same topology
            snap_a = NetworkSnapshot.objects.create(name="Snapshot A", topology_version=topo_version)
            snap_b = NetworkSnapshot.objects.create(name="Snapshot B", topology_version=topo_version)
            msg = f"Created Snapshot A ({snap_a.id}) and Snapshot B ({snap_b.id})\n"
            print(msg)
            f.write(msg)

            # 3. Add topology bus and snapshot states
            topo_bus = TopologyBus.objects.create(
                topology_version=topo_version,
                bus_number=99999,
                bus_name="ISOLATION_TEST_BUS",
                base_kv=132.0,
            )
            SnapshotBusState.objects.create(
                snapshot=snap_a,
                bus=topo_bus,
                bus_type=1,
                voltage_mag=1.0,
                voltage_angle=0.0,
            )
            SnapshotBusState.objects.create(
                snapshot=snap_b,
                bus=topo_bus,
                bus_type=1,
                voltage_mag=1.0,
                voltage_angle=0.0,
            )
            f.write("Created identical bus state 99999 in both snapshots.\n")

            # 3. Verify existence
            exists_a = SnapshotBusState.objects.filter(snapshot=snap_a, bus=topo_bus).exists()
            exists_b = SnapshotBusState.objects.filter(snapshot=snap_b, bus=topo_bus).exists()
            f.write(f"Pre-delete Check: Bus in A: {exists_a}, Bus in B: {exists_b}\n")
            
            if not (exists_a and exists_b):
                f.write("FAILURE: Setup failed.\n")
            else:
                # 4. Delete Bus from Snapshot A using TopologyService
                f.write("Deleting Bus from Snapshot A...\n")
                service_a = TopologyService(snap_a)
                deleted_count = service_a.delete_buses([topo_bus.id])
                f.write(f"Deleted {deleted_count} items from Snapshot A.\n")

                # 5. Verify Isolation
                exists_a_after = SnapshotBusState.objects.filter(snapshot=snap_a, bus=topo_bus).exists()
                exists_b_after = SnapshotBusState.objects.filter(snapshot=snap_b, bus=topo_bus).exists()
                
                f.write(f"Post-delete Check: Bus in A: {exists_a_after} (Should be False)\n")
                f.write(f"Post-delete Check: Bus in B: {exists_b_after} (Should be True)\n")

                if not exists_a_after and exists_b_after:
                    f.write("SUCCESS: Snapshot isolation verified. Deletion in A did not affect B.\n")
                else:
                    f.write("FAILURE: Isolation test failed.\n")

            # Cleanup
            snap_a.delete()
            snap_b.delete()
            topo_version.delete()
            f.write("Cleaned up test snapshots.\n")
            
        except Exception as e:
            f.write(f"ERROR: {str(e)}\n")
            print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    test_isolation()
