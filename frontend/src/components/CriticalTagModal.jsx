import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, PlusCircle, Trash2, Edit2 } from 'lucide-react';
import api from '../api';

const CriticalTagModal = ({ substationId, substationName, onClose, onAdd, onEdit, onDeactivate }) => {
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTags = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/critical-tags/?substation=${substationId}&is_inforce=true`);
            setTags(res.data || []);
        } catch (err) {
            console.error("Failed to load critical tags", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (substationId) fetchTags();
    }, [substationId]);

    const formatBayTagLabel = (bayId, lvVoltage) => {
        if (!bayId) return '';
        const match = bayId.match(/_T(\d+)$/i) || bayId.match(/T(\d+)/i);
        const base = match ? `T${match[1]}` : bayId;
        if (lvVoltage) {
            return `${base} ${lvVoltage}kV`;
        }
        return base;
    };

    const tagPillStyle = {
        display: 'inline-block',
        fontSize: '0.7rem',
        background: 'rgba(255,255,255,0.08)',
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.12)'
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.75)',
                    zIndex: 2100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem'
                }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 10 }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-card"
                    style={{ maxWidth: '920px', width: '100%', padding: '1.5rem' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>{substationId} Critical Tags</h3>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {substationName || substationId}
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <X />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                        <button className="btn-primary" onClick={() => onAdd(substationId)}>
                            <PlusCircle size={16} style={{ marginRight: '6px' }} /> Add Bay Tag
                        </button>
                        <button className="btn-secondary" onClick={() => onEdit(substationId)}>
                            <Edit2 size={16} style={{ marginRight: '6px' }} /> Edit Tags
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={async () => {
                                if (confirm(`Deactivate all critical tags for ${substationId}?`)) {
                                    await onDeactivate(substationId, tags);
                                    fetchTags();
                                }
                            }}
                            style={{ marginLeft: 'auto', color: '#ff3b30', borderColor: 'rgba(255,59,48,0.4)' }}
                        >
                            <Trash2 size={16} style={{ marginRight: '6px' }} /> Deactivate All
                        </button>
                    </div>

                    <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading...</div>
                        ) : tags.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No active critical tags.</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'left' }}>
                                        <th style={{ padding: '0.6rem' }}>Bay</th>
                                        <th style={{ padding: '0.6rem' }}>Category</th>
                                        <th style={{ padding: '0.6rem' }}>Note</th>
                                        <th style={{ padding: '0.6rem' }}>Source</th>
                                        <th style={{ padding: '0.6rem' }}>File</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tags.map(tag => (
                                        <tr key={tag.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.6rem' }}>
                                                <span style={tagPillStyle}>
                                                    {formatBayTagLabel(tag.load_transformer_bay_id, tag.load_transformer_lv_voltage)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.6rem' }}>
                                                <span style={tagPillStyle}>{tag.category_name}</span>
                                            </td>
                                            <td style={{ padding: '0.6rem' }}>{tag.short_text || ''}</td>
                                            <td style={{ padding: '0.6rem' }}>{tag.source_reference || ''}</td>
                                            <td style={{ padding: '0.6rem' }}>
                                                {tag.source ? (
                                                    <a
                                                        href={tag.source_file || '#'}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ color: '#ff9f43', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                    >
                                                        <FileText size={14} />
                                                    </a>
                                                ) : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CriticalTagModal;
