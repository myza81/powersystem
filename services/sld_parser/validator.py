"""
Instruction No. 12 Validation Module
Enforces naming, numbering, and data integrity rules before DB ingestion.
"""

import re
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Raised when data fails Instruction No.12 validation."""
    pass


def validate_transformer(t: Dict) -> bool:
    """
    Validate a single transformer record.
    
    Args:
        t: Transformer dictionary
    
    Returns:
        True if valid
    
    Raises:
        ValidationError: If validation fails
    """
    # Rule: Transformer ID pattern
    tid = t.get("transformer_id", "")
    if not re.match(r'^(T|SGT|XGT|GT|ST|ET|ETX)\d+[A-Z]?$', tid):
        raise ValidationError(
            f"Invalid transformer ID '{tid}'. "
            f"Must match pattern: (T|SGT|XGT|GT|ST|ET|ETX){{number}}{{optional_letter}}"
        )
    
    # Rule: HV voltage must be standard
    hv = t.get("hv_voltage")
    if hv and hv not in [132, 275, 500]:
        raise ValidationError(
            f"Invalid HV voltage {hv}kV for {tid}. "
            f"Must be one of: 132, 275, 500"
        )
    
    # Rule: Sequence number must match ID
    seq = t.get("sequence_number")
    if seq:
        # Extract number from ID (e.g., "T1" -> 1, "SGT2A" -> 2)
        id_match = re.search(r'(\d+)', tid)
        if id_match:
            id_num = int(id_match.group(1))
            if seq != id_num:
                raise ValidationError(
                    f"Sequence number {seq} doesn't match ID {tid}"
                )
    
    # Rule: HV breaker numbering ([seq]10)
    hv_breaker = t.get("hv_breaker_number")
    if hv_breaker and seq:
        expected_prefix = str(seq)
        if not hv_breaker.startswith(expected_prefix):
            raise ValidationError(
                f"HV breaker '{hv_breaker}' for {tid} should start with '{expected_prefix}'"
            )
        
        # Check it ends with 10
        if not hv_breaker.endswith("10"):
            logger.warning(
                f"HV breaker '{hv_breaker}' for {tid} doesn't end with '10' (expected pattern: {{seq}}10)"
            )
    
    return True


def validate_incoming_bay(bay: Dict) -> bool:
    """
    Validate an incoming bay record.
    
    Args:
        bay: IncomingBay dictionary
    
    Returns:
        True if valid
    
    Raises:
        ValidationError: If validation fails
    """
    # Rule: Bay ID pattern (feeder name + number)
    bay_id = bay.get("bay_id", "")
    if not re.match(r'^[A-Z]{2,}\d+$', bay_id):
        raise ValidationError(
            f"Invalid bay ID '{bay_id}'. "
            f"Must be uppercase letters followed by number (e.g., SRDN1, IOIM2)"
        )
    
    # Rule: Voltage must be standard
    v = bay.get("voltage")
    if v and v not in [132, 275, 500, 33, 11]:
        raise ValidationError(
            f"Invalid voltage {v}kV for bay {bay_id}. "
            f"Must be one of: 132, 275, 500, 33, 11"
        )
    
    # Rule: Breaker number should be 3-4 digits
    breaker = bay.get("breaker_number")
    if breaker and not re.match(r'^\d{3,4}$', str(breaker)):
        logger.warning(
            f"Bay {bay_id} breaker '{breaker}' is not 3-4 digits"
        )
    
    return True


def validate_dataset(data: Dict) -> Dict:
    """
    Validate complete parsed dataset.
    
    Args:
        data: Parsed SLD data with transformers and incoming_bays
    
    Returns:
        Same data dict if validation passes
    
    Raises:
        ValidationError: If any validation fails
    """
    errors = []
    
    # Validate transformers
    for i, t in enumerate(data.get("transformers", [])):
        try:
            validate_transformer(t)
        except ValidationError as e:
            errors.append(f"Transformer {i+1}: {str(e)}")
    
    # Validate incoming bays
    for i, bay in enumerate(data.get("incoming_bays", [])):
        try:
            validate_incoming_bay(bay)
        except ValidationError as e:
            errors.append(f"Bay {i+1}: {str(e)}")
    
    if errors:
        raise ValidationError(
            f"Validation failed with {len(errors)} error(s):\n" + 
            "\n".join(f"  - {e}" for e in errors)
        )
    
    logger.info(
        f"Validation passed: {len(data.get('transformers', []))} transformers, "
        f"{len(data.get('incoming_bays', []))} bays"
    )
    
    return data
