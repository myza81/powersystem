import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import SubstationForm from './components/SubstationForm';
import SldViewer from './components/SldViewer';

import ConfigurationEditor from './components/ConfigurationEditor';
import LoadProfileUpload from './components/LoadProfileUpload';
import LoadDashboard from './components/LoadDashboard';
import DevTools from './components/DevTools';
import MainLayout from './components/MainLayout';
import TopologyValidation from './components/TopologyValidation';
import SubstationCard from './components/SubstationCard';
import SubstationFilter from './components/SubstationFilter';


// API Service
const api = axios.create({ baseURL: '/api/v1' });

const App = () => {
    const [substations, setSubstations] = useState([]);
    const [filteredSubstations, setFilteredSubstations] = useState([]);
    const [view, setView] = useState('list'); // list, create, edit
    const [selectedSub, setSelectedSub] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [viewingSld, setViewingSld] = useState(null);

    // Fetch Substations
    const fetchSubstations = async () => {
        setLoading(true);
        try {
            const res = await api.get('/substations/');
            setSubstations(res.data);
            setFilteredSubstations(res.data); // Initial sync
        } catch (err) {
            console.error("Failed to fetch", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSubstations();
    }, []);

    const handleSave = async (data) => {
        console.log("App handleSave received data:", JSON.stringify(data, null, 2));
        setLoading(true);
        try {
            if (selectedSub) {
                console.log(`PATCH to /substations/${selectedSub.substation_id}/`);
                await api.patch(`/substations/${selectedSub.substation_id}/`, data);
                setStatus({ type: 'success', msg: 'Substation asset updated successfully' });
            } else {
                await api.post('/substations/', data);
                setStatus({ type: 'success', msg: 'New substation asset committed' });
            }
            setView('list');
            setSelectedSub(null);
            fetchSubstations();
        } catch (err) {
            console.error("Save error:", err);
            console.error("Error response:", err.response?.data);
            setStatus({ type: 'error', msg: err.response?.data?.error || 'Operation failed' });
        }
        setLoading(false);
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

    return (
        <MainLayout currentView={view} onViewChange={setView}>
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

                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                            {view === 'dashboard' && 'System Dashboard'}
                            {view === 'load-profile' && 'Load Profile Management'}
                            {view === 'list' && 'Substation Assets'}
                            {view === 'create' && 'New Substation Entry'}
                            {view === 'edit' && 'Edit Substation'}
                            {view === 'config' && 'Configuration Editor'}
                            {view === 'topology' && 'Network Topology Validation'}
                            {view === 'dev-tools' && 'Developer Tools'}
                        </h2>
                    </div>
                </header>

                {view === 'list' && (
                    <>
                        <SubstationFilter
                            substations={substations}
                            onFilterChange={setFilteredSubstations}
                        />

                        <div className="substation-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            <AnimatePresence>
                                {filteredSubstations.map(sub => (
                                    <SubstationCard
                                        key={sub.substation_id}
                                        substation={sub}
                                        onEdit={() => { setSelectedSub(sub); setView('edit'); }}
                                        onConfigEdit={() => { setSelectedSub(sub); setView('config'); }}
                                        onSLDUpload={handleSLDUpload}
                                        onProcess={handleProcessSLD}
                                        processing={loading}
                                        onViewSld={setViewingSld}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>

                        <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            Showing {filteredSubstations.length} of {substations.length} assets
                        </div>
                    </>
                )}

                {view === 'create' || view === 'edit' ? (
                    <SubstationForm
                        substation={selectedSub}
                        onSave={handleSave}
                        onCancel={() => setView('list')}
                        onConfigEdit={() => setView('config')}
                        onSLDUpload={handleSLDUpload}
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

                {view === 'load-profile' && (
                    <LoadProfileUpload
                        onUploadComplete={(results) => {
                            setStatus({ type: 'success', msg: `Load data uploaded: ${results.matched} matched, ${results.unmatched} unmatched` });
                            fetchSubstations(); // Refresh substations with load data
                        }}
                        onCancel={() => setView('dashboard')}
                        onResolveIssue={handleResolveIssue}
                    />
                )}

                {view === 'topology' && (
                    <TopologyValidation
                        onEditSubstation={(substationId) => {
                            const sub = substations.find(s => s.substation_id === substationId);
                            if (sub) {
                                setSelectedSub(sub);
                                setView('config');
                            }
                        }}
                    />
                )}

                {view === 'dev-tools' && (
                    <DevTools onBack={() => setView('list')} />
                )}

                {viewingSld && (
                    <SldViewer
                        substation={viewingSld}
                        onClose={() => setViewingSld(null)}
                    />
                )}
            </div>
        </MainLayout>
    );
};

export default App;
