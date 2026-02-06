from core.models import Substation, BayLoad, Transformer, IncomingBay
from services.load_profile_service import LoadProfileService

sub_id = 'BARG132'
mnemonic = 'BARG'

print(f"--- Debugging {sub_id} ---")
try:
    sub = Substation.objects.get(substation_id=sub_id)
    print(f"Substation: Found ({sub.name}, {sub.voltage}kV)")
except Substation.DoesNotExist:
    print("Substation: NOT FOUND")

transformers = list(Transformer.objects.filter(substation_id=sub_id).values_list('bay_name', flat=True))
print(f"Transformers: {transformers}")

bays = list(IncomingBay.objects.filter(substation_id=sub_id).values_list('bay_name', flat=True))
print(f"IncomingBays: {bays}")

unmatched_count = BayLoad.objects.filter(mnemonic=mnemonic, matched=False).count()
print(f"Unmatched Loads (Mnemonic='{mnemonic}'): {unmatched_count}")

from django.db.models import Q

# Correctly query matched loads via relationships
matched_count = BayLoad.objects.filter(
    Q(transformer__substation_id=sub_id) | 
    Q(incoming_bay__substation_id=sub_id)
).count()
print(f"Matched Loads (via Relations to '{sub_id}'): {matched_count}")

if matched_count == 0:
    print("WARNING: No loads are linked to this substation!")
    # Check if they are matched to SOME OTHER substation?
    strange_matches = BayLoad.objects.filter(mnemonic=mnemonic, matched=True).exclude(
        Q(transformer__substation_id=sub_id) | 
        Q(incoming_bay__substation_id=sub_id)
    )
    print(f"Loads with mnemonic '{mnemonic}' matched to OTHER substations: {strange_matches.count()}")
    if strange_matches.exists():
        first = strange_matches.first()
        linked_sub = first.transformer.substation_id if first.transformer else first.incoming_bay.substation_id
        print(f" - Example linked to: {linked_sub}")

else:
    print("Loads are linked correctly. Checking samples...")
    loads = BayLoad.objects.filter(
        Q(transformer__substation_id=sub_id) | 
        Q(incoming_bay__substation_id=sub_id)
    )[:5]
    for load in loads:
        link = f"Transformer {load.transformer.bay_name}" if load.transformer else f"IncomingBay {load.incoming_bay.bay_name}"
        print(f" - Load {load.bay_identifier} ({load.pload_mw}MW) -> {link}")

if unmatched_count > 0:
    print("\nSample Unmatched Records:")
    for load in BayLoad.objects.filter(mnemonic=mnemonic, matched=False)[:5]:
        print(f" - ID: {load.bay_identifier}, Bus: {load.bus_name}, Voltage: {load.voltage_level}")

print("\nAttempting Rematch...")
LoadProfileService.rematch_unmatched_loads()

post_unmatched = BayLoad.objects.filter(mnemonic=mnemonic, matched=False).count()
print(f"Unmatched after rematch: {post_unmatched}")
