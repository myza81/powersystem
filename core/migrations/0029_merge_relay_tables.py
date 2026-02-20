"""
Migration 0029: Merge ProtectionRelay + RelayTripAssignment into one table.

Old schema (from migration 0027):
  - core_protectionrelay   — relay panel device record
  - core_relaystripassignment — wiring record pointing to a relay

New schema:
  - core_protectionrelay   — single flat table: one row = one relay wired to one circuit.

Since the old tables almost certainly have no production data yet (the feature
was just built), we drop both old tables and recreate core_protectionrelay with
the merged fields. This is safe; if you had data to preserve you would need a
data migration first.
"""
import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0028_rename_shedgroupsetting_order_to_stage'),
    ]

    operations = [
        # 1. Drop the old two-table design
        migrations.DeleteModel(name='RelayTripAssignment'),
        migrations.DeleteModel(name='ProtectionRelay'),

        # 2. Create lean merged table
        migrations.CreateModel(
            name='ProtectionRelay',
            fields=[
                ('id', models.UUIDField(
                    primary_key=True, default=uuid.uuid4,
                    editable=False, serialize=False,
                )),
                ('relay_type', models.CharField(
                    choices=[
                        ('UFLS', 'Under-Frequency Load Shedding (UFLS)'),
                        ('UVLS', 'Under-Voltage Load Shedding (UVLS)'),
                    ],
                    max_length=10,
                )),
                ('relay_panel_id', models.CharField(
                    blank=True, null=True, max_length=30,
                    help_text="Panel label, e.g. 'UFLS-01'. Optional if not recorded.",
                )),
                ('substation', models.ForeignKey(
                    help_text='Substation where this relay panel is installed',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='protection_relays',
                    to='core.substation',
                )),
                ('assignment_type', models.CharField(
                    choices=[
                        ('branch', 'Branch (Feeder / Interconnector)'),
                        ('load_transformer', 'Load Transformer'),
                    ],
                    max_length=20,
                )),
                ('from_substation_id', models.CharField(
                    max_length=20,
                    help_text="Sending-end substation ID, e.g. 'BRGS132'",
                )),
                ('to_substation_id', models.CharField(
                    blank=True, null=True, max_length=20,
                    help_text="Remote-end substation ID (branch only), e.g. 'MGST132'",
                )),
                ('circuit_id', models.CharField(
                    max_length=10,
                    help_text="e.g. '1', '2' for feeders; 'T1', 'T2' for transformers",
                )),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Protection Relay',
                'verbose_name_plural': 'Protection Relays',
                'ordering': ['substation__substation_id', 'relay_type', 'relay_panel_id'],
            },
        ),
    ]
