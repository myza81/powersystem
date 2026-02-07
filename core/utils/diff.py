import json
from django.apps import apps
from django.core import serializers
from django.db import models

def get_fixture_diff(fixture_path):
    """
    Compares the contents of a JSON fixture file with the current database state.
    Returns a summary and details of differences.
    """
    try:
        with open(fixture_path, 'r') as f:
            fixture_data = json.load(f)
    except FileNotFoundError:
        return {"error": "Fixture file not found."}
    except json.JSONDecodeError:
        return {"error": "Invalid JSON in fixture file."}

    diff_summary = {
        "total_in_fixture": len(fixture_data),
        "new": 0,
        "modified": 0,
        "unchanged": 0,
        "details": []
    }

    # Group by model for efficiency if needed, but linear scan is fine for typical fixture sizes
    for item in fixture_data:
        model_label = item.get('model')
        pk = item.get('pk')
        fields = item.get('fields')

        try:
            model = apps.get_model(model_label)
        except LookupError:
            diff_summary["details"].append({
                "model": model_label,
                "pk": pk,
                "status": "ERROR",
                "message": f"Model {model_label} not found."
            })
            continue

        try:
            # Try to get the existing instance
            instance = model.objects.get(pk=pk)
            
            # Compare fields
            changes = []
            for field_name, new_value in fields.items():
                if not hasattr(instance, field_name):
                    continue # Skip fields that might not exist or are relations handled differently?
                
                # Get current value. Handling relations might be tricky (ID vs object)
                # In fixtures, FKs are usually IDs.
                current_value = getattr(instance, field_name)
                
                # Normalize current value for comparison
                if isinstance(current_value, models.Model):
                    current_value = current_value.pk
                
                # Handle dates/datetimes strings vs objects if necessary
                # For now, simple strict equality. 
                # serialization usually yields strings for dates, DB yields objects.
                # A robust comparison might need Django's serializer.
                
                if str(current_value) != str(new_value) and current_value != new_value:
                     # Attempt to be smarter about None/Empty
                    if (current_value is None and new_value is None):
                        continue
                        
                    changes.append({
                        "field": field_name,
                        "old": str(current_value),
                        "new": str(new_value)
                    })

            if changes:
                diff_summary["modified"] += 1
                diff_summary["details"].append({
                    "model": model_label,
                    "pk": pk,
                    "status": "MODIFIED",
                    "changes": changes
                })
            else:
                diff_summary["unchanged"] += 1

        except model.DoesNotExist:
            diff_summary["new"] += 1
            diff_summary["details"].append({
                "model": model_label,
                "pk": pk,
                "status": "NEW",
                "fields": fields
            })

    return diff_summary
