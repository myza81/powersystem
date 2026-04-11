import { useState, useEffect } from 'react';
import api from '../api';

export const useNetworkLinks = (snapshotId = null) => {
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLinks = async () => {
            setLoading(true);
            try {
                const url = snapshotId 
                    ? `/load-analytics/network-links/?snapshot_id=${snapshotId}`
                    : '/load-analytics/network-links/';
                const res = await api.get(url);
                setLinks(res.data.links || []);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch network links", err);
                setError(err);
                setLinks([]);
            } finally {
                setLoading(false);
            }
        };

        fetchLinks();
    }, [snapshotId]);

    return { links, loading, error };
};

export default useNetworkLinks;
