import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, FileText } from 'lucide-react';
import { LuCircuitBoard } from 'react-icons/lu';
import { FiAlertCircle } from 'react-icons/fi';

const SubstationListRow = ({ substation, onEdit, onViewSld, onLocate, onCriticalClick }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="glass-card"
            style={{
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                cursor: 'pointer',
                marginBottom: '0.75rem',
                transition: 'all 0.2s',
                border: '1px solid rgba(255, 255, 255, 0.05)'
            }}
            whileHover={{ 
                borderColor: 'var(--accent-cyan)', 
                background: 'rgba(0, 229, 255, 0.05)',
                x: 4 
            }}
            onClick={onEdit}
        >
            {/* Pattern: Substation Name (Mnemonic) */}
            <div style={{ flex: '1', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {substation.name} <span style={{ color: 'var(--accent-cyan)', opacity: 0.8, fontSize: '0.85rem' }}>({substation.mnemonic || substation.substation_id})</span>
                </h3>
                
                {/* Badges */}
                <div style={{ display: 'flex', gap: '6px' }}>
                    {substation.has_active_relay && (
                        <div title="Active Load Shedding Relay" style={{ color: '#ffb74d' }}>
                            <LuCircuitBoard size={14} />
                        </div>
                    )}
                    {substation.is_critical && (
                        <div title="Critical Asset" style={{ color: '#ef4444' }}>
                            <FiAlertCircle size={14} />
                        </div>
                    )}
                </div>
            </div>

            {/* Metadata Pills */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="mono" style={{ 
                    fontSize: '0.7rem', 
                    color: substation.voltage >= 500 ? '#ffffff' : (substation.voltage >= 275 ? '#15d5f6ff' : (substation.voltage >= 230 ? '#ffa500' : 'var(--accent-cyan)')),
                    fontWeight: 700 
                }}>
                    {substation.voltage}kV
                </span>
                
                <span style={{ fontSize: '0.7rem', opacity: 0.6, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                    {substation.ownership}
                </span>

                <span style={{ fontSize: '0.7rem', opacity: 0.6, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                    {substation.region}
                </span>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {(substation.state || (substation.latitude && substation.longitude)) && (
                    <button
                        onClick={(e) => {
                            if (substation.latitude && substation.longitude && onLocate) {
                                e.stopPropagation();
                                onLocate(substation);
                            }
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: (substation.latitude && substation.longitude) ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px',
                            borderRadius: '4px',
                            transition: 'all 0.2s'
                        }}
                        className="hover-cyan"
                        title="View on Map"
                    >
                        <MapPin size={16} />
                    </button>
                )}

                {substation.sld_file && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewSld(substation); }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px',
                            borderRadius: '4px',
                            transition: 'all 0.2s'
                        }}
                        className="hover-cyan"
                        title="View SLD"
                    >
                        <FileText size={16} />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

export default SubstationListRow;
