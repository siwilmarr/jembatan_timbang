from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("weighing", "0010_pricelist"),
    ]

    operations = [
        migrations.AddField(
            model_name="weighingtransaction",
            name="berat_tara_kg",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=10, null=True
            ),
        ),
    ]
