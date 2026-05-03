from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0090_loadsheddingpocketbay_manual_substations'),
    ]

    operations = [
        migrations.AddField(
            model_name='loadsheddingpocketbay',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AlterModelOptions(
            name='loadsheddingpocketbay',
            options={
                'ordering': ['created_at'],
                'verbose_name': 'Load Shedding Pocket Bay',
                'verbose_name_plural': 'Load Shedding Pocket Bays',
            },
        ),
    ]
