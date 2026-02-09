import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Cpu, Edit2, MapPin, FileText, Upload, Activity, AlertTriangle, Plus } from 'lucide-react';

const SubstationCard = ({ substation, onEdit, onConfigEdit, onSLDUpload, onProcess, processing, onViewSld }) => {
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) onSLDUpload(substation.substation_id, file);
    };

    const hasConfig = (substation.transformers?.length > 0 || substation.incoming_bays?.length > 0);

    // Config Summary
    const txCount = substation.transformers?.length || 0;
    const bayCount = substation.incoming_bays?.length || 0;

    // Check for LV configuration issues (Red Alert)
    const hasConfigIssue = substation.transformers?.some(t => {
        const v = Number(t.lv_voltage);
        return v && ![11, 22, 33].includes(v);
    });

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
            {/* Header: ID + Voltage Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="mono" style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {substation.substation_id}
                    </span>
                    <h3 style={{ fontSize: '1rem', margin: '2px 0', lineHeight: '1.2', fontWeight: 600, color: '#fff' }} title={substation.name}>
                        {substation.name.length > 25 ? `${substation.name.substring(0, 25)}...` : substation.name}
                    </h3>
                </div>
                <div style={{
                    background: 'rgba(255,255,255,0.1)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                    whiteSpace: 'nowrap'
                }}>
                    {substation.voltage} kV
                </div>
            </div>

            {/* Body: Pills for Region/Grid */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {substation.region && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(0, 229, 255, 0.1)', color: 'var(--accent-cyan)', padding: '2px 6px', borderRadius: '4px' }}>
                        {substation.region}
                    </span>
                )}
                {substation.grid && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {substation.grid}
                    </span>
                )}
                {substation.state && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {substation.state}
                    </span>
                )}
                {substation.ownership && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(255, 159, 67, 0.1)', color: '#ff9f43', padding: '2px 6px', borderRadius: '4px' }}>
                        {substation.ownership}
                    </span>
                )}
            </div>

            {/* Footer Row: Metadata Icons */}
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                {/* Config Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: hasConfig ? 'var(--text-primary)' : 'var(--text-secondary)' }} title="Transformers / Bays">
                    <Activity size={14} color={hasConfig ? 'var(--accent-cyan)' : 'gray'} />
                    <span>{hasConfig ? `${txCount} Tx • ${bayCount} Bays` : 'No Config'}</span>
                </div>

                {/* SLD Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
                    <FileText size={14} color={substation.sld_file ? 'var(--accent-cyan)' : 'gray'} />
                    <span style={{ color: substation.sld_file ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {substation.sld_file ? 'SLD Ready' : 'No SLD'}
                    </span>
                </div>

                {/* Alert Icon */}
                {hasConfigIssue && (
                    <div title="Non-standard LV Voltage detected" style={{ marginLeft: 'auto' }}>
                        <AlertTriangle size={16} color="#ef4444" className="animate-pulse" />
                    </div>
                )}
            </div>

            {/* Hover Actions Overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    padding: '0.75rem',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(0,229,255,0.2)'
                }}
            >
                <ActionButton icon={<Edit2 size={16} />} label="Edit" onClick={onEdit} color="white" />
                <ActionButton
                    icon={<Activity size={16} />}
                    label="Config"
                    onClick={onConfigEdit}
                    color={hasConfig ? 'var(--accent-cyan)' : 'white'}
                />

                {/* SLD Actions */}
                {substation.sld_file ? (
                    <>
                        <ActionButton
                            icon={<FileText size={16} />}
                            label="View SLD"
                            onClick={() => onViewSld(substation)}
                            color="var(--accent-cyan)"
                        />
                        <ActionButton
                            icon={<Cpu size={16} />}
                            label="Process"
                            onClick={() => onProcess(substation.substation_id)}
                            color={processing ? 'orange' : 'white'}
                            className={processing ? 'animate-spin' : ''}
                        />
                    </>
                ) : (
                    <div>
                        <input type="file" id={`sld-quick-${substation.substation_id}`} hidden onChange={handleFileChange} accept=".pdf,.dxf,.svg,image/*" />
                        <label htmlFor={`sld-quick-${substation.substation_id}`} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            <Upload size={16} /> Upload
                        </label>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};

const ActionButton = ({ icon, label, onClick, color, className }) => (
    <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={{
            background: 'transparent',
            border: 'none',
            color: color,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            fontSize: '0.65rem',
            cursor: 'pointer'
        }}
    >
        <div className={className}>{icon}</div>
        <span>{label}</span>
    </button>
);

export default SubstationCard;
