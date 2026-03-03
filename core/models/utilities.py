import os
from django.core.files.storage import FileSystemStorage


class OverwriteStorage(FileSystemStorage):
    """
    Custom storage to overwrite existing files with the same name.
    """
    def get_available_name(self, name, max_length=None):
        if self.exists(name):
            # Use Django's path resolution to prevent path traversal.
            existing_path = self.path(name)
            try:
                os.remove(existing_path)
            except FileNotFoundError:
                pass
        return name


def substation_sld_path(instance, filename):
    # Rename file to {substation_id}.{extension}
    ext = filename.split('.')[-1]
    return f"slds/{instance.substation_id}.{ext}"
