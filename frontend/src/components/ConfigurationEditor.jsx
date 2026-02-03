
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, X, Zap, Activity } from 'lucide-react';

const ConfigurationEditor = ({ substation, onSave, onCancel }) => {
    const [transformers, setTransformers] = useState(substation.transformers || []);
    const [bays, setBays] = useState(substation.incoming_bays || []);

    // Transformers Logic
    const addTransformer = () => {
        setTransformers([...transformers, {
            bay_name: `T${transformers.length + 1}`,
            capacity_mva: '',
            hv_breaker_number: '',
            lv_breaker_number: '',
            commission_date: ''
        }]);
    };

    const updateTransformer = (index, field, value) => {
        const newTransformers = [...transformers];
        newTransformers[index][field] = value;
        setTransformers(newTransformers);
    };

    const removeTransformer = (index) => {
        setTransformers(transformers.filter((_, i) => i !== index));
    };

    // Bays Logic
    const addBay = () => {
        setBays([...bays, {
            bay_name: '',
            voltage: 132,
            breaker_number: ''
        }]);
    };

    const updateBay = (index, field, value) => {
        const newBays = [...bays];
        newBays[index][field] = value;
        setBays(newBays);
    };

    const removeBay = (index) => {
        setBays(bays.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        const sanitize = (list) => list.map(item => {
            const clean = { ...item };
            // Sanitize numeric fields
            ['capacity_mva', 'hv_voltage', 'lv_voltage', 'sequence_number', 'voltage'].forEach(field => {
                if (field in clean) {
                    if (clean[field] === '' || clean[field] === null) clean[field] = null;
                    else clean[field] = Number(clean[field]);
                }
            });
            // Sanitize date fields
            if (clean.commission_date === '') clean.commission_date = null;

            return clean;
        });

        const payload = {
            transformers: sanitize(transformers),
            incoming_bays: sanitize(bays)
        };

        console.log("ConfigurationEditor payload:", JSON.stringify(payload, null, 2));
        onSave(payload);
    };

    return (
        <div className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Edit Substation Configuration</h3>
                <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={24} />
                </button>
            </div>

            {/* Transformers Section */}
            <section style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ color: 'var(--accent-cyan)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Zap size={18} /> TRANSFORMERS
                    </h4>
                    <button className="btn-secondary" onClick={addTransformer} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                        <Plus size={14} style={{ marginRight: '4px' }} /> Add Transformer
                    </button>
                </div>
                <div style={{ display: 'grid', gap: '1rem' }}>
                    <AnimatePresence>
                        {transformers.map((t, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}
                            >
                                <div>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Transformer Name</label>
                                    <input className="input-field" value={t.bay_name} onChange={(e) => updateTransformer(i, 'bay_name', e.target.value)} placeholder="T1" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>MVA</label>
                                    <input className="input-field" type="number" value={t.capacity_mva} onChange={(e) => updateTransformer(i, 'capacity_mva', e.target.value)} placeholder="30.0" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>HV Breaker</label>
                                    <input className="input-field" value={t.hv_breaker_number} onChange={(e) => updateTransformer(i, 'hv_breaker_number', e.target.value)} placeholder="110" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>LV Breaker</label>
                                    <input className="input-field" value={t.lv_breaker_number} onChange={(e) => updateTransformer(i, 'lv_breaker_number', e.target.value)} placeholder="30" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Comm. Date</label>
                                    <input className="input-field" type="date" value={t.commission_date} onChange={(e) => updateTransformer(i, 'commission_date', e.target.value)} />
                                </div>
                                <button onClick={() => removeTransformer(i)} style={{ color: '#f56565', background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}>
                                    <Trash2 size={18} />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </section>

            {/* Bays Section */}
            <section style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ color: 'var(--accent-blue)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Activity size={18} /> INCOMING BAYS
                    </h4>
                    <button className="btn-secondary" onClick={addBay} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                        <Plus size={14} style={{ marginRight: '4px' }} /> Add Bay
                    </button>
                </div>
                <div style={{ display: 'grid', gap: '1rem' }}>
                    <AnimatePresence>
                        {bays.map((b, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}
                            >
                                <div>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Bay Name</label>
                                    <input className="input-field" value={b.bay_name} onChange={(e) => updateBay(i, 'bay_name', e.target.value)} placeholder="SRDN1" />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Voltage (kV)</label>
                                    <select className="input-field" value={b.voltage} onChange={(e) => updateBay(i, 'voltage', e.target.value)}>
                                        <option value="500">500</option>
                                        <option value="275">275</option>
                                        <option value="132">132</option>
                                        <option value="33">33</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Breaker No.</label>
                                    <input className="input-field" value={b.breaker_number} onChange={(e) => updateBay(i, 'breaker_number', e.target.value)} placeholder="505" />
                                </div>
                                <button onClick={() => removeBay(i)} style={{ color: '#f56565', background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}>
                                    <Trash2 size={18} />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </section>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button className="btn-secondary" onClick={onCancel}>Cancel</button>
                <button className="btn-primary" onClick={handleSave}>
                    <Save size={18} style={{ marginRight: '8px' }} /> Save Configuration
                </button>
            </div>
        </div>
    );
};

export default ConfigurationEditor;
