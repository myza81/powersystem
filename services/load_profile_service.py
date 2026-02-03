"""
Load Profile Upload Service

Handles parsing Excel files, matching to bay IDs, and storing in database.
"""

import pandas as pd
import uuid
from typing import Dict, List, Tuple, Optional
from django.db import transaction
from django.utils import timezone

from core.models import BayLoad, Substation
from services.bay_id_matcher import BayIDMatcher


class LoadProfileService:
    """
    Service for processing load profile Excel uploads.
    
    Workflow:
    1. Parse Excel file
    2. Match each row to bay_id
    3. Create/update BayLoad records
    4. Return summary statistics
    """
    
    REQUIRED_COLUMNS = ['Bus Number', 'Bus Name', 'Mnemonic', 'Id', 'Pload (MW)', 'Qload (Mvar)']
    
    @staticmethod
    def validate_columns(df: pd.DataFrame) -> Tuple[bool, Optional[str]]:
        """
        Validate that DataFrame has required columns.
        
        Returns:
            (is_valid, error_message)
        """
        missing_columns = set(LoadProfileService.REQUIRED_COLUMNS) - set(df.columns)
        if missing_columns:
            return False, f"Missing required columns: {', '.join(missing_columns)}"
        return True, None
    
    @staticmethod
    def parse_excel(file_path: str) -> pd.DataFrame:
        """
        Parse Excel file and return DataFrame.
        
        Args:
            file_path: Path to Excel file (.xlsx or .xls)
        
        Returns:
            pandas DataFrame with load profile data
        
        Raises:
            ValueError: If file cannot be parsed or missing columns
        """
        try:
            df = pd.read_excel(file_path)
        except Exception as e:
            raise ValueError(f"Failed to parse Excel file: {str(e)}")
        
        # Normalize column names (remove extra spaces)
        df.columns = df.columns.str.strip().str.replace(r'\s+', ' ', regex=True)
        
        # Validate columns
        is_valid, error_msg = LoadProfileService.validate_columns(df)
        if not is_valid:
            raise ValueError(error_msg)
        
        # Clean up data
        df = df.dropna(subset=['Mnemonic', 'Id', 'Pload (MW)', 'Qload (Mvar)'])
        
        return df
    
    @staticmethod
    def process_upload(file_path: str) -> Dict:
        """
        Main orchestration function for load profile upload.
        
        Args:
            file_path: Path to uploaded Excel file
        
        Returns:
            Dict with summary:
            {
                'total_rows': int,
                'matched': int,
                'unmatched': int,
                'upload_batch_id': str,
                'unmatched_details': [
                    {'mnemonic': str, 'id': str, 'reason': str},
                    ...
                ]
            }
        """
        # Parse Excel
        df = LoadProfileService.parse_excel(file_path)
        
        # Generate batch ID
        batch_id = uuid.uuid4()
        
        # Build substations cache for performance
        substations_cache = BayIDMatcher.build_substations_cache()
        
        matched_count = 0
        unmatched_count = 0
        unmatched_details = []
        
        # Clear existing load data (full replacement strategy)
        with transaction.atomic():
            BayLoad.objects.all().delete()
            
            # Process each row
            for idx, row in df.iterrows():
                mnemonic = str(row['Mnemonic']).strip()
                bay_identifier = str(row['Id']).strip()
                bus_name = str(row['Bus Name']).strip()
                pload_mw = float(row['Pload (MW)'])
                qload_mvar = float(row['Qload (Mvar)'])
                
                # Extract voltage from Bus Name
                voltage = BayIDMatcher.extract_voltage_from_bus_name(bus_name)
                
                if voltage is None:
                    unmatched_count += 1
                    unmatched_details.append({
                        'mnemonic': mnemonic,
                        'id': bay_identifier,
                        'reason': f'Could not extract voltage from Bus Name: {bus_name}'
                    })
                    # Still create record for traceability
                    BayLoad.objects.create(
                        pload_mw=pload_mw,
                        qload_mvar=qload_mvar,
                        bus_name=bus_name,
                        mnemonic=mnemonic,
                        bay_identifier=bay_identifier,
                        upload_batch_id=batch_id,
                        matched=False
                    )
                    continue
                
                # Match to bay
                matched_obj, model_type = BayIDMatcher.match_bay(
                    mnemonic, bay_identifier, voltage, substations_cache
                )
                
                if matched_obj:
                    # Create BayLoad record with match
                    if model_type == 'transformer':
                        BayLoad.objects.create(
                            transformer=matched_obj,
                            pload_mw=pload_mw,
                            qload_mvar=qload_mvar,
                            bus_name=bus_name,
                            mnemonic=mnemonic,
                            bay_identifier=bay_identifier,
                            upload_batch_id=batch_id,
                            matched=True
                        )
                    else:  # incoming_bay
                        BayLoad.objects.create(
                            incoming_bay=matched_obj,
                            pload_mw=pload_mw,
                            qload_mvar=qload_mvar,
                            bus_name=bus_name,
                            mnemonic=mnemonic,
                            bay_identifier=bay_identifier,
                            upload_batch_id=batch_id,
                            matched=True
                        )
                    matched_count += 1
                else:
                    # No match found
                    substation_id = f"{mnemonic}{voltage}"
                    reason = f'Bay {bay_identifier} not found in substation {substation_id}'
                    if substation_id not in substations_cache:
                        reason = f'Substation {substation_id} does not exist'
                    
                    unmatched_details.append({
                        'mnemonic': mnemonic,
                        'id': bay_identifier,
                        'reason': reason
                    })
                    
                    # Create unmatched record for audit
                    BayLoad.objects.create(
                        pload_mw=pload_mw,
                        qload_mvar=qload_mvar,
                        bus_name=bus_name,
                        mnemonic=mnemonic,
                        bay_identifier=bay_identifier,
                        upload_batch_id=batch_id,
                        matched=False
                    )
                    unmatched_count += 1
        
        return {
            'total_rows': len(df),
            'matched': matched_count,
            'unmatched': unmatched_count,
            'upload_batch_id': str(batch_id),
            'unmatched_details': unmatched_details
        }
