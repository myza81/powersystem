# Team Data Collaboration Workflow

Since we are using SQLite (`db.sqlite3`) which is a binary file, we **cannot** share it directly via Git. It leads to corruption and merge conflicts.

Instead, we use **Data Fixtures** (JSON files) to sync data between team members.

## 1. Getting the Latest Data
When you pull the latest code, always update your local database with the shared data:

```bash
git pull origin main
python manage.py migrate
python manage.py loaddata core/fixtures/initial_data.json
```

## 2. Adding New Data
1. Run your server and log in to Admin (`/admin`).
2. Add new Substations, Load Profiles, etc.
3. Test your changes.

## 3. Sharing Your Changes
To share your new data with the team, you must "dump" it back to the JSON file:

```bash
# Export current database to the fixture file
python manage.py dumpdata --natural-foreign --natural-primary \
    -e contenttypes -e auth.Permission -e admin.LogEntry -e sessions.Session \
    --indent 2 > core/fixtures/initial_data.json
```

Then commit and push this file:

```bash
git add core/fixtures/initial_data.json
git commit -m "Updated substation data"
git push origin main
```

## ⚠️ Important Rules
- **Never commit `db.sqlite3`**.
- Always **communicate** before doing a large data update to avoid overwriting each other's work (though Git will help merge the JSON, it can still be tricky).
