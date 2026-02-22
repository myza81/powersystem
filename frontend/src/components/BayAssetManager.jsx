import React, { useEffect, useState } from 'react';
import { PlusCircle, Edit2 } from 'lucide-react';
import api from '../api';
import BayAssetForm from './BayAssetForm';

const BayAssetManager = ({ assetType, title, endpoint }) => {
    const [assets, setAssets] = useState([]);
    const [substations, setSubstations] = useState([]);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [view, setView] = useState('list');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    const fetchAssets = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/${endpoint}/`);
            setAssets(res.data);
        } catch (err) {
            setStatus({ type: 'error', msg: 'Failed to fetch assets.' });
        }
        setLoading(false);
    };

    const fetchSubstations = async () => {
        try {
            const res = await api.get('/substations/');
            setSubstations(res.data);
        } catch (err) {
            setStatus({ type: 'error', msg: 'Failed to load substations.' });
        }
    };

    useEffect(() => {
        fetchAssets();
        fetchSubstations();
    }, [endpoint]);

    const handleSave = async (data) => {
        setLoading(true);
        try {
            if (selectedAsset?.id) {
                await api.patch(`/${endpoint}/${selectedAsset.id}/`, data);
                setStatus({ type: 'success', msg: 'Asset updated successfully.' });
            } else {
                await api.post(`/${endpoint}/`, data);
                setStatus({ type: 'success', msg: 'New asset created.' });
            }
            setView('list');
            setSelectedAsset(null);
            fetchAssets();
        } catch (err) {
            let msg = 'Operation failed';
            if (err.response?.data) {
                msg = Object.entries(err.response.data)
                    .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
                    .join(' | ');
            }
            setStatus({ type: 'error', msg });
        }
        setLoading(false);
    };

    const columns = assetType === 'incoming-branch'
        ? ['bay_id', 'substation', 'to_substation', 'ckt_id', 'breaker_number']
        : ['bay_id', 'substation', 'transformer_no', 'hv_voltage', 'lv_voltage', 'capacity_mva'];

    const renderCell = (asset, key) => {
        if (key === 'substation') return asset.substation;
        if (key === 'to_substation') return asset.to_substation;
        return asset[key] ?? '';
    };

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>{title}</h2>
                <button
                    className="btn-primary"
                    onClick={() => {
                        setSelectedAsset(null);
                        setView('form');
                    }}
                >
                    <PlusCircle size={18} style={{ marginRight: '8px' }} /> New Entry
                </button>
            </div>

            {status && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: status.type === 'success' ? '#10b981' : '#ef4444'
                }}>
                    {status.msg}
                </div>
            )}

            {view === 'form' ? (
                <BayAssetForm
                    assetType={assetType}
                    asset={selectedAsset}
                    substations={substations}
                    onSave={handleSave}
                    onCancel={() => setView('list')}
                />
            ) : (
                <div className="glass-card" style={{ padding: '1rem' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'left' }}>
                                    {columns.map((col) => (
                                        <th key={col} style={{ padding: '0.75rem' }}>{col.replace('_', ' ').toUpperCase()}</th>
                                    ))}
                                    <th style={{ padding: '0.75rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assets.map((asset) => (
                                    <tr key={asset.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        {columns.map((col) => (
                                            <td key={col} style={{ padding: '0.75rem', color: '#fff', fontFamily: col === 'bay_id' ? 'monospace' : 'inherit' }}>
                                                {renderCell(asset, col)}
                                            </td>
                                        ))}
                                        <td style={{ padding: '0.75rem' }}>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => {
                                                    setSelectedAsset(asset);
                                                    setView('form');
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <Edit2 size={14} /> Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {assets.length === 0 && (
                                    <tr>
                                        <td colSpan={columns.length + 1} style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                                            No records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default BayAssetManager;
