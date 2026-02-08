"""
Network Topology Detection Service

Intelligent detection of substation connections from incoming bay naming patterns.
Implements pattern matching with confidence scoring and strict validation rules.
"""

import re
import logging
from collections import defaultdict
from django.db.models import Q
from core.models import IncomingBay, Substation

logger = logging.getLogger(__name__)


class NetworkTopologyService:
    """
    Service for detecting network topology connections from bay names
    """
    
    # Autotransformer patterns (internal connections)
    AUTOTRANSFORMER_PATTERNS = ['SGT', 'XGT', 'YGT', 'AGT']
    
    # Station Transformer patterns (internal connections)
    STATION_TRANSFORMER_PATTERNS = ['ST']
    
    # Generator Transformer patterns (internal connections)
    GENERATOR_TRANSFORMER_PATTERNS = ['GT']
    
    # Equipment base names (will match with numbers: Capbank1, Capbank2, etc.)
    EQUIPMENT_PATTERNS = ['Capbank', 'Reactor', 'SVC', 'STATCOM', 'Shunt']
    
    # Confidence thresholds
    CONFIDENCE_AUTO_VALIDATE = 0.95  # Auto-apply without user review
    CONFIDENCE_SUGGEST = 0.70        # Suggest to user, require approval
    
    @classmethod
    def detect_connections(cls, incoming_bay):
        """
        Main detection method - analyzes bay name and returns connection info
        
        Args:
            incoming_bay: IncomingBay instance
            
        Returns:
            dict: {
                'type': 'STANDARD' | 'TEE_OFF' | 'AUTOTRANSFORMER' | 'EQUIPMENT' | 'UNKNOWN',
                'primary': Substation instance or None,
                'tee_offs': [Substation, ...],
                'confidence': float (0.0-1.0),
                'note': str (explanation)
            }
        """
        bay_name = incoming_bay.bay_name
        
        # Rule 1: Check equipment exclusions (pattern-based)
        if cls.is_equipment(bay_name):
            return {
                'type': 'EQUIPMENT',
                'primary': None,
                'tee_offs': [],
                'confidence': 1.0,
                'note': f"'{bay_name}' is equipment, not a connection"
            }
        
        # Rule 2: Station Transformer (internal connection)
        if cls.is_station_transformer(bay_name):
            return {
                'type': 'EQUIPMENT',
                'primary': None,
                'tee_offs': [],
                'confidence': 1.0,
                'note': 'Station Transformer - internal equipment'
            }
        
        # Rule 3: Generator Transformer (internal connection)
        if cls.is_generator_transformer(bay_name):
            return {
                'type': 'EQUIPMENT',
                'primary': None,
                'tee_offs': [],
                'confidence': 1.0,
                'note': 'Generator Transformer - internal equipment'
            }
        
        # Rule 4: Autotransformer (internal connection)
        if cls.is_autotransformer(bay_name):
            return {
                'type': 'AUTOTRANSFORMER',
                'primary': None,
                'tee_offs': [],
                'confidence': 0.99,
                'note': 'Autotransformer - internal connection'
            }
        
        # Rule 5: Tee-off connection (slash notation)
        if '/' in bay_name:
            return cls.detect_tee_off(bay_name, incoming_bay)
        
        # Rule 6: Standard connection
        return cls.detect_standard(bay_name, incoming_bay)
    
    @classmethod
    def detect_standard(cls, bay_name, incoming_bay):
        """
        Detect standard single connection
        
        Returns high confidence (0.95) if exactly one substation matches
        """
        mnemonic = cls.extract_mnemonic(bay_name)
        
        # Exclude self-connection
        substations = Substation.objects.filter(
            mnemonic=mnemonic
        ).exclude(
            substation_id=incoming_bay.substation.substation_id
        )
        
        count = substations.count()
        
        if count == 0:
            return {
                'type': 'UNKNOWN',
                'primary': None,
                'tee_offs': [],
                'confidence': 0.0,
                'note': f"No substation found with mnemonic '{mnemonic}'"
            }
        
        elif count == 1:
            # Exact match - high confidence
            substation = substations.first()
            return {
                'type': 'STANDARD',
                'primary': substation,
                'tee_offs': [],
                'confidence': 0.95,
                'note': f"Exact match: {mnemonic} → {substation.substation_id}"
            }
        
        else:
            # Multiple matches - try voltage-level matching
            source_voltage = incoming_bay.substation.voltage
            voltage_matched = substations.filter(voltage=source_voltage)
            
            if voltage_matched.count() == 1:
                # Voltage-level match resolves ambiguity - HIGH CONFIDENCE
                substation = voltage_matched.first()
                all_matches = ', '.join([s.substation_id for s in substations[:5]])
                return {
                    'type': 'STANDARD',
                    'primary': substation,
                    'tee_offs': [],
                    'confidence': 0.95,
                    'note': f"Voltage-level match: {mnemonic} @ {source_voltage}kV → {substation.substation_id} (resolved from: {all_matches})"
                }
            elif voltage_matched.count() > 1:
                # Still ambiguous even with voltage matching
                matches = ', '.join([s.substation_id for s in voltage_matched[:5]])
                return {
                    'type': 'UNKNOWN',
                    'primary': None,
                    'tee_offs': [],
                    'confidence': 0.3,
                    'note': f"Ambiguous: {voltage_matched.count()} substations match '{mnemonic}' @ {source_voltage}kV: {matches}..."
                }
            else:
                # No voltage match - show all matches
                matches = ', '.join([s.substation_id for s in substations[:5]])
                return {
                    'type': 'UNKNOWN',
                    'primary': None,
                    'tee_offs': [],
                    'confidence': 0.3,
                    'note': f"Ambiguous: {count} substations match '{mnemonic}': {matches}... (no {source_voltage}kV match found)"
                }
    
    @classmethod
    def detect_tee_off(cls, bay_name, incoming_bay):
        """
        Detect tee-off connections (slash notation)
        
        Returns high confidence (0.95) if ALL parts resolve to exactly 1 substation each
        Returns medium confidence (0.50) if partial resolution
        """
        parts = bay_name.split('/')
        connected_substations = []
        unresolved_parts = []
        resolution_details = []
        
        for part in parts:
            # Clean transformer suffix if present (e.g., BBDG1/T7 → BBDG1)
            part = cls.clean_transformer_suffix(part)
            mnemonic = cls.extract_mnemonic(part)
            
            # Find substations matching this mnemonic
            substations = Substation.objects.filter(
                mnemonic=mnemonic
            ).exclude(
                substation_id=incoming_bay.substation.substation_id
            )
            
            count = substations.count()
            
            if count == 1:
                substation = substations.first()
                connected_substations.append(substation)
                resolution_details.append(f"{mnemonic} → {substation.substation_id}")
            elif count > 1:
                # Try voltage-level matching
                source_voltage = incoming_bay.substation.voltage
                voltage_matched = substations.filter(voltage=source_voltage)
                
                if voltage_matched.count() == 1:
                    substation = voltage_matched.first()
                    connected_substations.append(substation)
                    resolution_details.append(f"{mnemonic} → {substation.substation_id} (voltage matched)")
                else:
                    unresolved_parts.append(f"{mnemonic} (ambiguous: {count} matches)")
                    resolution_details.append(f"{mnemonic} → AMBIGUOUS")
            else:
                unresolved_parts.append(f"{mnemonic} (not found)")
                resolution_details.append(f"{mnemonic} → NOT FOUND")
        
        # All parts resolved successfully - HIGH CONFIDENCE
        if len(connected_substations) == len(parts) and len(parts) >= 2:
            return {
                'type': 'TEE_OFF',
                'primary': connected_substations[0],
                'tee_offs': connected_substations,
                'confidence': 0.95,  # High confidence - auto-validate
                'note': f"Tee-off: {' + '.join([s.substation_id for s in connected_substations])}"
            }
        
        # Partial resolution - MEDIUM CONFIDENCE
        elif len(connected_substations) >= 1:
            return {
                'type': 'TEE_OFF',
                'primary': connected_substations[0] if connected_substations else None,
                'tee_offs': connected_substations,
                'confidence': 0.50,  # Medium - requires validation
                'note': f"Partial tee-off: {len(connected_substations)}/{len(parts)} resolved. " + 
                       f"Resolved: {'; '.join(resolution_details)}"
            }
        
        # No resolution - LOW CONFIDENCE
        else:
            return {
                'type': 'UNKNOWN',
                'primary': None,
                'tee_offs': [],
                'confidence': 0.0,
                'note': f"Tee-off parse failed: {'; '.join(resolution_details)}"
            }
    
    @staticmethod
    def extract_mnemonic(bay_name):
        """
        Extract mnemonic from bay name by removing trailing numbers
        
        Examples:
            SRDN1 → SRDN
            GPTH2 → GPTH
            CBPS2 → CBPS
        """
        return re.sub(r'\d+$', '', bay_name).strip()
    
    @staticmethod
    def clean_transformer_suffix(text):
        """
        Remove transformer suffix like /T7
        
        Examples:
            BBDG1/T7 → BBDG1
            NRWG/HKCK → NRWG/HKCK (no change)
        """
        return re.sub(r'/T\d+$', '', text)
    
    @classmethod
    def is_autotransformer(cls, bay_name):
        """Check if bay name matches autotransformer patterns"""
        return any(bay_name.startswith(pattern) for pattern in cls.AUTOTRANSFORMER_PATTERNS)
    
    @classmethod
    def is_equipment(cls, bay_name):
        """
        Check if bay name matches equipment patterns (with optional numbers)
        Examples: Capbank, Capbank1, Capbank2, SVC, SVC1, Reactor3
        """
        for pattern in cls.EQUIPMENT_PATTERNS:
            # Match exact name or name with trailing numbers
            if bay_name == pattern or re.match(f'^{re.escape(pattern)}\\d+$', bay_name):
                return True
        return False
    
    @classmethod
    def is_station_transformer(cls, bay_name):
        """
        Check if bay name matches station transformer patterns
        Examples: ST1, ST2, ST10
        """
        for pattern in cls.STATION_TRANSFORMER_PATTERNS:
            if re.match(f'^{re.escape(pattern)}\\d+$', bay_name):
                return True
        return False
    
    @classmethod
    def is_generator_transformer(cls, bay_name):
        """
        Check if bay name matches generator transformer patterns
        Examples: GT1, GT2, GT10
        Note: Must have numbers to avoid conflict with autotransformer patterns
        """
        for pattern in cls.GENERATOR_TRANSFORMER_PATTERNS:
            if re.match(f'^{re.escape(pattern)}\\d+$', bay_name):
                return True
        return False
    
    @classmethod
    def apply_detection_result(cls, bay, detection, user=None):
        """
        Apply detection result to IncomingBay instance
        
        Args:
            bay: IncomingBay instance
            detection: dict from detect_connections()
            user: User instance for validation tracking (optional)
        """
        bay.connection_type = detection['type']
        bay.connected_to_substation = detection['primary']
        bay.detection_confidence = detection['confidence']
        bay.detection_note = detection['note']
        bay.auto_detected = True
        
        # Apply validation status based on confidence
        if detection['confidence'] >= cls.CONFIDENCE_AUTO_VALIDATE:
            bay.validation_status = 'AUTO_VALIDATED'
        elif detection['confidence'] >= cls.CONFIDENCE_SUGGEST:
            bay.validation_status = 'PENDING'
        else:
            bay.validation_status = 'REJECTED'
        
        # Save to apply changes
        bay.save()
        
        # Handle tee-off connections (ManyToManyField)
        if detection['tee_offs']:
            bay.tee_off_connections.set(detection['tee_offs'])
        
        logger.info(
            f"Applied detection for {bay.bay_id}: {detection['type']} "
            f"(confidence: {detection['confidence']:.2f}, status: {bay.validation_status})"
        )
    
    @classmethod
    def auto_detect_all(cls, confidence_threshold=None):
        """
        Run auto-detection on all incoming bays that need validation
        
        Args:
            confidence_threshold: Minimum confidence to auto-apply (default: CONFIDENCE_AUTO_VALIDATE)
            
        Returns:
            dict: {
                'processed': int,
                'auto_validated': int,
                'pending_review': int,
                'rejected': int,
                'details': [...]
            }
        """
        if confidence_threshold is None:
            confidence_threshold = cls.CONFIDENCE_AUTO_VALIDATE
        
        # Get bays that need detection
        bays = IncomingBay.objects.filter(
            Q(validation_status='PENDING') | 
            Q(validation_status='REJECTED') | 
            Q(topology_changed=True)
        )
        
        results = {
            'processed': 0,
            'auto_validated': 0,
            'pending_review': 0,
            'rejected': 0,
            'details': []
        }
        
        for bay in bays:
            detection = cls.detect_connections(bay)
            cls.apply_detection_result(bay, detection)
            
            results['processed'] += 1
            
            if bay.validation_status == 'AUTO_VALIDATED':
                results['auto_validated'] += 1
            elif bay.validation_status == 'PENDING':
                results['pending_review'] += 1
            else:
                results['rejected'] += 1
            
            # Track low-confidence cases
            if detection['confidence'] < confidence_threshold:
                results['details'].append({
                    'bay_id': bay.bay_id,
                    'bay_name': bay.bay_name,
                    'confidence': detection['confidence'],
                    'note': detection['note'],
                    'status': bay.validation_status
                })
        
        logger.info(
            f"Auto-detection complete: {results['processed']} processed, "
            f"{results['auto_validated']} auto-validated, "
            f"{results['pending_review']} pending review, "
            f"{results['rejected']} rejected"
        )
        
        return results
    
    @classmethod
    def check_topology_changes(cls):
        """
        Check for topology changes in validated connections
        Re-run detection and flag if connection changed
        
        Returns:
            list: [{bay_id, old_connection, new_connection, confidence}, ...]
        """
        # Get all validated connections
        bays = IncomingBay.objects.filter(
            validation_status__in=['VALIDATED', 'AUTO_VALIDATED'],
            is_active=True
        )
        
        changes_detected = []
        
        for bay in bays:
            # Re-run detection
            new_detection = cls.detect_connections(bay)
            
            # Compare with current connection
            current_connection = bay.connected_to_substation
            new_connection = new_detection.get('primary')
            
            if current_connection != new_connection:
                # Connection changed!
                bay.topology_changed = True
                bay.validation_status = 'PENDING'
                bay.detection_note = (
                    f"Topology change detected: "
                    f"{current_connection.substation_id if current_connection else 'None'} → "
                    f"{new_connection.substation_id if new_connection else 'None'}. "
                    f"Re-validation required."
                )
                bay.save()
                
                changes_detected.append({
                    'bay_id': bay.bay_id,
                    'old_connection': current_connection.substation_id if current_connection else None,
                    'new_connection': new_connection.substation_id if new_connection else None,
                    'confidence': new_detection['confidence'],
                })
                
                logger.warning(
                    f"Topology change detected for {bay.bay_id}: "
                    f"{current_connection} → {new_connection}"
                )
        
        return changes_detected
