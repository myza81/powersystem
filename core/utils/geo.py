"""
Utility functions for the core app
"""

def get_state_from_coordinates(lat, lon, grid=None):
    """
    Determine Malaysian state from coordinates using bounding boxes.
    
    Args:
        lat (float): Latitude
        lon (float): Longitude
        grid (str, optional): Grid mnemonic (e.g., 'SELG', 'KLUM') to assist detection
    
    Returns:
        str: State name or None if coordinates don't match any state
    """
    if lat is None or lon is None:
        return None
    
    # 1. Grid-based Overrides (High Confidence)
    # If grid is definitively one state, return it immediately if reasonable
    if grid:
        grid_map = {
            'SELG': 'Selangor',
            'JOH1': 'Johor', 'JOH2': 'Johor',
            'MLKA': 'Melaka',
            'NSEM': 'Negeri Sembilan',
            'PHNG': 'Pahang',
            'TERG': 'Terengganu',
            'KELN': 'Kelantan',
            'PERK': 'Perak',
            'PPNG': 'Pulau Pinang',
            # 'KLUM' is ambiguous (KL/Selangor), 'KEDP' (Kedah/Perlis)
        }
        if grid in grid_map:
            return grid_map[grid]

    # Convert to float if Decimal
    lat = float(lat)
    lon = float(lon)
    
    # Malaysian state bounding boxes (approximate)
    # Format: 'State': {'lat': (min, max), 'lon': (min, max)}
    state_bounds = {
        # Peninsular Malaysia (North to South)
        'Perlis': {'lat': (6.3, 6.7), 'lon': (100.1, 100.35)},
        'Kedah': {'lat': (5.6, 6.7), 'lon': (99.6, 100.9)},
        'Pulau Pinang': {'lat': (5.2, 5.5), 'lon': (100.15, 100.55)},
        'Perak': {'lat': (3.9, 5.6), 'lon': (100.4, 101.5)},
        'Kelantan': {'lat': (4.5, 6.3), 'lon': (101.3, 102.6)},
        'Terengganu': {'lat': (4.0, 5.9), 'lon': (102.4, 103.6)},
        'Pahang': {'lat': (2.8, 4.8), 'lon': (102.0, 103.6)},
        'Selangor': {'lat': (2.7, 3.8), 'lon': (100.9, 101.9)},
        'Kuala Lumpur': {'lat': (3.0, 3.25), 'lon': (101.615, 101.8)}, # Adjusted western boundary (was 101.6)
        'Negeri Sembilan': {'lat': (2.5, 3.0), 'lon': (101.7, 102.7)},
        'Melaka': {'lat': (2.0, 2.5), 'lon': (102.0, 102.7)},
        'Johor': {'lat': (1.2, 2.8), 'lon': (102.4, 104.6)},
        
        # East Malaysia
        'Sabah': {'lat': (4.0, 7.5), 'lon': (115.0, 119.5)},
        'Sarawak': {'lat': (0.8, 5.0), 'lon': (109.5, 115.5)},
        'Labuan': {'lat': (5.2, 5.4), 'lon': (115.1, 115.35)},
    }
    
    # Check each state's bounding box
    # Priority order: Check smaller states first to avoid overlap issues
    priority_states = ['Kuala Lumpur', 'Labuan', 'Melaka', 'Pulau Pinang', 'Perlis', 'Selangor']
    
    # Check priority states first
    for state in priority_states:
        if state in state_bounds:
            bounds = state_bounds[state]
            if (bounds['lat'][0] <= lat <= bounds['lat'][1] and 
                bounds['lon'][0] <= lon <= bounds['lon'][1]):
                return state
    
    # Check remaining states
    for state, bounds in state_bounds.items():
        if state not in priority_states:
            if (bounds['lat'][0] <= lat <= bounds['lat'][1] and 
                bounds['lon'][0] <= lon <= bounds['lon'][1]):
                return state
    
    return None
