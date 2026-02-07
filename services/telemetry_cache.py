"""
Real-Time Telemetry Cache Service

Provides a Redis-backed caching layer for real-time substation load data.
This enables sub-10ms API responses for telemetry endpoints without hitting the database.
"""

import redis
import json
from datetime import datetime
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class TelemetryCache:
    """
    Redis cache for real-time substation load telemetry.
    
    Data Structure:
        Key: "telemetry:load:{substation_id}"
        Value: JSON {"mw": float, "mvar": float, "ts": ISO timestamp}
        TTL: 60 seconds (auto-expire stale data)
    """
    
    def __init__(self):
        """Initialize Redis connection."""
        try:
            self.redis_client = redis.Redis(
                host=getattr(settings, 'REDIS_HOST', 'localhost'),
                port=getattr(settings, 'REDIS_PORT', 6379),
                db=getattr(settings, 'REDIS_DB', 0),
                decode_responses=True
            )
            # Test connection
            self.redis_client.ping()
            logger.info("TelemetryCache: Redis connection established")
        except redis.ConnectionError as e:
            logger.error(f"TelemetryCache: Failed to connect to Redis: {e}")
            self.redis_client = None
    
    def update_substation_load(self, substation_id, pload_mw, qload_mvar):
        """
        Update load data for a specific substation.
        
        Args:
            substation_id (str): Substation identifier (e.g., "ABBA132")
            pload_mw (float): Active power load in MW
            qload_mvar (float): Reactive power load in Mvar
        """
        if not self.redis_client:
            logger.warning("TelemetryCache: Redis not available, skipping update")
            return
        
        try:
            key = f"telemetry:load:{substation_id}"
            value = json.dumps({
                "mw": round(pload_mw, 2),
                "mvar": round(qload_mvar, 2),
                "ts": datetime.utcnow().isoformat()
            })
            
            # Set with 60-second TTL (auto-expire stale data)
            self.redis_client.setex(key, 60, value)
            logger.debug(f"TelemetryCache: Updated {substation_id} -> {pload_mw} MW")
        
        except Exception as e:
            logger.error(f"TelemetryCache: Failed to update {substation_id}: {e}")
    
    def get_load(self, substation_id):
        """
        Get load data for a specific substation.
        
        Args:
            substation_id (str): Substation identifier
            
        Returns:
            dict: {"mw": float, "mvar": float, "ts": str} or None if not found
        """
        if not self.redis_client:
            return None
        
        try:
            key = f"telemetry:load:{substation_id}"
            value = self.redis_client.get(key)
            
            if value:
                return json.loads(value)
            return None
        
        except Exception as e:
            logger.error(f"TelemetryCache: Failed to get {substation_id}: {e}")
            return None
    
    def get_all_loads(self):
        """
        Get all substation loads from cache.
        
        Returns:
            dict: {substation_id: {"mw": float, "mvar": float, "ts": str}}
        """
        if not self.redis_client:
            return {}
        
        try:
            # Scan for all telemetry keys
            loads = {}
            cursor = 0
            
            while True:
                cursor, keys = self.redis_client.scan(
                    cursor=cursor,
                    match="telemetry:load:*",
                    count=100
                )
                
                for key in keys:
                    # Extract substation_id from key
                    substation_id = key.replace("telemetry:load:", "")
                    value = self.redis_client.get(key)
                    
                    if value:
                        loads[substation_id] = json.loads(value)
                
                if cursor == 0:
                    break
            
            logger.debug(f"TelemetryCache: Retrieved {len(loads)} substation loads")
            return loads
        
        except Exception as e:
            logger.error(f"TelemetryCache: Failed to get all loads: {e}")
            return {}
    
    def update_aggregated_metrics(self, region_totals, state_totals, ownership_totals, grid_total):
        """
        Update aggregated metrics in cache.
        
        Args:
            region_totals (dict): {region_name: {"mw": float, "mvar": float}}
            state_totals (dict): {state_name: {"mw": float, "mvar": float}}
            ownership_totals (dict): {ownership_type: {"mw": float, "mvar": float}}
            grid_total (dict): {"mw": float, "mvar": float}
        """
        if not self.redis_client:
            logger.warning("TelemetryCache: Redis not available, skipping aggregated metrics")
            return
        
        try:
            timestamp = datetime.utcnow().isoformat()
            
            # Store region totals
            for region, values in region_totals.items():
                key = f"telemetry:region:{region}"
                value = json.dumps({
                    "mw": round(values["mw"], 2),
                    "mvar": round(values["mvar"], 2),
                    "ts": timestamp
                })
                self.redis_client.setex(key, 60, value)
            
            # Store state totals
            for state, values in state_totals.items():
                key = f"telemetry:state:{state}"
                value = json.dumps({
                    "mw": round(values["mw"], 2),
                    "mvar": round(values["mvar"], 2),
                    "ts": timestamp
                })
                self.redis_client.setex(key, 60, value)
            
            # Store ownership totals
            for ownership, values in ownership_totals.items():
                key = f"telemetry:ownership:{ownership}"
                value = json.dumps({
                    "mw": round(values["mw"], 2),
                    "mvar": round(values["mvar"], 2),
                    "ts": timestamp
                })
                self.redis_client.setex(key, 60, value)
            
            # Store grid total
            key = "telemetry:grid:total"
            value = json.dumps({
                "mw": round(grid_total["mw"], 2),
                "mvar": round(grid_total["mvar"], 2),
                "ts": timestamp
            })
            self.redis_client.setex(key, 60, value)
            
            logger.debug(f"TelemetryCache: Updated aggregated metrics")
        
        except Exception as e:
            logger.error(f"TelemetryCache: Failed to update aggregated metrics: {e}")
    
    def get_aggregated_metrics(self):
        """
        Get all aggregated metrics from cache.
        
        Returns:
            dict: {
                "regions": {region_name: {"mw": float, "mvar": float, "ts": str}},
                "states": {state_name: {"mw": float, "mvar": float, "ts": str}},
                "ownership": {type: {"mw": float, "mvar": float, "ts": str}},
                "grid": {"mw": float, "mvar": float, "ts": str}
            }
        """
        if not self.redis_client:
            return {"regions": {}, "states": {}, "ownership": {}, "grid": None}
        
        try:
            result = {
                "regions": {},
                "states": {},
                "ownership": {},
                "grid": None
            }
            
            # Get regions
            for key in self.redis_client.scan_iter(match="telemetry:region:*"):
                region_name = key.replace("telemetry:region:", "")
                value = self.redis_client.get(key)
                if value:
                    result["regions"][region_name] = json.loads(value)
            
            # Get states
            for key in self.redis_client.scan_iter(match="telemetry:state:*"):
                state_name = key.replace("telemetry:state:", "")
                value = self.redis_client.get(key)
                if value:
                    result["states"][state_name] = json.loads(value)
            
            # Get ownership
            for key in self.redis_client.scan_iter(match="telemetry:ownership:*"):
                ownership_type = key.replace("telemetry:ownership:", "")
                value = self.redis_client.get(key)
                if value:
                    result["ownership"][ownership_type] = json.loads(value)
            
            # Get grid total
            grid_value = self.redis_client.get("telemetry:grid:total")
            if grid_value:
                result["grid"] = json.loads(grid_value)
            
            return result
        
        except Exception as e:
            logger.error(f"TelemetryCache: Failed to get aggregated metrics: {e}")
            return {"regions": {}, "states": {}, "ownership": {}, "grid": None}
    
    def clear_all(self):
        """Clear all telemetry data (useful for testing)."""
        if not self.redis_client:
            return
        
        try:
            cursor = 0
            deleted = 0
            
            while True:
                cursor, keys = self.redis_client.scan(
                    cursor=cursor,
                    match="telemetry:load:*",
                    count=100
                )
                
                if keys:
                    deleted += self.redis_client.delete(*keys)
                
                if cursor == 0:
                    break
            
            logger.info(f"TelemetryCache: Cleared {deleted} telemetry entries")
        
        except Exception as e:
            logger.error(f"TelemetryCache: Failed to clear cache: {e}")


# Singleton instance
_cache_instance = None

def get_telemetry_cache():
    """Get or create the singleton TelemetryCache instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = TelemetryCache()
    return _cache_instance
