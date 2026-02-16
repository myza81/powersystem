import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, MapPin, FileText, Upload } from 'lucide-react';

const SubstationCard = ({ substation, onEdit, onSLDUpload, onViewSld, onLocate }) => {
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
                padding: '1rem',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                minHeight: '160px'
            }}
        >
            {/* Header: ID + Voltage Badge + Edit Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span className="mono" style={{ color: substation.voltage >= 500 ? '#ffffff' : (substation.voltage >= 275 ? '#15d5f6ff' : 'var(--accent-cyan)'), fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {substation.substation_id}
                    </span>
                    <h3 style={{ fontSize: '1rem', margin: '2px 0', lineHeight: '1.2', fontWeight: 600, color: '#fff' }} title={substation.name}>
                        {substation.name.length > 25 ? `${substation.name.substring(0, 25)}...` : substation.name}
                    </h3>
                </div>

            </div>

            {/* Body: Pills for Region/Grid */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {/* Voltage Badge */}
                {/* <span style={{
                    fontSize: '0.65rem',
                    background: substation.voltage >= 500 ? 'rgba(255,255,255,0.1)' : (substation.voltage >= 275 ? 'rgba(0, 191, 255, 0.08)' : 'rgba(74, 222, 128, 0.1)'),
                    color: substation.voltage >= 500 ? '#ffffff' : (substation.voltage >= 275 ? '#15d5f6ff' : 'var(--accent-cyan)'),
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 600
                }}>
                    {substation.voltage} kV
                </span> */}
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
                {substation.ownership && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(255, 159, 67, 0.1)', color: '#ff9f43', padding: '2px 6px', borderRadius: '4px' }}>
                        {substation.ownership}
                    </span>
                )}
            </div>

            {/* Footer Row: SLD Status + Edit Button */}
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                {substation.sld_file ? (
                    <div
                        onClick={() => onViewSld(substation)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--accent-cyan)';
                            e.currentTarget.style.transform = 'translateX(2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.transform = 'translateX(0)';
                        }}
                    >
                        <FileText size={14} color="var(--accent-cyan)" />
                        <span style={{ color: 'var(--text-primary)', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                            SLD Ready
                        </span>
                    </div>
                ) : (
                    <div>
                        <input type="file" id={`sld-upload-${substation.substation_id}`} hidden onChange={handleFileChange} accept=".pdf,.dxf,.svg,image/*" />
                        <label
                            htmlFor={`sld-upload-${substation.substation_id}`}
                            style={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--accent-cyan)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                        >
                            <Upload size={14} />
                            Upload SLD
                        </label>
                    </div>
                )}

                {/* Edit Button - Bottom Right */}
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    style={{
                        marginLeft: 'auto',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                        padding: '4px 8px',
                        borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(255,255,255,0.05)';
                        e.target.style.color = 'var(--accent-cyan)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                        e.target.style.color = 'var(--text-secondary)';
                    }}
                >
                    <Edit2 size={14} />
                    Edit
                </button>
            </div>
        </motion.div>
    );
};

export default SubstationCard;
