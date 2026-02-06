from core.models import BayLoad

print(f"Total BayLoads: {BayLoad.objects.count()}")
mnemonics = list(BayLoad.objects.values_list('mnemonic', flat=True).distinct())
print(f"Unique Mnemonics: {sorted(mnemonics)}")

# Check specifically for BARG with whitespace
barg_variants = BayLoad.objects.filter(mnemonic__icontains='BARG').values_list('mnemonic', flat=True).distinct()
print(f"BARG Variants: {list(barg_variants)}")
