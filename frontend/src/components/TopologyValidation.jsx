import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TopologyValidation.css';

const API_BASE = 'http://localhost:8000/api/v1/network-topology';

// Configure axios to send credentials (session cookies) with requests
axios.defaults.withCredentials = true;

const TopologyValidation = ({ onEditSubstation }) => {
    const [bays, setBays] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedBays, setSelectedBays] = useState(new Set());
    const [filter, setFilter] = useState('all'); // all, rejected, pending, low_confidence, equipment_info

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all items (limit 1000) including validated ones for the Equipment Log
            // We'll filter client-side to separate Equipment from actual issues
            const [baysRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE}/pending_validations/?limit=1000&include_all=true`),
                axios.get(`${API_BASE}/statistics/`)
            ]);

            setBays(baysRes.data.results);
            setStatistics(statsRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Failed to load validation data');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkValidate = async (action) => {
        if (selectedBays.size === 0) return;
        if (!confirm(`Are you sure you want to ${action} ${selectedBays.size} bays?`)) return;

        try {
            await axios.post(`${API_BASE}/bulk_validate/`, {
                bay_ids: Array.from(selectedBays),
                action: action
            });
            fetchData();
            setSelectedBays(new Set());
        } catch (error) {
            console.error('Error validating:', error);
            alert('Bulk action failed');
        }
    };

    const toggleSelection = (bayId) => {
        const newSelection = new Set(selectedBays);
        if (newSelection.has(bayId)) {
            newSelection.delete(bayId);
        } else {
            newSelection.add(bayId);
        }
        setSelectedBays(newSelection);
    };

    // Filter Logic
    const getFilteredBays = () => {
        if (!bays) return [];

        // EQUIPMENT TAB: Show Equipment and Autotransformers
        if (filter === 'equipment_info') {
            return bays.filter(bay =>
                bay.connection_type === 'EQUIPMENT' ||
                bay.connection_type === 'AUTOTRANSFORMER'
            );
        }

        // Actionable Items (Exclude Equipment/Autotransformers from other tabs to reduce noise)
        const actionableBays = bays.filter(bay =>
            bay.connection_type !== 'EQUIPMENT' &&
            bay.connection_type !== 'AUTOTRANSFORMER'
        );

        switch (filter) {
            case 'rejected':
                return actionableBays.filter(bay => bay.validation_status === 'REJECTED');
            case 'pending':
                return actionableBays.filter(bay => bay.validation_status === 'PENDING');
            case 'low_confidence':
                return actionableBays.filter(bay => bay.detection_confidence < 0.5);
            case 'all':
            default:
                // Only show Actionable Items that are PENDING or REJECTED
                return actionableBays.filter(bay => ['REJECTED', 'PENDING'].includes(bay.validation_status));
        }
    };

    const filteredBays = getFilteredBays();
    const isEquipmentTab = filter === 'equipment_info';
    const isReadonly = isEquipmentTab;

    // Helper counts for tabs
    const getTabCounts = () => {
        const equipmentCount = bays.filter(b => b.connection_type === 'EQUIPMENT' || b.connection_type === 'AUTOTRANSFORMER').length;

        // Actionable items are those that are NOT equipment/autotransformers AND are either REJECTED or PENDING
        const actionable = bays.filter(b =>
            b.connection_type !== 'EQUIPMENT' &&
            b.connection_type !== 'AUTOTRANSFORMER' &&
            ['REJECTED', 'PENDING'].includes(b.validation_status)
        );

        return {
            all: actionable.length,
            rejected: actionable.filter(b => b.validation_status === 'REJECTED').length,
            pending: actionable.filter(b => b.validation_status === 'PENDING').length,
            equipment: equipmentCount
        };
    };

    const counts = getTabCounts();

    if (loading) return <div className="loading">Loading validation data...</div>;

    return (
        <div className="topology-validation">
            <div className="header">
                <h1>🔗 Network Topology Validation</h1>
                <p className="subtitle">Review and validate auto-detected substation connections</p>
                <div className="actions">
                    <button className="btn-cancel" onClick={fetchData}>🔄 Refresh</button>
                    <button
                        className="btn-primary"
                        onClick={async () => {
                            if (confirm('Run auto-detection on all bays? This may take a moment.')) {
                                setLoading(true);
                                try {
                                    const response = await axios.post(`${API_BASE}/run_detection/`);
                                    const data = response.data;
                                    alert(
                                        `Detection complete!\n\n` +
                                        `Processed: ${data.processed}\n` +
                                        `Auto-Validated: ${data.auto_validated}\n` +
                                        `Rejected: ${data.rejected}\n` +
                                        `Pending Review: ${data.pending_review}`
                                    );
                                    await fetchData();
                                } catch (error) {
                                    console.error('Detection error:', error);
                                    const errorMsg = error.response?.data?.error || error.response?.data?.detail || error.message || 'Unknown error';
                                    alert(`Detection failed: ${errorMsg}`);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                        disabled={loading}
                    >
                        ⚡ Run Detection
                    </button>
                </div>
            </div>

            {/* Statistics Dashboard */}
            {statistics && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-label">Total Bays</div>
                        <div className="stat-value">{statistics.total_bays}</div>
                    </div>
                    <div className="stat-card success">
                        <div className="stat-label">Validated</div>
                        <div className="stat-value">
                            {statistics.validation_status.auto_validated + statistics.validation_status.user_validated}
                        </div>
                        <div className="stat-percent">{statistics.validation_rate}%</div>
                    </div>
                    <div className="stat-card warning">
                        <div className="stat-label">Actionable</div>
                        <div className="stat-value">
                            {counts.all}
                        </div>
                    </div>
                    <div className="stat-card info">
                        <div className="stat-label">Equipment Log</div>
                        <div className="stat-value">
                            {counts.equipment}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="controls">
                <div className="filters">
                    <button
                        className={filter === 'all' ? 'active' : ''}
                        onClick={() => setFilter('all')}
                    >
                        All Needing Action ({counts.all})
                    </button>
                    <button
                        className={filter === 'rejected' ? 'active' : ''}
                        onClick={() => setFilter('rejected')}
                    >
                        Rejected ({counts.rejected})
                    </button>
                    <button
                        className={filter === 'pending' ? 'active' : ''}
                        onClick={() => setFilter('pending')}
                    >
                        Pending ({counts.pending})
                    </button>
                    <button
                        className={`filter-tab-equipment ${filter === 'equipment_info' ? 'active' : ''}`}
                        onClick={() => setFilter('equipment_info')}
                        style={{ marginLeft: '1rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}
                    >
                        📋 Equipment & Info Log ({counts.equipment})
                    </button>
                </div>

                {!isReadonly && selectedBays.size > 0 && (
                    <div className="bulk-actions">
                        <span className="selected-count">{selectedBays.size} selected</span>
                        <button
                            className="btn-approve"
                            onClick={() => handleBulkValidate('approve')}
                        >
                            ✓ Approve Selected
                        </button>
                        <button
                            className="btn-reject"
                            onClick={() => handleBulkValidate('reject')}
                        >
                            ✗ Reject Selected
                        </button>
                    </div>
                )}
            </div>

            {/* Validation List */}
            <div className="validations-list">
                {filteredBays.length === 0 ? (
                    <div className="empty-state">
                        <h3>
                            {filter === 'equipment_info'
                                ? 'No equipment logs found'
                                : '🎉 All connections processed!'}
                        </h3>
                        <p>
                            {filter === 'equipment_info'
                                ? 'Equipment logs will appear here when detected.'
                                : 'No bays requiring attention in this category.'}
                        </p>
                    </div>
                ) : (
                    filteredBays.map(bay => (
                        <div key={bay.bay_id} className={`validation-card ${isReadonly ? 'readonly-mode' : ''}`}>
                            <div className="card-header">
                                {!isReadonly && (
                                    <input
                                        type="checkbox"
                                        checked={selectedBays.has(bay.bay_id)}
                                        onChange={() => toggleSelection(bay.bay_id)}
                                    />
                                )}
                                <div className="bay-info">
                                    <h3>{bay.bay_id}</h3>
                                    <span className="bay-name">{bay.bay_name}</span>
                                    <span className={`status-badge ${bay.validation_status.toLowerCase()}`}>
                                        {bay.validation_status}
                                    </span>
                                </div>
                                <div className="confidence-indicator">
                                    <div
                                        className="confidence-bar"
                                        style={{
                                            width: `${bay.detection_confidence * 100}%`,
                                            backgroundColor: bay.detection_confidence > 0.8 ? '#28a745' :
                                                bay.detection_confidence > 0.5 ? '#ffc107' : '#dc3545'
                                        }}
                                    />
                                    <span className="confidence-value">{Math.round(bay.detection_confidence * 100)}%</span>
                                </div>
                                <div className="actions">
                                    {isReadonly ? (
                                        <span className="readonly-badge">INFO ONLY</span>
                                    ) : (
                                        <>
                                            <button
                                                className="btn-modify"
                                                onClick={() => onEditSubstation(bay.substation.substation_id)}
                                                title="Edit Substation Configuration"
                                            >
                                                ✏️ Edit Substation
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="card-body">
                                <div className="connection-info">
                                    <div className="info-row">
                                        <span className="label">From:</span>
                                        <span className="value">{bay.substation.name} ({bay.substation.substation_id})</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="label">To:</span>
                                        <span className="value">
                                            {bay.connected_to_substation
                                                ? `${bay.connected_to_substation.name} (${bay.connected_to_substation.substation_id})`
                                                : <span className="unknown">Unknown</span>
                                            }
                                        </span>
                                    </div>
                                    <div className="info-row">
                                        <span className="label">Type:</span>
                                        <span className="type-badge">{bay.connection_type}</span>
                                    </div>
                                    {bay.tee_off_connections && bay.tee_off_connections.length > 0 && (
                                        <div className="info-row">
                                            <span className="label">Tee-Offs:</span>
                                            <span className="value">
                                                {bay.tee_off_connections.map(s => s.substation_id).join(', ')}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {bay.detection_note && (
                                    <div className="detection-note">
                                        <strong>Detection Note:</strong>
                                        <p>{bay.detection_note}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TopologyValidation;
