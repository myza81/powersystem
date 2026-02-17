import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

const MissingSubstationAlert = () => {
    const [alertData, setAlertData] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMissingSubstations();
    }, []);

    const fetchMissingSubstations = async () => {
        try {
            const response = await api.get('/load-analytics/missing_substations/');
            setAlertData(response.data);
        } catch (error) {
            console.error('Failed to fetch missing substations:', error);
        } finally {
            setLoading(false);
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
                            {alertData.missing_count} substation{alertData.missing_count !== 1 ? 's' : ''} could not be linked
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
                        The following substations from the .raw file could not be matched to the master substation database.
                        This may affect regional/state aggregations for these buses.
                    </p>

                    <div className="missing-list">
                        {alertData.missing_mnemonics.map((item, index) => (
                            <div key={index} className="missing-item">
                                <div className="missing-header">
                                    <span className="mnemonic-badge">{item.mnemonic}</span>
                                    <span className="bus-count">{item.bus_count} bus{item.bus_count !== 1 ? 'es' : ''}</span>
                                </div>
                                <div className="bus-list">
                                    {item.buses.slice(0, 3).map((bus, busIndex) => (
                                        <div key={busIndex} className="bus-item">
                                            <span className="bus-number">Bus {bus.bus_number}</span>
                                            <span className="bus-name">{bus.bus_name}</span>
                                            <span className="bus-voltage">{bus.voltage} kV</span>
                                        </div>
                                    ))}
                                    {item.buses.length > 3 && (
                                        <div className="bus-item more">
                                            +{item.buses.length - 3} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="alert-footer">
                        <p className="alert-note">
                            💡 <strong>Tip:</strong> Add these substations to your master data to improve data linkage.
                        </p>
                    </div>
                </div>
            )}

            <style>{`
                .missing-substation-alert {
                    background: linear-gradient(135deg, #fff5e6 0%, #ffe8cc 100%);
                    border: 2px solid #ff9800;
                    border-radius: 12px;
                    margin: 20px 0;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.15);
                }

                .alert-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .alert-header:hover {
                    background: rgba(255, 152, 0, 0.05);
                }

                .alert-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .alert-icon {
                    color: #ff9800;
                    flex-shrink: 0;
                }

                .alert-title h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #e65100;
                }

                .alert-subtitle {
                    margin: 4px 0 0 0;
                    font-size: 13px;
                    color: #f57c00;
                }

                .alert-actions {
                    display: flex;
                    gap: 8px;
                }

                .expand-btn,
                .dismiss-btn {
                    background: none;
                    border: none;
                    color: #ff9800;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .expand-btn:hover,
                .dismiss-btn:hover {
                    background: rgba(255, 152, 0, 0.1);
                    transform: scale(1.1);
                }

                .alert-content {
                    padding: 0 20px 20px 20px;
                    border-top: 1px solid rgba(255, 152, 0, 0.2);
                }

                .alert-description {
                    margin: 16px 0;
                    color: #5d4037;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .missing-list {
                    max-height: 400px;
                    overflow-y: auto;
                    display: grid;
                    gap: 12px;
                }

                .missing-item {
                    background: white;
                    border-radius: 8px;
                    padding: 12px;
                    border: 1px solid rgba(255, 152, 0, 0.2);
                }

                .missing-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .mnemonic-badge {
                    background: #ff9800;
                    color: white;
                    padding: 4px 12px;
                    border-radius: 6px;
                    font-weight: 600;
                    font-size: 13px;
                    font-family: 'Courier New', monospace;
                }

                .bus-count {
                    color: #f57c00;
                    font-size: 12px;
                    font-weight: 500;
                }

                .bus-list {
                    display: grid;
                    gap: 6px;
                }

                .bus-item {
                    display: flex;
                    gap: 12px;
                    padding: 6px 8px;
                    background: #fafafa;
                    border-radius: 4px;
                    font-size: 12px;
                }

                .bus-item.more {
                    color: #f57c00;
                    font-weight: 500;
                    justify-content: center;
                }

                .bus-number {
                    color: #424242;
                    font-weight: 600;
                    min-width: 80px;
                }

                .bus-name {
                    color: #616161;
                    flex: 1;
                    font-family: 'Courier New', monospace;
                }

                .bus-voltage {
                    color: #9e9e9e;
                    min-width: 60px;
                    text-align: right;
                }

                .alert-footer {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(255, 152, 0, 0.2);
                }

                .alert-note {
                    margin: 0;
                    font-size: 13px;
                    color: #5d4037;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .alert-note strong {
                    color: #e65100;
                }

                /* Scrollbar styling */
                .missing-list::-webkit-scrollbar {
                    width: 8px;
                }

                .missing-list::-webkit-scrollbar-track {
                    background: rgba(255, 152, 0, 0.1);
                    border-radius: 4px;
                }

                .missing-list::-webkit-scrollbar-thumb {
                    background: #ff9800;
                    border-radius: 4px;
                }

                .missing-list::-webkit-scrollbar-thumb:hover {
                    background: #f57c00;
                }
            `}</style>
        </div>
    );
};

export default MissingSubstationAlert;
