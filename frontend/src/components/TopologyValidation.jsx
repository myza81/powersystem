import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TopologyValidation.css';

const API_BASE = 'http://localhost:8000/api/v1/network-topology';

const TopologyValidation = () => {
    const [pendingBays, setPendingBays] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedBays, setSelectedBays] = useState(new Set());
    const [filter, setFilter] = useState('all');
    const [modifyingBay, setModifyingBay] = useState(null);

    useEffect(() => {
        fetchData();
    }, [filter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pendingRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE}/pending_validations/`, {
                    params: filter !== 'all' ? { confidence_max: 0.5 } : {}
                }),
                axios.get(`${API_BASE}/statistics/`)
            ]);

            setPendingBays(pendingRes.data.results);
            setStatistics(statsRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
        setLoading(false);
    };

    const handleValidate = async (bayId, action, data = {}) => {
        try {
            await axios.post(`${API_BASE}/validate_connection/`, {
                bay_id: bayId,
                action,
                ...data
            });

            fetchData();
            setModifyingBay(null);
            setSelectedBays(new Set());
        } catch (error) {
            console.error('Error validating:', error);
            alert('Validation failed: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleBulkValidate = async (action) => {
        if (selectedBays.size === 0) {
            alert('Please select at least one bay');
            return;
        }

        try {
            await axios.post(`${API_BASE}/bulk_validate/`, {
                bay_ids: Array.from(selectedBays),
                action
            });

            fetchData();
            setSelectedBays(new Set());
        } catch (error) {
            console.error('Error bulk validating:', error);
            alert('Bulk validation failed');
        }
    };

    const toggleSelection = (bayId) => {
        const newSelected = new Set(selectedBays);
        if (newSelected.has(bayId)) {
            newSelected.delete(bayId);
        } else {
            newSelected.add(bayId);
        }
        setSelectedBays(newSelected);
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.95) return '#28a745';
        if (confidence >= 0.70) return '#ffc107';
        if (confidence >= 0.50) return '#fd7e14';
        return '#dc3545';
    };

    const getStatusBadge = (status) => {
        const colors = {
            'PENDING': '#ffc107',
            'VALIDATED': '#28a745',
            'AUTO_VALIDATED': '#007bff',
            'REJECTED': '#dc3545'
        };
        return colors[status] || '#6c757d';
    };

    if (loading) {
        return (
            <div className="topology-validation">
                <div className="loading">Loading topology data...</div>
            </div>
        );
    }

    return (
        <div className="topology-validation">
            {/* Header */}
            <div className="header">
                <h1>🔗 Network Topology Validation</h1>
                <p className="subtitle">Review and validate auto-detected substation connections</p>
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
                        <div className="stat-label">Pending Review</div>
                        <div className="stat-value">
                            {statistics.validation_status.pending + statistics.validation_status.rejected}
                        </div>
                    </div>
                    <div className="stat-card info">
                        <div className="stat-label">Standard Connections</div>
                        <div className="stat-value">{statistics.connection_types.standard}</div>
                    </div>
                    <div className="stat-card info">
                        <div className="stat-label">Tee-Off</div>
                        <div className="stat-value">{statistics.connection_types.tee_off}</div>
                    </div>
                    <div className="stat-card info">
                        <div className="stat-label">Autotransformers</div>
                        <div className="stat-value">{statistics.connection_types.autotransformer}</div>
                    </div>
                </div>
            )}

            {/* Filters and Bulk Actions */}
            <div className="controls">
                <div className="filters">
                    <button
                        className={filter === 'all' ? 'active' : ''}
                        onClick={() => setFilter('all')}
                    >
                        All ({pendingBays.length})
                    </button>
                    <button
                        className={filter === 'low' ? 'active' : ''}
                        onClick={() => setFilter('low')}
                    >
                        Low Confidence Only
                    </button>
                </div>

                {selectedBays.size > 0 && (
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

            {/* Pending Validations List */}
            <div className="validations-list">
                {pendingBays.length === 0 ? (
                    <div className="empty-state">
                        <h3>🎉 All connections validated!</h3>
                        <p>No pending validations at this time.</p>
                    </div>
                ) : (
                    pendingBays.map(bay => (
                        <div key={bay.bay_id} className="validation-card">
                            <div className="card-header">
                                <input
                                    type="checkbox"
                                    checked={selectedBays.has(bay.bay_id)}
                                    onChange={() => toggleSelection(bay.bay_id)}
                                />
                                <div className="bay-info">
                                    <h3>{bay.bay_id}</h3>
                                    <span className="bay-name">{bay.bay_name}</span>
                                    <span
                                        className="status-badge"
                                        style={{ backgroundColor: getStatusBadge(bay.validation_status) }}
                                    >
                                        {bay.validation_status}
                                    </span>
                                </div>
                                <div className="confidence-indicator">
                                    <div
                                        className="confidence-bar"
                                        style={{
                                            width: `${bay.detection_confidence * 100}%`,
                                            backgroundColor: getConfidenceColor(bay.detection_confidence)
                                        }}
                                    />
                                    <span className="confidence-value">
                                        {(bay.detection_confidence * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>

                            <div className="card-body">
                                <div className="connection-info">
                                    <div className="info-row">
                                        <span className="label">From:</span>
                                        <span className="value">
                                            {bay.substation.substation_id} ({bay.substation.name})
                                        </span>
                                    </div>
                                    <div className="info-row">
                                        <span className="label">To:</span>
                                        <span className="value">
                                            {bay.connected_to_substation ? (
                                                `${bay.connected_to_substation.substation_id} (${bay.connected_to_substation.name})`
                                            ) : (
                                                <span className="unknown">Unknown</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="info-row">
                                        <span className="label">Type:</span>
                                        <span className="value type-badge">{bay.connection_type}</span>
                                    </div>
                                    {bay.tee_off_connections.length > 0 && (
                                        <div className="info-row">
                                            <span className="label">Tee-offs:</span>
                                            <span className="value">
                                                {bay.tee_off_connections.map(s => s.substation_id).join(', ')}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="detection-note">
                                    <strong>Detection Note:</strong>
                                    <p>{bay.detection_note}</p>
                                </div>

                                {modifyingBay === bay.bay_id ? (
                                    <ModifyForm
                                        bay={bay}
                                        onSubmit={(data) => handleValidate(bay.bay_id, 'modify', data)}
                                        onCancel={() => setModifyingBay(null)}
                                    />
                                ) : (
                                    <div className="actions">
                                        <button
                                            className="btn-approve"
                                            onClick={() => handleValidate(bay.bay_id, 'approve')}
                                            disabled={!bay.connected_to_substation}
                                        >
                                            ✓ Approve
                                        </button>
                                        <button
                                            className="btn-modify"
                                            onClick={() => setModifyingBay(bay.bay_id)}
                                        >
                                            ✏️ Modify
                                        </button>
                                        <button
                                            className="btn-reject"
                                            onClick={() => handleValidate(bay.bay_id, 'reject')}
                                        >
                                            ✗ Reject
                                        </button>
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

const ModifyForm = ({ bay, onSubmit, onCancel }) => {
    const [connectedTo, setConnectedTo] = useState(
        bay.connected_to_substation?.substation_id || ''
    );
    const [connectionType, setConnectionType] = useState(bay.connection_type);
    const [note, setNote] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            connected_to_substation_id: connectedTo,
            connection_type: connectionType,
            note
        });
    };

    return (
        <form className="modify-form" onSubmit={handleSubmit}>
            <div className="form-group">
                <label>Connected To Substation ID:</label>
                <input
                    type="text"
                    value={connectedTo}
                    onChange={(e) => setConnectedTo(e.target.value)}
                    placeholder="e.g., SRDN132"
                    required
                />
            </div>
            <div className="form-group">
                <label>Connection Type:</label>
                <select
                    value={connectionType}
                    onChange={(e) => setConnectionType(e.target.value)}
                >
                    <option value="STANDARD">Standard</option>
                    <option value="TEE_OFF">Tee-Off</option>
                    <option value="AUTOTRANSFORMER">Autotransformer</option>
                    <option value="EQUIPMENT">Equipment</option>
                </select>
            </div>
            <div className="form-group">
                <label>Note (optional):</label>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for modification..."
                    rows="2"
                />
            </div>
            <div className="form-actions">
                <button type="submit" className="btn-save">Save</button>
                <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
};

export default TopologyValidation;
