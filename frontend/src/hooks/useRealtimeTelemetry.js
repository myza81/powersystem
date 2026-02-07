/**
 * Real-Time Telemetry Hook
 * 
 * A modular, reusable React hook that any component can use to subscribe
 * to real-time load data updates.
 * 
 * Usage:
 *   const { loads, aggregates, isLive } = useRealtimeTelemetry({ enabled: true });
 */

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

export const useRealtimeTelemetry = ({ 
    enabled = false, 
    interval = 5000,
    includeAggregates = false 
} = {}) => {
    const [loads, setLoads] = useState({});
    const [aggregates, setAggregates] = useState(null);
    const [isLive, setIsLive] = useState(false);
    const [error, setError] = useState(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!enabled) {
            setIsLive(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        const fetchTelemetry = async () => {
            try {
                // Fetch substation loads
                const loadsRes = await api.get('/telemetry/loads/');
                const loadMap = {};
                loadsRes.data.forEach(item => {
                    loadMap[item.id] = { 
                        mw: item.mw, 
                        mvar: item.mvar,
                        ts: item.ts 
                    };
                });
                setLoads(loadMap);

                // Optionally fetch aggregated metrics
                if (includeAggregates) {
                    const aggRes = await api.get('/telemetry/aggregates/');
                    setAggregates(aggRes.data);
                }

                setIsLive(true);
                setError(null);
            } catch (err) {
                console.error('Telemetry fetch error:', err);
                setError(err.message);
                setIsLive(false);
            }
        };

        // Initial fetch
        fetchTelemetry();

        // Set up polling
        timerRef.current = setInterval(fetchTelemetry, interval);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [enabled, interval, includeAggregates]);

    return { loads, aggregates, isLive, error };
};
