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
        
        # Clean up data - remove empty rows only
        df = df.dropna(how='all')
        
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
                # Validate required fields
                if pd.isna(row['Mnemonic']) or pd.isna(row['Id']) or \
                   pd.isna(row['Pload (MW)']) or pd.isna(row['Qload (Mvar)']):
                    unmatched_count += 1
                    unmatched_details.append({
                        'mnemonic': 'N/A' if pd.isna(row['Mnemonic']) else str(row['Mnemonic']),
                        'id': 'N/A' if pd.isna(row['Id']) else str(row['Id']),
                        'reason': 'Missing required data (Mnemonic, Id, or Load values)'
                    })
                    continue

                mnemonic = str(row['Mnemonic']).strip()
                bay_identifier = str(row['Id']).strip()
                bus_name = str(row['Bus Name']).strip() if not pd.isna(row['Bus Name']) else ""
                
                try:
                    pload_mw = float(row['Pload (MW)'])
                    qload_mvar = float(row['Qload (Mvar)'])
                except (ValueError, TypeError):
                    unmatched_count += 1
                    unmatched_details.append({
                        'mnemonic': mnemonic,
                        'id': bay_identifier,
                        'reason': 'Invalid load values (must be numbers)'
                    })
                    continue
                
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
    
    @staticmethod
    def rematch_unmatched_loads():
        """
        Attempt to rematch all unmatched BayLoad records.
        This should be called when Substation, Transformer, or IncomingBay 
        records are created or updated.
        """
        unmatched_loads = BayLoad.objects.filter(matched=False)
        if not unmatched_loads.exists():
            return
            
        # Re-build cache as new substations might have been added
        substations_cache = BayIDMatcher.build_substations_cache()
        rematch_count = 0
        
        # Avoid circular imports if any
        # BayIDMatcher is already imported
        
        with transaction.atomic():
            for load in unmatched_loads:
                voltage = BayIDMatcher.extract_voltage_from_bus_name(load.bus_name)
                
                if voltage is None:
                    continue
                
                matched_obj, model_type = BayIDMatcher.match_bay(
                    load.mnemonic,
                    load.bay_identifier,
                    voltage,
                    substations_cache
                )
                
                if matched_obj:
                    # Check for existing OneToOne relation to avoid IntegrityError
                    # If this asset is already matched to a load, but we found a NEW match for it (likely via better ID match),
                    # we assume the new match is correct and "detach" the old one.
                    if hasattr(matched_obj, 'load_data') and matched_obj.load_data:
                        # Optimization: check if it's the SAME load object (unlikely in this loop, but good practice)
                        if matched_obj.load_data.id != load.id:
                            old_load = matched_obj.load_data
                            old_load.transformer = None
                            old_load.incoming_bay = None
                            old_load.matched = False
                            old_load.save()

                    if model_type == 'transformer':
                        load.transformer = matched_obj
                        load.incoming_bay = None # Ensure exclusivity
                    else:
                        load.incoming_bay = matched_obj
                        load.transformer = None
                        
                    load.matched = True
                    load.save()
                    rematch_count += 1
