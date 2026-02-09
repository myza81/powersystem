import React, { useEffect, useMemo } from 'react';
import { Filter, RotateCcw, Search, X } from 'lucide-react';

const SubstationFilter = ({ substations, currentFilters, onUpdateFilters }) => {
    // Destructure current filters
    const { region, grid, state, voltage, ownership, search } = currentFilters;

    // Extract unique values based on current selection hierarchy
    const uniqueValues = useMemo(() => {
        let filtered = substations;

        // 1. Available Regions (always all)
        const regions = ['All', ...new Set(substations.map(s => s.region).filter(Boolean))].sort();

        // 2. Available Grids (depend on Region)
        if (region !== 'All') {
            filtered = filtered.filter(s => s.region === region);
        }
        const grids = ['All', ...new Set(filtered.map(s => s.grid).filter(Boolean))].sort();

        // 3. Available States (depend on Region + Grid)
        if (grid !== 'All') {
            filtered = filtered.filter(s => s.grid === grid);
        }
        const states = ['All', ...new Set(filtered.map(s => s.state).filter(Boolean))].sort();

        // 4. Available Voltages (depend on Region + Grid + State)
        if (state !== 'All') {
            filtered = filtered.filter(s => s.state === state);
        }
        const voltages = ['All', ...new Set(filtered.map(s => s.voltage).filter(Boolean))].sort((a, b) => b - a);

        // 5. Available Ownerships (depend on Region + Grid + State + Voltage)
        if (voltage !== 'All') {
            filtered = filtered.filter(s => s.voltage === parseInt(voltage));
        }
        const ownerships = ['All', ...new Set(filtered.map(s => s.ownership).filter(Boolean))].sort();

        return { regions, grids, states, voltages, ownerships };
    }, [substations, region, grid, state, voltage]);

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
            search: ''
        });
    };

    const hasActiveFilters = region !== 'All' || grid !== 'All' || state !== 'All' || voltage !== 'All' || ownership !== 'All' || search !== '';

    return (
        <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            {/* Top Row: Search and Reset */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
                    <Filter size={18} />
                    <span style={{ fontWeight: 600 }}>Filter Assets</span>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flex: 1, justifyContent: 'flex-end' }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative', minWidth: '250px', flex: '0 1 400px' }}>
                        <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            className="input-field"
                            placeholder="Search name, ID, mnemonic..."
                            value={search}
                            onChange={(e) => updateFilter('search', e.target.value)}
                            style={{ paddingLeft: '2.2rem', paddingRight: '2rem', width: '100%', height: '36px' }}
                        />
                        {search && (
                            <X
                                size={14}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                onClick={() => updateFilter('search', '')}
                            />
                        )}
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={resetFilters}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px', padding: '0 12px', color: '#f56565',
                                fontSize: '0.8rem', cursor: 'pointer', height: '36px'
                            }}
                        >
                            <RotateCcw size={14} /> Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Dropdowns Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <FilterDropdown label="Region" value={region} options={uniqueValues.regions} onChange={(v) => updateFilter('region', v)} />
                <FilterDropdown label="Grid" value={grid} options={uniqueValues.grids} onChange={(v) => updateFilter('grid', v)} disabled={region === 'All' && uniqueValues.grids.length <= 2} />
                <FilterDropdown label="State" value={state} options={uniqueValues.states} onChange={(v) => updateFilter('state', v)} disabled={grid === 'All' && uniqueValues.states.length <= 2} />
                <FilterDropdown label="Voltage Level" value={voltage} options={uniqueValues.voltages} onChange={(v) => updateFilter('voltage', v)} suffix=" kV" />
                <FilterDropdown label="Ownership" value={ownership} options={uniqueValues.ownerships} onChange={(v) => updateFilter('ownership', v)} />
            </div>
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
