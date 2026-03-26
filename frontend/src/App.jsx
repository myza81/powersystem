import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, AlertCircle, X, Loader2, MapPin, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import SubstationForm from './components/SubstationForm';
import SldViewer from './components/SldViewer';

import ConfigurationEditor from './components/ConfigurationEditor';
import LoadDashboard from './components/LoadDashboard';
import DevTools from './components/DevTools';
import MainLayout from './components/MainLayout';
// import TopologyValidation from './components/TopologyValidation';
import SubstationCard from './components/SubstationCard';
import SubstationFilter from './components/SubstationFilter';
import SubstationMap from './components/SubstationMap';
import SubstationListRow from './components/SubstationListRow';

import SnapshotManager from './components/SnapshotManager';
import LoadSheddingViewer from './components/LoadSheddingViewer';
import LoadSheddingDesigner from './components/LoadSheddingDesigner';
import CriticalSubstationManager from './components/CriticalSubstationManager';
import api from './api';
import LoginForm from './components/LoginForm';

const DEFAULT_FILTERS = {
    region: 'All',
    grid: 'All',
    state: 'All',
    voltage: 'All',
    ownership: 'All',
    search: '',
    hasRelay: 'All',
    commissionYear: 'All',
    transformerYear: 'All'
};

// Anonymous sentinel — used when the user skips login
const ANONYMOUS_USER = { id: null, username: 'Anonymous', is_staff: false, is_superuser: false, is_anonymous: true };

const App = () => {
    const [substations, setSubstations] = useState([]);
    const [filteredSubstations, setFilteredSubstations] = useState([]);
    const [filterCriteria, setFilterCriteria] = useState(DEFAULT_FILTERS);
    const [currentUser, setCurrentUser] = useState(null);
    // authResolved: false while /users/me/ is in-flight; prevents login flash for returning users
    const [authResolved, setAuthResolved] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [loggingIn, setLoggingIn] = useState(false);

    // Initialize view from URL or default to 'list'
    const [view, setView] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('view') || 'list';
    });

    const [listDisplayMode, setListDisplayMode] = useState('grid');

    const [selectedSnapshotId, setSelectedSnapshotId] = useState(null);

    const [selectedSub, setSelectedSub] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [viewingSld, setViewingSld] = useState(null);
    const [locatingSubstation, setLocatingSubstation] = useState(null);

    // Auto-clear success messages after 5 seconds
    useEffect(() => {
        if (status?.type === 'success') {
            const timer = setTimeout(() => {
                setStatus(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    // Sync URL with view state
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') !== view) {
            const newUrl = `${window.location.pathname}?view=${view}`;
            window.history.pushState({ path: newUrl }, '', newUrl);
        }
    }, [view]);

    // Handle browser back/forward buttons
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const newView = params.get('view') || 'list';
            setView(newView);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Fetch Substations
    const fetchSubstations = async () => {
        setLoading(true);
        try {
            const res = await api.get('/substations/');
            setSubstations(res.data);
            // Trigger initial filter application
        } catch (err) {
            console.error("Failed to fetch", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSubstations();
    }, []);

    // Check current user on mount — resolve auth before rendering anything
    useEffect(() => {
        const checkUser = async () => {
            try {
                const res = await api.get('/users/me/');
                if (res.data.id) {
                    setCurrentUser(res.data);
                    setAuthResolved(true);
                    return;
                }
            } catch (err) {
                // 401 = not authenticated, fall through to show login
            }
            setAuthResolved(true); // show login page
        };
        checkUser();
    }, []);

    const handleLogin = async (username, password) => {
        setLoggingIn(true);
        setLoginError('');
        try {
            const res = await api.post('/users/login/', { username, password });
            setCurrentUser(res.data);
            setShowLogin(false);
            setLoginError('');
        } catch (err) {
            setLoginError(err.response?.data?.error || 'Invalid credentials. Please try again.');
        } finally {
            setLoggingIn(false);
        }
    };

    const handleAnonymous = () => {
        setCurrentUser(ANONYMOUS_USER);
        setShowLogin(false);
        setLoginError('');
    };

    const handleShowLogin = () => {
        setCurrentUser(null);
        setShowLogin(true);
        setLoginError('');
    };

    const handleLogout = async () => {
        try {
            await api.post('/users/logout/');
        } catch (err) {
            console.error("Logout error", err);
        }
        setCurrentUser(null);
        setShowLogin(true);
    };

    // Apply Filters whenever criteria or substations change
    useEffect(() => {
        let result = substations;
        const { region, grid, state, voltage, ownership, search, hasRelay, commissionYear, transformerYear } = filterCriteria;

        if (region !== 'All') result = result.filter(s => s.region === region);
        if (grid !== 'All') result = result.filter(s => s.grid === grid);
        if (state !== 'All') result = result.filter(s => s.state === state);
        if (voltage !== 'All') result = result.filter(s => s.voltage === parseInt(voltage));
        if (ownership && ownership !== 'All') result = result.filter(s => s.ownership === ownership);

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

        if (search) {
            const lowSearch = search.toLowerCase();
            result = result.filter(s =>
                (s.name || '').toLowerCase().includes(lowSearch) ||
                (s.mnemonic || '').toLowerCase().includes(lowSearch) ||
                (s.substation_id || '').toLowerCase().includes(lowSearch)
            );
        }

        const sortedResult = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setFilteredSubstations(sortedResult);
    }, [substations, filterCriteria]);

    const handleSave = async (data) => {
        console.log("App handleSave received data:", JSON.stringify(data, null, 2));
        setLoading(true);
        setStatus(null); // Clear previous status
        try {
            let savedData;
            if (selectedSub) {
                console.log(`PATCH to /substations/${selectedSub.substation_id}/`);
                const res = await api.patch(`/substations/${selectedSub.substation_id}/`, data);
                savedData = res.data;
                setStatus({ type: 'success', msg: 'Substation metadata updated successfully' });
            } else {
                const res = await api.post('/substations/', data);
                savedData = res.data;
                setStatus({ type: 'success', msg: 'New substation created' });
                setView('edit');
            }
            setSelectedSub(savedData);
            fetchSubstations();
        } catch (err) {
            console.error("Save error:", err);
            let errMsg = 'Operation failed';
            if (err.response?.data) {
                if (err.response.data.error) {
                    errMsg = err.response.data.error;
                } else {
                    errMsg = Object.entries(err.response.data)
                        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
                        .join(' | ');
                }
            }
            setStatus({ type: 'error', msg: errMsg });
        }
        setLoading(false);
    };

    const handleRefreshSubstation = async (substationId) => {
        if (!substationId) return;
        try {
            const res = await api.get(`/substations/${substationId}/`);
            const refreshed = res.data;
            setSubstations(prev => prev.map(s => s.substation_id === substationId ? refreshed : s));
            setFilteredSubstations(prev => prev.map(s => s.substation_id === substationId ? refreshed : s));
            if (selectedSub?.substation_id === substationId) {
                setSelectedSub(refreshed);
            }
        } catch (err) {
            console.error('Failed to refresh substation after asset update', err);
        }
    };

    const handleBulkUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/substations/upload_bulk/', formData);
            const { summary, logs, created, errors } = res.data;
            let statusType = 'success';
            let message = summary;

            if (created === 0 && (res.data.duplicates_skipped > 0 || res.data.invalid_grid_skipped > 0 || errors.length > 0)) {
                statusType = 'error';
                message = `Sync Failed: 0 records added. (${summary})`;
            } else if (errors.length > 0 || res.data.duplicates_skipped > 0) {
                message = `${summary} (Check console for skips/errors)`;
            }

            setStatus({ type: statusType, msg: message });
            console.log("Sync Logs:", logs);
            if (errors.length > 0) console.error("Sync Errors:", errors);
            fetchSubstations();
        } catch (err) {
            console.error("Bulk upload err:", err);
            setStatus({ type: 'error', msg: err.response?.data?.error || 'Bulk sync failed.' });
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const handleSLDUpload = async (subId, file) => {
        setLoading(true);
        const formData = new FormData();
        formData.append('sld_file', file);
        try {
            await api.post(`/substations/${subId}/upload_sld/`, formData);
            setStatus({ type: 'success', msg: 'SLD file standards applied and stored' });
            fetchSubstations();

            if (selectedSub && selectedSub.substation_id === subId) {
                const res = await api.get(`/substations/${subId}/`);
                setSelectedSub(res.data);
            }
        } catch (err) {
            setStatus({ type: 'error', msg: 'SLD rejection: File must be PDF, Image, DXF, or SVG' });
        }
        setLoading(false);
    };

    const handleProcessSLD = async (substationId) => {
        setLoading(true);
        setStatus({ type: 'info', msg: `Analyzing SLD for ${substationId}...` });
        try {
            const res = await api.post(`/substations/${substationId}/process_sld/`);
            setSubstations(prev => prev.map(s => s.substation_id === substationId ? res.data : s));

            // Sync selectedSub if it's the one being processed
            if (selectedSub && selectedSub.substation_id === substationId) {
                setSelectedSub(res.data);
            }

            setStatus({ type: 'success', msg: `SLD Intelligence extracted for ${substationId}` });
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', msg: err.response?.data?.error || "SLD Analysis failed" });
        } finally {
            setLoading(false);
        }
    };

    const handleResolveIssue = (issue) => {
        if (issue.type === 'create_substation') {
            setSelectedSub({
                mnemonic: issue.data.mnemonic,
                voltage: issue.data.voltage,
                name: '',
                ownership: 'TNB',
                grid: '',
            });
            setView('create');
        } else if (issue.type === 'edit_substation') {
            const sub = substations.find(s => s.substation_id === issue.data.substation_id);
            if (sub) {
                setSelectedSub(sub);
                setView('edit');
            } else {
                setStatus({ type: 'error', msg: `Substation ${issue.data.substation_id} not found locally. Try syncing or check ID.` });
            }
        }
    };

    // ── Auth gate: show loading, login page, or the app ──────────────────────
    if (!authResolved) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100vw', height: '100vh', background: 'var(--bg-deep)',
                flexDirection: 'column', gap: '1rem',
            }}>
                <div style={{
                    width: 44, height: 44,
                    borderRadius: '50%',
                    border: '3px solid rgba(0,229,255,0.15)',
                    borderTop: '3px solid var(--accent-cyan)',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Connecting…</span>
            </div>
        );
    }

    if (!currentUser || showLogin) {
        return (
            <LoginForm
                onLogin={handleLogin}
                onAnonymous={handleAnonymous}
                error={loginError}
                loading={loggingIn}
            />
        );
    }

    return (
        <>
        <MainLayout currentView={view} onViewChange={setView} currentUser={currentUser} onLogout={handleLogout} onShowLogin={handleShowLogin}>
            <div className="dashboard-container">
                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            position: 'fixed', top: '2rem', right: '2rem', zIndex: 1000,
                            background: status.type === 'success' ? 'var(--accent-cyan)' : '#f56565',
                            color: '#000', padding: '1rem 2rem', borderRadius: '0.5rem',
                            display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                        }}
                    >
                        {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        {status.msg}
                        <X size={16} style={{ marginLeft: '1rem', cursor: 'pointer' }} onClick={() => setStatus(null)} />
                    </motion.div>
                )}

                {view !== 'critical-substations' && view !== 'load-shedding-designer' && (
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                                {view === 'dashboard' && 'Live Dashboard'}
                                {view === 'list' && 'Substation Assets'}
                                {view === 'create' && 'Register New Entry'}
                                {view === 'edit' && 'Edit Substation'}
                                {view === 'config' && 'Configuration Editor'}
                                {view === 'snapshots' && 'Network Analysis'}
                                {view === 'dev-tools' && 'Developer Tools'}
                                {view === 'load-shedding-viewer' && 'Load Shedding Viewer'}
                            </h2>
                        </div>
                    </header>
                )}

                {view === 'list' && (
                    <>
                        <SubstationFilter
                            substations={substations}
                            currentFilters={filterCriteria}
                            onUpdateFilters={setFilterCriteria}
                            onRegister={() => { setSelectedSub(null); setView('create'); }}
                            viewMode={listDisplayMode}
                            onViewModeChange={setListDisplayMode}
                        />

                        {listDisplayMode === 'grid' ? (
                            <div className="substation-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                <AnimatePresence>
                                    {filteredSubstations.map(sub => (
                                        <SubstationCard
                                            key={sub.substation_id}
                                            substation={sub}
                                            onEdit={() => { setSelectedSub(sub); setView('edit'); }}
                                            onSLDUpload={handleSLDUpload}
                                            onProcess={handleProcessSLD}
                                            processing={loading}
                                            onViewSld={setViewingSld}
                                            onLocate={setLocatingSubstation}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <div className="substation-list" style={{ display: 'flex', flexDirection: 'column' }}>
                                <AnimatePresence>
                                    {filteredSubstations.map(sub => (
                                        <SubstationListRow
                                            key={sub.substation_id}
                                            substation={sub}
                                            onEdit={() => { setSelectedSub(sub); setView('edit'); }}
                                            onSLDUpload={handleSLDUpload}
                                            onProcess={handleProcessSLD}
                                            processing={loading}
                                            onViewSld={setViewingSld}
                                            onLocate={setLocatingSubstation}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}

                        <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            Showing {filteredSubstations.length} of {substations.length} assets
                        </div>
                    </>
                )}

                {/* Substation Location Map Modal */}
                <AnimatePresence>
                    {locatingSubstation && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                background: 'rgba(0,0,0,0.85)',
                                backdropFilter: 'blur(10px)',
                                zIndex: 2000,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2rem'
                            }}
                            onClick={() => setLocatingSubstation(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: '100%',
                                    maxWidth: '1000px',
                                    background: '#0f172a',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(0, 229, 255, 0.3)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                                }}
                            >
                                <div style={{
                                    padding: '1.5rem',
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(0,0,0,0.2)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ padding: '8px', background: 'rgba(0, 229, 255, 0.1)', borderRadius: '8px' }}>
                                            <MapPin size={20} color="#00e5ff" />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                                                {locatingSubstation.name}
                                            </h3>
                                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                                                {locatingSubstation.substation_id} • {locatingSubstation.state || 'Unknown State'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setLocatingSubstation(null)}
                                        style={{
                                            background: 'rgba(255,255,255,0.1)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '8px',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                                        onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <div style={{ padding: '1rem', height: '600px' }}>
                                    <SubstationMap
                                        data={[locatingSubstation]}
                                        focusLocation={locatingSubstation}
                                    />
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {view === 'create' || view === 'edit' ? (
                    <SubstationForm
                        substation={selectedSub}
                        onSave={handleSave}
                        onSubstationRefresh={handleRefreshSubstation}
                        onCancel={() => setView('list')}
                        onConfigEdit={() => setView('config')}
                        onSLDUpload={handleSLDUpload}
                        status={status}
                        loading={loading}
                    />
                ) : null}

                {view === 'config' && (
                    <ConfigurationEditor
                        substation={selectedSub}
                        onSave={handleSave}
                        onCancel={() => setView('list')}
                        onProcess={() => handleProcessSLD(selectedSub.substation_id)}
                        processing={loading}
                        onViewSld={setViewingSld}
                    />
                )}

                {view === 'dashboard' && (
                    <LoadDashboard substations={substations} />
                )}


                {/* {view === 'topology' && (
                    <TopologyValidation
                        onEditSubstation={(substationId) => {
                            const sub = substations.find(s => s.substation_id === substationId);
                            if (sub) {
                                setSelectedSub(sub);
                                setView('config');
                            }
                        }}
                    />
                )} */}

                {view === 'dev-tools' && (
                    <DevTools onBack={() => setView('list')} />
                )}

                {view === 'snapshots' && (
                    <SnapshotManager />
                )}


                {view === 'load-shedding-viewer' && (
                    <LoadSheddingViewer />
                )}

                {view === 'load-shedding-designer' && (
                    <LoadSheddingDesigner />
                )}

                {view === 'critical-substations' && (
                    <CriticalSubstationManager />
                )}

                {viewingSld && (
                    <SldViewer
                        substation={viewingSld}
                        onClose={() => setViewingSld(null)}
                    />
                )}

            </div>
        </MainLayout>
        </>
    );
};

export default App;
