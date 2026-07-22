from django.db import migrations

def create_groups_and_permissions(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Permission = apps.get_model('auth', 'Permission')
    ContentType = apps.get_model('contenttypes', 'ContentType')
    WeighingTransaction = apps.get_model('weighing', 'WeighingTransaction')

    # Dapatkan content type untuk WeighingTransaction
    content_type = ContentType.objects.get_for_model(WeighingTransaction)

    # Dapatkan permissions untuk model tersebut
    permissions = Permission.objects.filter(content_type=content_type)
    
    view_perm = permissions.get(codename='view_weighingtransaction')
    add_perm = permissions.get(codename='add_weighingtransaction')
    change_perm = permissions.get(codename='change_weighingtransaction')
    delete_perm = permissions.get(codename='delete_weighingtransaction')

    # Buat Grup Operator: Cuma bisa melihat & menambah data
    operator_group, _ = Group.objects.get_or_create(name='Operator')
    operator_group.permissions.add(view_perm, add_perm)

    # Buat Grup Admin: Bisa semua akses (view, add, change, delete)
    admin_group, _ = Group.objects.get_or_create(name='Admin')
    admin_group.permissions.add(view_perm, add_perm, change_perm, delete_perm)

def delete_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Group.objects.filter(name__in=['Admin', 'Operator']).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('weighing', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_groups_and_permissions, reverse_code=delete_groups),
    ]
