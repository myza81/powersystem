"""
Bay ID Matching Service for Load Profile Data

Matches Excel load profile rows to existing Transformer/IncomingBay records
based on mnemonic, voltage, and bay identifier (T1, F1, etc.).
"""

import re
from typing import Tuple, Optional, Dict
from core.models import Substation, Transformer, IncomingBay


class BayIDMatcher:
    """
    Service for matching load profile Excel rows to bay_id.
    
    Matching Algorithm:
    1. Parse Bus Name to extract voltage
    2. Construct substation_id = f"{mnemonic}{voltage}"
    3. Verify substation exists
    4. Determine bay type from Id column pattern:
       - Starts with 'T' → Transformer
       - Starts with 'F' → IncomingBay/Feeder
    5. Query by bay_name = Id
    6. Return (model_instance, model_type) or (None, None)
    """
    
    @staticmethod
    def extract_voltage_from_bus_name(bus_name: str) -> Optional[int]:
        """
        Extract voltage from Bus Name field.
        
        Expected formats:
        - "ABBA132 132.00"
        - "LGMR275 275.00"
        - "ADAM500 500.00"
        
        Returns:
            Voltage as integer (132, 275, 500) or None if not found
        """
        # Try pattern: "MNEMONIC123 123.00"
        match = re.search(r'\s+(\d{3})\.', bus_name)
        if match:
            return int(match.group(1))
        
        # Try extracting last 3 digits from first word
        match = re.search(r'(\d{3})\s+', bus_name)
        if match:
            return int(match.group(1))
        
        return None
    
    @staticmethod
    def match_bay(
        mnemonic: str,
        bay_identifier: str,
        voltage: int,
        substations_cache: Optional[Dict] = None
    ) -> Tuple[Optional[object], Optional[str]]:
        """
        Match Excel row to Transformer or IncomingBay.
        
        Args:
            mnemonic: Substation mnemonic (e.g., "ABBA", "LGMR")
            bay_identifier: Bay ID from Excel (e.g., "T1", "F1", "T2")
            voltage: Voltage level (132, 275, 500)
            substations_cache: Optional dict of substation_id -> Substation
        
        Returns:
            Tuple of (matched_object, model_type) where:
            - matched_object: Transformer or IncomingBay instance
            - model_type: 'transformer' or 'incoming_bay'
            Returns (None, None) if no match found
        
        Examples:
            >>> match_bay('ABBA', 'T1', 132)
            (<Transformer: ABBA132_T1>, 'transformer')
            
            >>> match_bay('LGMR', 'F1', 132)
            (<IncomingBay: LGMR132_F1>, 'incoming_bay')
        """
        # Construct substation_id
        substation_id = f"{mnemonic.upper()}{int(voltage)}"
        
        # Check if substation exists
        if substations_cache is not None:
            if substation_id not in substations_cache:
                return None, None
        else:
            if not Substation.objects.filter(substation_id=substation_id).exists():
                return None, None
        
        # Determine bay type from Id pattern
        bay_id_upper = bay_identifier.upper().strip()
        
        if bay_id_upper.startswith('T'):
            # Transformer match
            try:
                transformer = Transformer.objects.get(
                    substation__substation_id=substation_id,
                    bay_name=bay_identifier
                )
                return transformer, 'transformer'
            except Transformer.DoesNotExist:
                return None, None
            except Transformer.MultipleObjectsReturned:
                # Should not happen with unique bay_id, but handle gracefully
                return None, None
        
        elif bay_id_upper.startswith('F'):
            # IncomingBay/Feeder match
            try:
                incoming_bay = IncomingBay.objects.get(
                    substation__substation_id=substation_id,
                    bay_name=bay_identifier
                )
                return incoming_bay, 'incoming_bay'
            except IncomingBay.DoesNotExist:
                return None, None
            except IncomingBay.MultipleObjectsReturned:
                return None, None
        
        else:
            # Unknown pattern - try both, prioritize Transformer
            try:
                transformer = Transformer.objects.get(
                    substation__substation_id=substation_id,
                    bay_name=bay_identifier
                )
                return transformer, 'transformer'
            except Transformer.DoesNotExist:
                pass
            
            try:
                incoming_bay = IncomingBay.objects.get(
                    substation__substation_id=substation_id,
                    bay_name=bay_identifier
                )
                return incoming_bay, 'incoming_bay'
            except IncomingBay.DoesNotExist:
                return None, None
        
        return None, None
    
    @staticmethod
    def build_substations_cache() -> Dict[str, Substation]:
        """
        Build a cache of all substations for faster lookups.
        
        Returns:
            Dict mapping substation_id -> Substation instance
        """
        return {
            sub.substation_id: sub
            for sub in Substation.objects.all()
        }
