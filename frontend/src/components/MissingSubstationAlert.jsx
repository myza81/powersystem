
import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, X, Trash2, Zap, Activity, Network } from 'lucide-react';
import axios from 'axios';

import api from '../api';

const MissingSubstationAlert = ({ snapshotId, onRefresh }) => {
    const [alertData, setAlertData] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null); // ID of item being deleted

    useEffect(() => {
        fetchMissingSubstations();
    }, [snapshotId]);

    const fetchMissingSubstations = async () => {
        try {
            const params = snapshotId ? { snapshot_id: snapshotId } : {};
            const response = await api.get('/load-analytics/missing-substations/', { params });
            setAlertData(response.data);
        } catch (error) {
            console.error('Failed to fetch missing substations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (busIds, type) => {
        const confirmMsg = type === 'group'
            ? `Delete all ${busIds.length} buses in this group? This cannot be undone.`
            : `Delete Bus? This cannot be undone.`;

        if (!window.confirm(confirmMsg)) return;

        setProcessing(busIds.join(',')); // Simple loading lock
        try {
            await api.post('/topology/cleanup/', {
                snapshot_id: alertData.snapshot_id,
                bus_ids: busIds
            });
            // Refresh local data
            fetchMissingSubstations();
            if (onRefresh) onRefresh(); // Trigger parent refresh if provided
        } catch (error) {
            alert('Failed to delete: ' + (error.response?.data?.error || error.message));
        } finally {
            setProcessing(null);
        }
    };

    if (loading || !alertData || !alertData.has_missing || isDismissed) {
        return null;
    }

    return (
        <div className="missing-substation-alert">
            <div className="alert-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="alert-title">
                    <AlertTriangle className="alert-icon" />
                    <div>
                        <h3>Missing Substation Data</h3>
                        <p className="alert-subtitle">
                            {alertData.missing_count} groups ({alertData.missing_mnemonics.reduce((acc, g) => acc + g.bus_count, 0)} buses) unmapped
                        </p>
                    </div>
                </div>
                <div className="alert-actions">
                    <button
                        className="expand-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <button
                        className="dismiss-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsDismissed(true);
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="alert-content">
                    <p className="alert-description">
                        The following buses are not linked to any Substation Master Data.
                        Review their details (Load, Generation, Connectivity) and delete if they are data artifacts.
                    </p>

                    <div className="missing-list">
                        {alertData.missing_mnemonics.map((group, index) => (
                            <div key={index} className="missing-group">
                                {/* Group Header */}
                                <div className="group-header">
                                    <div className="group-info">
                                        <span className="mnemonic-badge">{group.mnemonic}</span>
                                        <span className="group-stats">
                                            {group.bus_count} Buses • {group.total_load_mw.toFixed(1)} MW Load
                                        </span>
                                    </div>
                                    <button
                                        className="group-delete-btn"
                                        onClick={() => handleDelete(group.buses.map(b => b.id), 'group')}
                                        disabled={processing !== null}
                                    >
                                        <Trash2 size={14} /> Delete Group
                                    </button>
                                </div>

                                {/* Bus Table */}
                                <div className="bus-table-wrapper">
                                    <table className="bus-table">
                                        <thead>
                                            <tr>
                                                <th>Bus ID</th>
                                                <th>Name</th>
                                                <th>Voltage</th>
                                                <th>Load</th>
                                                <th>Gen</th>
                                                <th>Branches</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.buses.map((bus) => (
                                                <tr key={bus.id}>
                                                    <td className="font-mono">{bus.bus_number}</td>
                                                    <td className="font-mono">{bus.bus_name}</td>
                                                    <td>{bus.voltage} kV</td>
                                                    <td className={bus.load_mw > 0 ? 'text-warn' : 'text-dim'}>
                                                        {bus.load_mw > 0 && <Activity size={10} style={{ marginRight: 4 }} />}
                                                        {bus.load_mw} MW
                                                    </td>
                                                    <td className={bus.gen_mw > 0 ? 'text-success' : 'text-dim'}>
                                                        {bus.gen_mw > 0 && <Zap size={10} style={{ marginRight: 4 }} />}
                                                        {bus.gen_mw} MW
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${bus.is_isolated ? 'badge-err' : 'badge-ok'}`}>
                                                            <Network size={10} style={{ marginRight: 4 }} />
                                                            {bus.branch_count}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="icon-btn-delete"
                                                            title="Delete this bus"
                                                            onClick={() => handleDelete([bus.id], 'single')}
                                                            disabled={processing !== null}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`
                .missing-substation-alert {
                    background: linear-gradient(135deg, #fff5e6 0%, #ffe8cc 100%);
                    border: 1px solid #ff9800;
                    border-radius: 8px;
                    margin: 16px 0;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.1);
                    font-family: 'Inter', sans-serif;
                }
                .alert-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; cursor: pointer; }
                .alert-header:hover { background: rgba(255, 152, 0, 0.05); }
                .alert-title { display: flex; align-items: center; gap: 12px; }
                .alert-icon { color: #f57c00; }
                .alert-title h3 { margin: 0; font-size: 15px; font-weight: 600; color: #e65100; }
                .alert-subtitle { margin: 2px 0 0 0; font-size: 13px; color: #f57c00; }
                .alert-actions { display: flex; gap: 8px; }
                .expand-btn, .dismiss-btn { background: none; border: none; color: #f57c00; cursor: pointer; padding: 4px; }
                
                .alert-content { padding: 0 16px 16px 16px; border-top: 1px solid rgba(255, 152, 0, 0.15); }
                .alert-description { margin: 12px 0; color: #78350f; font-size: 13px; line-height: 1.5; }
                
                .missing-list { display: grid; gap: 16px; max-height: 500px; overflow-y: auto; }
                .missing-group { background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 152, 0, 0.2); border-radius: 6px; overflow: hidden; }
                
                .group-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255, 152, 0, 0.05); border-bottom: 1px solid rgba(255, 152, 0, 0.1); }
                .group-info { display: flex; align-items: center; gap: 10px; }
                .mnemonic-badge { background: #ff9800; color: white; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; font-family: monospace; }
                .group-stats { font-size: 12px; color: #ca8a04; font-weight: 500; }
                .group-delete-btn { display: flex; align-items: center; gap: 6px; background: white; border: 1px solid #fda4af; color: #e11d48; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600; }
                .group-delete-btn:hover { background: #fff1f2; }
                
                .bus-table { width: 100%; border-collapse: collapse; font-size: 12px; }
                .bus-table th { text-align: left; padding: 8px; color: #78350f; font-weight: 600; background: rgba(255, 255, 255, 0.3); border-bottom: 1px solid rgba(0,0,0,0.05); }
                .bus-table td { padding: 6px 8px; border-bottom: 1px solid rgba(0,0,0,0.03); color: #4b5563; }
                .bus-table tr:last-child td { border-bottom: none; }
                .bus-table tr:hover { background: rgba(255, 255, 255, 0.8); }
                
                .font-mono { font-family: 'Courier New', monospace; }
                .text-warn { color: #d97706; font-weight: 600; display: flex; align-items: center; }
                .text-success { color: #059669; font-weight: 600; display: flex; align-items: center; }
                .text-dim { color: #9ca3af; }
                
                .badge { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 99px; font-size: 10px; font-weight: 600; }
                .badge-err { background: #fecaca; color: #b91c1c; }
                .badge-ok { background: #d1fae5; color: #047857; }
                
                .icon-btn-delete { background: none; border: none; color: #ef4444; padding: 4px; border-radius: 4px; cursor: pointer; opacity: 0.6; }
                .icon-btn-delete:hover { opacity: 1; background: #fee2e2; }
            `}</style>
        </div>
    );
};

export default MissingSubstationAlert;
