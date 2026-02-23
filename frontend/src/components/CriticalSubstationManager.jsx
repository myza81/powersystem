import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, X, Save } from 'lucide-react';
import api from '../api';
import CriticalSubstationCard from './CriticalSubstationCard';

const CriticalSubstationManager = () => {
    const [tags, setTags] = useState([]);
    const [substations, setSubstations] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sources, setSources] = useState([]);
    const [loadTransformers, setLoadTransformers] = useState([]);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [selectedSubstation, setSelectedSubstation] = useState('');
    const [editingTagId, setEditingTagId] = useState('');
    const [formData, setFormData] = useState({
        load_transformer: '',
        category: '',
        severity_rank: '',
        source: '',
        is_inforce: true,
        inforce_from: '',
        inforce_to: ''
    });

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [tagRes, subRes, catRes, srcRes] = await Promise.all([
                api.get('/critical-tags/'),
                api.get('/substations/'),
                api.get('/critical-categories/'),
                api.get('/critical-sources/')
            ]);
            setTags(tagRes.data || []);
            setSubstations(subRes.data || []);
            setCategories(catRes.data || []);
            setSources(srcRes.data || []);
        } catch (err) {
            setStatus({ type: 'error', msg: 'Failed to load critical substations.' });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAll();
    }, []);

    useEffect(() => {
        const fetchLoadTransformers = async () => {
            if (!selectedSubstation) {
                setLoadTransformers([]);
                return;
            }
            try {
                const res = await api.get(`/load-transformers/?substation=${selectedSubstation}`);
                setLoadTransformers(res.data || []);
            } catch (err) {
                setStatus({ type: 'error', msg: 'Failed to load load transformers.' });
            }
        };
        fetchLoadTransformers();
    }, [selectedSubstation]);

    const grouped = useMemo(() => {
        const map = {};
        tags.forEach(tag => {
            if (!tag.substation) return;
            if (!map[tag.substation]) map[tag.substation] = [];
            map[tag.substation].push(tag);
        });
        return map;
    }, [tags]);

    const substationLookup = useMemo(() => {
        const map = {};
        substations.forEach(s => { map[s.substation_id] = s; });
        return map;
    }, [substations]);

    const handleDeactivateAll = async (substationId) => {
        const items = grouped[substationId] || [];
        if (!items.length) return;
        if (!confirm(`Deactivate all critical tags for ${substationId}?`)) return;

        setLoading(true);
        try {
            const today = new Date().toISOString().slice(0, 10);
            await Promise.all(items.map(item => api.patch(`/critical-tags/${item.id}/`, {
                is_inforce: false,
                inforce_to: today
            })));
            setStatus({ type: 'success', msg: `Deactivated ${substationId}` });
            fetchAll();
        } catch (err) {
            setStatus({ type: 'error', msg: 'Failed to deactivate tags.' });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!selectedSubstation) {
            setStatus({ type: 'error', msg: 'Select a substation.' });
            return;
        }
        if (!formData.load_transformer || !formData.category) {
            setStatus({ type: 'error', msg: 'Select bay and category.' });
            return;
        }

        setLoading(true);
        try {
            const payload = {
                substation: selectedSubstation,
                load_transformer: formData.load_transformer,
                category: formData.category,
                severity_rank: formData.severity_rank || null,
                source: formData.source || null,
                is_inforce: formData.is_inforce,
                inforce_from: formData.inforce_from || null,
                inforce_to: formData.inforce_to || null
            };

            if (editingTagId) {
                await api.patch(`/critical-tags/${editingTagId}/`, payload);
                setStatus({ type: 'success', msg: 'Critical tag updated.' });
            } else {
                await api.post('/critical-tags/', payload);
                setStatus({ type: 'success', msg: 'Critical tag created.' });
            }
            setShowForm(false);
            setEditingTagId('');
            setFormData({ load_transformer: '', category: '', severity_rank: '', source: '', is_inforce: true, inforce_from: '', inforce_to: '' });
            fetchAll();
        } catch (err) {
            setStatus({ type: 'error', msg: 'Failed to create tag.' });
        }
        setLoading(false);
    };

    const openEditModal = (substationId) => {
        const items = grouped[substationId] || [];
        if (!items.length) {
            setSelectedSubstation(substationId);
            setEditingTagId('');
            setFormData({ load_transformer: '', category: '', severity_rank: '', source: '', is_inforce: true, inforce_from: '', inforce_to: '' });
            setShowForm(true);
            return;
        }

        const first = items[0];
        setSelectedSubstation(substationId);
        setEditingTagId(first.id);
        setFormData({
            load_transformer: first.load_transformer,
            category: first.category,
            severity_rank: first.severity_rank || '',
            source: first.source || '',
            is_inforce: first.is_inforce,
            inforce_from: first.inforce_from || '',
            inforce_to: first.inforce_to || ''
        });
        setShowForm(true);
    };

    const openAddModal = (substationId) => {
        setSelectedSubstation(substationId);
        setEditingTagId('');
        setFormData({ load_transformer: '', category: '', severity_rank: '', source: '', is_inforce: true, inforce_from: '', inforce_to: '' });
        setShowForm(true);
    };

    const openEditTagModal = (tag) => {
        setSelectedSubstation(tag.substation);
        setEditingTagId(tag.id);
        setFormData({
            load_transformer: tag.load_transformer,
            category: tag.category,
            severity_rank: tag.severity_rank || '',
            source: tag.source || '',
            is_inforce: tag.is_inforce,
            inforce_from: tag.inforce_from || '',
            inforce_to: tag.inforce_to || ''
        });
        setShowForm(true);
    };

    const selectedSubstationTags = selectedSubstation ? (grouped[selectedSubstation] || []) : [];

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Critical Substations</h2>
                <button className="btn-primary" onClick={() => setShowForm(true)}>
                    <PlusCircle size={18} style={{ marginRight: '8px' }} /> New Critical Tag
                </button>
            </div>

            {status && (
                <div style={{ marginBottom: '1rem', color: status.type === 'success' ? '#10b981' : '#ef4444' }}>
                    {status.msg}
                </div>
            )}

            <div className="substation-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <AnimatePresence>
                    {Object.keys(grouped).map(subId => (
                        <CriticalSubstationCard
                            key={subId}
                            substation={substationLookup[subId] || { substation_id: subId, name: subId }}
                            tags={grouped[subId]}
                            onEdit={() => openEditModal(subId)}
                            onAdd={() => openAddModal(subId)}
                            onEditTag={openEditTagModal}
                            onDeactivate={() => handleDeactivateAll(subId)}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {Object.keys(grouped).length === 0 && !loading && (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
                    No critical substations yet.
                </div>
            )}

            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.7)',
                            zIndex: 2000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2rem'
                        }}
                        onClick={() => setShowForm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card"
                            style={{ maxWidth: '720px', width: '100%', padding: '1.5rem' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>New Critical Tag</h3>
                                <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>
                                    <X />
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Substation</label>
                                    <select className="input-field" value={selectedSubstation} onChange={(e) => setSelectedSubstation(e.target.value)}>
                                        <option value="">Select...</option>
                                        {substations.map(s => (
                                            <option key={s.substation_id} value={s.substation_id}>{s.substation_id} - {s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedSubstationTags.length > 0 && (
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Existing Tags</label>
                                        <select
                                            className="input-field"
                                            value={editingTagId}
                                            onChange={(e) => {
                                                const tagId = e.target.value;
                                                const tag = selectedSubstationTags.find(t => t.id === tagId);
                                                setEditingTagId(tagId);
                                                if (tag) {
                                                    setFormData({
                                                        load_transformer: tag.load_transformer,
                                                        category: tag.category,
                                                        severity_rank: tag.severity_rank || '',
                                                        source: tag.source || '',
                                                        is_inforce: tag.is_inforce,
                                                        inforce_from: tag.inforce_from || '',
                                                        inforce_to: tag.inforce_to || ''
                                                    });
                                                }
                                            }}
                                        >
                                            {selectedSubstationTags.map(tag => (
                                                <option key={tag.id} value={tag.id}>
                                                    {tag.load_transformer_bay_id} • {tag.category_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Load Transformer Bay</label>
                                    <select className="input-field" value={formData.load_transformer} onChange={(e) => setFormData({ ...formData, load_transformer: e.target.value })}>
                                        <option value="">Select...</option>
                                        {loadTransformers.map(lt => (
                                            <option key={lt.id} value={lt.id}>{lt.bay_id}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Category</label>
                                    <select className="input-field" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                                        <option value="">Select...</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Severity Rank</label>
                                    <input className="input-field" type="number" value={formData.severity_rank} onChange={(e) => setFormData({ ...formData, severity_rank: e.target.value })} />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Source</label>
                                    <select className="input-field" value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })}>
                                        <option value="">Select...</option>
                                        {sources.map(src => (
                                            <option key={src.id} value={src.id}>{src.reference}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>In Force</label>
                                    <select className="input-field" value={formData.is_inforce ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, is_inforce: e.target.value === 'true' })}>
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>In‑force From</label>
                                    <input className="input-field" type="date" value={formData.inforce_from} onChange={(e) => setFormData({ ...formData, inforce_from: e.target.value })} />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>In‑force To</label>
                                    <input className="input-field" type="date" value={formData.inforce_to} onChange={(e) => setFormData({ ...formData, inforce_to: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ flex: 1 }}>
                                    <Save size={16} style={{ marginRight: '6px' }} /> {editingTagId ? 'Update Tag' : 'Save Tag'}
                                </button>
                                <button className="btn-secondary" onClick={() => setShowForm(false)} style={{ flex: 1 }}>
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CriticalSubstationManager;
