import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, FileText, Zap } from 'lucide-react';
import { LuCircuitBoard } from 'react-icons/lu';
import { FiAlertCircle } from 'react-icons/fi';

const SubstationListRow = ({ substation, onEdit, onViewSld, onLocate, onCriticalClick }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 0.8fr 1fr 0.8fr 120px',
                gap: '1rem',
                alignItems: 'center',
                padding: '0.85rem 1.25rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderBottom: '1px solid rgba(4, 125, 96, 0.1)',
                background: 'rgba(255, 255, 255, 0.4)',
            }}
            whileHover={{ 
                background: 'rgba(4, 125, 96, 0.08)',
                borderLeft: '3px solid #047d60',
            }}
            onClick={onEdit}
        >
            {/* Substation Name & ID */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                            {substation.name}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {substation.has_active_relay && (
                                <span title="Active Load Shedding Relay" style={{ color: '#f59e0b' }}>
                                    <LuCircuitBoard size={14} />
                                </span>
                            )}
                            {substation.is_critical && (
                                <span title="Critical Asset" style={{ color: '#ef4444' }}>
                                    <FiAlertCircle size={14} />
                                </span>
                            )}
                        </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                        {substation.mnemonic || substation.substation_id}
                    </span>
                </div>
            </div>

            {/* Voltage Level */}
            <div>
                <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 700,
                    color: substation.voltage >= 500 ? '#dc2626' : (substation.voltage >= 275 ? '#ea580c' : '#059669'),
                    background: substation.voltage >= 500 ? 'rgba(220, 38, 38, 0.1)' : (substation.voltage >= 275 ? 'rgba(234, 88, 12, 0.1)' : 'rgba(5, 150, 105, 0.1)'),
                    padding: '3px 8px',
                    borderRadius: '4px',
                }}>
                    {substation.voltage}kV
                </span>
            </div>

            {/* Ownership */}
            <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                {substation.ownership}
            </div>

            {/* Region */}
            <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                {substation.region}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                {substation.latitude && substation.longitude && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onLocate && onLocate(substation);
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '6px',
                            borderRadius: '6px',
                            transition: 'all 0.2s'
                        }}
                        title="View on Map"
                    >
                        <MapPin size={14} />
                    </button>
                )}
                {substation.sld_file && (
                    <button
                        onClick={(e) => { 
                            e.stopPropagation();
                            onViewSld && onViewSld(substation); 
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '6px',
                            borderRadius: '6px',
                            transition: 'all 0.2s'
                        }}
                        title="View SLD"
                    >
                        <FileText size={14} />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

export default SubstationListRow;