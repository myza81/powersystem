import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0026_networksnapshot_activated_at_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Physical Relay Registry ───────────────────────────────────
        migrations.CreateModel(
            name='ProtectionRelay',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('relay_type', models.CharField(
                    choices=[('UFLS', 'Under-Frequency Load Shedding (UFLS)'), ('UVLS', 'Under-Voltage Load Shedding (UVLS)')],
                    max_length=10,
                )),
                ('relay_id', models.CharField(
                    help_text="Site label / panel ID, e.g. 'UFLS-01', 'Panel-A'",
                    max_length=30,
                )),
                ('manufacturer', models.CharField(blank=True, max_length=50, null=True)),
                ('model', models.CharField(blank=True, help_text='e.g. SEL-81', max_length=50, null=True)),
                ('commissioned_date', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('substation', models.ForeignKey(
                    help_text='Substation where the relay panel is physically installed',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='protection_relays',
                    to='core.substation',
                )),
            ],
            options={
                'verbose_name': 'Protection Relay',
                'verbose_name_plural': 'Protection Relays',
                'ordering': ['substation', 'relay_type', 'relay_id'],
            },
        ),
        migrations.AddConstraint(
            model_name='protectionrelay',
            constraint=models.UniqueConstraint(
                fields=('substation', 'relay_type', 'relay_id'),
                name='unique_relay_per_substation',
            ),
        ),
        migrations.CreateModel(
            name='RelayTripAssignment',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('assignment_type', models.CharField(
                    choices=[('branch', 'Branch (Feeder / Interconnector)'), ('load_transformer', 'Load Transformer')],
                    max_length=20,
                )),
                ('circuit_id', models.CharField(help_text="e.g. '1', '2', 'T1', 'T2'", max_length=10)),
                ('trip_output_id', models.PositiveSmallIntegerField(
                    blank=True, null=True,
                    help_text='Rows sharing the same relay and trip_output_id represent a single contact output. Null = standalone.',
                )),
                ('notes', models.TextField(blank=True, null=True)),
                ('relay', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='trip_assignments',
                    to='core.protectionrelay',
                )),
                ('from_substation', models.ForeignKey(
                    help_text='Substation with the sending-end breaker wired to this relay',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='relay_trip_from',
                    to='core.substation',
                )),
                ('to_substation', models.ForeignKey(
                    blank=True, null=True,
                    help_text='Remote-end substation (branch only)',
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='relay_trip_to',
                    to='core.substation',
                )),
            ],
            options={
                'verbose_name': 'Relay Trip Assignment',
                'verbose_name_plural': 'Relay Trip Assignments',
                'ordering': ['relay', 'trip_output_id', 'assignment_type'],
            },
        ),

        # ── Load Shedding Schemes ─────────────────────────────────────
        migrations.CreateModel(
            name='LoadSheddingScheme',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('scheme_type', models.CharField(
                    choices=[
                        ('UFLS', 'Under-Frequency Load Shedding (UFLS)'),
                        ('UVLS', 'Under-Voltage Load Shedding (UVLS)'),
                        ('MANUAL', 'Manual Load Shedding'),
                    ],
                    max_length=10,
                    unique=True,
                )),
                ('name', models.CharField(help_text="e.g. 'National UFLS Scheme'", max_length=100)),
                ('description', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='shedding_schemes',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Load Shedding Scheme',
                'verbose_name_plural': 'Load Shedding Schemes',
            },
        ),
        migrations.CreateModel(
            name='SchemeVersion',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('version_number', models.CharField(help_text="e.g. '2024', 'Rev 3', 'v2.1'", max_length=20)),
                ('status', models.CharField(
                    choices=[('draft', 'Draft'), ('active', 'Active'), ('superseded', 'Superseded')],
                    default='draft',
                    max_length=15,
                )),
                ('effective_date', models.DateField(blank=True, null=True)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, help_text='Revision notes / change summary', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('scheme', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='versions',
                    to='core.loadsheddingscheme',
                )),
                ('published_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='published_scheme_versions',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Scheme Version',
                'verbose_name_plural': 'Scheme Versions',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='schemeversion',
            constraint=models.UniqueConstraint(
                fields=('scheme', 'version_number'),
                name='unique_version_per_scheme',
            ),
        ),
        migrations.CreateModel(
            name='ShedGroupSetting',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('name', models.CharField(help_text="e.g. 'Group 1', 'Stage A'", max_length=50)),
                ('order', models.PositiveSmallIntegerField(help_text='Priority order; 1 = shed first')),
                ('trigger_setpoint1', models.FloatField(
                    blank=True, null=True,
                    help_text='Primary setpoint: Hz for UFLS, pu voltage for UVLS',
                )),
                ('trigger_delay1', models.FloatField(blank=True, null=True, help_text='Primary relay delay (seconds)')),
                ('trigger_setpoint2', models.FloatField(blank=True, null=True, help_text='Backup/secondary setpoint')),
                ('trigger_delay2', models.FloatField(blank=True, null=True, help_text='Backup relay delay (seconds)')),
                ('target_mw_shed', models.FloatField(
                    blank=True, null=True,
                    help_text='Planned MW quantum to be shed by this group',
                )),
                ('include_autotransformers', models.BooleanField(default=True)),
                ('version', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='groups',
                    to='core.schemeversion',
                )),
            ],
            options={
                'verbose_name': 'Shed Group Setting',
                'verbose_name_plural': 'Shed Group Settings',
                'ordering': ['version', 'order'],
            },
        ),
        migrations.AddConstraint(
            model_name='shedgroupsetting',
            constraint=models.UniqueConstraint(
                fields=('version', 'order'),
                name='unique_order_per_version',
            ),
        ),
        migrations.CreateModel(
            name='ShedGroupAssignment',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('assignment_type', models.CharField(
                    choices=[('branch', 'Branch (Feeder / Interconnector)'), ('load_transformer', 'Load Transformer')],
                    max_length=20,
                )),
                ('from_substation_id', models.CharField(
                    help_text="Substation ID string, e.g. 'BRGS132'",
                    max_length=20,
                )),
                ('to_substation_id', models.CharField(
                    blank=True, null=True,
                    help_text="Remote substation ID (branch only), e.g. 'MGST132'",
                    max_length=20,
                )),
                ('circuit_id', models.CharField(
                    help_text="e.g. '1', '2' for branches; 'T1', 'T2' for load transformers",
                    max_length=10,
                )),
                ('note', models.TextField(blank=True, null=True)),
                ('group', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='assignments',
                    to='core.shedgroupsetting',
                )),
                ('substation', models.ForeignKey(
                    blank=True, null=True,
                    help_text='Auto-resolved from from_substation_id',
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='shed_assignments',
                    to='core.substation',
                )),
            ],
            options={
                'verbose_name': 'Shed Group Assignment',
                'verbose_name_plural': 'Shed Group Assignments',
                'ordering': ['group', 'assignment_type', 'from_substation_id'],
            },
        ),
    ]
