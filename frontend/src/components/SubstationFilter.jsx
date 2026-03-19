import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, RotateCcw, Search, X, PlusCircle } from 'lucide-react';
import { BsGrid3X3GapFill, BsListUl } from 'react-icons/bs';

const SubstationFilter = ({
    substations,
    currentFilters,
    onUpdateFilters,
    onRegister,
    extraLabel = 'Ownership',
    extraValue,
    onExtraChange,
    extraOptions = null,
    showVoltage = true,
    viewMode = 'grid',
    onViewModeChange
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Destructure current filters
    const { region, grid, state, voltage, ownership, search, hasRelay, commissionYear, transformerYear } = currentFilters;
    const currentExtraValue = extraValue || ownership;

    // Extract unique values based on independent filters
    const uniqueValues = useMemo(() => {
        const getDecadeRange = (year) => {
            if (!year) return null;
            const startYear = Math.floor((year - 1) / 10) * 10 + 1;
            const endYear = startYear + 9;
            return `${startYear}-${endYear}`;
        };

        // Regions options: filter substations by grid + state
        const regionFiltered = substations.filter(s =>
            (grid === 'All' || s.grid === grid) &&
            (state === 'All' || s.state === state)
        );
        const regions = ['All', ...new Set(regionFiltered.map(s => s.region).filter(Boolean))].sort();

        // Grids options: filter substations by region + state
        const gridFiltered = substations.filter(s =>
            (region === 'All' || s.region === region) &&
            (state === 'All' || s.state === state)
        );
        const grids = ['All', ...new Set(gridFiltered.map(s => s.grid).filter(Boolean))].sort();

        // States options: filter substations by region + grid
        const stateFiltered = substations.filter(s =>
            (region === 'All' || s.region === region) &&
            (grid === 'All' || s.grid === grid)
        );
        const states = ['All', ...new Set(stateFiltered.map(s => s.state).filter(Boolean))].sort();

        // Voltages: show voltages available in the currently filtered set (by R/G/S)
        const vFiltered = substations.filter(s =>
            (region === 'All' || s.region === region) &&
            (grid === 'All' || s.grid === grid) &&
            (state === 'All' || s.state === state)
        );
        const voltages = ['All', ...new Set(vFiltered.map(s => s.voltage).filter(Boolean))].sort((a, b) => b - a);

        // Ownerships and Decades (mostly global or semi-global)
        const ownerships = extraOptions || ['All', ...new Set(substations.map(s => s.ownership).filter(Boolean))].sort();

        const years = substations.map(s => s.commission_date ? new Date(s.commission_date).getFullYear() : null).filter(Boolean);
        const decades = ['All', ...new Set(years.map(getDecadeRange))].sort((a, b) => b.localeCompare(a));

        const txYears = substations.flatMap(s => s.transformer_commissioning_years || []);
        const txDecades = ['All', ...new Set(txYears.map(getDecadeRange))].sort((a, b) => b.localeCompare(a));

        return { regions, grids, states, voltages, ownerships, decades, txDecades };
    }, [substations, region, grid, state, voltage, extraOptions]);

    const updateFilter = (key, value) => {
        onUpdateFilters({ ...currentFilters, [key]: value });
    };

    const resetFilters = () => {
        onUpdateFilters({
            region: 'All',
            grid: 'All',
            state: 'All',
            voltage: 'All',
            ownership: 'All',
            search: '',
            hasRelay: 'All',
            commissionYear: 'All',
            transformerYear: 'All'
        });
    };

    const hasActiveFilters = region !== 'All' || grid !== 'All' || state !== 'All' || voltage !== 'All' || currentExtraValue !== 'All' || search !== '' || hasRelay !== 'All' || commissionYear !== 'All' || transformerYear !== 'All';

    return (
        <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            {/* Top Row: Title, Search, and Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
                    <Filter size={18} />
                    <span style={{ fontWeight: 600 }}>Filter Assets</span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative', minWidth: '200px', flex: '0 1 350px' }}>
                        <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            className="input-field"
                            placeholder="Search name, ID, mnemonic..."
                            value={search}
                            onChange={(e) => updateFilter('search', e.target.value)}
                            style={{ paddingLeft: '2.2rem', paddingRight: '2rem', width: '100%', height: '36px' }}
                        />
                        {search !== '' && (
                            <X
                                size={14}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                onClick={() => updateFilter('search', '')}
                            />
                        )}
                    </div>

                    {/* Advanced Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{
                            background: showAdvanced ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${showAdvanced ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.1)'}`,
                            color: showAdvanced ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            padding: '0 12px', height: '36px', borderRadius: '6px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
                        }}
                    >
                        <Filter size={14} />
                        <span style={{ fontSize: '0.8rem' }}>Advanced</span>
                    </button>


                    <div style={{ 
                        display: 'flex', 
                        background: 'rgba(255, 255, 255, 0.05)', 
                        padding: '3px', 
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <button
                            onClick={() => onViewModeChange('grid')}
                            style={{
                                background: viewMode === 'grid' ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                                border: 'none',
                                color: viewMode === 'grid' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                            }}
                            title="Grid View"
                        >
                            <BsGrid3X3GapFill size={16} />
                        </button>
                        <button
                            onClick={() => onViewModeChange('list')}
                            style={{
                                background: viewMode === 'list' ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                                border: 'none',
                                color: viewMode === 'list' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                            }}
                            title="List View"
                        >
                            <BsListUl size={16} />
                        </button>
                    </div>

                    <button
                        onClick={onRegister}
                        className="btn-primary"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            borderRadius: '6px', padding: '0 12px',
                            fontSize: '0.8rem', height: '36px'
                        }}
                    >
                        <PlusCircle size={14} /> Register
                    </button>
                </div>
            </div>

            {/* Basic Filters Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <FilterDropdown label="Region" value={region} options={uniqueValues.regions} onChange={(v) => updateFilter('region', v)} />
                <FilterDropdown label="Grid" value={grid} options={uniqueValues.grids} onChange={(v) => updateFilter('grid', v)} />
                <FilterDropdown label="State" value={state} options={uniqueValues.states} onChange={(v) => updateFilter('state', v)} />
                {showVoltage && <FilterDropdown label="Voltage Level" value={voltage} options={uniqueValues.voltages} onChange={(v) => updateFilter('voltage', v)} suffix=" kV" />}
                {!showAdvanced && (
                    <FilterDropdown label={extraLabel} value={currentExtraValue} options={uniqueValues.ownerships} onChange={(v) => onExtraChange ? onExtraChange(v) : updateFilter('ownership', v)} />
                )}
            </div>

            {/* Advanced Filters Section */}
            <AnimatePresence>
                {showAdvanced && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                            <FilterDropdown label={extraLabel} value={currentExtraValue} options={uniqueValues.ownerships} onChange={(v) => onExtraChange ? onExtraChange(v) : updateFilter('ownership', v)} />
                            <FilterDropdown label="Load Shedding Relay" value={hasRelay || 'All'} options={['All', 'Active', 'None']} onChange={(v) => updateFilter('hasRelay', v)} />
                            <FilterDropdown label="Substation Commission" value={commissionYear || 'All'} options={uniqueValues.decades} onChange={(v) => updateFilter('commissionYear', v)} />
                            <FilterDropdown label="Load Transformer Commission" value={transformerYear || 'All'} options={['All', 'None', ...uniqueValues.txDecades.filter(y => y !== 'All')]} onChange={(v) => updateFilter('transformerYear', v)} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const FilterDropdown = ({ label, value, options, onChange, disabled, suffix = '' }) => (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</label>
        <select
            className="input-field"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
        >
            {options.map(opt => (
                <option key={opt} value={opt}>
                    {opt === 'All' ? `All ${label} s` : `${opt}${suffix} `}
                </option>
            ))}
        </select>
    </div>
);

export default SubstationFilter;
