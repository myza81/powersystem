import React, { useState } from 'react';
import { X, Save, MapPin, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const SubstationForm = ({ substation, onSave, onCancel }) => {
    const [formData, setFormData] = useState(substation || {
        mnemonic: '',
        name: '',
        ownership: 'TNB',
        voltage: '',
        grid: '',
        latitude: '',
        longitude: ''
    });

    const GRIDS = ['KEDP', 'PPNG', 'PERK', 'SELG', 'KLUM', 'NSEM', 'MLKA', 'JOH2', 'JOH1', 'PHNG', 'TERG', 'KELN'];
    const VOLTAGES = [500, 275, 132];

    const handleChange = (e) => {
        const value = e.target.name === 'voltage' ? parseInt(e.target.value) : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card"
            style={{ position: 'relative', maxWidth: '600px', margin: '0 auto' }}
        >
            <button onClick={onCancel} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)' }}>
                <X />
            </button>

            <h2 style={{ marginBottom: '2rem' }}>{substation ? 'Edit Substation' : 'New Substation Asset'}</h2>

            <form onSubmit={(e) => {
                e.preventDefault();
                // Filter out read-only and nested fields
                const {
                    substation_id, sld, sld_file, transformers, incoming_bays,
                    created_at, updated_at, sync_log, state, region, ...editableData
                } = formData;
                onSave(editableData);
            }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ gridColumn: 'span 1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Mnemonic</label>
                    <input name="mnemonic" className="input-field mono" value={formData.mnemonic} onChange={handleChange} required />
                </div>

                <div style={{ gridColumn: 'span 1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Voltage (kV)</label>
                    <select name="voltage" className="input-field" value={formData.voltage} onChange={handleChange} required>
                        <option value="">Select...</option>
                        {VOLTAGES.map(v => <option key={v} value={v}>{v} kV</option>)}
                    </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Substation Name</label>
                    <input name="name" className="input-field" value={formData.name} onChange={handleChange} required />
                </div>

                <div style={{ gridColumn: 'span 1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Grid</label>
                    <select name="grid" className="input-field" value={formData.grid} onChange={handleChange} required>
                        <option value="">Select Grid...</option>
                        {GRIDS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Ownership</label>
                    <select name="ownership" className="input-field" value={formData.ownership} onChange={handleChange}>
                        <option value="TNB">Tenaga Nasional Berhad (TNB)</option>
                        <option value="DC">Data Centre (DC)</option>
                        <option value="LSS">Large Scale Solar (LSS)</option>
                        <option value="IPP">Independent Power Producer (IPP)</option>
                        <option value="LPC">Large Power Consumer (LPC)</option>
                    </select>
                </div>

                <div style={{ gridColumn: 'span 1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Latitude</label>
                    <input name="latitude" type="number" step="any" className="input-field mono" value={formData.latitude} onChange={handleChange} />
                </div>

                <div style={{ gridColumn: 'span 1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Longitude</label>
                    <input name="longitude" type="number" step="any" className="input-field mono" value={formData.longitude} onChange={handleChange} />
                </div>

                <div style={{ gridColumn: 'span 2', background: 'rgba(229, 62, 62, 0.1)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <AlertTriangle color="#f56565" size={20} />
                    <span style={{ fontSize: '0.85rem', color: '#feb2b2' }}>
                        System will attempt to auto-geocode if coordinates are left empty.
                    </span>
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                        <Save size={18} style={{ marginRight: '8px' }} />
                        Commit to Database
                    </button>
                    <button type="button" className="btn-secondary" onClick={onCancel} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}>
                        Discard
                    </button>
                </div>
            </form>
        </motion.div>
    );
};

export default SubstationForm;
