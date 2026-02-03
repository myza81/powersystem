import pandas as pd
from django.db import transaction
from core.models import Substation
import logging
import os

logger = logging.getLogger(__name__)

class SubstationSyncService:
    @staticmethod
    def sync_from_file(file_path):
        """
        Syncs substations from Excel or CSV with strict filters.
        Normalizes column names for better compatibility.
        """
        try:
            ext = os.path.splitext(file_path)[1].lower()
            if ext == '.csv':
                # Try to detect delimiter if possible, or just default to common ones
                try:
                    df = pd.read_csv(file_path, sep=None, engine='python')
                except:
                    df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)

            # Normalize column names: strip spaces and lowercase
            df.columns = [str(c).strip().lower() for c in df.columns]
            
            required_cols = ['mnemonic', 'name', 'ownership', 'voltage', 'grid']
            missing = [c for c in required_cols if c not in df.columns]
            if missing:
                raise ValueError(f"Missing required columns: {', '.join(missing)}. Found: {', '.join(df.columns)}")

            results = {
                'created': 0,
                'duplicates_skipped': 0,
                'invalid_grid_skipped': 0,
                'errors': [],
                'logs': []
            }

            # Valid Grid Choices
            valid_grids = [choice[0] for choice in Substation.GRID_CHOICES]
            valid_voltages = [choice[0] for choice in Substation.VOLTAGE_CHOICES]

            with transaction.atomic():
                for index, row in df.iterrows():
                    row_num = index + 2
                    try:
                        # Normalize values
                        mnemonic = str(row['mnemonic']).strip().upper() if not pd.isna(row['mnemonic']) else None
                        name = str(row['name']).strip() if not pd.isna(row['name']) else None
                        ownership = str(row['ownership']).strip() if not pd.isna(row['ownership']) else 'TNB'
                        grid = str(row['grid']).strip().upper() if not pd.isna(row['grid']) else None
                        
                        if not mnemonic or not name:
                            results['errors'].append(f"Row {row_num}: Missing Mnemonic or Name. Skipped.")
                            continue

                        # 1. Validate Grid Choice
                        if grid not in valid_grids:
                            msg = f"Row {row_num}: Invalid Grid '{grid}'. (Expected: {', '.join(valid_grids)}). Skipped."
                            results['invalid_grid_skipped'] += 1
                            results['logs'].append(msg)
                            continue

                        # 2. Validate Voltage
                        try:
                            # Handle cases where voltage might be float or string
                            v_raw = row['voltage']
                            if isinstance(v_raw, str):
                                v_raw = v_raw.replace('kV', '').strip()
                            voltage = int(float(v_raw))
                            
                            if voltage not in valid_voltages:
                                msg = f"Row {row_num}: Unsupported Voltage '{voltage} kV'. (Expected: {', '.join(map(str, valid_voltages))}). Skipped."
                                results['errors'].append(msg)
                                continue
                        except:
                            msg = f"Row {row_num}: Invalid Voltage format '{row['voltage']}'. Skipped."
                            results['errors'].append(msg)
                            continue

                        # 3. Generate ID and check for Duplicates
                        substation_id = f"{mnemonic}{voltage}"
                        if Substation.objects.filter(substation_id=substation_id).exists():
                            msg = f"Row {row_num}: Substation {substation_id} already exists. Skipped."
                            results['duplicates_skipped'] += 1
                            results['logs'].append(msg)
                            continue

                        # 4. Create record
                        substation = Substation(
                            substation_id=substation_id,
                            mnemonic=mnemonic,
                            name=name,
                            ownership=ownership,
                            voltage=voltage,
                            grid=grid
                        )
                        substation.save() # Triggers Geocoding
                        
                        results['created'] += 1
                        results['logs'].append(f"Row {row_num}: Added {substation_id}")

                    except Exception as e:
                        logger.error(f"Error at row {row_num}: {str(e)}")
                        results['errors'].append(f"Row {row_num}: {str(e)}")
            
            return results

        except Exception as e:
            logger.error(f"Sync failed: {str(e)}")
            return {'error': str(e)}
