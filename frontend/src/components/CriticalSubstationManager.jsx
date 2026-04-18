import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, BarChart2, MapPin, ShieldAlert, Info } from 'lucide-react';
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

const InfoTip = ({ text, direction = 'up', align = 'center' }) => {
    const [visible, setVisible] = React.useState(false);
    const isDown = direction === 'down';
    const isLeft = align === 'left';
    const isRight = align === 'right';
    return (
        <span
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: isLeft ? '0' : '4px', marginRight: isRight ? '0' : '4px', verticalAlign: 'middle' }}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            <Info size={11} color="#cbd5e1" style={{ cursor: 'help', flexShrink: 0 }} />
            {visible && (
                <span style={{
                    position: 'absolute',
                    ...(isDown ? { top: 'calc(100% + 6px)' } : { bottom: 'calc(100% + 6px)' }),
                    ...(isLeft ? { left: 0 } : isRight ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }),
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
                        ...(isDown 
                            ? { bottom: '100%', borderColor: 'transparent transparent #1e293b transparent' }
                            : { top: '100%', borderColor: '#1e293b transparent transparent transparent' }),
                        ...(isLeft ? { left: '12px' } : isRight ? { right: '12px' } : { left: '50%', transform: 'translateX(-50%)' }),
                        borderWidth: '5px',
                        borderStyle: 'solid',
                    }} />
                </span>
            )}
        </span>
    );
};

const CriticalSubstationManager = ({ onEditSubstation }) => {
    const [tags, setTags] = useState([]);
    const [substations, setSubstations] = useState([]);
    const [categories, setCategories] = useState([]);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('assets');
    const [filterCriteria, setFilterCriteria] = useState(DEFAULT_FILTERS);
    const [listDisplayMode, setListDisplayMode] = useState('grid');

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [tagRes, subRes, catRes] = await Promise.all([
                api.get('/critical-assets/'),
                api.get('/substations/'),
                api.get('/critical-categories/'),
            ]);
            setTags(tagRes.data || []);
            setSubstations(subRes.data || []);
            setCategories(catRes.data || []);
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

        // Sort by substation_id
        const sortedKeys = Object.keys(map).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const sortedMap = {};
        sortedKeys.forEach(key => { sortedMap[key] = map[key]; });
        
        return sortedMap;
    }, [grouped, filteredSubstations]);

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
                                            onEditAsset={(tag) => onEditSubstation && onEditSubstation(tag.substation, tag.id)}
                                            onAddAsset={() => onEditSubstation && onEditSubstation(subId, 'new')}
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
                                            onEditAsset={(tag) => onEditSubstation && onEditSubstation(tag.substation, tag.id)}
                                            onAddAsset={() => onEditSubstation && onEditSubstation(subId, 'new')}
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
                                {statCard('% Network Tagged', `${Math.round((criticalSubIds.size / (totalSubs || 1)) * 100)}%`, 'of total substations', '#0ea5e9', 'Critical substations ÷ total substations × 100.', 'down')}
                            </div>

                            {/* Charts row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 220px', gap: '0.75rem' }}>

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
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        Relay-installed substations minus those identified as critical — available headroom for load shedding design
                                                        <InfoTip text="This metric only counts substations with an ACTIVE RELAY installed. It differs from 'Regional Coverage - Critical vs Total Substations' which counts ALL critical substations (with or without relay)." direction="down" />
                                                    </span>
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

                                        {/* Bar legend */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.5rem', marginBottom: '0.25rem', padding: '0 0.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <div style={{ width: '12px', height: '8px', background: '#e2e8f0', borderRadius: '2px' }} />
                                                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Total Relay</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <div style={{ width: '12px', height: '8px', background: '#047d60', borderRadius: '2px' }} />
                                                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Available</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <div style={{ width: '12px', height: '8px', background: 'rgba(239,68,68,0.35)', borderRadius: '2px' }} />
                                                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Critical (excluded)</span>
                                            </div>
                                        </div>

                                        {/* Table header */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px 70px 70px 80px', gap: '0.75rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                                            {[
                                                { h: 'Region', i: 0 },
                                                { h: 'Relay substations', i: 1, hint: null },
                                                { h: 'Relay', i: 2, hint: 'Total substations in region with an active relay installed.' },
                                                { h: 'Critical', i: 3, hint: 'Critical substations that also have an active relay. Differs from "Regional Coverage" which counts ALL critical subs (with or without relay).' },
                                                { h: 'Available', i: 4, hint: 'Relay substations minus critical ones = available for load shedding design.' },
                                                { h: 'Headroom', i: 5, hint: 'Percentage of relay capacity available for load shedding (Available ÷ Relay × 100).' },
                                            ].map(({ h, i, hint }) => (
                                                <div key={h} style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i >= 2 ? 'center' : 'left', display: 'flex', alignItems: 'center', justifyContent: i >= 2 ? 'center' : 'flex-start' }}>
                                                    {h}{hint && <InfoTip text={hint} />}
                                                </div>
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
                                                    { label: 'Total Grid MW', value: fmw(totalGridMw), color: '#0f172a', hint: 'Total load (MW) of all substations in the network from the current network snapshot.' },
                                                    { label: 'Total Relay MW', value: fmw(totalRelayMw), color: '#475569', hint: 'Total load (MW) of all substations that have an active relay installed.' },
                                                    { label: 'Critical (excl.)', value: fmw(totalCritMw), color: '#ef4444', hint: 'Load (MW) on substations that are both critical AND have an active relay — these are protected and excluded from load shedding.' },
                                                    { label: 'Available MW', value: fmw(totalAvailMw), color: '#047d60', hint: 'Total load that can be shed: Total Relay MW minus Critical (excluded) MW.' },
                                                    { label: '% of Grid', value: gridPct(totalAvailMw), color: '#0ea5e9', hint: 'What percentage of the entire grid load is available for load shedding.' },
                                                ].map(({ label, value, color, hint }) => (
                                                    <div key={label} style={{ textAlign: 'center', padding: '0.5rem 0.9rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '80px', position: 'relative' }}>
                                                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                                                        <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '3px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                                            {label}
                                                            {hint && label === '% of Grid' && <InfoTip text={hint} align="right" />}
                                                            {hint && label !== '% of Grid' && <InfoTip text={hint} />}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Bar legend */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.5rem', marginBottom: '0.25rem', padding: '0 0.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <div style={{ width: '12px', height: '8px', background: '#e2e8f0', borderRadius: '2px' }} />
                                                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Total Relay MW</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <div style={{ width: '12px', height: '8px', background: '#047d60', borderRadius: '2px' }} />
                                                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Available MW</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <div style={{ width: '12px', height: '8px', background: 'rgba(239,68,68,0.35)', borderRadius: '2px' }} />
                                                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Critical (excluded)</span>
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

        </div>
    );
};

export default CriticalSubstationManager;
