import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, X, Save, FileText, Trash2, Edit2 } from 'lucide-react';
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
    const [detailModal, setDetailModal] = useState(null);

    const formatBayTagLabel = (bayId, lvVoltage) => {
        if (!bayId) return '';
        const match = bayId.match(/_T(\d+)$/i) || bayId.match(/T(\d+)/i);
        const base = match ? `T${match[1]}` : bayId;
        if (lvVoltage) {
            return `${base} ${lvVoltage}kV`;
        }
        return base;
    };

    const tagPillStyle = {
        display: 'inline-block',
        fontSize: '0.7rem',
        background: 'rgba(255,255,255,0.08)',
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.12)'
    };

    const [showForm, setShowForm] = useState(false);
    const [selectedSubstation, setSelectedSubstation] = useState('');
    const [editingTagId, setEditingTagId] = useState('');
    const [formMode, setFormMode] = useState('create');
    const [sourceMode, setSourceMode] = useState('existing');
    const [sourceForm, setSourceForm] = useState({
        reference: '',
        source_file: null,
        issued_date: '',
        notes: ''
    });
    const [formData, setFormData] = useState({
        load_transformers: [],
        categories: [],
        severity_rank: '',
        source: '',
        short_text: '',
        is_inforce: true,
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
        if (sources.length === 0) {
            setSourceMode('new');
        }
    }, [sources.length]);

    useEffect(() => {
        const fetchLoadTransformers = async () => {
            if (!selectedSubstation) {
                setLoadTransformers([]);
                setFormData((prev) => ({ ...prev, load_transformers: [] }));
                return;
            }
            try {
                const res = await api.get(`/load-transformers/?substation=${selectedSubstation}`);
                setLoadTransformers(res.data || []);
                setFormData((prev) => ({ ...prev, load_transformers: [] }));
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
            await Promise.all(items.map(item => api.patch(`/critical-tags/${item.id}/`, {
                is_inforce: false
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
        if (!formData.load_transformers.length || !formData.categories.length) {
            setStatus({ type: 'error', msg: 'Select bay and category.' });
            return;
        }

        setLoading(true);
        try {
            let sourceId = formData.source || null;
            if (sourceMode === 'new') {
                if (!sourceForm.reference) {
                    setStatus({ type: 'error', msg: 'Source reference is required for new source.' });
                    setLoading(false);
                    return;
                }
                const sourcePayload = new FormData();
                sourcePayload.append('reference', sourceForm.reference);
                if (sourceForm.source_file) {
                    sourcePayload.append('source_file', sourceForm.source_file);
                }
                if (sourceForm.issued_date) {
                    sourcePayload.append('issued_date', sourceForm.issued_date);
                }
                if (sourceForm.notes) {
                    sourcePayload.append('notes', sourceForm.notes);
                }
                const sourceRes = await api.post('/critical-sources/', sourcePayload, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                sourceId = sourceRes.data.id;
            }

            const payloadBase = {
                substation: selectedSubstation,
                severity_rank: formData.severity_rank || null,
                source: sourceId,
                short_text: formData.short_text || '',
                is_inforce: formData.is_inforce,
            };

            if (editingTagId) {
                const payload = {
                    ...payloadBase,
                    load_transformer: formData.load_transformers[0],
                    category: formData.categories[0]
                };
                await api.patch(`/critical-tags/${editingTagId}/`, payload);
                setStatus({ type: 'success', msg: 'Critical tag updated.' });
            } else {
                const requests = [];
                formData.load_transformers.forEach((lt) => {
                    formData.categories.forEach((cat) => {
                        requests.push(api.post('/critical-tags/', { ...payloadBase, load_transformer: lt, category: cat }));
                    });
                });
                await Promise.all(requests);
                setStatus({ type: 'success', msg: 'Critical tags created.' });
            }
            setShowForm(false);
            setEditingTagId('');
            setSourceMode(sources.length === 0 ? 'new' : 'existing');
            setSourceForm({ reference: '', source_file: null, issued_date: '', notes: '' });
            setFormData({ load_transformers: [], categories: [], severity_rank: '', source: '', short_text: '', is_inforce: true });
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
            setFormMode('edit');
            setSourceMode(sources.length === 0 ? 'new' : 'existing');
            setSourceForm({ reference: '', source_file: null, issued_date: '', notes: '' });
            setFormData({ load_transformers: [], categories: [], severity_rank: '', source: '', short_text: '', is_inforce: true });
            setShowForm(true);
            return;
        }

        const first = items[0];
        setSelectedSubstation(substationId);
        setEditingTagId(first.id);
        setFormMode('edit');
        setSourceMode(sources.length === 0 ? 'new' : 'existing');
        setSourceForm({ reference: '', source_file: null, issued_date: '', notes: '' });
        setFormData({
            load_transformers: [first.load_transformer],
            categories: [first.category],
            severity_rank: first.severity_rank || '',
            source: first.source || '',
            short_text: first.short_text || '',
            is_inforce: first.is_inforce,
        });
        setShowForm(true);
    };

    const openAddModal = (substationId) => {
        setSelectedSubstation(substationId);
        setEditingTagId('');
        setFormMode('create');
        setSourceMode(sources.length === 0 ? 'new' : 'existing');
        setSourceForm({ reference: '', source_file: null, issued_date: '', notes: '' });
        setFormData({ load_transformers: [], categories: [], severity_rank: '', source: '', short_text: '', is_inforce: true });
        setShowForm(true);
    };

    const openEditTagModal = (tag) => {
        setSelectedSubstation(tag.substation);
        setEditingTagId(tag.id);
        setFormMode('edit');
        setSourceMode('existing');
        setSourceForm({ reference: '', url: '', issued_date: '', notes: '' });
        setFormData({
            load_transformers: [tag.load_transformer],
            categories: [tag.category],
            severity_rank: tag.severity_rank || '',
            source: tag.source || '',
            short_text: tag.short_text || '',
            is_inforce: tag.is_inforce,
        });
        setShowForm(true);
    };

    const selectedSubstationTags = selectedSubstation ? (grouped[selectedSubstation] || []) : [];

    const detailTags = detailModal ? (grouped[detailModal] || []) : [];

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Critical Substations</h2>
                <button className="btn-primary" onClick={() => { setFormMode('create'); setShowForm(true); }}>
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
                            onOpen={() => setDetailModal(subId)}
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
                                <h3 style={{ margin: 0 }}>{formMode === 'edit' ? 'Edit Critical Tag' : 'New Critical Tag'}</h3>
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

                                {formMode === 'edit' && selectedSubstationTags.length > 0 && (
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
                                                        load_transformers: [tag.load_transformer],
                                                        categories: [tag.category],
                                                        severity_rank: tag.severity_rank || '',
                                                        source: tag.source || '',
                                                        short_text: tag.short_text || '',
                                                        is_inforce: tag.is_inforce,
                                                    });
                                                }
                                            }}
                                        >
                                        {selectedSubstationTags.map(tag => (
                                            <option key={tag.id} value={tag.id}>
                                                {formatBayTagLabel(tag.load_transformer_bay_id, tag.load_transformer_lv_voltage)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Load Transformer Bays</label>
                                    <div style={{
                                        maxHeight: '180px',
                                        overflowY: 'auto',
                                        padding: '0.5rem',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        background: 'rgba(0,0,0,0.2)'
                                    }}>
                                        {loadTransformers.map((lt) => {
                                            const checked = formData.load_transformers.includes(lt.id);
                                            return (
                                                <label key={lt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.25rem 0' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFormData({ ...formData, load_transformers: [...formData.load_transformers, lt.id] });
                                                            } else {
                                                                setFormData({ ...formData, load_transformers: formData.load_transformers.filter(id => id !== lt.id) });
                                                            }
                                                        }}
                                                    />
                                                    <span className="mono" style={{ color: '#fff' }}>{lt.bay_id}</span>
                                                    <span style={{ opacity: 0.7 }}>{lt.lv_voltage ? `${lt.lv_voltage}kV` : ''}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {formMode === 'edit' && formData.load_transformers.length > 1 && (
                                        <div style={{ marginTop: '0.5rem', color: '#ff9f43', fontSize: '0.75rem' }}>
                                            Edit mode supports one bay at a time. Extra selections will be ignored.
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Categories</label>
                                    <div style={{
                                        maxHeight: '160px',
                                        overflowY: 'auto',
                                        padding: '0.5rem',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        background: 'rgba(0,0,0,0.2)'
                                    }}>
                                        {categories.map((cat) => {
                                            const checked = formData.categories.includes(cat.id);
                                            return (
                                                <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.25rem 0' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFormData({ ...formData, categories: [...formData.categories, cat.id] });
                                                            } else {
                                                                setFormData({ ...formData, categories: formData.categories.filter(id => id !== cat.id) });
                                                            }
                                                        }}
                                                    />
                                                    <span style={{ color: '#fff' }}>{cat.category_name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {formMode === 'edit' && formData.categories.length > 1 && (
                                        <div style={{ marginTop: '0.5rem', color: '#ff9f43', fontSize: '0.75rem' }}>
                                            Edit mode supports one category at a time. Extra selections will be ignored.
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Severity Rank</label>
                                    <input className="input-field" type="number" value={formData.severity_rank} onChange={(e) => setFormData({ ...formData, severity_rank: e.target.value })} />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Short Note</label>
                                    <input className="input-field" value={formData.short_text} onChange={(e) => setFormData({ ...formData, short_text: e.target.value })} placeholder="e.g. Hospital feeder" />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Source</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={() => setSourceMode('existing')}
                                                style={{ padding: '2px 8px', fontSize: '0.7rem', borderRadius: '999px', opacity: sourceMode === 'existing' ? 1 : 0.6 }}
                                            >
                                                Use Existing
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={() => setSourceMode('new')}
                                                style={{ padding: '2px 8px', fontSize: '0.7rem', borderRadius: '999px', opacity: sourceMode === 'new' ? 1 : 0.6 }}
                                            >
                                                Create New
                                            </button>
                                        </div>
                                    </div>

                                    {sourceMode === 'existing' && (
                                        <select className="input-field" value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })}>
                                            <option value="">Select...</option>
                                            {sources.map(src => (
                                                <option key={src.id} value={src.id}>{src.reference}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {sourceMode === 'new' && (
                                    <>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Reference</label>
                                            <input className="input-field" value={sourceForm.reference} onChange={(e) => setSourceForm({ ...sourceForm, reference: e.target.value })} placeholder="Doc ID / Memo / Ticket" />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Evidence File</label>
                                            <input className="input-field" type="file" onChange={(e) => setSourceForm({ ...sourceForm, source_file: e.target.files[0] || null })} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Issued Date</label>
                                            <input className="input-field" type="date" value={sourceForm.issued_date} onChange={(e) => setSourceForm({ ...sourceForm, issued_date: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Notes</label>
                                            <input className="input-field" value={sourceForm.notes} onChange={(e) => setSourceForm({ ...sourceForm, notes: e.target.value })} />
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>In Force</label>
                                    <select className="input-field" value={formData.is_inforce ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, is_inforce: e.target.value === 'true' })}>
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                    </select>
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

            <AnimatePresence>
                {detailModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.75)',
                            zIndex: 2100,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2rem'
                        }}
                        onClick={() => setDetailModal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card"
                            style={{ maxWidth: '920px', width: '100%', padding: '1.5rem' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>{detailModal} Critical Tags</h3>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        {substationLookup[detailModal]?.name || detailModal}
                                    </div>
                                </div>
                                <button onClick={() => setDetailModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>
                                    <X />
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                                <button className="btn-primary" onClick={() => { setDetailModal(null); openAddModal(detailModal); }}>
                                    <PlusCircle size={16} style={{ marginRight: '6px' }} /> Add Bay Tag
                                </button>
                                <button className="btn-secondary" onClick={() => { setDetailModal(null); openEditModal(detailModal); }}>
                                    <Edit2 size={16} style={{ marginRight: '6px' }} /> Edit Tags
                                </button>
                                <button className="btn-secondary" onClick={() => handleDeactivateAll(detailModal)} style={{ marginLeft: 'auto', color: '#ff3b30', borderColor: 'rgba(255,59,48,0.4)' }}>
                                    <Trash2 size={16} style={{ marginRight: '6px' }} /> Deactivate All
                                </button>
                            </div>

                            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'left' }}>
                                            <th style={{ padding: '0.6rem' }}>Bay</th>
                                            <th style={{ padding: '0.6rem' }}>Category</th>
                                            <th style={{ padding: '0.6rem' }}>Note</th>
                                            <th style={{ padding: '0.6rem' }}>Source</th>
                                            <th style={{ padding: '0.6rem' }}>File</th>
                                            <th style={{ padding: '0.6rem' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detailTags.map(tag => (
                                            <tr key={tag.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '0.6rem' }}>
                                                    <span style={tagPillStyle}>
                                                        {formatBayTagLabel(tag.load_transformer_bay_id, tag.load_transformer_lv_voltage)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.6rem' }}>
                                                    <span style={tagPillStyle}>{tag.category_name}</span>
                                                </td>
                                                <td style={{ padding: '0.6rem' }}>{tag.short_text || ''}</td>
                                                <td style={{ padding: '0.6rem' }}>{tag.source_reference || ''}</td>
                                                <td style={{ padding: '0.6rem' }}>
                                                    {tag.source ? (
                                                        <a
                                                            href={tag.source_file || '#'}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{ color: '#ff9f43', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                        >
                                                            <FileText size={14} />
                                                        </a>
                                                    ) : ''}
                                                </td>
                                                <td style={{ padding: '0.6rem', color: tag.is_inforce ? '#10b981' : '#ef4444' }}>
                                                    {tag.is_inforce ? 'Active' : 'Inactive'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CriticalSubstationManager;
