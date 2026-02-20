import django.db.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0027_load_shedding_scheme_and_relay_registry'),
    ]

    operations = [
        migrations.RenameField(
            model_name='shedgroupsetting',
            old_name='order',
            new_name='operating_stage',
        ),
        migrations.RemoveConstraint(
            model_name='shedgroupsetting',
            name='unique_order_per_version',
        ),
        migrations.AddConstraint(
            model_name='shedgroupsetting',
            constraint=models.UniqueConstraint(
                fields=('version', 'operating_stage'),
                name='unique_operating_stage_per_version',
            ),
        ),
    ]
