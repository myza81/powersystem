import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListFilter, X, Check, Search, ChevronDown } from 'lucide-react';

/**
 * SubstationSelectionPanel
 *
 * A FUI-styled floating panel that lets the user filter the geospatial map
 * to a specific subset of substations.
 *
 * Props:
 *   substations   - full array of substation objects
 *   selectedIds   - Set<string> of selected substation_id values / null 
 *   onChangeIds   - (newSet: Set<string> | null) => void
 *   showNetworkLines - boolean
 *   onToggleNetworkLines - (val: boolean) => void
 *   circuitDisplayMode - 'thickness' | 'multiple'
 *   onChangeCircuitDisplayMode - (val: string) => void
 */
const SubstationSelectionPanel = ({ 
    substations = [], 
    selectedIds, 
    onChangeIds,
    showNetworkLines = false,
    onToggleNetworkLines,
    circuitDisplayMode = 'thickness',
    onChangeCircuitDisplayMode
}) => {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('categories');

    // Category filter state (local to the panel)
    const [catRegion, setCatRegion] = useState('All');
    const [catState, setCatState] = useState('All');
    const [catGrid, setCatGrid] = useState('All');
    const [catOwnership, setCatOwnership] = useState('All');
    const [catVoltages, setCatVoltages] = useState(new Set()); // Empty Set = All

    // Individual tab search
    const [indSearch, setIndSearch] = useState('');

    // ── Derived options ──────────────────────────────────────────────────────
    const uniqueRegions = useMemo(() =>
        ['All', ...new Set(substations.map(s => s.region).filter(Boolean))].sort(),
        [substations]);

    const uniqueStates = useMemo(() =>
        ['All', ...new Set(substations.map(s => s.state).filter(Boolean))].sort(),
        [substations]);

    const uniqueGrids = useMemo(() =>
        ['All', ...new Set(substations.map(s => s.grid).filter(Boolean))].sort(),
        [substations]);

    const uniqueOwnerships = useMemo(() =>
        ['All', ...new Set(substations.map(s => s.ownership).filter(Boolean))].sort(),
        [substations]);

    const uniqueVoltages = useMemo(() => {
        const volts = new Set(substations.map(s => s.voltage).filter(v => v && v !== 230));
        return Array.from(volts).sort((a,b) => b - a);
    }, [substations]);

    // Substations matching current category filters
    const categoryMatches = useMemo(() =>
        substations.filter(s =>
            (catRegion === 'All' || s.region === catRegion) &&
            (catState === 'All' || s.state === catState) &&
            (catGrid === 'All' || s.grid === catGrid) &&
            (catOwnership === 'All' || s.ownership === catOwnership) &&
            (catVoltages.size === 0 || catVoltages.has(s.voltage))
        ),
        [substations, catRegion, catState, catGrid, catOwnership, catVoltages]);

    // Individual tab: substations filtered by search text
    const individualFiltered = useMemo(() => {
        const q = indSearch.toLowerCase();
        if (!q) return substations;
        return substations.filter(s =>
            (s.name || '').toLowerCase().includes(q) ||
            (s.substation_id || '').toLowerCase().includes(q)
        );
    }, [substations, indSearch]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const totalCount = substations.length;
    const activeCount = selectedIds === null ? totalCount : selectedIds.size;
    const isFiltered = selectedIds !== null;

    const applyCategories = () => {
        const newSet = new Set(categoryMatches.map(s => s.substation_id));
        onChangeIds(newSet);
    };

    const selectAll = () => onChangeIds(null);

    const clearAll = () => onChangeIds(new Set());

    const toggleIndividual = (id) => {
        // If in show-all mode (null), seed the set with ALL IDs first then toggle
        const base = selectedIds === null
            ? new Set(substations.map(s => s.substation_id))
            : new Set(selectedIds);
        if (base.has(id)) {
            base.delete(id);
        } else {
            base.add(id);
        }
        // If all are back, collapse to null (show-all mode)
        if (base.size === substations.length) {
            onChangeIds(null);
        } else {
            onChangeIds(base);
        }
    };

    const toggleCatVoltage = (v) => {
        const next = new Set(catVoltages);
        if (next.has(v)) next.delete(v);
        else next.add(v);
        setCatVoltages(next);
    };

    const isChecked = (id) => selectedIds === null || selectedIds.has(id);

    // ── Styles ───────────────────────────────────────────────────────────────
    const panelBase = {
        position: 'absolute',
        bottom: '46px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1001,
        width: '360px',
        background: 'rgba(15, 23, 42, 0.97)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0,229,255,0.3)',
        borderRadius: '14px',
        padding: '16px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
    };

    const tabBtn = (isActive) => ({
        background: 'none',
        border: 'none',
        padding: '0 0 4px 0',
        color: isActive ? '#00e5ff' : '#aaa',
        cursor: 'pointer',
        fontWeight: isActive ? 600 : 400,
        fontSize: '0.8rem',
        borderBottom: isActive ? '2px solid #00e5ff' : '2px solid transparent',
        transition: 'all 0.2s ease',
        fontFamily: 'Poppins, sans-serif',
    });

    const dropdownStyle = {
        width: '100%',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '6px',
        color: '#fff',
        padding: '6px 10px',
        fontSize: '0.75rem',
        cursor: 'pointer',
        outline: 'none',
        fontFamily: 'Poppins, sans-serif',
    };

    return (
        <div style={{ position: 'relative', paddingBottom: '10px' }}>
            {/* Icon-only Trigger Button */}
            <button
                onClick={() => setOpen(!open)}
                title="Filter Substations"
                style={{
                    background: isFiltered
                        ? 'rgba(0,229,255,0.15)'
                        : 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${isFiltered ? 'rgba(0,229,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: '8px',
                    padding: '8px',
                    color: isFiltered ? '#00e5ff' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    boxShadow: isFiltered ? '0 0 12px rgba(0,229,255,0.25)' : 'none',
                }}
            >
                <ListFilter size={18} />
                {/* Badge */}
                <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-8px',
                    background: isFiltered ? '#00e5ff' : 'rgba(255,255,255,0.2)',
                    color: isFiltered ? '#000' : '#fff',
                    borderRadius: '10px',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    padding: '1px 5px',
                    minWidth: '20px',
                    textAlign: 'center',
                    lineHeight: '1.4',
                    fontFamily: 'monospace',
                }}>
                    {activeCount}/{totalCount}
                </span>
            </button>

            {/* Expandable Panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.97 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        style={panelBase}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button style={tabBtn(activeTab === 'categories')} onClick={() => setActiveTab('categories')}>Categories</button>
                                <button style={tabBtn(activeTab === 'individual')} onClick={() => setActiveTab('individual')}>Individual</button>
                                <button style={tabBtn(activeTab === 'network')} onClick={() => setActiveTab('network')}>Network</button>
                            </div>
                            <X size={15} style={{ cursor: 'pointer', color: '#aaa' }} onClick={() => setOpen(false)} />
                        </div>

                        {/* ── CATEGORIES TAB ── */}
                        {activeTab === 'categories' && (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.65rem', color: 'rgba(0,229,255,0.7)', marginBottom: '4px', letterSpacing: '0.05em' }}>REGION</label>
                                        <select value={catRegion} onChange={e => setCatRegion(e.target.value)} style={dropdownStyle}>
                                            {uniqueRegions.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.65rem', color: 'rgba(0,229,255,0.7)', marginBottom: '4px', letterSpacing: '0.05em' }}>STATE</label>
                                        <select value={catState} onChange={e => setCatState(e.target.value)} style={dropdownStyle}>
                                            {uniqueStates.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.65rem', color: 'rgba(0,229,255,0.7)', marginBottom: '4px', letterSpacing: '0.05em' }}>GRID</label>
                                        <select value={catGrid} onChange={e => setCatGrid(e.target.value)} style={dropdownStyle}>
                                            {uniqueGrids.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.65rem', color: 'rgba(0,229,255,0.7)', marginBottom: '4px', letterSpacing: '0.05em' }}>OWNERSHIP</label>
                                        <select value={catOwnership} onChange={e => setCatOwnership(e.target.value)} style={dropdownStyle}>
                                            {uniqueOwnerships.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                                        <label style={{ display: 'block', fontSize: '0.65rem', color: 'rgba(0,229,255,0.7)', marginBottom: '8px', letterSpacing: '0.05em' }}>VOLTAGE LEVELS</label>
                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            {uniqueVoltages.map(v => (
                                                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                                    <div 
                                                        onClick={() => toggleCatVoltage(v)}
                                                        style={{
                                                            width: '14px',
                                                            height: '14px',
                                                            borderRadius: '3px',
                                                            border: `1px solid ${catVoltages.has(v) || catVoltages.size === 0 ? '#00e5ff' : 'rgba(255,255,255,0.3)'}`,
                                                            background: catVoltages.has(v) || catVoltages.size === 0 ? 'rgba(0,229,255,0.25)' : 'transparent',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.15s ease',
                                                        }}
                                                    >
                                                        {(catVoltages.has(v) || catVoltages.size === 0) && <Check size={10} color="#00e5ff" />}
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', color: '#fff' }} onClick={() => toggleCatVoltage(v)}>{v} kV</span>
                                                </label>
                                            ))}
                                            {catVoltages.size > 0 && (
                                                <button 
                                                    onClick={() => setCatVoltages(new Set())}
                                                    style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '0.65rem', cursor: 'pointer', padding: '0 4px', textDecoration: 'underline' }}
                                                >
                                                    Reset
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#aaa', marginBottom: '10px' }}>
                                    {categoryMatches.length} substation{categoryMatches.length !== 1 ? 's' : ''} match current filters
                                </div>
                                <button
                                    onClick={applyCategories}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0,229,255,0.12)',
                                        border: '1px solid rgba(0,229,255,0.4)',
                                        borderRadius: '6px',
                                        color: '#00e5ff',
                                        padding: '7px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s ease',
                                        fontFamily: 'Poppins, sans-serif',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,229,255,0.12)'}
                                >
                                    <Check size={13} /> Apply Filter to Map
                                </button>
                            </div>
                        )}

                        {/* ── INDIVIDUAL TAB ── */}
                        {activeTab === 'individual' && (
                            <div>
                                {/* Search box */}
                                <div style={{ position: 'relative', marginBottom: '10px' }}>
                                    <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by name or ID…"
                                        value={indSearch}
                                        onChange={e => setIndSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            paddingLeft: '28px',
                                            paddingRight: '8px',
                                            height: '32px',
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            fontSize: '0.75rem',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            fontFamily: 'Poppins, sans-serif',
                                        }}
                                    />
                                    {indSearch && (
                                        <X size={11} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', cursor: 'pointer' }} onClick={() => setIndSearch('')} />
                                    )}
                                </div>

                                {/* Checkbox list */}
                                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '12px' }}>
                                    {individualFiltered.length === 0 && (
                                        <div style={{ color: '#aaa', fontSize: '0.75rem', textAlign: 'center', padding: '20px 0' }}>No substations match "{indSearch}"</div>
                                    )}
                                    {individualFiltered.map(s => {
                                        const checked = isChecked(s.substation_id);
                                        return (
                                            <label
                                                key={s.substation_id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '5px 8px',
                                                    borderRadius: '5px',
                                                    cursor: 'pointer',
                                                    background: checked ? 'rgba(0,229,255,0.06)' : 'transparent',
                                                    transition: 'background 0.1s ease',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                onMouseLeave={e => e.currentTarget.style.background = checked ? 'rgba(0,229,255,0.06)' : 'transparent'}
                                            >
                                                <div
                                                    onClick={() => toggleIndividual(s.substation_id)}
                                                    style={{
                                                        width: '14px',
                                                        height: '14px',
                                                        borderRadius: '3px',
                                                        border: `1px solid ${checked ? '#00e5ff' : 'rgba(255,255,255,0.3)'}`,
                                                        background: checked ? 'rgba(0,229,255,0.25)' : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    {checked && <Check size={9} color="#00e5ff" />}
                                                </div>
                                                <div onClick={() => toggleIndividual(s.substation_id)} style={{ flex: 1, overflow: 'hidden' }}>
                                                    <div style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name || s.substation_id}</div>
                                                    <div style={{ fontSize: '0.62rem', color: '#aaa' }}>{s.substation_id} · {s.state}</div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>

                                <div style={{ fontSize: '0.65rem', color: '#aaa', marginBottom: '8px' }}>
                                    {indSearch ? `${individualFiltered.length} results` : `${totalCount} total`} · {activeCount} shown on map
                                </div>
                            </div>
                        )}

                        {/* ── NETWORK TAB ── */}
                        {activeTab === 'network' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '8px' }}>
                                
                                {/* Toggle Switch */}
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 500 }}>Grid Network Diagram</span>
                                        <span style={{ fontSize: '0.65rem', color: '#aaa' }}>Connects visible substations with lines</span>
                                    </div>
                                    <div style={{
                                        position: 'relative', width: '36px', height: '20px', 
                                        background: showNetworkLines ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.1)',
                                        borderRadius: '10px', transition: 'all 0.2s', border: `1px solid ${showNetworkLines ? '#00e5ff' : 'transparent'}`
                                    }} onClick={(e) => {
                                        e.preventDefault();
                                        if (onToggleNetworkLines) onToggleNetworkLines(!showNetworkLines);
                                    }}>
                                        <div style={{
                                            position: 'absolute', top: '2px', left: showNetworkLines ? '18px' : '2px',
                                            width: '14px', height: '14px', background: showNetworkLines ? '#00e5ff' : '#aaa',
                                            borderRadius: '50%', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                        }} />
                                    </div>
                                </label>

                                {/* Circuit Display Options */}
                                <div style={{ 
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px',
                                    opacity: showNetworkLines ? 1 : 0.5, pointerEvents: showNetworkLines ? 'auto' : 'none',
                                    transition: 'opacity 0.2s'
                                }}>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(0,229,255,0.8)', fontWeight: 600, letterSpacing: '0.05em' }}>CIRCUIT DISPLAY MODE</div>
                                    
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                                        <input 
                                            type="radio" 
                                            name="circuitMode" 
                                            value="thickness" 
                                            checked={circuitDisplayMode === 'thickness'}
                                            onChange={(e) => onChangeCircuitDisplayMode && onChangeCircuitDisplayMode(e.target.value)}
                                            style={{ marginTop: '2px', accentColor: '#00e5ff' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 500 }}>Dynamic Thickness</span>
                                            <span style={{ fontSize: '0.65rem', color: '#aaa' }}>Draw one line matching the total circuits</span>
                                        </div>
                                    </label>
                                    
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                                        <input 
                                            type="radio" 
                                            name="circuitMode" 
                                            value="multiple" 
                                            checked={circuitDisplayMode === 'multiple'}
                                            onChange={(e) => onChangeCircuitDisplayMode && onChangeCircuitDisplayMode(e.target.value)}
                                            style={{ marginTop: '2px', accentColor: '#00e5ff' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 500 }}>Multiple Offset Lines</span>
                                            <span style={{ fontSize: '0.65rem', color: '#aaa' }}>Draw parallel lines for each circuit</span>
                                        </div>
                                    </label>
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#facc15', marginTop: '-4px', fontStyle: 'italic', display: showNetworkLines ? 'block' : 'none' }}>
                                    Note: Enabling the network diagram hides the thermal heatmap.
                                </div>

                            </div>
                        )}

                        {/* Footer */}
                        {activeTab !== 'network' && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <button
                                    onClick={selectAll}
                                    style={{ background: 'none', border: 'none', color: '#00e5ff', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontFamily: 'Poppins, sans-serif' }}
                                >
                                    Show All
                                </button>
                                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>·</span>
                                <button
                                    onClick={clearAll}
                                    style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontFamily: 'Poppins, sans-serif' }}
                                >
                                    Hide All
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SubstationSelectionPanel;
