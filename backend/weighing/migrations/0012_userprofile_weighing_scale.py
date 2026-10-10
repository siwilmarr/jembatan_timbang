import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("weighing", "0011_weighingtransaction_berat_tara_kg"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="weighing_scale",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="weighing.weighingscale",
            ),
        ),
    ]
