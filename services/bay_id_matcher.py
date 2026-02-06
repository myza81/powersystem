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
        # 1. Try finding explicitly 500, 275, 132 (Most reliable)
        # Matches "132", "132kV", "132.00", "ABBA132"
        match = re.search(r'(500|275|132)', bus_name)
        if match:
            return int(match.group(1))

        # 2. Legacy Pattern: "MNEMONIC123 123.00"
        match = re.search(r'\s+(\d{3})\.', bus_name)
        if match:
            return int(match.group(1))
        
        # 3. Digits followed by kV
        match = re.search(r'(\d{3})\s*kV', bus_name, re.IGNORECASE)
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
        
        # Construct target bay_id (Strict format: SubstationID_BayName)
        target_bay_id = f"{substation_id}_{bay_identifier}"
        
        if bay_id_upper.startswith('T'):
            # Transformer match by ID
            try:
                transformer = Transformer.objects.get(bay_id=target_bay_id)
                return transformer, 'transformer'
            except Transformer.DoesNotExist:
                return None, None
        
        if bay_id_upper.startswith('F'):
            # IncomingBay/Feeder match
            
            # 1. Standard Match (Exact ID)
            try:
                incoming_bay = IncomingBay.objects.get(bay_id=target_bay_id)
                return incoming_bay, 'incoming_bay'
            except IncomingBay.DoesNotExist:
                pass

            # 2. Non-TNB Aliasing Logic (F1, F2 -> Sorted Breaker Number)
            # Check substation ownership
            try:
                substation = None
                if substations_cache:
                    substation = substations_cache.get(substation_id)
                
                if not substation:
                    substation = Substation.objects.filter(substation_id=substation_id).first()
                
                if substation and substation.ownership != 'TNB':
                    # Only apply if pattern is F<number>
                    f_match = re.match(r'^F(\d+)$', bay_id_upper)
                    if f_match:
                        index = int(f_match.group(1)) - 1 # 1-based to 0-based
                        if index >= 0:
                            bays = IncomingBay.objects.filter(substation=substation).order_by('breaker_number')
                            bays_list = list(bays)
                            if index < len(bays_list):
                                return bays_list[index], 'incoming_bay'
            except Exception as e:
                 print(f"Error in Non-TNB matching: {e}")

            return None, None
        
        else:
            # Unknown pattern - try both by ID
            try:
                transformer = Transformer.objects.get(bay_id=target_bay_id)
                return transformer, 'transformer'
            except Transformer.DoesNotExist:
                pass
            
            try:
                incoming_bay = IncomingBay.objects.get(bay_id=target_bay_id)
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
