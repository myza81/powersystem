import os
import django
import sys
import traceback
from django.db import connection

sys.path.append('/Volumes/externalDrive/code-gym/powersystem')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem.settings')
django.setup()

def check_column():
    with open('db_check.txt', 'w') as f:
        try:
            with connection.cursor() as cursor:
                # Check for column in sqlite (assuming sqlite based on file list)
                cursor.execute("PRAGMA table_info(core_networksnapshot)")
                columns = [row[1] for row in cursor.fetchall()]
                f.write(f"Columns in core_networksnapshot: {columns}\n")
                if 'created_by_id' in columns:
                    f.write("PASS: created_by_id exists.\n")
                else:
                    f.write("FAIL: created_by_id missing.\n")
        except Exception:
            f.write(traceback.format_exc())

if __name__ == "__main__":
    check_column()
