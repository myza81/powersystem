import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, MapPin, FileText, Upload } from 'lucide-react';
import { BsTools } from 'react-icons/bs';
import { LuCircuitBoard } from 'react-icons/lu';
import { FiAlertCircle } from 'react-icons/fi';

const SubstationCard = ({ substation, onEdit, onSLDUpload, onViewSld, onLocate, onCriticalClick }) => {
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) onSLDUpload(substation.substation_id, file);
    };


    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass-card"
            whileHover={{ y: -4, borderColor: 'var(--accent-cyan)', boxShadow: '0 8px 24px rgba(0, 229, 255, 0.15)' }}
            style={{
                padding: '0.75rem',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                cursor: 'pointer'
            }}
            onClick={onEdit}
        >
            {/* Header: ID + Name */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="mono" style={{ color: substation.voltage >= 500 ? '#ffffff' : (substation.voltage >= 275 ? '#15d5f6ff' : (substation.voltage >= 230 ? '#ffa500' : 'var(--accent-cyan)')), fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {substation.substation_id}
                    </span>
                    <h3 style={{ fontSize: '0.9rem', margin: '2px 0 0 0', lineHeight: '1.2', fontWeight: 600, color: '#fff' }} title={substation.name}>
                        {substation.name.length > 25 ? `${substation.name.substring(0, 25)}...` : substation.name}
                    </h3>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    {substation.has_active_relay && (
                        <div
                            title="Active Load Shedding Relay"
                            style={{
                                background: 'rgba(255, 183, 77, 0.1)',
                                border: '1px solid rgba(255, 183, 77, 0.3)',
                                color: '#ffb74d',
                                padding: '4px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 12px rgba(255, 183, 77, 0.2)'
                            }}
                        >
                            <LuCircuitBoard size={14} />
                        </div>
                    )}
                    {substation.is_critical && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onCriticalClick) onCriticalClick(substation.substation_id);
                            }}
                            title="View Critical Asset Tags"
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                color: '#ef4444',
                                padding: '4px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <FiAlertCircle size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Body: Pills for Metadata */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: 'auto' }}>
                {substation.ownership && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(255, 159, 67, 0.1)', color: '#ff9f43', padding: '2px 6px', borderRadius: '4px' }}>
                        {substation.ownership}
                    </span>
                )}
                {substation.region && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {substation.region}
                    </span>
                )}
                {substation.grid && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {substation.grid}
                    </span>
                )}
                {/* Interactive Location Tag (State) */}
                {(substation.state || (substation.latitude && substation.longitude)) && (
                    <span
                        onClick={(e) => {
                            if (substation.latitude && substation.longitude && onLocate) {
                                e.stopPropagation();
                                onLocate(substation);
                            }
                        }}
                        title={substation.latitude && substation.longitude ? "View on Map" : "No coordinates available"}
                        style={{
                            fontSize: '0.65rem',
                            background: 'rgba(0, 229, 255, 0.1)',
                            color: 'var(--accent-cyan)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            cursor: (substation.latitude && substation.longitude) ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            border: (substation.latitude && substation.longitude) ? '1px solid transparent' : 'none',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (substation.latitude && substation.longitude) {
                                e.currentTarget.style.background = 'rgba(0, 229, 255, 0.2)';
                                e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 229, 255, 0.4)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (substation.latitude && substation.longitude) {
                                e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)';
                                e.currentTarget.style.boxShadow = 'none';
                            }
                        }}
                    >
                        {substation.latitude && substation.longitude && <MapPin size={10} />}
                        {substation.state || 'Locate'}
                    </span>
                )}
                {substation.sld_file && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewSld(substation); }}
                        style={{
                            background: 'rgba(0, 229, 255, 0.1)',
                            border: '1px solid rgba(0, 229, 255, 0.2)',
                            color: 'var(--accent-cyan)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.65rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: 400
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 229, 255, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)';
                        }}
                        title="View Single Line Diagram"
                    >
                        <FileText size={10} />
                        <span>SLD</span>
                    </button>
                )}
            </div>
        </motion.div>
    );
};

export default SubstationCard;
