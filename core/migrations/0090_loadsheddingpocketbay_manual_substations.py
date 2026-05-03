from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0089_remove_unused_network_tables'),
    ]

    operations = [
        migrations.AddField(
            model_name='loadsheddingpocketbay',
            name='manual_substations',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='User-defined list of substation IDs that override topology-computed island.',
            ),
        ),
    ]
