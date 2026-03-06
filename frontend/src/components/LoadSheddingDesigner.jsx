import React, { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Save,
    RotateCcw,
    Zap,
    Shield,
    Settings as SettingsIcon,
    Search,
    ChevronRight,
    Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

const LoadSheddingDesigner = () => {
    const [relays, setRelays] = useState([]);
    const [schemeType, setSchemeType] = useState('UFLS');
    const [activeStage, setActiveStage] = useState(0);
    const [stages, setStages] = useState([
        { id: Date.now(), stage_number: 1, label: 'Stage 1', transformer_bays: [], pocket_bays: [] }
    ]);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [versionLabel, setVersionLabel] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await api.get('/load-shedding-relays/');
                setRelays(res.data);
            } catch (err) {
                console.error("Failed to fetch designer data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const addStage = () => {
        const newId = stages.length + 1;
        setStages([
            ...stages,
            {
                id: Date.now(),
                stage_number: newId,
                label: `Stage ${newId}`,
                transformer_bays: [],
                pocket_bays: []
            }
        ]);
    };

    const handleSave = async () => {
        if (!versionLabel) {
            alert("Please provide a version label");
            return;
        }

        setSaving(true);
        try {
            // 1. Create the version
            const versionRes = await api.post('/load-shedding-versions/', {
                scheme_type: schemeType.includes('UFLS') ? 'UFLS' : (schemeType.includes('UVLS') ? 'UVLS' : 'EMLS'),
                version_label: versionLabel,
                status: 'draft'
            });
            const versionId = versionRes.data.id;

            // 2. Create stages and assignments
            for (const stage of stages) {
                const stageRes = await api.post('/load-shedding-stages/', {
                    version: versionId,
                    stage_number: stage.stage_number,
                    label: stage.label
                });
                const stageId = stageRes.data.id;

                // Add transformer bays
                for (const tb of stage.transformer_bays || []) {
                    await api.post('/load-shedding-transformer-bays/', {
                        stage: stageId,
                        relay: tb.relay,
                        transformers: tb.transformers
                    });
                }
            }
            alert("Scheme saved successfully!");
        } catch (err) {
            console.error("Failed to save scheme", err);
            alert("Save failed. " + (err.response?.data?.detail || "Check console."));
        } finally {
            setSaving(false);
        }
    };

    const calculateTotalMW = (stage) => {
        if (!stage) return "0.0";
        return (stage.transformer_bays?.reduce((acc, bay) => {
            return acc + (bay.transformers?.length * 15.0 || 0); // Est 15MW per transformer
        }, 0) || 0).toFixed(1);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem', height: 'calc(100vh - 12rem)', fontFamily: "'Inter', sans-serif" }}>

            {/* Left Sidebar: Scheme Settings & Stages */}
            <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
                <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Scheme Profile</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Scheme Type</label>
                            <select
                                className="platinum-input"
                                value={schemeType}
                                onChange={(e) => setSchemeType(e.target.value)}
                            >
                                <option>UFLS (Under Frequency)</option>
                                <option>UVLS (Under Voltage)</option>
                                <option>EMLS (Manual Load Shedding)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Version Label</label>
                            <input
                                type="text"
                                placeholder="e.g. 2026 March Revision"
                                className="platinum-input"
                                value={versionLabel}
                                onChange={(e) => setVersionLabel(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Defined Stages</div>
                        <button onClick={addStage} style={{ padding: '4px', borderRadius: '4px', background: 'rgba(0, 255, 163, 0.1)', color: 'var(--accent-cyan)', border: 'none', cursor: 'pointer' }}>
                            <Plus size={16} />
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {stages.map((stage, idx) => (
                            <div
                                key={stage.id}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s',
                                    background: activeStage === idx ? 'rgba(0, 255, 163, 0.1)' : 'rgba(255,255,255,0.02)',
                                    border: activeStage === idx ? '1px solid rgba(0, 255, 163, 0.3)' : '1px solid transparent',
                                    color: activeStage === idx ? 'var(--accent-cyan)' : 'inherit'
                                }}
                                onClick={() => setActiveStage(idx)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', background: activeStage === idx ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)', color: activeStage === idx ? '#000' : 'var(--text-secondary)' }}>
                                        {idx + 1}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{stage.label}</div>
                                </div>
                                {idx > 0 && (
                                    <button style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }}>
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Middle: Content Builder */}
            <div className="glass-card" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', padding: 0 }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', background: 'rgba(0, 255, 163, 0.1)', borderRadius: '8px', color: 'var(--accent-cyan)' }}>
                            <Layout size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 'bold', margin: 0 }}>{stages[activeStage]?.label}</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Assign assets to this stage to define shedding capacity</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                            <SettingsIcon size={14} /> Stage Settings
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Transformer Assignment */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <Zap size={16} style={{ color: 'var(--accent-cyan)' }} /> Transformer Assignments
                            </h4>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{calculateTotalMW(stages[activeStage])} MW Est.</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {stages[activeStage]?.transformer_bays.map((bay, idx) => (
                                <div key={bay.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Zap size={14} style={{ color: 'var(--accent-cyan)' }} />
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{bay.relay_substation_id}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{bay.transformers.length} TXs</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newStages = [...stages];
                                            newStages[activeStage].transformer_bays.splice(idx, 1);
                                            setStages(newStages);
                                        }}
                                        style={{ background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            <div style={{ border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'default', transition: 'all 0.2s' }}>
                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Select assets from the library to add them here</div>
                            </div>
                        </div>
                    </div>

                    {/* Pocket Assignment */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <Shield size={16} style={{ color: 'var(--accent-blue)' }} /> Network Pocket Assignments
                            </h4>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>0.0 MW Total</div>
                        </div>

                        <div style={{ border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <Plus size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                            <div style={{ fontSize: '0.85rem' }}>Click to instantiate Network Pocket</div>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px', opacity: 0.5 }}>Define complex mesh isolation</div>
                        </div>
                    </div>
                </div>

                {/* Sticky Footer Actions */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1rem', background: 'rgba(10, 12, 16, 0.8)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        Unsaved changes detected in Version 2.4
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                            <RotateCcw size={16} /> Reset
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', fontSize: '0.85rem', boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)', opacity: saving ? 0.7 : 1 }}
                        >
                            {saving ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Saving...' : 'Save Scheme'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right: Asset Picker (Hidden until 'Add' clicked, normally) */}
            <div className="glass-card" style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Asset Library</div>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={14} />
                        <input
                            type="text"
                            placeholder="Search by Substation Mnemonic..."
                            className="platinum-input"
                            style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {Array.isArray(relays) && relays.filter(r => (r.substation_id || "").toLowerCase().includes((searchTerm || "").toLowerCase())).map(relay => (
                        <div
                            key={relay.id}
                            style={{ padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s', background: 'rgba(255,255,255,0.02)' }}
                            onClick={() => {
                                const currentStages = [...stages];
                                const active = currentStages[activeStage];
                                active.transformer_bays.push({
                                    id: Date.now(),
                                    relay: relay.id,
                                    relay_substation_id: relay.substation_id,
                                    transformers: relay.load_transformers // By default add all transformers from relay
                                });
                                setStages(currentStages);
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{relay.substation_id}</span>
                                <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Relay Anchor</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Load Shedding Relay @ {relay.substation_id}</div>
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{relay.load_transformers?.length || 0} Transformers</span>
                                <div style={{ fontSize: '9px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Add to Stage <ChevronRight size={10} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default LoadSheddingDesigner;
