import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Download, Upload, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Database, Server } from 'lucide-react';
import axios from 'axios';

// API Service (reusing the one from App.jsx if possible, but defining here for now)
import api from '../api';

const DevTools = ({ onBack }) => {
    const [diff, setDiff] = useState(null);
    const [loading, setLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null); // { type: 'success'|'error', msg: '' }
    const [expandedRows, setExpandedRows] = useState({});
    const [resetMaster, setResetMaster] = useState(true);
    const [forceImport, setForceImport] = useState(false);

    const fetchDiff = async () => {
        setLoading(true);
        try {
            const res = await api.get('/dev/sync-status/');
            setDiff(res.data);
            setSyncStatus(null);
        } catch (err) {
            console.error("Diff fetch error:", err);
            setSyncStatus({ type: 'error', msg: 'Failed to fetch comparison. Ensure DEBUG=True on backend.' });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchDiff();
    }, []);

    const handleExport = async () => {
        if (!confirm("This will overwrite the local fixture file with current DB data. Continue?")) return;
        setLoading(true);
        try {
            const res = await api.post('/dev/export/');
            setSyncStatus({ type: 'success', msg: `Export successful: ${res.data.path}` });
            fetchDiff(); // Refresh diff (should be 0 changes now theoretically)
        } catch (err) {
            setSyncStatus({ type: 'error', msg: err.response?.data?.error || 'Export failed.' });
        }
        setLoading(false);
    };

    const handleImport = async () => {
        if (!confirm("WARNING: This will overwrite your local database with data from the fixture. All local changes not exported will be lost. Continue?")) return;
        setLoading(true);
        try {
            await api.post('/dev/import/', {
                reset_master: resetMaster,
                force_import: forceImport,
            });
            setSyncStatus({ type: 'success', msg: 'Database successfully synced from fixture. Backup created before import.' });
            fetchDiff(); // Refresh diff
        } catch (err) {
            setSyncStatus({ type: 'error', msg: err.response?.data?.error || 'Import failed.' });
        }
        setLoading(false);
    };

    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Group details by model
    const groupedDetails = diff?.details?.reduce((acc, item) => {
        if (!acc[item.model]) acc[item.model] = [];
        acc[item.model].push(item);
        return acc;
    }, {}) || {};

    return (
        <div className="dev-tools-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={onBack} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    &larr; Back
                </button>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Database size={32} color="var(--accent-cyan)" />
                    Database Sync <span style={{ fontSize: '1rem', background: 'var(--accent-blue)', color: 'black', padding: '2px 8px', borderRadius: '4px', marginLeft: '1rem' }}>DEV MODE</span>
                </h1>
            </div>

            {syncStatus && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: syncStatus.type === 'success' ? 'rgba(0, 255, 163, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                        border: `1px solid ${syncStatus.type === 'success' ? 'var(--accent-cyan)' : '#ff6b6b'}`,
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        marginBottom: '2rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                    }}
                >
                    {syncStatus.type === 'success' ? <CheckCircle size={20} color="var(--accent-cyan)" /> : <AlertTriangle size={20} color="#ff6b6b" />}
                    <span>{syncStatus.msg}</span>
                </motion.div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                {/* Control Panel */}
                <div className="glass-card" style={{ height: 'fit-content' }}>
                    <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Server size={20} /> Sync Operations
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>Export to Fixture</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Dumps master data (Substation, LoadTransformer, IncomingBranch, AutoTransformer) to `core/fixtures/initial_data.json`.
                                Commit this file to share changes.
                            </p>
                            <button
                                className="btn-primary"
                                onClick={handleExport}
                                disabled={loading}
                                style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)' }}
                            >
                                {loading ? 'Processing...' : <><Upload size={18} /> Export DB &rarr; JSON</>}
                            </button>
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>Import from Fixture</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Loads `core/fixtures/initial_data.json` into database and resets master data.
                                <strong style={{ color: '#ff6b6b' }}> Overwrites local data!</strong>
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <input
                                        type="checkbox"
                                        checked={resetMaster}
                                        onChange={(e) => setResetMaster(e.target.checked)}
                                    />
                                    Reset master data before import (recommended for non-owner workstations)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <input
                                        type="checkbox"
                                        checked={forceImport}
                                        onChange={(e) => setForceImport(e.target.checked)}
                                    />
                                    Force import even if fixture is older than local DB
                                </label>
                            </div>
                            <button
                                className="btn-primary"
                                onClick={handleImport}
                                disabled={loading}
                                style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #56CCF2 0%, #2F80ED 100%)' }}
                            >
                                {loading ? 'Processing...' : <><Download size={18} /> Import JSON &rarr; DB</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Diff View */}
                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Comparison Summary
                        </h3>
                        <button className="btn-secondary" onClick={fetchDiff} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ marginRight: '6px' }} /> Refresh
                        </button>
                    </div>

                    {!diff ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {loading ? 'Analyzing database...' : 'Ready to compare.'}
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                                <StatBox label="New Objects" value={diff.new} color="#00ffa3" />
                                <StatBox label="Modified" value={diff.modified} color="#fbbf24" />
                                <StatBox label="Unchanged" value={diff.unchanged} color="var(--text-secondary)" />
                            </div>

                            <h4 style={{ marginBottom: '1rem' }}>Detailed Changes</h4>
                            {Object.keys(groupedDetails).length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No differences found. Database matches fixture.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {Object.entries(groupedDetails).map(([model, items]) => (
                                        <div key={model} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                                            <div
                                                onClick={() => toggleRow(model)}
                                                style={{
                                                    padding: '1rem',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {expandedRows[model] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    {model}
                                                </div>
                                                <div style={{ fontSize: '0.8rem' }}>
                                                    <span style={{ color: '#00ffa3', marginRight: '8px' }}>{items.filter(i => i.status === 'NEW').length} New</span>
                                                    <span style={{ color: '#fbbf24' }}>{items.filter(i => i.status === 'MODIFIED').length} Mod</span>
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {expandedRows[model] && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        style={{ background: 'rgba(0,0,0,0.2)' }}
                                                    >
                                                        <div style={{ padding: '1rem' }}>
                                                            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                                                <thead>
                                                                    <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                                                                        <th style={{ paddingBottom: '0.5rem' }}>PK</th>
                                                                        <th style={{ paddingBottom: '0.5rem' }}>Status</th>
                                                                        <th style={{ paddingBottom: '0.5rem' }}>Details</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {items.map((item, idx) => (
                                                                        <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                                            <td style={{ padding: '0.5rem 0', fontFamily: 'monospace' }}>{item.pk}</td>
                                                                            <td style={{ padding: '0.5rem 0' }}>
                                                                                <span style={{
                                                                                    padding: '2px 6px',
                                                                                    borderRadius: '4px',
                                                                                    background: item.status === 'NEW' ? 'rgba(0, 255, 163, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                                                                                    color: item.status === 'NEW' ? '#00ffa3' : '#fbbf24',
                                                                                    fontSize: '0.7rem'
                                                                                }}>
                                                                                    {item.status}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ padding: '0.5rem 0' }}>
                                                                                {item.status === 'NEW' ? (
                                                                                    <span style={{ color: 'var(--text-secondary)' }}>Full object create</span>
                                                                                ) : (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                                        {item.changes?.map((change, cIdx) => (
                                                                                            <div key={cIdx} style={{ fontSize: '0.75rem' }}>
                                                                                                <span style={{ color: 'var(--accent-cyan)' }}>{change.field}:</span>{' '}
                                                                                                <span style={{ color: '#ff6b6b' }}>{change.old}</span> &rarr; <span style={{ color: '#00ffa3' }}>{change.new}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatBox = ({ label, value, color }) => (
    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: color }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
);

export default DevTools;
