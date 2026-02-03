import React, { useState, useEffect } from 'react';
import { Search, Zap, TrendingUp, MapPin, Building2, Database, Loader2, BarChart3, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

const LoadDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [gridData, setGridData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedSubstation, setSelectedSubstation] = useState(null);
    const [substationDetails, setSubstationDetails] = useState(null);
    const [activeView, setActiveView] = useState('overview'); // 'overview' | 'regions' | 'states'

    // Fetch grid overview on mount
    useEffect(() => {
        const fetchGridData = async () => {
            try {
                const response = await api.get('/load-profiles/aggregate/?level=grid');
                setGridData(response.data);
            } catch (err) {
                console.error('Failed to fetch grid data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchGridData();
    }, []);

    // Search substations
    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        try {
            const response = await api.get(`/substations/?search=${query}`);
            setSearchResults(response.data.results || response.data || []);
        } catch (err) {
            console.error('Search failed:', err);
            setSearchResults([]);
        }
    };

    // Fetch substation details
    const handleSelectSubstation = async (substation) => {
        setSelectedSubstation(substation);
        try {
            const response = await api.get(`/load-profiles/aggregate/?level=substation&key=${substation.substation_id}`);
            setSubstationDetails(response.data);
        } catch (err) {
            console.error('Failed to fetch substation details:', err);
            setSubstationDetails(null);
        }
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)'
            }}>
                <Loader2 size={48} className="animate-spin" style={{ color: '#00e5ff' }} />
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            padding: '2rem',
            background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)'
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '2rem' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: 'linear-gradient(135deg, #00e5ff 0%, #00a8ff 100%)',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 24px rgba(0, 229, 255, 0.3)'
                        }}>
                            <BarChart3 size={28} color="#000" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 style={{
                                fontSize: '2.25rem',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #fff 0%, #00e5ff 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                margin: 0
                            }}>
                                Load Analytics Dashboard
                            </h1>
                            <p style={{ color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0', fontSize: '0.95rem' }}>
                                Real-time grid demand monitoring & substation analytics
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* View Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '2rem',
                    padding: '0.5rem',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    {['overview', 'regions', 'states'].map(view => (
                        <button
                            key={view}
                            onClick={() => setActiveView(view)}
                            style={{
                                flex: 1,
                                padding: '0.75rem 1.5rem',
                                background: activeView === view
                                    ? 'linear-gradient(135deg, #00e5ff 0%, #00a8ff 100%)'
                                    : 'transparent',
                                color: activeView === view ? '#000' : 'rgba(255,255,255,0.7)',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                                textTransform: 'capitalize'
                            }}
                        >
                            {view}
                        </button>
                    ))}
                </div>

                {/* Grid Overview Metrics */}
                {activeView === 'overview' && gridData && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '1.5rem',
                            marginBottom: '2rem'
                        }}>
                            <MetricCard
                                icon={<Zap size={28} />}
                                label="Total Load Demand"
                                value={`${gridData.total_pload_mw.toFixed(1)} MW`}
                                subValue={`${gridData.total_qload_mvar.toFixed(1)} MVAr`}
                                color="#00e5ff"
                                trend="+2.3%"
                            />
                            <MetricCard
                                icon={<Database size={28} />}
                                label="Active Load Points"
                                value={gridData.breakdown?.length || 0}
                                subValue="Regions monitored"
                                color="#34c759"
                            />
                            <MetricCard
                                icon={<TrendingUp size={28} />}
                                label="Peak Demand"
                                value={`${Math.max(...(gridData.breakdown || []).map(r => r.total_pload_mw || 0)).toFixed(1)} MW`}
                                subValue="Regional maximum"
                                color="#ff9500"
                            />
                        </div>

                        {/* Regional Breakdown */}
                        <div style={{
                            background: 'rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '16px',
                            border: '1px solid rgba(0,229,255,0.2)',
                            padding: '2rem',
                            marginBottom: '2rem'
                        }}>
                            <h3 style={{
                                fontSize: '1.25rem',
                                color: '#fff',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <MapPin size={20} color="#00e5ff" />
                                Load Distribution by Region
                            </h3>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {gridData.breakdown?.map((region, idx) => (
                                    <RegionLoadBar
                                        key={idx}
                                        name={region.region || 'Unknown'}
                                        load={region.total_pload_mw}
                                        maxLoad={Math.max(...gridData.breakdown.map(r => r.total_pload_mw))}
                                        reactiveLoad={region.total_qload_mvar}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Ownership Breakdown */}
                        {gridData.ownership_breakdown && gridData.ownership_breakdown.length > 0 && (
                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '16px',
                                border: '1px solid rgba(0,229,255,0.2)',
                                padding: '2rem',
                                marginBottom: '2rem'
                            }}>
                                <h3 style={{
                                    fontSize: '1.25rem',
                                    color: '#fff',
                                    marginBottom: '1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <Building2 size={20} color="#00e5ff" />
                                    Customer Category Load
                                </h3>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                    gap: '1.5rem'
                                }}>
                                    {gridData.ownership_breakdown.map((owner, idx) => (
                                        <div key={idx} style={{
                                            padding: '1.5rem',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '1rem'
                                            }}>
                                                <span style={{
                                                    color: '#fff',
                                                    fontWeight: 600,
                                                    fontSize: '1.1rem'
                                                }}>
                                                    {owner.type}
                                                </span>
                                                {owner.type === 'DC' ? (
                                                    <Database size={20} color="#00e5ff" />
                                                ) : (
                                                    <Zap size={20} color="#ff9500" />
                                                )}
                                            </div>
                                            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                                                {owner.total_pload_mw.toFixed(1)} <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>MW</span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
                                                Reactive: {owner.total_qload_mvar.toFixed(1)} MVAr
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Regions View */}
                {activeView === 'regions' && (
                    <RegionsView breakdown={gridData?.breakdown || []} />
                )}

                {/* States View */}
                {activeView === 'states' && (
                    <StatesView regions={gridData?.breakdown || []} />
                )}

                {/* Search Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        background: 'rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '16px',
                        border: '1px solid rgba(0,229,255,0.2)',
                        padding: '2rem',
                        marginTop: '2rem'
                    }}
                >
                    <h3 style={{
                        fontSize: '1.25rem',
                        color: '#fff',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <Search size={20} color="#00e5ff" />
                        Substation Load Lookup
                    </h3>

                    {/* Search Input */}
                    <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                        <Search
                            size={20}
                            style={{
                                position: 'absolute',
                                left: '1rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'rgba(255,255,255,0.5)'
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Search by name or mnemonic (e.g., ABBA, Butterworth)"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '1rem 1rem 1rem 3rem',
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(0,229,255,0.3)',
                                borderRadius: '12px',
                                color: '#fff',
                                fontSize: '1rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div style={{
                            display: 'grid',
                            gap: '0.75rem',
                            marginBottom: '2rem',
                            maxHeight: '300px',
                            overflowY: 'auto'
                        }}>
                            {searchResults.map(sub => (
                                <SubstationSearchCard
                                    key={sub.substation_id}
                                    substation={sub}
                                    onClick={() => handleSelectSubstation(sub)}
                                    isSelected={selectedSubstation?.substation_id === sub.substation_id}
                                />
                            ))}
                        </div>
                    )}

                    {/* Substation Details */}
                    {substationDetails && selectedSubstation && (
                        <SubstationDetailsPanel
                            substation={selectedSubstation}
                            details={substationDetails}
                            onClose={() => {
                                setSelectedSubstation(null);
                                setSubstationDetails(null);
                            }}
                        />
                    )}
                </motion.div>
            </div>
        </div>
    );
};

// Metric Card Component
const MetricCard = ({ icon, label, value, subValue, color, trend }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
            padding: '1.5rem',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: `1px solid ${color}33`,
            position: 'relative',
            overflow: 'hidden'
        }}
    >
        <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '120px',
            height: '120px',
            background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`
        }} />
        <div style={{ color, marginBottom: '1rem' }}>
            {icon}
        </div>
        <div style={{
            fontSize: '2.25rem',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '0.25rem',
            fontFamily: 'monospace'
        }}>
            {value}
        </div>
        <div style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '0.5rem'
        }}>
            {subValue}
        </div>
        <div style={{
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.6)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        }}>
            {label}
        </div>
        {trend && (
            <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                fontSize: '0.75rem',
                color: '#34c759',
                fontWeight: 600
            }}>
                {trend}
            </div>
        )}
    </motion.div>
);

// Region Load Bar Component
const RegionLoadBar = ({ name, load, maxLoad, reactiveLoad }) => {
    const percentage = (load / maxLoad) * 100;

    return (
        <div style={{
            padding: '1rem',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.75rem'
            }}>
                <span style={{ color: '#fff', fontWeight: 600 }}>{name}</span>
                <span style={{ color: '#00e5ff', fontFamily: 'monospace', fontWeight: 600 }}>
                    {load.toFixed(1)} MW
                </span>
            </div>
            <div style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #00e5ff 0%, #00a8ff 100%)',
                        boxShadow: '0 0 10px rgba(0, 229, 255, 0.5)'
                    }}
                />
            </div>
            <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.5)',
                marginTop: '0.5rem'
            }}>
                Reactive: {reactiveLoad.toFixed(1)} MVAr
            </div>
        </div>
    );
};

// Regions View Component
const RegionsView = ({ breakdown }) => (
    <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem'
    }}>
        {breakdown.map((region, idx) => (
            <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                style={{
                    padding: '1.5rem',
                    background: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(0,229,255,0.2)'
                }}
            >
                <h4 style={{
                    fontSize: '1.1rem',
                    color: '#00e5ff',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <MapPin size={18} />
                    {region.region || 'Unknown Region'}
                </h4>
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        Active Power
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                        {region.total_pload_mw.toFixed(1)} <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)' }}>MW</span>
                    </div>
                </div>
                <div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        Reactive Power
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                        {region.total_qload_mvar.toFixed(1)} <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>MVAr</span>
                    </div>
                </div>
            </motion.div>
        ))}
    </div>
);

// States View Component (placeholder - would need state-level API)
const StatesView = ({ regions }) => (
    <div style={{
        padding: '2rem',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center'
    }}>
        <AlertCircle size={48} color="rgba(255,255,255,0.3)" style={{ marginBottom: '1rem' }} />
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>
            State-level breakdown requires additional API endpoint configuration
        </p>
    </div>
);

// Substation Search Card
const SubstationSearchCard = ({ substation, onClick, isSelected }) => (
    <motion.div
        whileHover={{ scale: 1.02 }}
        onClick={onClick}
        style={{
            padding: '1rem',
            background: isSelected ? 'rgba(0,229,255,0.1)' : 'rgba(0,0,0,0.2)',
            border: isSelected ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s'
        }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {substation.name}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                    {substation.substation_id} • {substation.state || 'N/A'}
                </div>
            </div>
            <Building2 size={20} color={isSelected ? '#00e5ff' : 'rgba(255,255,255,0.3)'} />
        </div>
    </motion.div>
);

// Substation Details Panel
const SubstationDetailsPanel = ({ substation, details, onClose }) => (
    <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        style={{
            marginTop: '1.5rem',
            padding: '2rem',
            background: 'rgba(0,229,255,0.05)',
            border: '2px solid rgba(0,229,255,0.3)',
            borderRadius: '16px'
        }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
            <div>
                <h4 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '0.5rem' }}>
                    {substation.name}
                </h4>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                    {substation.substation_id} • {substation.state}
                </p>
            </div>
            <button
                onClick={onClose}
                style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                }}
            >
                Close
            </button>
        </div>

        {/* Aggregate Load */}
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
            marginBottom: '2rem'
        }}>
            <div style={{
                padding: '1rem',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '12px'
            }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Total Active Load
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#00e5ff', fontFamily: 'monospace' }}>
                    {details.total_pload_mw.toFixed(2)} MW
                </div>
            </div>
            <div style={{
                padding: '1rem',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '12px'
            }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Total Reactive Load
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ff9500', fontFamily: 'monospace' }}>
                    {details.total_qload_mvar.toFixed(2)} MVAr
                </div>
            </div>
        </div>

        {/* Individual Bay Loads */}
        {details.breakdown && details.breakdown.length > 0 && (
            <>
                <h5 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.1rem' }}>
                    Individual Bay Loads
                </h5>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {details.breakdown.map((bay, idx) => (
                        <div
                            key={idx}
                            style={{
                                padding: '1rem',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr',
                                gap: '1rem',
                                alignItems: 'center'
                            }}
                        >
                            <div>
                                <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>
                                    {bay.bay_name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                    {bay.type === 'transformer' ? 'Transformer' : 'Incoming Bay'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>P-Load</div>
                                <div style={{ color: '#00e5ff', fontWeight: 600, fontFamily: 'monospace' }}>
                                    {bay.pload_mw.toFixed(2)} MW
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Q-Load</div>
                                <div style={{ color: '#ff9500', fontWeight: 600, fontFamily: 'monospace' }}>
                                    {bay.qload_mvar.toFixed(2)} MVAr
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        )}

        {(!details.breakdown || details.breakdown.length === 0) && (
            <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.5)'
            }}>
                No load data available for this substation
            </div>
        )}
    </motion.div>
);

export default LoadDashboard;
