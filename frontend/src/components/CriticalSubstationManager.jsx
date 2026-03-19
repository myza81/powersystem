import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, X, Save, FileText, Trash2, Edit2, LayoutGrid, BarChart2, MapPin } from 'lucide-react';
import api from '../api';
import CriticalSubstationCard from './CriticalSubstationCard';
import CriticalSubstationListRow from './CriticalSubstationListRow';
import SubstationMap from './SubstationMap';
import SubstationFilter from './SubstationFilter';
import { BsGrid3X3GapFill, BsListUl } from 'react-icons/bs';

const DEFAULT_FILTERS = {
    region: 'All',
    grid: 'All',
    state: 'All',
    category: 'All',
    search: '',
    hasRelay: 'All',
    commissionYear: 'All',
    transformerYear: 'All'
};

const CriticalSubstationManager = () => {
    const [tags, setTags] = useState([]);
    const [substations, setSubstations] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sources, setSources] = useState([]);
    const [loadTransformers, setLoadTransformers] = useState([]);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('assets');
    const [filterCriteria, setFilterCriteria] = useState(DEFAULT_FILTERS);
    const [listDisplayMode, setListDisplayMode] = useState('grid');

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
        sensitivity_impact: '',
        source: '',
        asset: '',
        asset_id: '',
        notes: '',
        is_inforce: true,
    });

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [tagRes, subRes, catRes, srcRes] = await Promise.all([
                api.get('/critical-assets/'),
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
        if (status?.type === 'success') {
            const timer = setTimeout(() => {
                setStatus(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    useEffect(() => {
        if (sources.length === 0) {
            setSourceMode('new');
        }
    }, [sources.length]);

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
        tags.forEach(asset => {
            if (!asset.substation) return;
            if (!map[asset.substation]) map[asset.substation] = [];
            map[asset.substation].push(asset);
        });
        return map;
    }, [tags]);

    const substationLookup = useMemo(() => {
        const map = {};
        substations.forEach(s => { map[s.substation_id] = s; });
        return map;
    }, [substations]);

    // Apply Filters to substations
    const filteredSubstations = useMemo(() => {
        let result = substations;
        const { region, grid, state, category, search, hasRelay, commissionYear, transformerYear } = filterCriteria;

        if (region !== 'All') result = result.filter(s => s.region === region);
        if (grid !== 'All') result = result.filter(s => s.grid === grid);
        if (state !== 'All') result = result.filter(s => s.state === state);

        if (hasRelay === 'Active') {
            result = result.filter(s => s.has_active_relay === true);
        } else if (hasRelay === 'None') {
            result = result.filter(s => !s.has_active_relay);
        }

        if (commissionYear !== 'All') {
            result = result.filter(s => {
                if (!s.commission_date) return false;
                const year = new Date(s.commission_date).getFullYear();
                const [start, end] = commissionYear.split('-').map(Number);
                return year >= start && year <= end;
            });
        }

        if (transformerYear !== 'All') {
            if (transformerYear === 'None') {
                // EXCLUDE 275kV and above, and ONLY TNB ownership for "None" filter list
                result = result.filter(s =>
                    (s.transformer_commissioning_years || []).length === 0 &&
                    (s.voltage < 275 || !s.voltage) &&
                    s.ownership === 'TNB'
                );
            } else {
                const [start, end] = transformerYear.split('-').map(Number);
                result = result.filter(s => (s.transformer_commissioning_years || []).some(year => year >= start && year <= end));
            }
        }

        // Category filter: substation matches if it's "All" 
        // OR if it has at least one tag in the selected category
        if (category !== 'All') {
            result = result.filter(s => {
                const subTags = grouped[s.substation_id] || [];
                // Find matching category name in tags
                return subTags.some(t => {
                    const cat = categories.find(c => c.id === t.category);
                    return cat && cat.category_name === category;
                });
            });
        }

        if (search) {
            const lowSearch = search.toLowerCase();
            result = result.filter(s =>
                (s.name || '').toLowerCase().includes(lowSearch) ||
                (s.mnemonic || '').toLowerCase().includes(lowSearch) ||
                (s.substation_id || '').toLowerCase().includes(lowSearch)
            );
        }
        return [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [substations, filterCriteria, grouped, categories]);

    // Apply filters to grouped critical assets
    const filteredGrouped = useMemo(() => {
        const filteredSubIds = new Set(filteredSubstations.map(s => s.substation_id));
        const map = {};

        Object.keys(grouped).forEach(subId => {
            if (filteredSubIds.has(subId)) {
                map[subId] = grouped[subId];
            }
        });

        return map;
    }, [grouped, filteredSubstations]);

    const handleSave = async () => {
        console.log('--- handleSave triggered ---');
        console.log('Selected Substation:', selectedSubstation);
        console.log('Form Data:', formData);
        console.log('Source Mode:', sourceMode);
        console.log('Editing Tag ID:', editingTagId);

        if (!selectedSubstation) {
            console.warn('Blocked: No substation selected');
            setStatus({ type: 'error', msg: 'Select a substation.' });
            return;
        }
        if (!formData.load_transformers.length || !formData.categories.length) {
            console.warn('Blocked: Missing bay or category', { load_transformers: formData.load_transformers.length, categories: formData.categories.length });
            setStatus({ type: 'error', msg: 'Please select at least one bay and one category.' });
            return;
        }
        if (!formData.asset || !formData.asset.trim()) {
            console.warn('Blocked: Empty asset name');
            setStatus({ type: 'error', msg: 'Please enter an asset name.' });
            return;
        }

        setLoading(true);
        try {
            let sourceId = formData.source || null;

            // If user explicitly chose to upload a new source
            if (sourceMode === 'new' && sourceForm.source_file) {
                const sourcePayload = new FormData();
                sourcePayload.append('source_file', sourceForm.source_file);
                if (sourceForm.issued_date) {
                    sourcePayload.append('issued_date', sourceForm.issued_date);
                }
                const sourceRes = await api.post('/critical-sources/', sourcePayload, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                sourceId = sourceRes.data.id;
            }
            // If sourceMode is 'existing', sourceId is simply 'formData.source' which is already handled above.

            // 1. Create or Update the CriticalAsset with load_transformers array
            const assetPayload = {
                asset: formData.asset || '',
                substation: selectedSubstation,
                load_transformers: formData.load_transformers,
                category: formData.categories[0], // primary category
                sensitivity_impact: formData.sensitivity_impact ? parseInt(formData.sensitivity_impact, 10) : null,
                source: sourceId,
                notes: formData.notes,
                is_inforce: formData.is_inforce,
            };

            if (editingTagId && formData.asset_id) {
                // If editing an existing asset, patch it
                await api.patch(`/critical-assets/${formData.asset_id}/`, assetPayload);
                setStatus({ type: 'success', msg: 'Critical asset updated.' });
            } else {
                await api.post('/critical-assets/', assetPayload);
                setStatus({ type: 'success', msg: 'Critical asset created.' });
            }

            setShowForm(false);
            setEditingTagId('');
            setSourceMode(sources.length === 0 ? 'new' : 'existing');
            setSourceForm({ reference: '', source_file: null, issued_date: '' });
            setFormData({ load_transformers: [], categories: [], sensitivity_impact: '', source: '', asset: '', notes: '', is_inforce: true });
            fetchAll();
        } catch (err) {
            setStatus({ type: 'error', msg: 'Failed to create tag.' });
        }
        setLoading(false);
    };

    const openEditModal = (substationId) => {
        setStatus(null);
        const items = grouped[substationId] || [];
        if (!items.length) {
            setSelectedSubstation(substationId);
            setEditingTagId('');
            setFormMode('edit');
            setSourceMode(sources.length === 0 ? 'new' : 'existing');
            setSourceForm({ reference: '', source_file: null, issued_date: '' });
            setFormData({ load_transformers: [], categories: [], sensitivity_impact: '', source: '', asset: '', notes: '', is_inforce: true });
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
            load_transformers: first.load_transformers || [],
            categories: [first.category],
            sensitivity_impact: first.sensitivity_impact || '',
            source: first.source || '',
            asset: first.asset || '',
            asset_id: first.id || '',
            notes: first.notes || '',
            is_inforce: first.is_inforce,
        });
        setShowForm(true);
    };

    const openAddModal = (substationId) => {
        setStatus(null);
        setSelectedSubstation(substationId);
        setEditingTagId('');
        setFormMode('create');
        setSourceMode(sources.length === 0 ? 'new' : 'existing');
        setSourceForm({ reference: '', source_file: null, issued_date: '', notes: '' });
        setFormData({
            load_transformers: [],
            categories: [],
            sensitivity_impact: '',
            source: '',
            asset: '',
            asset_id: '',
            notes: '',
            is_inforce: true
        });
        setShowForm(true);
    };

    const openEditTagModal = (tag) => {
        setStatus(null);
        setSelectedSubstation(tag.substation);
        setEditingTagId(tag.id);
        setFormMode('edit');
        setSourceMode('existing');
        setSourceForm({ reference: '', url: '', issued_date: '', notes: '' });
        setFormData({
            load_transformers: tag.load_transformers || [],
            categories: [tag.category],
            sensitivity_impact: tag.sensitivity_impact || '',
            source: tag.source || '',
            asset: tag.asset || '',
            asset_id: tag.id || '',
            notes: tag.notes || '',
            is_inforce: tag.is_inforce,
        });
        setShowForm(true);
    };

    const selectedSubstationTags = selectedSubstation ? (grouped[selectedSubstation] || []) : [];

    // Filter substations for the map (only those with critical assets)
    const criticalSubstationsForMap = useMemo(() => {
        return Object.keys(grouped).map(subId => {
            const sub = substationLookup[subId];
            if (!sub) return null;
            return {
                ...sub,
                load_mw: grouped[subId].reduce((acc, t) => acc + (t.load_data?.pload_mw || 0), 0)
            };
        }).filter(Boolean);
    }, [grouped, substationLookup]);

    const tabList = [
        { id: 'assets', label: 'Critical Assets', icon: <LayoutGrid size={18} /> },
        { id: 'analysis', label: 'Analysis', icon: <BarChart2 size={18} /> },
        { id: 'geo', label: 'Geo Location', icon: <MapPin size={18} /> }
    ];

    const tabButtonStyle = (isActive) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0.75rem 1.5rem',
        background: isActive ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
        border: 'none',
        borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
        color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontWeight: isActive ? '600' : '400',
        transition: 'all 0.2s ease',
        borderRadius: '8px 8px 0 0'
    });

    return (
        <div style={{ padding: '2rem' }}>
            {/* Tab Navigation */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '2rem'
            }}>
                {tabList.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={tabButtonStyle(activeTab === tab.id)}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {status && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px', background: status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: status.type === 'success' ? '#10b981' : '#ef4444', border: `1px solid ${status.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
                    {status.msg}
                </div>
            )}

            {activeTab === 'assets' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <SubstationFilter
                        substations={substations}
                        currentFilters={filterCriteria}
                        onUpdateFilters={setFilterCriteria}
                        onRegister={() => openAddModal('')}
                        extraLabel="Category"
                        extraValue={filterCriteria.category}
                        onExtraChange={(val) => setFilterCriteria(prev => ({ ...prev, category: val }))}
                        extraOptions={['All', ...categories.map(c => c.category_name)].sort()}
                        showVoltage={false}
                        viewMode={listDisplayMode}
                        onViewModeChange={setListDisplayMode}
                    />

                    {listDisplayMode === 'grid' ? (
                        <div className="substation-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                            <AnimatePresence>
                                {Object.keys(filteredGrouped).map(subId => (
                                    <CriticalSubstationCard
                                        key={subId}
                                        substation={substationLookup[subId] || { substation_id: subId, name: subId }}
                                        tags={filteredGrouped[subId]}
                                        allTransformers={loadTransformers}
                                        onEditAsset={openEditTagModal}
                                        onAddAsset={() => openAddModal(subId)}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div className="substation-list" style={{ display: 'flex', flexDirection: 'column' }}>
                            <AnimatePresence>
                                {Object.keys(filteredGrouped).map(subId => (
                                    <CriticalSubstationListRow
                                        key={subId}
                                        substation={substationLookup[subId] || { substation_id: subId, name: subId }}
                                        tags={filteredGrouped[subId]}
                                        onEditAsset={openEditTagModal}
                                        onAddAsset={() => openAddModal(subId)}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {Object.keys(filteredGrouped).length === 0 && !loading && (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', gridColumn: '1/-1', padding: '4rem 0' }}>
                            <div style={{ opacity: 0.5, marginBottom: '1rem' }}><LayoutGrid size={48} style={{ margin: '0 auto' }} /></div>
                            No critical substations found matching your criteria.
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'analysis' && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card"
                    style={{ padding: '2rem' }}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
                        <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Total Critical Substations</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{Object.keys(grouped).length}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Total Critical Assets</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{tags.length}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Active Enforcement</div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f59e0b' }}>{tags.filter(t => t.is_inforce).length}</div>
                        </div>
                    </div>
                </motion.div>
            )}

            {activeTab === 'geo' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ height: '700px', borderRadius: '16px', overflow: 'hidden' }}
                >
                    <SubstationMap data={criticalSubstationsForMap} />
                </motion.div>
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
                            padding: '1rem',
                            overflowY: 'auto'
                        }}
                        onClick={() => setShowForm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card form-container"
                            style={{
                                maxWidth: '720px',
                                width: '100%',
                                padding: '1.5rem',
                                maxHeight: '90vh',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0 }}>{formMode === 'edit' ? 'Edit Critical Asset' : 'New Critical Asset'}</h3>
                                <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{
                                overflowY: 'auto',
                                paddingRight: '0.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
                                    <div style={{ gridColumn: 'span 3' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Substation</label>
                                        <select className="input-field" value={selectedSubstation} onChange={(e) => setSelectedSubstation(e.target.value)}>
                                            <option value="">Select...</option>
                                            {substations.map(s => (
                                                <option key={s.substation_id} value={s.substation_id}>{s.substation_id} - {s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ gridColumn: 'span 3' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Category</label>
                                        <select
                                            className="input-field"
                                            value={formData.categories[0] || ''}
                                            onChange={(e) => setFormData({ ...formData, categories: [e.target.value] })}
                                        >
                                            <option value="">Select a Category...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ gridColumn: 'span 6' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Load Transformer Bays</label>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '0.4rem',
                                            maxHeight: '180px',
                                            overflowY: 'auto',
                                            padding: '0.4rem',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '8px',
                                            background: 'rgba(0,0,0,0.2)',
                                            alignItems: 'flex-start'
                                        }}>
                                            {loadTransformers.length === 0 && (
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic', width: '100%' }}>No load transformers available for this substation.</div>
                                            )}
                                            {loadTransformers.map((lt) => {
                                                const checked = formData.load_transformers.includes(lt.id);
                                                return (
                                                    <label
                                                        key={lt.id}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem',
                                                            fontSize: '0.7rem',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '999px',
                                                            cursor: 'pointer',
                                                            background: checked ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                            border: `1px solid ${checked ? 'rgba(76, 175, 80, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                                                            color: checked ? '#fff' : 'var(--text-secondary)',
                                                            transition: 'all 0.2s',
                                                            userSelect: 'none'
                                                        }}
                                                    >
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
                                                            style={{ display: 'none' }}
                                                        />
                                                        <span className="mono">{lt.bay_id}</span>
                                                        {lt.lv_voltage && <span style={{ opacity: checked ? 0.9 : 0.6, fontSize: '0.7rem' }}>{lt.lv_voltage}kV</span>}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Asset Name</label>
                                        <input className="input-field" value={formData.asset} onChange={(e) => setFormData({ ...formData, asset: e.target.value })} placeholder="e.g. TUDM Kuantan" />
                                    </div>

                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Sensitivity Impact</label>
                                        <select className="input-field" value={formData.sensitivity_impact} onChange={(e) => setFormData({ ...formData, sensitivity_impact: e.target.value })}>
                                            <option value="">Select Impact...</option>
                                            <option value="3">Critical (High Intensity)</option>
                                            <option value="2">Major (Medium Intensity)</option>
                                            <option value="1">Minor (Low Intensity)</option>
                                        </select>
                                    </div>

                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Status</label>
                                        <div style={{ display: 'flex', alignItems: 'center', height: '42px', gap: '10px' }}>
                                            <div
                                                onClick={() => setFormData({ ...formData, is_inforce: !formData.is_inforce })}
                                                style={{
                                                    width: '40px',
                                                    height: '20px',
                                                    background: formData.is_inforce ? 'rgba(76, 175, 80, 0.4)' : 'rgba(255,255,255,0.1)',
                                                    borderRadius: '20px',
                                                    padding: '2px',
                                                    cursor: 'pointer',
                                                    position: 'relative',
                                                    border: `1px solid ${formData.is_inforce ? 'rgba(76, 175, 80, 0.5)' : 'rgba(255,255,255,0.2)'}`,
                                                    transition: 'all 0.3s'
                                                }}
                                            >
                                                <motion.div
                                                    animate={{ x: formData.is_inforce ? 20 : 0 }}
                                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                    style={{
                                                        width: '14px',
                                                        height: '14px',
                                                        background: '#fff',
                                                        borderRadius: '50%',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                    }}
                                                />
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: formData.is_inforce ? '#fff' : 'var(--text-secondary)', fontWeight: 500 }}>
                                                {formData.is_inforce ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ gridColumn: 'span 6' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Source Documentation</label>

                                            {/* Redesigned Toggle Group */}
                                            <div style={{
                                                display: 'flex',
                                                background: 'rgba(0,0,0,0.3)',
                                                padding: '4px',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                width: 'fit-content'
                                            }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setSourceMode('existing')}
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        fontSize: '0.8rem',
                                                        borderRadius: '6px',
                                                        background: sourceMode === 'existing' ? 'rgba(33, 150, 243, 0.2)' : 'transparent',
                                                        color: sourceMode === 'existing' ? '#fff' : 'var(--text-secondary)',
                                                        border: `1px solid ${sourceMode === 'existing' ? 'rgba(33, 150, 243, 0.5)' : 'transparent'}`,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        fontWeight: sourceMode === 'existing' ? 500 : 400
                                                    }}
                                                >
                                                    Select Existing
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSourceMode('new')}
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        fontSize: '0.8rem',
                                                        borderRadius: '6px',
                                                        background: sourceMode === 'new' ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
                                                        color: sourceMode === 'new' ? '#fff' : 'var(--text-secondary)',
                                                        border: `1px solid ${sourceMode === 'new' ? 'rgba(76, 175, 80, 0.5)' : 'transparent'}`,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        fontWeight: sourceMode === 'new' ? 500 : 400
                                                    }}
                                                >
                                                    Upload New Default
                                                </button>
                                            </div>
                                        </div>

                                        {sourceMode === 'existing' && (
                                            <select className="input-field" value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })}>
                                                <option value="">Select...</option>
                                                {sources.map(src => (
                                                    <option key={src.id} value={src.id}>{src.source_file ? src.source_file.split('/').pop() : 'Unnamed Source'}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>


                                    {sourceMode === 'new' && (
                                        <>
                                            <div style={{ gridColumn: 'span 2' }}>
                                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Issued Date</label>
                                                <input className="input-field" type="date" value={sourceForm.issued_date} onChange={(e) => setSourceForm({ ...sourceForm, issued_date: e.target.value })} />
                                            </div>
                                            <div style={{ gridColumn: 'span 4' }}>
                                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Supported Document</label>
                                                <input className="input-field" type="file" onChange={(e) => setSourceForm({ ...sourceForm, source_file: e.target.files[0] || null })} style={{ paddingTop: '8px' }} />
                                            </div>
                                            <div style={{ gridColumn: 'span 6' }}>
                                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Notes</label>
                                                <textarea
                                                    className="input-field"
                                                    value={formData.notes}
                                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                    placeholder="Enter additional details or context about this critical asset..."
                                                    rows={4}
                                                    style={{ minHeight: '120px', resize: 'vertical' }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexShrink: 0 }}>
                                <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Save size={16} /> {editingTagId ? 'Update Asset' : 'Save Asset'}
                                </button>
                                <button className="btn-secondary" onClick={() => setShowForm(false)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
