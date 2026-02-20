#!/usr/bin/env python
"""
Diagnostic: check migration status and DB tables for load shedding models.
Run from project root: python check_migration.py
"""
import os, sys, json
os.environ['DJANGO_SETTINGS_MODULE'] = 'powersystem_core.settings'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import django
django.setup()

from django.db import connection
from django.db.migrations.executor import MigrationExecutor

tables = connection.introspection.table_names()
target_tables = [
    'core_protectionrelay',
    'core_relaytripassignment',
    'core_loadsheddingscheme',
    'core_schemeversion',
    'core_shedgroupsetting',
    'core_shedgroupassignment',
]

result = {t: t in tables for t in target_tables}

executor = MigrationExecutor(connection)
plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
pending = [(app, name) for app, name in plan]

output = {
    'tables': result,
    'pending_migrations': pending,
    'all_tables_exist': all(result.values()),
}

out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.tmp', 'db_diagnostic.json')
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w') as f:
    json.dump(output, f, indent=2)

print(f"Done. Output written to {out_path}")
