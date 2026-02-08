#!/usr/bin/env python3
"""
Mock WebSocket Data Generator for Testing Real-Time Telemetry

This script simulates real-time load data by:
1. Fetching all substations from the database
2. Generating realistic fluctuating MW/MVAr values
3. Populating Redis cache every 2 seconds
4. Computing hierarchical aggregations (region, state, ownership, grid)

Usage:
    python mock_telemetry_generator.py

Press Ctrl+C to stop.
"""

import os
import sys
import django
import time
import random
from datetime import datetime

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'powersystem_core.settings')
django.setup()

from core.models import Substation
from services.telemetry_cache import get_telemetry_cache


class MockTelemetryGenerator:
    """Generates realistic fluctuating load data for testing."""
    
    def __init__(self):
        self.cache = get_telemetry_cache()
        self.substations = list(Substation.objects.all())
        self.base_loads = {}  # Store base load for each substation
        
        # Initialize base loads (realistic ranges by voltage level)
        for sub in self.substations:
            if sub.voltage == 500:
                base_mw = random.uniform(200, 400)
            elif sub.voltage == 275:
                base_mw = random.uniform(100, 250)
            else:  # 132kV
                base_mw = random.uniform(20, 120)
            
            # Power factor between 0.85 and 0.95
            pf = random.uniform(0.85, 0.95)
            base_mvar = base_mw * (1 - pf**2)**0.5 / pf
            
            self.base_loads[sub.substation_id] = {
                'mw': base_mw,
                'mvar': base_mvar
            }
        
        print(f"✅ Initialized {len(self.substations)} substations with base loads")
    
    def generate_fluctuation(self, base_value, volatility=0.05):
        """
        Generate realistic fluctuation around base value.
        
        Args:
            base_value (float): Base load value
            volatility (float): Percentage of fluctuation (default 5%)
        
        Returns:
            float: Fluctuated value
        """
        # Random walk with mean reversion
        change = random.gauss(0, base_value * volatility)
        new_value = base_value + change
        
        # Ensure non-negative and within reasonable bounds
        return max(0, min(new_value, base_value * 1.5))
    
    def update_loads(self):
        """Generate and cache new load values for all substations."""
        
        # Aggregation containers
        region_totals = {}
        state_totals = {}
        ownership_totals = {}
        grid_mw = 0
        grid_mvar = 0
        
        for sub in self.substations:
            sub_mw = 0
            sub_mvar = 0
            bays_data = []

            # Process Transformers
            for transformer in sub.transformers.all():
                bay_id = transformer.bay_name or transformer.bay_id 
                # Use a simplified base load model for bays if not persisted
                base_mw = self.base_loads[sub.substation_id]['mw'] / max(1, sub.transformers.count())
                base_mvar = self.base_loads[sub.substation_id]['mvar'] / max(1, sub.transformers.count())
                
                mw = self.generate_fluctuation(base_mw)
                mvar = self.generate_fluctuation(base_mvar)
                
                sub_mw += mw
                sub_mvar += mvar
                
                bays_data.append({
                    "name": bay_id,
                    "type": "transformer",
                    "mw": round(mw, 2),
                    "mvar": round(mvar, 2)
                })

            # Process Incoming Bays (if any, just add to total for now or treat as sources)
            # For simplicity in this mock, we'll focus on transformers as load points
            # If we wanted to treat incoming bays as load, we'd do similar loop.
            
            # If no transformers, fallback to substation level simulation
            if not bays_data:
                base = self.base_loads[sub.substation_id]
                sub_mw = self.generate_fluctuation(base['mw'])
                sub_mvar = self.generate_fluctuation(base['mvar'])
                
                # Update base (slow drift)
                self.base_loads[sub.substation_id]['mw'] = sub_mw * 0.9 + base['mw'] * 0.1
                self.base_loads[sub.substation_id]['mvar'] = sub_mvar * 0.9 + base['mvar'] * 0.1
            
            # Update substation-level cache with bay breakdown
            self.cache.update_substation_load(sub.substation_id, sub_mw, sub_mvar, bays=bays_data)
            
            # Accumulate for aggregations
            grid_mw += sub_mw
            grid_mvar += sub_mvar
            
            # Region aggregation
            if sub.region:
                if sub.region not in region_totals:
                    region_totals[sub.region] = {"mw": 0, "mvar": 0}
                region_totals[sub.region]["mw"] += sub_mw
                region_totals[sub.region]["mvar"] += sub_mvar
            
            # State aggregation
            if sub.state:
                if sub.state not in state_totals:
                    state_totals[sub.state] = {"mw": 0, "mvar": 0}
                state_totals[sub.state]["mw"] += sub_mw
                state_totals[sub.state]["mvar"] += sub_mvar
            
            # Ownership aggregation
            if sub.ownership:
                if sub.ownership not in ownership_totals:
                    ownership_totals[sub.ownership] = {"mw": 0, "mvar": 0}
                ownership_totals[sub.ownership]["mw"] += sub_mw
                ownership_totals[sub.ownership]["mvar"] += sub_mvar
        
        # Update aggregated metrics in cache
        self.cache.update_aggregated_metrics(
            region_totals,
            state_totals,
            ownership_totals,
            {"mw": grid_mw, "mvar": grid_mvar}
        )
        
        return grid_mw, grid_mvar, len(self.substations)
    
    def run(self, interval=2):
        """
        Run the mock generator continuously.
        
        Args:
            interval (int): Update interval in seconds
        """
        print(f"\n🚀 Starting mock telemetry generator (interval: {interval}s)")
        print("📊 Generating realistic fluctuating load data...")
        print("🔴 Press Ctrl+C to stop\n")
        
        iteration = 0
        try:
            while True:
                iteration += 1
                start_time = time.time()
                
                # Generate new loads
                grid_mw, grid_mvar, count = self.update_loads()
                
                elapsed = (time.time() - start_time) * 1000
                
                # Print status
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[{timestamp}] Iteration {iteration:4d} | "
                      f"Grid: {grid_mw:7.1f} MW, {grid_mvar:6.1f} MVAr | "
                      f"Substations: {count:3d} | "
                      f"Time: {elapsed:5.1f}ms")
                
                # Sleep for remaining interval
                time.sleep(max(0, interval - elapsed / 1000))
        
        except KeyboardInterrupt:
            print("\n\n✋ Stopping mock generator...")
            print("✅ Cache will retain data for 60 seconds (TTL)")


if __name__ == "__main__":
    generator = MockTelemetryGenerator()
    generator.run(interval=2)  # Update every 2 seconds
