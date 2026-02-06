from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from .models import Transformer, IncomingBay, BayLoad
from services.load_profile_service import LoadProfileService
import logging

logger = logging.getLogger(__name__)

@receiver(post_delete, sender=Transformer)
@receiver(post_delete, sender=IncomingBay)
def cleanup_phantom_matches(sender, instance, **kwargs):
    """
    When a Transformer or IncomingBay is deleted, the related BayLoad 
    will have its FK set to NULL (due to on_delete=SET_NULL), 
    but matched=True will remain. We must reset it to False.
    """
    # Find phantom matches (matched=True but both FKs are None)
    # Note: The instance is already deleted from DB, so the BayLoad's FK is already NULL.
    phantoms = BayLoad.objects.filter(
        matched=True,
        transformer__isnull=True,
        incoming_bay__isnull=True
    )
    
    count = phantoms.update(matched=False)
    if count > 0:
        logger.info(f"Reset {count} phantom matched BayLoad records to Unmatched.")
        # Trigger rematch immediately to try and find new owners
        try:
            LoadProfileService.rematch_unmatched_loads()
        except Exception as e:
            logger.error(f"Auto-rematch failed after cleanup: {e}")

@receiver(post_save, sender=Transformer)
@receiver(post_save, sender=IncomingBay)
@receiver(post_save, sender=BayLoad)
def trigger_rematch(sender, instance, created, **kwargs):
    """
    Trigger rematch when new potential parents or new loads are created.
    """
    if created:
        try:
            LoadProfileService.rematch_unmatched_loads()
        except Exception as e:
            logger.error(f"Auto-rematch failed after save: {e}")
