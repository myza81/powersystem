import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Search, X, PlusCircle, SlidersHorizontal, Building2 } from 'lucide-react';
import { BsGrid3X3GapFill, BsListUl } from 'react-icons/bs';
import React from 'react';

const SubstationFilter = ({
    substations,
    currentFilters,
    onUpdateFilters,
    onRegister,
    pageTitle = 'Substation Assets',
    resultCount,
    extraLabel = 'Ownership',
    extraValue,
    onExtraChange,
    extraOptions = null,
    secondaryExtraLabel = null,
    secondaryExtraValue,
    onSecondaryExtraChange,
    secondaryExtraOptions = null,
    showVoltage = true,
    showRelayFilter = true,
    viewMode = 'grid',
    onViewModeChange,
    icon: Icon = Building2,
}) => {
    const [showFilters, setShowFilters] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const { region, grid, state, voltage, ownership, search, hasRelay, commissionYear, transformerYear } = currentFilters;
    const currentExtraValue = extraValue !== undefined ? extraValue : ownership;

    const getDecadeRange = (year) => {
        if (!year) return null;
        const startYear = Math.floor((year - 1) / 10) * 10 + 1;
        return `${startYear}-${startYear + 9}`;
    };

    const regions = useMemo(() =>
        ['All', ...new Set(substations
            .filter(s => (grid === 'All' || s.grid === grid) && (state === 'All' || s.state === state))
            .map(s => s.region).filter(Boolean))].sort()
    , [substations, grid, state]);

    const grids = useMemo(() =>
        ['All', ...new Set(substations
            .filter(s => (region === 'All' || s.region === region) && (state === 'All' || s.state === state))
            .map(s => s.grid).filter(Boolean))].sort()
    , [substations, region, state]);

    const states = useMemo(() =>
        ['All', ...new Set(substations
            .filter(s => (region === 'All' || s.region === region) && (grid === 'All' || s.grid === grid))
            .map(s => s.state).filter(Boolean))].sort()
    , [substations, region, grid]);

    const voltages = useMemo(() =>
        ['All', ...new Set(substations
            .filter(s =>
                (region === 'All' || s.region === region) &&
                (grid === 'All' || s.grid === grid) &&
                (state === 'All' || s.state === state))
            .map(s => s.voltage).filter(Boolean))].sort((a, b) => b - a)
    , [substations, region, grid, state]);

    const ownerships = useMemo(() =>
        extraOptions || ['All', ...new Set(substations.map(s => s.ownership).filter(Boolean))].sort()
    , [substations, extraOptions]);

    const decades = useMemo(() => {
        const years = substations.map(s => s.commission_date ? new Date(s.commission_date).getFullYear() : null).filter(Boolean);
        return ['All', ...new Set(years.map(getDecadeRange))].sort((a, b) => b.localeCompare(a));
    }, [substations]);

    const txDecades = useMemo(() => {
        const txYears = substations.flatMap(s => s.transformer_commissioning_years || []);
        return ['All', ...new Set(txYears.map(getDecadeRange))].sort((a, b) => b.localeCompare(a));
    }, [substations]);

    const updateFilter = (key, value) => onUpdateFilters({ ...currentFilters, [key]: value });

    const resetFilters = () => {
        onUpdateFilters({ region: 'All', grid: 'All', state: 'All', voltage: 'All', ownership: 'All', search: '', hasRelay: 'All', commissionYear: 'All', transformerYear: 'All' });
        if (onExtraChange) onExtraChange('All');
        if (onSecondaryExtraChange) onSecondaryExtraChange('All');
    };

    // Build active filter chips for display
    const activeChips = useMemo(() => {
        const chips = [];
        if (region !== 'All')            chips.push({ key: 'region',          label: region,          clear: () => updateFilter('region', 'All') });
        if (grid !== 'All')              chips.push({ key: 'grid',            label: grid,            clear: () => updateFilter('grid', 'All') });
        if (state !== 'All')             chips.push({ key: 'state',           label: state,           clear: () => updateFilter('state', 'All') });
        if (showVoltage && voltage != null && voltage !== 'All') chips.push({ key: 'voltage', label: `${voltage} kV`, clear: () => updateFilter('voltage', 'All') });
        if (currentExtraValue !== 'All') chips.push({ key: 'ownership',       label: currentExtraValue, clear: () => onExtraChange ? onExtraChange('All') : updateFilter('ownership', 'All') });
        if (secondaryExtraLabel && secondaryExtraValue !== undefined && secondaryExtraValue !== 'All') {
            chips.push({ key: 'secondaryExtra', label: `${secondaryExtraLabel}: ${secondaryExtraValue}`, clear: () => onSecondaryExtraChange?.('All') });
        }
        if (showRelayFilter && hasRelay !== 'All') chips.push({ key: 'hasRelay', label: `Relay: ${hasRelay}`, clear: () => updateFilter('hasRelay', 'All') });
        if (commissionYear !== 'All')    chips.push({ key: 'commissionYear',  label: `Built ${commissionYear}`, clear: () => updateFilter('commissionYear', 'All') });
        if (transformerYear !== 'All')   chips.push({ key: 'transformerYear', label: `TX ${transformerYear}`, clear: () => updateFilter('transformerYear', 'All') });
        return chips;
    }, [region, grid, state, voltage, currentExtraValue, secondaryExtraLabel, secondaryExtraValue, hasRelay, commissionYear, transformerYear, showRelayFilter]);

    const hasActiveFilters = activeChips.length > 0 || search !== '';

    return (
        <div style={{ flexShrink: 0, background: 'var(--surface-card)', borderBottom: '1px solid var(--border-default)' }}>

            {/* ── Command Bar ──────────────────────────────────────────────── */}
            <div style={{
                height: 52,
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0 1.5rem',
            }}>
                {/* Title + count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <Icon size={16} color="var(--brand-mid)" strokeWidth={2} />
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-1)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                        {pageTitle}
                    </span>
                    {resultCount !== undefined && (
                        <span style={{
                            background: 'var(--surface-raised)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 700,
                            color: 'var(--text-2)',
                            padding: '1px 8px',
                            whiteSpace: 'nowrap',
                        }}>
                            {resultCount.toLocaleString()}
                        </span>
                    )}
                </div>

                {/* Divider */}
                <div style={{ width: 1, height: 20, background: 'var(--border-default)', flexShrink: 0 }} />

                {/* Search — takes remaining space */}
                <div style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: 380 }}>
                    <Search size={14} color="var(--text-3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                        placeholder="Search name, ID, mnemonic…"
                        value={search}
                        onChange={e => updateFilter('search', e.target.value)}
                        className="filter-search-input"
                        style={{
                            paddingLeft: '2rem', paddingRight: search ? '2rem' : '0.75rem',
                            width: '100%', height: 34,
                            background: 'var(--surface-raised)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-1)',
                            outline: 'none',
                            fontSize: 'var(--text-sm)',
                            transition: 'border-color 0.15s',
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--brand-mid)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                    />
                    {search && (
                        <button onClick={() => updateFilter('search', '')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
                            <X size={13} />
                        </button>
                    )}
                </div>

                {/* Right-side actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginLeft: 'auto' }}>

                    {/* Filter toggle button */}
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            height: 34, padding: '0 12px',
                            background: showFilters ? 'rgba(4,125,96,0.08)' : (hasActiveFilters ? 'rgba(4,125,96,0.06)' : 'var(--surface-raised)'),
                            border: `1px solid ${showFilters || hasActiveFilters ? 'var(--brand-mid)' : 'var(--border-default)'}`,
                            borderRadius: 'var(--radius-sm)',
                            color: showFilters || hasActiveFilters ? 'var(--brand-dark)' : 'var(--text-2)',
                            cursor: 'pointer',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            transition: 'all 0.15s',
                        }}
                    >
                        <SlidersHorizontal size={13} />
                        Filters
                        {activeChips.length > 0 && (
                            <span style={{ background: 'var(--brand-mid)', color: '#fff', borderRadius: 'var(--radius-pill)', fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', lineHeight: 1.5 }}>
                                {activeChips.length}
                            </span>
                        )}
                    </button>

                    {/* View mode toggle */}
                    {onViewModeChange && (
                        <div style={{ display: 'flex', background: 'var(--surface-raised)', padding: 3, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                            <button onClick={() => onViewModeChange('grid')} title="Grid view" style={{ background: viewMode === 'grid' ? '#fff' : 'transparent', border: 'none', color: viewMode === 'grid' ? 'var(--brand-mid)' : 'var(--text-3)', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: viewMode === 'grid' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s' }}>
                                <BsGrid3X3GapFill size={14} />
                            </button>
                            <button onClick={() => onViewModeChange('list')} title="List view" style={{ background: viewMode === 'list' ? '#fff' : 'transparent', border: 'none', color: viewMode === 'list' ? 'var(--brand-mid)' : 'var(--text-3)', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s' }}>
                                <BsListUl size={15} />
                            </button>
                        </div>
                    )}

                    {/* Register */}
                    {onRegister && (
                        <button onClick={onRegister} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', background: 'var(--brand-gradient)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(2,64,49,0.18)', whiteSpace: 'nowrap', transition: 'filter 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
                            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                        >
                            <PlusCircle size={14} /> Register
                        </button>
                    )}
                </div>
            </div>

            {/* ── Active chips strip (visible when filters on but panel closed) ── */}
            <AnimatePresence>
                {!showFilters && activeChips.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ overflow: 'hidden', borderTop: '1px solid var(--border-subtle)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', padding: '0.4rem 1.5rem' }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Filtered by:</span>
                            {activeChips.map(chip => (
                                <button
                                    key={chip.key}
                                    onClick={chip.clear}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 10px', background: 'rgba(4,125,96,0.08)', border: '1px solid rgba(4,125,96,0.2)', borderRadius: 'var(--radius-pill)', color: 'var(--brand-dark)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', transition: 'background 0.12s', whiteSpace: 'nowrap' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(4,125,96,0.14)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(4,125,96,0.08)'}
                                >
                                    {chip.label}
                                    <X size={10} strokeWidth={2.5} />
                                </button>
                            ))}
                            <button onClick={resetFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', marginLeft: 2 }}>
                                <RotateCcw size={10} /> Clear all
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Filter panel (collapsible) ────────────────────────────────── */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        style={{ overflow: 'hidden', borderTop: '1px solid var(--border-subtle)' }}
                    >
                        <div style={{ padding: '0.75rem 1.5rem', background: 'var(--surface-raised)' }}>

                            {/* Basic filters row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem' }}>
                                <FilterDropdown label="Region"      value={region}            options={regions}    onChange={v => updateFilter('region', v)} />
                                <FilterDropdown label="Grid"        value={grid}              options={grids}      onChange={v => updateFilter('grid', v)} />
                                <FilterDropdown label="State"       value={state}             options={states}     onChange={v => updateFilter('state', v)} />
                                {showVoltage && <FilterDropdown label="Voltage" value={voltage} options={voltages} onChange={v => updateFilter('voltage', v)} suffix=" kV" />}
                                {!showAdvanced && <FilterDropdown label={extraLabel} value={currentExtraValue} options={ownerships} onChange={v => onExtraChange ? onExtraChange(v) : updateFilter('ownership', v)} />}

                                {/* Inline actions */}
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => setShowAdvanced(a => !a)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, height: 33, padding: '0 10px', background: showAdvanced ? 'rgba(4,125,96,0.1)' : '#fff', border: `1px solid ${showAdvanced ? 'var(--brand-mid)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', color: showAdvanced ? 'var(--brand-dark)' : 'var(--text-2)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                                    >
                                        <SlidersHorizontal size={11} />
                                        Advanced
                                    </button>
                                    {hasActiveFilters && (
                                        <button
                                            onClick={resetFilters}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4, height: 33, padding: '0 10px', background: '#fff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-2)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-danger)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                        >
                                            <RotateCcw size={11} /> Reset
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Advanced filters */}
                            <AnimatePresence>
                                {showAdvanced && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem', marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-subtle)' }}>
                                            <FilterDropdown label={extraLabel} value={currentExtraValue} options={ownerships} onChange={v => onExtraChange ? onExtraChange(v) : updateFilter('ownership', v)} />
                                            {secondaryExtraLabel && (
                                                <FilterDropdown
                                                    label={secondaryExtraLabel}
                                                    value={secondaryExtraValue || 'All'}
                                                    options={secondaryExtraOptions || ['All']}
                                                    onChange={v => onSecondaryExtraChange?.(v)}
                                                />
                                            )}
                                            {showRelayFilter && <FilterDropdown label="LS Relay" value={hasRelay || 'All'} options={['All', 'Active', 'None']} onChange={v => updateFilter('hasRelay', v)} />}
                                            <FilterDropdown label="Substation Built" value={commissionYear || 'All'} options={decades} onChange={v => updateFilter('commissionYear', v)} />
                                            <FilterDropdown label="TX Commissioned" value={transformerYear || 'All'} options={['All', 'None', ...txDecades.filter(y => y !== 'All')]} onChange={v => updateFilter('transformerYear', v)} />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const FilterDropdown = ({ label, value, options, onChange, disabled, suffix = '' }) => (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
        <label style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-3)', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            style={{ width: '100%', height: 33, padding: '0 8px', fontSize: 'var(--text-sm)', background: '#fff', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = 'var(--brand-mid)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
        >
            {options.map(opt => (
                <option key={opt} value={opt}>
                    {opt === 'All' ? `All ${label}s` : `${opt}${suffix}`}
                </option>
            ))}
        </select>
    </div>
);

export default React.memo(SubstationFilter);
