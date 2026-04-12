import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, X, Save, FileText, Trash2, Edit2, LayoutGrid, BarChart2, MapPin, ShieldAlert, Info } from 'lucide-react';
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

const InfoTip = ({ text, direction = 'up' }) => {
    const [visible, setVisible] = React.useState(false);
    const isDown = direction === 'down';
    return (
        <span
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '4px', verticalAlign: 'middle' }}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <Info size={11} color="#cbd5e1" style={{ cursor: 'help', flexShrink: 0 }} />
            {visible && (
                <span style={{
                    position: 'absolute',
                    ...(isDown ? { top: 'calc(100% + 6px)' } : { bottom: 'calc(100% + 6px)' }),
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#1e293b',
                    color: '#f1f5f9',
                    fontSize: '0.72rem',
                    fontWeight: 400,
                    lineHeight: '1.55',
                    letterSpacing: 'normal',
                    textTransform: 'none',
                    fontFamily: "'Poppins', sans-serif",
                    padding: '7px 10px',
                    borderRadius: '7px',
                    whiteSpace: 'pre-line',
                    width: '220px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                    zIndex: 9999,
                    pointerEvents: 'none',
                }}>
                    {text}
                    <span style={{
                        position: 'absolute',
                        ...(isDown ? { bottom: '100%', borderColor: 'transparent transparent #1e293b transparent' } : { top: '100%', borderColor: '#1e293b transparent transparent transparent' }),
                        left: '50%',
                        transform: 'translateX(-50%)',
                        borderWidth: '5px',
                        borderStyle: 'solid',
                    }} />
                </span>
            )}
        </span>
    );
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
        { id: 'assets', label: 'Critical Substations', icon: <LayoutGrid size={18} /> },
        { id: 'analysis', label: 'Analytics', icon: <BarChart2 size={18} /> },
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
        color: isActive ? 'var(--accent-blue)' : '#64748b',
        cursor: 'pointer',
        fontWeight: isActive ? '600' : '400',
        transition: 'all 0.2s ease',
        borderRadius: '8px 8px 0 0'
    });

    const FIXED_HEADER_STYLE = {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
        background: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        padding: '0.5rem 0 1rem 0'
    };
    const ICON_WRAP_STYLE = {
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
    };
    const TITLE_STYLE = {
        fontSize: '0.9rem',
        fontWeight: 700,
        fontFamily: "'Poppins', sans-serif",
        letterSpacing: '-0.01em'
    };
    const SUBTITLE_STYLE = {
        fontSize: '0.65rem',
        color: '#64748b',
        fontFamily: "'Poppins', sans-serif",
        marginTop: '1px'
    };
    const COUNT_STYLE = {
        fontSize: '0.65rem',
        fontWeight: 700,
        padding: '2px 10px',
        borderRadius: '20px',
        border: '1px solid'
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif" }}>

            {/* ROW 1: Tab Navigation — fixed, no scroll */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid #e2e8f0',
                flexShrink: 0,
                background: '#fff',
                padding: '0 2rem',
                zIndex: 20
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

            {/* ROW 2: Header — fixed, no scroll, changes per tab */}
            <div style={{ flexShrink: 0, zIndex: 10, padding: '1.25rem 2rem 0', display: activeTab === 'geo' ? 'none' : undefined }}>
                {status && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: status.type === 'success' ? '#10b981' : '#ef4444', border: `1px solid ${status.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` }}>
                        {status.msg}
                    </div>
                )}

                {activeTab === 'assets' && (
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', marginBottom: '0.75rem' }}>
                            <div>
                                <div style={{fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(30, 41, 59, 0.6)', marginBottom: '0.5rem' }}>Critical Substation Registry</div>
                                <h1 style={{ margin: 0, fontSize: '2.6rem', fontWeight: 600, color: '#0f172a', letterSpacing: '-0.03em' }}>Critical Substations</h1>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(30, 41, 59, 0.7)', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: '0.75rem'}}>{Object.keys(grouped).length} critical substations • All Regions</div>
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
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', marginBottom: '0.75rem' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(30, 41, 59, 0.6)', marginBottom: '0.5rem' }}>Analytics</div>
                                <h1 style={{ margin: 0, fontSize: '2.6rem', fontWeight: 600, color: '#0f172a', letterSpacing: '-0.03em' }}>Stats Overview</h1>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(30, 41, 59, 0.7)', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: '0.75rem'}}>{tags.length} critical customers • {Object.keys(grouped).length} critical substations</div>
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
                    </div>
                )}

            </div>

            {/* ROW 3: Scrollable content */}
            <div style={activeTab === 'geo' ? { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' } : { flex: 1, overflowY: 'auto', minHeight: 0, padding: '0.75rem 2rem 1.5rem' }} className={activeTab !== 'geo' ? 'custom-scrollbar' : undefined}>
                {activeTab === 'assets' && (
                    <>
                        {listDisplayMode === 'grid' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem', padding: '2px' }}>
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
                            <div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 0.6fr 0.8fr 2.5fr 100px',
                                    gap: '1rem',
                                    padding: '0.75rem 1.25rem',
                                    background: 'transparent',
                                    borderBottom: '1px solid #e2e8f0',
                                    position: 'sticky',
                                    top: '0.75rem',
                                    zIndex: 10,
                                }}>
                                    {['Substation', 'Voltage', 'Region', 'Critical Substations', 'Actions'].map((col, i) => (
                                        <div key={col} style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 4 ? 'right' : 'left' }}>
                                            {col}
                                        </div>
                                    ))}
                                </div>
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
                            <div style={{ color: '#64748b', textAlign: 'center', padding: '4rem 0' }}>
                                <div style={{ opacity: 0.5, marginBottom: '1rem' }}><LayoutGrid size={48} style={{ margin: '0 auto' }} /></div>
                                No critical substations found matching your criteria.
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'analysis' && (() => {
                    const totalSubs = substations.length;
                    const criticalSubIds = new Set(Object.keys(grouped));

                    const relayCount = substations.filter(s => criticalSubIds.has(s.substation_id) && s.has_active_relay).length;

                    // Regional coverage
                    const regionMap = {};
                    substations.forEach(s => {
                        const r = s.region || 'Unknown';
                        if (!regionMap[r]) regionMap[r] = { total: 0, critical: 0 };
                        regionMap[r].total++;
                        if (criticalSubIds.has(s.substation_id)) regionMap[r].critical++;
                    });
                    const regions = Object.entries(regionMap)
                        .filter(([, v]) => v.total > 0)
                        .sort((a, b) => (b[1].critical / b[1].total) - (a[1].critical / a[1].total));

                    // Sensitivity breakdown
                    const sensLabels = { 3: 'High', 2: 'Medium', 1: 'Low', 0: 'None' };
                    const sensColors = { 3: '#ef4444', 2: '#f97316', 1: '#eab308', 0: '#cbd5e1' };
                    const sensCounts = [3, 2, 1, 0].map(s => ({
                        label: sensLabels[s],
                        color: sensColors[s],
                        count: tags.filter(t => (t.sensitivity_impact === s || t.sensitivity_impact === String(s))).length,
                    }));
                    const sensTotal = tags.length || 1;

                    // Category breakdown
                    const catMap = {};
                    tags.forEach(t => {
                        const k = t.category_name || 'Uncategorised';
                        catMap[k] = (catMap[k] || 0) + 1;
                    });
                    const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
                    const catMax = catEntries[0]?.[1] || 1;


                    const statCard = (label, value, sub, color = '#0f172a', hint = null, tipDirection = 'up') => (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center' }}>
                                {label}{hint && <InfoTip text={hint} direction={tipDirection} />}
                            </div>
                            <div style={{ fontSize: '1.9rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                            {sub && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.3rem' }}>{sub}</div>}
                        </div>
                    );

                    const panelStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.1rem 1.25rem' };
                    const panelTitle = (t) => (
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.85rem', letterSpacing: '-0.01em' }}>{t}</div>
                    );

                    return (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            {/* Stat row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                {statCard('Critical Substations', criticalSubIds.size, `of ${totalSubs} total`)}
                                {statCard('Critical Customers', tags.length, `across ${criticalSubIds.size} substations`)}
                                {statCard('Relay Coverage', relayCount, 'with active relay', '#8b5cf6', 'Count of substations where has_active_relay is true.', 'down')}
                                {statCard('Coverage Rate', `${Math.round((criticalSubIds.size / (totalSubs || 1)) * 100)}%`, 'substations tagged critical', '#0ea5e9', 'Critical substations ÷ total substations × 100.', 'down')}
                            </div>

                            {/* Charts row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '0.75rem' }}>

                                {/* Regional coverage */}
                                <div style={panelStyle}>
                                    {panelTitle('Regional Coverage — Critical vs Total Substations')}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {regions.map(([region, { total, critical }]) => {
                                            const pct = Math.round((critical / total) * 100);
                                            return (
                                                <div key={region} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 70px', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ fontSize: '0.73rem', color: '#475569', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{region}</div>
                                                    <div style={{ position: 'relative', height: '8px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                                                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(total / (regions[0]?.[1].total || 1)) * 100}%`, background: '#e2e8f0', borderRadius: '99px' }} />
                                                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(critical / (regions[0]?.[1].total || 1)) * 100}%`, background: pct >= 50 ? '#ef4444' : pct >= 25 ? '#f97316' : '#ff9f43', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'right' }}>
                                                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{critical}</span>/{total}
                                                        <span style={{ marginLeft: '5px', fontSize: '0.65rem', color: pct >= 50 ? '#ef4444' : '#94a3b8' }}>({pct}%)</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {regions.length === 0 && <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No region data available.</div>}
                                    </div>
                                </div>

                                {/* Sensitivity donut */}
                                <div style={panelStyle}>
                                    {panelTitle('Sensitivity Breakdown')}
                                    {(() => {
                                        const r = 48, cx = 80, cy = 62, stroke = 18;
                                        const circumference = 2 * Math.PI * r;
                                        let offset = 0;
                                        const arcs = sensCounts.map(s => {
                                            const pct = s.count / sensTotal;
                                            const arc = { ...s, pct, dashArray: `${pct * circumference} ${circumference}`, dashOffset: -offset * circumference };
                                            offset += pct;
                                            return arc;
                                        });
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                                <svg width="160" height="124" viewBox="0 0 160 124">
                                                    {arcs.map((arc, i) => arc.count > 0 && (
                                                        <circle key={i} cx={cx} cy={cy} r={r}
                                                            fill="none" stroke={arc.color} strokeWidth={stroke}
                                                            strokeDasharray={arc.dashArray}
                                                            strokeDashoffset={arc.dashOffset}
                                                            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.5s ease' }}
                                                        />
                                                    ))}
                                                    <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: '15px', fontWeight: 700, fill: '#0f172a' }}>{tags.length}</text>
                                                    <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: '8px', fill: '#94a3b8' }}>total</text>
                                                </svg>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                                    {sensCounts.filter(s => s.count > 0).map(s => (
                                                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
                                                            <span style={{ fontSize: '0.7rem', color: '#475569', flex: 1 }}>{s.label}</span>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>{s.count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Bottom row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

                                {/* Category breakdown */}
                                <div style={panelStyle}>
                                    {panelTitle('Critical Customers by Category')}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                        {catEntries.length === 0 && <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No categories assigned.</div>}
                                        {catEntries.map(([cat, count]) => (
                                            <div key={cat} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '0.75rem' }}>
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                                        <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 500 }}>{cat}</span>
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a' }}>{count}</span>
                                                    </div>
                                                    <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${(count / catMax) * 100}%`, background: '#ff9f43', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>

                            {/* Load Shedding Scheme Design — Available Relay Substations */}
                            {(() => {
                                const lsRegionMap = {};
                                substations.forEach(s => {
                                    const r = s.region || 'Unknown';
                                    if (!lsRegionMap[r]) lsRegionMap[r] = { relay: 0, relayCritical: 0 };
                                    if (s.has_active_relay) {
                                        lsRegionMap[r].relay++;
                                        if (criticalSubIds.has(s.substation_id)) lsRegionMap[r].relayCritical++;
                                    }
                                });
                                const lsRows = Object.entries(lsRegionMap)
                                    .filter(([, v]) => v.relay > 0)
                                    .sort((a, b) => (b[1].relay - b[1].relayCritical) - (a[1].relay - a[1].relayCritical));
                                const maxRelay = Math.max(...lsRows.map(([, v]) => v.relay), 1);
                                const totalRelay = lsRows.reduce((s, [, v]) => s + v.relay, 0);
                                const totalCritRelay = lsRows.reduce((s, [, v]) => s + v.relayCritical, 0);
                                const totalAvailable = totalRelay - totalCritRelay;

                                return (
                                    <div style={{ ...panelStyle, marginTop: '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <div>
                                                {panelTitle('Load Shedding Scheme — Available Relay Substations by Region')}
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '-0.5rem', marginBottom: '0.85rem' }}>
                                                    Relay-installed substations minus those identified as critical — available headroom for load shedding design
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                                {[
                                                    { label: 'Total Relay Subs', value: totalRelay, color: '#0f172a' },
                                                    { label: 'Critical (excluded)', value: totalCritRelay, color: '#ef4444' },
                                                    { label: 'Available', value: totalAvailable, color: '#047d60' },
                                                ].map(({ label, value, color }) => (
                                                    <div key={label} style={{ textAlign: 'center', padding: '0.5rem 0.9rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '80px' }}>
                                                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                                                        <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '3px', whiteSpace: 'nowrap' }}>{label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Table header */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px 70px 70px 80px', gap: '0.75rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                                            {['Region', 'Relay substations', 'Relay', 'Critical', 'Available', 'Headroom'].map((h, i) => (
                                                <div key={h} style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i >= 2 ? 'center' : 'left' }}>{h}</div>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                            {lsRows.length === 0 && (
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem 0' }}>No relay substations found.</div>
                                            )}
                                            {lsRows.map(([region, { relay, relayCritical }]) => {
                                                const available = relay - relayCritical;
                                                const headroom = Math.round((available / relay) * 100);
                                                return (
                                                    <div key={region} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px 70px 70px 80px', gap: '0.75rem', alignItems: 'center' }}>
                                                        <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{region}</div>
                                                        <div style={{ position: 'relative', height: '10px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                                                            {/* total relay bar */}
                                                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(relay / maxRelay) * 100}%`, background: '#e2e8f0', borderRadius: '99px' }} />
                                                            {/* available bar */}
                                                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(available / maxRelay) * 100}%`, background: headroom >= 75 ? '#047d60' : headroom >= 40 ? '#ff9f43' : '#ef4444', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                                                            {/* critical overlay */}
                                                            <div style={{ position: 'absolute', left: `${(available / maxRelay) * 100}%`, top: 0, height: '100%', width: `${(relayCritical / maxRelay) * 100}%`, background: 'rgba(239,68,68,0.35)', borderRadius: '0 99px 99px 0' }} />
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>{relay}</div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: '4px' }}>−{relayCritical}</span>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047d60', background: 'rgba(4,125,96,0.08)', padding: '2px 8px', borderRadius: '4px' }}>{available}</span>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: headroom >= 75 ? '#047d60' : headroom >= 40 ? '#f97316' : '#ef4444' }}>{headroom}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Load Shedding Scheme Design — MW headroom by region */}
                            {(() => {
                                const totalGridMw = substations.reduce((sum, s) => sum + (parseFloat(s.total_pload_mw) || 0), 0);
                                const mwRegionMap = {};
                                substations.forEach(s => {
                                    const r = s.region || 'Unknown';
                                    const mw = parseFloat(s.total_pload_mw) || 0;
                                    if (!mwRegionMap[r]) mwRegionMap[r] = { relayMw: 0, criticalRelayMw: 0 };
                                    if (s.has_active_relay) {
                                        mwRegionMap[r].relayMw += mw;
                                        if (criticalSubIds.has(s.substation_id)) mwRegionMap[r].criticalRelayMw += mw;
                                    }
                                });
                                const mwRows = Object.entries(mwRegionMap)
                                    .filter(([, v]) => v.relayMw > 0)
                                    .sort((a, b) => (b[1].relayMw - b[1].criticalRelayMw) - (a[1].relayMw - a[1].criticalRelayMw));
                                const maxMw = Math.max(...mwRows.map(([, v]) => v.relayMw), 1);
                                const totalRelayMw = mwRows.reduce((s, [, v]) => s + v.relayMw, 0);
                                const totalCritMw = mwRows.reduce((s, [, v]) => s + v.criticalRelayMw, 0);
                                const totalAvailMw = totalRelayMw - totalCritMw;
                                const fmw = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)} GW` : `${Math.round(v)} MW`;
                                const gridPct = (v) => totalGridMw > 0 ? `${((v / totalGridMw) * 100).toFixed(1)}%` : '—';

                                return (
                                    <div style={{ ...panelStyle, marginTop: '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <div>
                                                {panelTitle('Load Shedding Scheme — Available MW Headroom by Region')}
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '-0.5rem', marginBottom: '0.85rem' }}>
                                                    Load (MW) on relay substations minus load on critical substations — usable MW for load shedding design
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                                {[
                                                    { label: 'Total Grid MW', value: fmw(totalGridMw), color: '#0f172a' },
                                                    { label: 'Total Relay MW', value: fmw(totalRelayMw), color: '#475569' },
                                                    { label: 'Critical (excl.)', value: fmw(totalCritMw), color: '#ef4444' },
                                                    { label: 'Available MW', value: fmw(totalAvailMw), color: '#047d60' },
                                                    { label: '% of Grid', value: gridPct(totalAvailMw), color: '#0ea5e9' },
                                                ].map(({ label, value, color }) => (
                                                    <div key={label} style={{ textAlign: 'center', padding: '0.5rem 0.9rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '80px' }}>
                                                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                                                        <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '3px', whiteSpace: 'nowrap' }}>{label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Table header */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 90px 90px 75px 75px', gap: '0.65rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                                            {[
                                                { h: 'Region', i: 0 },
                                                { h: 'MW distribution', i: 1 },
                                                { h: 'Relay MW', i: 2, hint: 'Total snapshot load of all substations with a relay installed in this region.' },
                                                { h: 'Critical', i: 3, hint: 'Portion of relay load that belongs to substations tagged as critical — these are off-limits for load shedding.' },
                                                { h: 'Available', i: 4, hint: "What's actually left to work with: relay load minus the protected critical portion." },
                                                { h: '% of Relay', i: 5, hint: 'An internal efficiency metric — how constrained your relay pool is by critical subs. Low % means most of your relay capacity is locked up.' },
                                                { h: '% of Grid', i: 6, hint: "How much of the entire grid load this region's available headroom covers. Use this to compare regions and size system-level load shedding schemes." },
                                            ].map(({ h, i, hint }) => (
                                                <div key={h} style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i >= 2 ? 'center' : 'left', display: 'flex', alignItems: 'center', justifyContent: i >= 2 ? 'center' : 'flex-start' }}>
                                                    {h}{hint && <InfoTip text={hint} />}
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                            {mwRows.length === 0 && (
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem 0' }}>No MW data available. Ensure a network snapshot is loaded.</div>
                                            )}
                                            {mwRows.map(([region, { relayMw, criticalRelayMw }]) => {
                                                const availMw = relayMw - criticalRelayMw;
                                                const pctOfRelay = Math.round((availMw / relayMw) * 100);
                                                const pctOfGrid = totalGridMw > 0 ? ((availMw / totalGridMw) * 100).toFixed(1) : null;
                                                return (
                                                    <div key={region} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 90px 90px 75px 75px', gap: '0.65rem', alignItems: 'center' }}>
                                                        <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{region}</div>
                                                        <div style={{ position: 'relative', height: '10px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                                                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(relayMw / maxMw) * 100}%`, background: '#e2e8f0', borderRadius: '99px' }} />
                                                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(availMw / maxMw) * 100}%`, background: pctOfRelay >= 75 ? '#047d60' : pctOfRelay >= 40 ? '#ff9f43' : '#ef4444', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                                                            <div style={{ position: 'absolute', left: `${(availMw / maxMw) * 100}%`, top: 0, height: '100%', width: `${(criticalRelayMw / maxMw) * 100}%`, background: 'rgba(239,68,68,0.35)', borderRadius: '0 99px 99px 0' }} />
                                                        </div>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>{fmw(relayMw)}</div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 7px', borderRadius: '4px' }}>−{fmw(criticalRelayMw)}</span>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047d60', background: 'rgba(4,125,96,0.08)', padding: '2px 7px', borderRadius: '4px' }}>{fmw(availMw)}</span>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: pctOfRelay >= 75 ? '#047d60' : pctOfRelay >= 40 ? '#f97316' : '#ef4444' }}>{pctOfRelay}%</span>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0ea5e9' }}>{pctOfGrid !== null ? `${pctOfGrid}%` : '—'}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                        </motion.div>
                    );
                })()}

                {activeTab === 'geo' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'absolute', inset: 0 }}>

                        {/* Backdrop map */}
                        <div style={{ position: 'absolute', inset: 0, opacity: 0.9, filter: 'saturate(0.6) brightness(0.85)' }}>
                            <SubstationMap data={criticalSubstationsForMap} fuiMode={true} />
                        </div>

                        {/* Right-side panel stack */}
                        <div style={{
                            position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 10,
                            display: 'flex', flexDirection: 'column', gap: '10px', width: '220px',
                        }}>
                            {/* Title badge */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                background: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255,159,67,0.25)', borderRadius: '12px',
                                padding: '10px 14px',
                            }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(255,159,67,0.15)', border: '1px solid rgba(255,159,67,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <ShieldAlert size={15} color="#ff9f43" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>Critical Substations</div>
                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '1px' }}>Geographic distribution</div>
                                </div>
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#ff9f43', background: 'rgba(255,159,67,0.12)', border: '1px solid rgba(255,159,67,0.25)', padding: '2px 8px', borderRadius: '20px', flexShrink: 0 }}>
                                    {Object.keys(grouped).length}
                                </span>
                            </div>

                            {/* Region breakdown */}
                            {(() => {
                                const regionCounts = {};
                                criticalSubstationsForMap.forEach(s => {
                                    const r = s.region || 'Unknown';
                                    regionCounts[r] = (regionCounts[r] || 0) + 1;
                                });
                                const entries = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
                                return (
                                    <div style={{
                                        background: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                                        padding: '12px 14px',
                                    }}>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>By Region</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                            {entries.map(([region, count]) => (
                                                <div key={region} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ flex: 1, fontSize: '0.7rem', color: '#cbd5e1' }}>{region}</div>
                                                    <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '99px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${(count / entries[0][1]) * 100}%`, background: '#ff9f43', borderRadius: '99px' }} />
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ff9f43', minWidth: '14px', textAlign: 'right' }}>{count}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                    </motion.div>
                )}
            </div>

            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(15, 23, 42, 0.4)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 2000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '1rem',
                        }}
                        onClick={() => setShowForm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.97, y: 8, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.97, y: 8, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                maxWidth: '560px',
                                width: '100%',
                                background: '#fff',
                                borderRadius: '14px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                                display: 'flex',
                                flexDirection: 'column',
                                maxHeight: '90vh',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1rem 1.25rem',
                                borderBottom: '1px solid #f1f5f9',
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                                        {formMode === 'edit' ? 'Edit Critical Customer' : 'New Critical Customer'}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>
                                        {formMode === 'edit' ? 'Update the critical customer and their supplying load transformers' : 'Register a critical customer and the load transformers supplying them'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowForm(false)}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        color: '#94a3b8',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '5px',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8'; }}
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{ overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                                {/* Row 1: Substation + Category */}
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Substation</label>
                                        <select
                                            value={selectedSubstation}
                                            onChange={(e) => setSelectedSubstation(e.target.value)}
                                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '7px', color: '#0f172a', background: '#fff', outline: 'none' }}
                                        >
                                            <option value="">Select substation…</option>
                                            {substations.map(s => (
                                                <option key={s.substation_id} value={s.substation_id}>{s.substation_id} — {s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Category</label>
                                        <select
                                            value={formData.categories[0] || ''}
                                            onChange={(e) => setFormData({ ...formData, categories: [e.target.value] })}
                                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '7px', color: '#0f172a', background: '#fff', outline: 'none' }}
                                        >
                                            <option value="">Select category…</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Row 2: Asset Name + Sensitivity + Status */}
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Critical Customer</label>
                                        <input
                                            value={formData.asset}
                                            onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
                                            placeholder="e.g. TUDM Kuantan"
                                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '7px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Sensitivity</label>
                                        <select
                                            value={formData.sensitivity_impact}
                                            onChange={(e) => setFormData({ ...formData, sensitivity_impact: e.target.value })}
                                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '7px', color: '#0f172a', background: '#fff', outline: 'none' }}
                                        >
                                            <option value="">— None —</option>
                                            <option value="3">High</option>
                                            <option value="2">Medium</option>
                                            <option value="1">Low</option>
                                        </select>
                                    </div>
                                    <div style={{ paddingBottom: '1px' }}>
                                        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Status</label>
                                        <div
                                            onClick={() => setFormData({ ...formData, is_inforce: !formData.is_inforce })}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '7px',
                                                cursor: 'pointer',
                                                padding: '0.45rem 0.75rem',
                                                borderRadius: '7px',
                                                border: 'none',
                                                background: 'transparent',
                                                userSelect: 'none',
                                                transition: 'all 0.2s',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            <div style={{
                                                width: '28px', height: '16px',
                                                background: formData.is_inforce ? '#047d60' : '#cbd5e1',
                                                borderRadius: '99px',
                                                position: 'relative',
                                                transition: 'background 0.2s',
                                                flexShrink: 0,
                                            }}>
                                                <motion.div
                                                    animate={{ x: formData.is_inforce ? 13 : 1 }}
                                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                    style={{ position: 'absolute', top: '2px', width: '12px', height: '12px', background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                                                />
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: formData.is_inforce ? '#047d60' : '#94a3b8' }}>
                                                {formData.is_inforce ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3: Load Transformer Bays */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Load Transformer Bays</label>
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '0.35rem',
                                        maxHeight: '110px',
                                        overflowY: 'auto',
                                        padding: '0.5rem',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        background: '#f8fafc',
                                        alignItems: 'flex-start',
                                    }}>
                                        {loadTransformers.length === 0 ? (
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No load transformers available for this substation.</span>
                                        ) : loadTransformers.map((lt) => {
                                            const checked = formData.load_transformers.includes(lt.id);
                                            return (
                                                <label
                                                    key={lt.id}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.72rem',
                                                        fontFamily: 'monospace',
                                                        padding: '3px 8px',
                                                        borderRadius: '5px',
                                                        cursor: 'pointer',
                                                        background: checked ? 'rgba(4, 125, 96, 0.08)' : '#fff',
                                                        border: `1px solid ${checked ? 'rgba(4, 125, 96, 0.3)' : '#e2e8f0'}`,
                                                        color: checked ? '#047d60' : '#475569',
                                                        fontWeight: checked ? 600 : 400,
                                                        transition: 'all 0.15s',
                                                        userSelect: 'none',
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
                                                    {lt.bay_id}
                                                    {lt.lv_voltage && <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{lt.lv_voltage}kV</span>}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Row 4: Source Documentation */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                        <label style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source Documentation</label>
                                        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', gap: '2px' }}>
                                            {['existing', 'new'].map(mode => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => setSourceMode(mode)}
                                                    style={{
                                                        padding: '3px 10px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        background: sourceMode === mode ? '#fff' : 'transparent',
                                                        color: sourceMode === mode ? '#0f172a' : '#94a3b8',
                                                        boxShadow: sourceMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    {mode === 'existing' ? 'Existing' : 'Upload New'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {sourceMode === 'existing' ? (
                                        <select
                                            value={formData.source}
                                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '7px', color: '#0f172a', background: '#fff', outline: 'none' }}
                                        >
                                            <option value="">Select source document…</option>
                                            {sources.map(src => (
                                                <option key={src.id} value={src.id}>{src.source_file ? src.source_file.split('/').pop() : 'Unnamed Source'}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.75rem' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Issued Date</label>
                                                <input
                                                    type="date"
                                                    value={sourceForm.issued_date}
                                                    onChange={(e) => setSourceForm({ ...sourceForm, issued_date: e.target.value })}
                                                    style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '7px', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Document File</label>
                                                <input
                                                    type="file"
                                                    onChange={(e) => setSourceForm({ ...sourceForm, source_file: e.target.files[0] || null })}
                                                    style={{ width: '100%', padding: '0.4rem 0.65rem', fontSize: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '7px', color: '#475569', outline: 'none', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                            <div style={{ gridColumn: 'span 2' }}>
                                                <label style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Notes</label>
                                                <textarea
                                                    value={formData.notes}
                                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                    placeholder="Additional context…"
                                                    rows={2}
                                                    style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '7px', color: '#0f172a', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{
                                display: 'flex',
                                gap: '0.5rem',
                                padding: '0.75rem 1.25rem',
                                borderTop: '1px solid #f1f5f9',
                                background: '#fafafa',
                                flexShrink: 0,
                            }}>
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '0.5rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        background: '#ff9f43',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        opacity: loading ? 0.7 : 1,
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#f7921e'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#ff9f43'; }}
                                >
                                    <Save size={14} />
                                    {editingTagId ? 'Update Asset' : 'Save Asset'}
                                </button>
                                <button
                                    onClick={() => setShowForm(false)}
                                    style={{
                                        padding: '0.5rem 1.25rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        background: 'transparent',
                                        color: '#64748b',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                                >
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
