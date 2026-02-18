from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings

class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0023_remove_substation_sync_log'),
    ]

    operations = [
        migrations.AddField(
            model_name='networksnapshot',
            name='created_by',
            field=models.ForeignKey(blank=True, help_text='User who uploaded this snapshot', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='snapshots', to=settings.AUTH_USER_MODEL),
        ),
    ]
