import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { motion } from 'framer-motion';

const LOAD_LV_VOLTAGES = [33, 22, 11];
const AUTO_LV_VOLTAGES = [275, 132];

const BayAssetForm = ({ assetType, asset, substations, onSave, onCancel }) => {
    const [formData, setFormData] = useState(() => asset || {});

    useEffect(() => {
        setFormData(asset || {});
    }, [asset]);

    const isLoad = assetType === 'load-transformer';
    const isAuto = assetType === 'auto-transformer';
    const isIncoming = assetType === 'incoming-branch';

    const title = asset?.id
        ? `Edit ${isLoad ? 'Load Transformer' : isAuto ? 'Auto Transformer' : 'Incoming Branch'}`
        : `New ${isLoad ? 'Load Transformer' : isAuto ? 'Auto Transformer' : 'Incoming Branch'}`;

    const handleChange = (e) => {
        const { name, value } = e.target;
        const parsedValue = ['transformer_no', 'capacity_mva', 'hv_voltage', 'lv_voltage'].includes(name)
            ? (value === '' ? '' : parseInt(value, 10))
            : value;

        const next = { ...formData, [name]: parsedValue };

        if (name === 'substation') {
            const selected = substations.find((s) => s.substation_id === value);
            if (selected && (isLoad || isAuto)) {
                next.hv_voltage = selected.voltage;
            }
        }

        setFormData(next);
    };

    const substationOptions = substations.map((s) => (
        <option key={s.substation_id} value={s.substation_id}>
            {s.substation_id} - {s.name}
        </option>
    ));

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card"
            style={{ position: 'relative', maxWidth: '700px', margin: '0 auto' }}
        >
            <button onClick={onCancel} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)' }}>
                <X />
            </button>

            <h2 style={{ marginBottom: '2rem' }}>{title}</h2>

            <form onSubmit={(e) => {
                e.preventDefault();
                const { id, bay_id, created_at, updated_at, ...editableData } = formData;
                onSave(editableData);
            }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Substation</label>
                    <select name="substation" className="input-field" value={formData.substation || ''} onChange={handleChange} required>
                        <option value="">Select Substation...</option>
                        {substationOptions}
                    </select>
                </div>

                {isIncoming && (
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Remote Substation</label>
                        <select name="to_substation" className="input-field" value={formData.to_substation || ''} onChange={handleChange} required>
                            <option value="">Select Remote Substation...</option>
                            {substationOptions}
                        </select>
                    </div>
                )}

                {(isLoad || isAuto) && (
                    <>
                        <div style={{ gridColumn: 'span 1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Transformer No</label>
                            <input name="transformer_no" type="number" className="input-field mono" value={formData.transformer_no || ''} onChange={handleChange} required />
                        </div>

                        <div style={{ gridColumn: 'span 1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>HV Voltage (kV)</label>
                            <input name="hv_voltage" type="number" className="input-field mono" value={formData.hv_voltage || ''} onChange={handleChange} disabled />
                        </div>
                    </>
                )}

                {(isLoad || isAuto) && (
                    <>
                        <div style={{ gridColumn: 'span 1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>LV Voltage (kV)</label>
                            <select name="lv_voltage" className="input-field" value={formData.lv_voltage || ''} onChange={handleChange}>
                                <option value="">Select...</option>
                                {(isLoad ? LOAD_LV_VOLTAGES : AUTO_LV_VOLTAGES).map((v) => (
                                    <option key={v} value={v}>{v} kV</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ gridColumn: 'span 1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Capacity (MVA)</label>
                            <input name="capacity_mva" type="number" className="input-field mono" value={formData.capacity_mva || ''} onChange={handleChange} />
                        </div>
                    </>
                )}

                {isIncoming && (
                    <>
                        <div style={{ gridColumn: 'span 1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Circuit ID</label>
                            <input name="ckt_id" className="input-field mono" value={formData.ckt_id || ''} onChange={handleChange} required />
                        </div>
                        <div style={{ gridColumn: 'span 1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Breaker Number</label>
                            <input name="breaker_number" className="input-field mono" value={formData.breaker_number || ''} onChange={handleChange} />
                        </div>
                    </>
                )}

                {(isLoad || isAuto) && (
                    <>
                        <div style={{ gridColumn: 'span 1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>HV Breaker</label>
                            <input name="hv_breaker_number" className="input-field mono" value={formData.hv_breaker_number || ''} onChange={handleChange} />
                        </div>
                        <div style={{ gridColumn: 'span 1' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>LV Breaker</label>
                            <input name="lv_breaker_number" className="input-field mono" value={formData.lv_breaker_number || ''} onChange={handleChange} />
                        </div>
                    </>
                )}

                <div style={{ gridColumn: 'span 1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Commissioning Date</label>
                    <input name="commissioning_date" type="date" className="input-field" value={formData.commissioning_date || ''} onChange={handleChange} />
                </div>

                {asset?.bay_id && (
                    <div style={{ gridColumn: 'span 1' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Bay ID</label>
                        <input className="input-field mono" value={asset.bay_id} disabled />
                    </div>
                )}

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                        <Save size={18} style={{ marginRight: '8px' }} />
                        {asset?.id ? 'Update Asset' : 'Create Asset'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={onCancel} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}>
                        Discard
                    </button>
                </div>
            </form>
        </motion.div>
    );
};

export default BayAssetForm;
