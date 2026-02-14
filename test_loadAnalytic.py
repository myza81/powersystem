from core.models import NetworkSnapshot
from core.models import NetworkLoad



snapshot_id = "1e54f82e-4ac9-45ed-818b-e351875135c8"
snapshot = NetworkSnapshot.objects.get(id=snapshot_id)




loads = NetworkLoad.objects.filter(snapshot=snapshot)

for load in loads:
    print(load.bus.bus_name, load.p_mw, load.q_mvar)