import React, { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Save,
    RotateCcw,
    Zap,
    Shield,
    Settings as SettingsIcon,
    Search,
    ChevronRight,
    ChevronDown,
    Layout,
    Copy,
    Edit3,
    X,
    FolderOpen,
    Play,
    Lock,
    Square,
    CheckSquare,
    RefreshCw
} from 'lucide-react';
import { FaWandMagicSparkles, FaFolderTree, FaShieldHalved, FaLayerGroup, FaBolt, FaCircleNodes } from 'react-icons/fa6';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

// Format Date string helper
const formatDate = (ds) => {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const LoadSheddingDesigner = () => {
    // --- Global State ---
    const [currentUser, setCurrentUser] = useState(null);

    const getInitialState = (key, defaultVal) => {
        try {
            const stored = sessionStorage.getItem('ls_draft_state');
            if (stored) {
                if (key === 'view') return 'designer'; // If a draft exists, force user back into designer
                const parsed = JSON.parse(stored);
                if (parsed[key] !== undefined) return parsed[key];
            }
        } catch (e) {
            console.error("Error reading sessionStorage", e);
        }
        return defaultVal;
    };

    const [view, setView] = useState(() => getInitialState('view', 'manager')); // 'manager' | 'designer'
    const [activeTab, setActiveTab] = useState('stages'); // 'stages' | 'settings'
    const [loading, setLoading] = useState(true);

    // --- Master Data ---
    const [relays, setRelays] = useState([]);
    const [versions, setVersions] = useState([]);
    const [globalSettings, setGlobalSettings] = useState([]);

    // --- Designer Workspace State ---
    const [substations, setSubstations] = useState([]);
    const [expandedNodes, setExpandedNodes] = useState(new Set());

    const [activeVersionId, setActiveVersionId] = useState(() => getInitialState('activeVersionId', null));
    const [schemeType, setSchemeType] = useState(() => getInitialState('schemeType', 'UFLS'));
    const [versionLabel, setVersionLabel] = useState(() => getInitialState('versionLabel', ''));
    const [reviewYear, setReviewYear] = useState(() => getInitialState('reviewYear', new Date().getFullYear()));
    const [stages, setStages] = useState(() => getInitialState('stages', [{ id: Date.now(), stage_number: 1, label: 'Stage 1', transformer_bays: [], pocket_bays: [], setting_ids: [] }]));
    const [activeStageIdx, setActiveStageIdx] = useState(() => getInitialState('activeStageIdx', 0));
    const [detailedSubstations, setDetailedSubstations] = useState(() => getInitialState('detailedSubstations', {}));

    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Settings Modal & Tab State ---
    const [showStageSettingsModal, setShowStageSettingsModal] = useState(false);

    // Inline add setting form
    const [newSettingThreshold, setNewSettingThreshold] = useState('');
    const [newSettingTimeDelay, setNewSettingTimeDelay] = useState('');

    const getSortedSettings = (settingsList) => {
        return [...settingsList].sort((a, b) => {
            if (b.threshold !== a.threshold) {
                return b.threshold - a.threshold; // Higher threshold first
            }
            return a.time_delay - b.time_delay; // or smaller delay first (per example: 0s before 60s)
        });
    };

    // --- Create Stage Modal State ---
    const [showCreateStageModal, setShowCreateStageModal] = useState(false);
    const [newStageNumber, setNewStageNumber] = useState(1);
    const [newStageLabel, setNewStageLabel] = useState('');
    const [newStageSettings, setNewStageSettings] = useState([]);

    const fetchMasterData = async () => {
        setLoading(true);
        try {
            const [userRes, relayRes, versionRes, settingsRes, subsRes] = await Promise.all([
                api.get('/users/me/'),
                api.get('/load-shedding-relays/'),
                api.get('/load-shedding-versions/'),
                api.get('/load-shedding-settings/'),
                api.get('/substations/')
            ]);
            setCurrentUser(userRes.data);
            setRelays(relayRes.data);
            setVersions(versionRes.data);
            setGlobalSettings(settingsRes.data);
            setSubstations(subsRes.data);
        } catch (err) {
            console.error("Failed to fetch designer data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMasterData();
    }, [view]); // Refresh when going back to manager

    // --- Session Storage Auto-Save ---
    useEffect(() => {
        if (view === 'designer') {
            const draftState = {
                activeVersionId, schemeType, versionLabel, reviewYear, stages, activeStageIdx, detailedSubstations
            };
            sessionStorage.setItem('ls_draft_state', JSON.stringify(draftState));
        }
    }, [activeVersionId, schemeType, versionLabel, reviewYear, stages, activeStageIdx, detailedSubstations, view]);

    // ==========================================
    // VERSION MANAGER LOGIC
    // ==========================================

    const handleCreateNew = () => {
        sessionStorage.removeItem('ls_draft_state');
        setSchemeType('UFLS');
        setReviewYear(new Date().getFullYear());
        setVersionLabel('');
        setStages([{ id: Date.now(), stage_number: 1, label: 'Stage 1', transformer_bays: [], pocket_bays: [], setting_ids: [] }]);
        setActiveStageIdx(0);
        setActiveVersionId(null);
        setView('designer');
        setActiveTab('stages');
    };

    const handleResumeDraft = async (vId) => {
        setLoading(true);
        try {
            const res = await api.get(`/load-shedding-versions/${vId}/`);
            const vData = res.data;
            setSchemeType(vData.scheme_type);
            setReviewYear(vData.review_year);
            setVersionLabel(vData.notes);
            setActiveVersionId(vData.id);

            if (vData.stages && vData.stages.length > 0) {
                // Fetch full details for each stage (including transformer bays)
                const detailedStages = await Promise.all(
                    vData.stages.map(async (s) => {
                        const sDetail = await api.get(`/load-shedding-stages/${s.id}/?include_bays=true`);
                        const stageData = sDetail.data;
                        return {
                            id: stageData.id,
                            stage_number: stageData.stage_number,
                            label: stageData.label,
                            setting_ids: (stageData.settings || []).map(stg => stg.id),
                            transformer_bays: stageData.transformer_bays || [],
                            pocket_bays: stageData.pocket_bays || []
                        };
                    })
                );
                // Sort by stage_number
                detailedStages.sort((a, b) => a.stage_number - b.stage_number);
                setStages(detailedStages);
            } else {
                setStages([{ id: Date.now(), stage_number: 1, label: 'Stage 1', transformer_bays: [], pocket_bays: [], setting_ids: [] }]);
            }
            setActiveStageIdx(0);
            setView('designer');
            setActiveTab('stages');
        } catch (err) {
            console.error("Failed to load draft", err);
            alert("Failed to load draft. See console.");
        } finally {
            setLoading(false);
        }
    };

    const handleCloneAndEdit = async (vId) => {
        setLoading(true);
        try {
            const res = await api.post(`/load-shedding-versions/${vId}/clone/`);
            if (res.data && res.data.id) {
                // Call resume on the newly cloned draft ID
                await handleResumeDraft(res.data.id);
            }
        } catch (err) {
            console.error("Failed to clone version", err);
            alert("Failed to clone. " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDraft = async (vId) => {
        if (!window.confirm("Are you sure you want to delete this draft?")) return;
        try {
            await api.delete(`/load-shedding-versions/${vId}/`);
            setVersions(versions.filter(v => v.id !== vId));
        } catch (err) {
            alert("Failed to delete draft. " + (err.response?.data?.error || err.message));
        }
    };

    // ==========================================
    // DESIGNER LOGIC
    // ==========================================

    const handleOpenAddStage = () => {
        const nextNum = stages.length > 0 ? Math.max(...stages.map(s => s.stage_number)) + 1 : 1;
        setNewStageNumber(nextNum);
        setNewStageLabel(`Stage ${nextNum}`);
        setNewStageSettings([]);
        setShowCreateStageModal(true);
    };

    const confirmAddStage = () => {
        if (!newStageLabel.trim()) {
            alert("Please enter a stage label.");
            return;
        }

        // 1. Check for Duplicate Stage Number
        if (stages.some(s => s.stage_number === newStageNumber)) {
            alert(`A stage with number ${newStageNumber} already exists. Please use a unique number.`);
            return;
        }

        // 2. Check for Duplicate Settings Combination
        // Sort IDs to compare correctly as a set
        const sortedNewSettings = [...newStageSettings].sort().join(',');
        const duplicateSettings = stages.find(s => {
            const sortedExisting = [...(s.setting_ids || [])].sort().join(',');
            return sortedExisting === sortedNewSettings;
        });

        if (duplicateSettings) {
            alert(`A stage with this exact combination of settings already exists ("${duplicateSettings.label}").`);
            return;
        }

        const newStageObj = {
            id: Date.now(),
            stage_number: newStageNumber,
            label: newStageLabel,
            transformer_bays: [],
            pocket_bays: [],
            setting_ids: newStageSettings
        };
        setStages([...stages, newStageObj]);
        setActiveStageIdx(stages.length);
        setShowCreateStageModal(false);
    };

    const handleDeleteStage = async (idx) => {
        const stage = stages[idx];
        if (!window.confirm(`Are you sure you want to delete "${stage.label}"? This will also remove all bay assignments within this stage.`)) {
            return;
        }

        // Internal delete from backend if it exists
        if (typeof stage.id === 'string' || typeof stage.id === 'number' && stage.id > 1000000) {
            // It's a real UUID or temp timestamp, but let's check if it's strictly a UUID for backend delete
            if (stage.id.toString().includes('-')) {
                try {
                    await api.delete(`/load-shedding-stages/${stage.id}/`);
                } catch (err) {
                    console.error("Failed to delete stage from backend", err);
                }
            }
        }

        const newStages = stages.filter((_, i) => i !== idx);
        setStages(newStages);
        if (activeStageIdx >= newStages.length) {
            setActiveStageIdx(Math.max(0, newStages.length - 1));
        }
    };

    const addTransformerToStage = async (relay) => {
        const currentStages = [...stages];
        const active = currentStages[activeStageIdx];

        // Prevent duplicate relay in same stage
        if (active.transformer_bays.find(tb => tb.relay === relay.id)) {
            alert("This relay is already added to this stage.");
            return;
        }

        active.transformer_bays.push({
            id: 'temp_' + Date.now(),
            relay: relay.id,
            relay_substation_id: relay.substation, // <-- BUG FIX: It's relay.substation not substation_id mapped in Relay model
            transformers: (relay.load_transformers || []).map(tId => ({ id: tId })) // Store minimal ref
        });
        setStages(currentStages);

        // Fetch exact substation data if not loaded via tree expansion
        const subId = relay.substation;
        if (!detailedSubstations[subId]) {
            try {
                const [res, txRes] = await Promise.all([
                    api.get(`/substations/${subId}/`),
                    api.get(`/load-transformers/?substation=${subId}`)
                ]);
                const data = res.data;
                data.db_transformers = txRes.data;
                setDetailedSubstations(prev => ({ ...prev, [subId]: data }));
            } catch (err) {
                console.error("Failed to fetch sub data mapping for MW calc", err);
            }
        }
    };

    const refreshStageData = async (stageIdx) => {
        const stage = stages[stageIdx];
        if (!stage || !stage.transformer_bays) return;

        const subIds = [...new Set(stage.transformer_bays.map(b => b.relay_substation_id))];

        for (const subId of subIds) {
            try {
                const [res, txRes] = await Promise.all([
                    api.get(`/substations/${subId}/`),
                    api.get(`/load-transformers/?substation=${subId}`)
                ]);
                const data = res.data;
                data.db_transformers = txRes.data;
                setDetailedSubstations(prev => ({ ...prev, [subId]: data }));
            } catch (err) {
                console.error(`Failed to refresh sub data mapping for ${subId}`, err);
            }
        }
    };

    const handleSaveWorkspace = async () => {
        setSaving(true);
        try {
            // 1. Create or Update Version
            let vId = activeVersionId;
            if (!vId) {
                const versionRes = await api.post('/load-shedding-versions/', {
                    scheme_type: schemeType.includes('UFLS') ? 'UFLS' : (schemeType.includes('UVLS') ? 'UVLS' : 'EMLS'),
                    review_year: reviewYear,
                    notes: versionLabel,
                    status: 'draft'
                });
                vId = versionRes.data.id;
                setActiveVersionId(vId);
            } else {
                await api.patch(`/load-shedding-versions/${vId}/`, {
                    scheme_type: schemeType.includes('UFLS') ? 'UFLS' : (schemeType.includes('UVLS') ? 'UVLS' : 'EMLS'),
                    review_year: reviewYear,
                    notes: versionLabel
                });
            }

            // 2. We simply delete all stages for this draft and recreate them to avoid complex diffing logic for now
            // (Only because this is a draft. Do not do this for active versions)
            const oldStagesRes = await api.get(`/load-shedding-stages/?version=${vId}`);
            for (const oldS of oldStagesRes.data) {
                await api.delete(`/load-shedding-stages/${oldS.id}/`);
            }

            // 3. Create stages and assignments
            for (const stage of stages) {
                const stageRes = await api.post('/load-shedding-stages/', {
                    version: vId,
                    stage_number: stage.stage_number,
                    label: stage.label,
                    setting_ids: stage.setting_ids
                });
                const stageId = stageRes.data.id;

                // Add transformer bays
                for (const tb of stage.transformer_bays || []) {
                    await api.post('/load-shedding-transformer-bays/', {
                        stage: stageId,
                        relay: tb.relay,
                        transformers: tb.transformers.map(t => t.id)
                    });
                }
            }
            sessionStorage.removeItem('ls_draft_state');
            alert("Draft saved successfully!");
        } catch (err) {
            console.error("Failed to save scheme", err);

            // Try to extract useful error message based on DRF format
            let errStr = "Check console.";
            if (err.response?.data) {
                if (typeof err.response.data === 'object') {
                    errStr = JSON.stringify(err.response.data);
                } else {
                    errStr = err.response.data;
                }
            }
            alert("Save failed: " + errStr);
        } finally {
            setSaving(false);
        }
    };

    // ==========================================
    // SETTINGS LOGIC
    // ==========================================

    const handleAddNewSetting = async () => {
        if (!newSettingThreshold || !newSettingTimeDelay) {
            alert("Threshold and Time Delay are required.");
            return;
        }

        try {
            const res = await api.post('/load-shedding-settings/', {
                scheme_type: schemeType.includes('UFLS') ? 'UFLS' : 'UVLS',
                threshold: parseFloat(newSettingThreshold),
                time_delay: parseFloat(newSettingTimeDelay)
            });
            const newSetting = res.data;
            setGlobalSettings([...globalSettings, newSetting]);

            setNewSettingThreshold('');
            setNewSettingTimeDelay('');

            // If we are in the stage modal, auto-assign it
            if (showStageSettingsModal) {
                const newStages = [...stages];
                if (!newStages[activeStageIdx].setting_ids.includes(newSetting.id)) {
                    newStages[activeStageIdx].setting_ids.push(newSetting.id);
                    setStages(newStages);
                }
            }
        } catch (err) {
            alert("Failed to create setting. " + JSON.stringify(err.response?.data || err.message));
        }
    };

    const handleDeleteSetting = async (sId) => {
        if (!window.confirm("Are you sure? This will remove the setting from ANY stage using it globally.")) return;
        try {
            await api.delete(`/load-shedding-settings/${sId}/`);
            setGlobalSettings(globalSettings.filter(s => s.id !== sId));

            // Cleanup local state
            const newStages = [...stages].map(stg => ({
                ...stg,
                setting_ids: stg.setting_ids.filter(id => id !== sId)
            }));
            setStages(newStages);
        } catch (err) {
            alert("Failed to delete setting.");
        }
    };

    const toggleStageSetting = (sId) => {
        const newStages = [...stages];
        const currentIds = newStages[activeStageIdx].setting_ids;
        if (currentIds.includes(sId)) {
            newStages[activeStageIdx].setting_ids = currentIds.filter(id => id !== sId);
        } else {
            newStages[activeStageIdx].setting_ids.push(sId);
        }
        setStages(newStages);
    };

    // ==========================================
    // RENDER HELPERS
    // ==========================================

    const calculateTotalMW = (stage) => {
        if (!stage) return "0.00";
        let total = 0;
        let anyLoading = false;

        stage.transformer_bays?.forEach(bay => {
            const subId = bay.relay_substation_id;
            const detail = detailedSubstations[subId];

            if (!detail || !detail.transformers || !detail.db_transformers) {
                // If this substation's data hasn't been fetched via Expansion yet, we can't get exact MW
                anyLoading = true;
                return;
            }

            bay.transformers?.forEach(transformerObj => {
                const transformerId = typeof transformerObj === 'object' ? transformerObj.id : transformerObj;
                const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId));
                if (dbTx) {
                    const expectedName = `TX T${dbTx.transformer_no}`;
                    const tx = detail.transformers.find(t => t.name.includes(expectedName) || t.name === expectedName);
                    if (tx && tx.load_mw != null) {
                        total += parseFloat(tx.load_mw);
                    }
                }
            });
        });

        if (anyLoading && total === 0) return "Loading...";
        return total.toFixed(2);
    };

    const isStaff = currentUser?.is_staff || false;
    const drafts = versions.filter(v => v.status === 'draft');
    const published = versions.filter(v => ['active', 'deactivated'].includes(v.status));

    if (loading && view === 'manager') {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--accent-cyan)' }}><RotateCcw className="animate-spin" size={32} /></div>;
    }

    // ==========================================
    // VIEW: MANAGER
    // ==========================================
    // ==========================================
    // VIEW: MANAGER
    // ==========================================
    if (view === 'manager') {
        const hasDrafts = drafts.length > 0;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', height: 'calc(100vh - 8rem)', overflowY: 'auto', padding: '2rem', fontFamily: "'Inter', sans-serif" }}>

                {/* Header Area */}
                <div style={{ textAlign: 'center', marginBottom: '1rem', marginTop: '1rem' }}>
                    <h2 style={{
                        fontSize: '2.5rem',
                        fontWeight: 800,
                        margin: 0,
                        background: 'linear-gradient(135deg, #ffffff 0%, #00e5ff 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '0.5px'
                    }}>
                        Load Shedding Scheme Architect
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.5rem', maxWidth: '600px', margin: '0.5rem auto 0 auto' }}>
                        Choose how you want to design your load shedding scheme.
                    </p>
                </div>

                {/* Main Hero Actions Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

                    {/* Action 1: Create New */}
                    <div
                        className="glass-card hover-glow"
                        onClick={handleCreateNew}
                        style={{
                            padding: '2.5rem 2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            cursor: 'pointer',
                            border: '1px solid rgba(0, 229, 255, 0.3)',
                            background: 'linear-gradient(180deg, rgba(0, 229, 255, 0.05) 0%, rgba(0,0,0,0.4) 100%)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0, 229, 255, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
                            color: 'var(--accent-cyan)', boxShadow: '0 0 20px rgba(0, 229, 255, 0.2)'
                        }}>
                            <Plus size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#fff' }}>Start from Scratch</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                            Begin with a blank canvas. Build a completely new UFLS, UVLS, or EMLS design from the ground up.
                        </p>
                    </div>

                    {/* Action 2: Active Drafts */}
                    <div
                        className="glass-card"
                        style={{
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            border: '1px solid rgba(255, 171, 0, 0.3)',
                            background: 'linear-gradient(180deg, rgba(255, 171, 0, 0.05) 0%, rgba(0,0,0,0.4) 100%)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255, 171, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFAB00' }}>
                                <FaFolderTree size={20} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>Resume Active Drafts</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Continue working on an existing design.</p>
                            </div>
                        </div>

                        {hasDrafts ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto', maxHeight: '300px', paddingRight: '0.5rem' }}>
                                {drafts.map(v => (
                                    <div key={v.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: '#FFAB00', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>{v.scheme_type} {v.review_year} v{v.version}</div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{v.notes || 'Unnamed Document'}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn-secondary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: '#fff' }} onClick={() => handleResumeDraft(v.id)}>
                                                <FolderOpen size={12} style={{ marginRight: '4px' }} /> Resume
                                            </button>
                                            <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none' }} onClick={() => handleDeleteDraft(v.id)}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '0.85rem' }}>No active drafts.</div>
                                <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.7 }}>Start from scratch or clone a published version.</div>
                            </div>
                        )}
                    </div>

                    {/* Action 3: Published Versions */}
                    <div
                        className="glass-card"
                        style={{
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(0,0,0,0.4) 100%)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}>
                                <FaShieldHalved size={20} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>Clone Published Scheme</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Use an active system as your baseline.</p>
                            </div>
                        </div>

                        {published.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto', maxHeight: '300px', paddingRight: '0.5rem' }}>
                                {published.map(v => (
                                    <div key={v.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: v.status === 'active' ? 1 : 0.6 }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: v.status === 'active' ? 'var(--accent-cyan)' : 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>
                                                {v.status} • {v.scheme_type} {v.review_year} v{v.version}
                                            </div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{v.notes || 'System Baseline'}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Published: {formatDate(v.published_at)}</div>
                                        </div>
                                        <button className="btn-secondary" style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: '#fff' }} onClick={() => handleCloneAndEdit(v.id)}>
                                            <Copy size={12} style={{ marginRight: '4px' }} /> Clone to Draft
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '0.85rem' }}>No published schemes found.</div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        );
    }

    // ==========================================
    // VIEW: DESIGNER WORKSPACE
    // ==========================================
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 8rem)', fontFamily: "'Inter', sans-serif" }}>

            {/* Top Bar Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <button className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%' }} onClick={() => setView('manager')}>
                        <ChevronRight style={{ transform: 'rotate(180deg)' }} size={16} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(255, 171, 0, 0.1)', color: '#FFAB00', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Workspace</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{schemeType} {reviewYear}</span>
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{versionLabel || 'Untitled Design'}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '4px' }}>
                    <button
                        style={{ padding: '0.5rem 1rem', background: activeTab === 'stages' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'stages' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        onClick={() => setActiveTab('stages')}
                    >
                        <Layout size={14} /> Stage Designer
                    </button>
                    <button
                        style={{ padding: '0.5rem 1rem', background: activeTab === 'settings' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'settings' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        onClick={() => setActiveTab('settings')}
                    >
                        <SettingsIcon size={14} /> Scheme Settings
                    </button>
                </div>
            </div>

            {/* TAB: STAGE DESIGNER */}
            {activeTab === 'stages' && (
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem', overflow: 'hidden' }}>
                    {/* Left Sidebar: Scheme Settings & Stages */}
                    <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Profile</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Scheme Type</label>
                                        {activeVersionId && <Lock size={12} style={{ color: 'var(--accent-cyan)', opacity: 0.8 }} />}
                                    </div>
                                    <select
                                        className="dark-input"
                                        style={{ width: '100%', opacity: activeVersionId ? 0.6 : 1, cursor: activeVersionId ? 'not-allowed' : 'default' }}
                                        value={schemeType}
                                        onChange={(e) => setSchemeType(e.target.value)}
                                        disabled={!!activeVersionId}
                                    >
                                        <option value="UFLS">UFLS (Under Frequency)</option>
                                        <option value="UVLS">UVLS (Under Voltage)</option>
                                        <option value="EMLS">EMLS (Manual Load Shedding)</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Review Year</label>
                                            {activeVersionId && <Lock size={12} style={{ color: 'var(--accent-cyan)', opacity: 0.8 }} />}
                                        </div>
                                        <input
                                            type="number"
                                            className="dark-input"
                                            style={{ width: '100%', opacity: activeVersionId ? 0.6 : 1, cursor: activeVersionId ? 'not-allowed' : 'default' }}
                                            value={reviewYear}
                                            onChange={(e) => setReviewYear(Number(e.target.value))}
                                            disabled={!!activeVersionId}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Document Name (Notes)</label>
                                        {activeVersionId && <Lock size={12} style={{ color: 'var(--accent-cyan)', opacity: 0.8 }} />}
                                    </div>
                                    <input
                                        type="text"
                                        className="dark-input"
                                        style={{ width: '100%', opacity: activeVersionId ? 0.6 : 1, cursor: activeVersionId ? 'not-allowed' : 'default' }}
                                        placeholder="e.g. 2026 National UFLS"
                                        value={versionLabel}
                                        onChange={(e) => setVersionLabel(e.target.value)}
                                        disabled={!!activeVersionId}
                                    />
                                    {activeVersionId && (
                                        <div style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', marginTop: '6px', fontStyle: 'italic', opacity: 0.8 }}>
                                            Profile is locked for existing drafts to maintain data integrity.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Defined Stages</div>
                                <button onClick={handleOpenAddStage} style={{ padding: '4px', borderRadius: '4px', background: 'rgba(0, 255, 163, 0.1)', color: 'var(--accent-cyan)', border: 'none', cursor: 'pointer' }}>
                                    <Plus size={16} />
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {stages.map((stage, idx) => (
                                    <div
                                        key={stage.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s',
                                            background: activeStageIdx === idx ? 'rgba(0, 255, 163, 0.1)' : 'rgba(255,255,255,0.02)',
                                            border: activeStageIdx === idx ? '1px solid rgba(0, 255, 163, 0.3)' : '1px solid transparent',
                                            color: activeStageIdx === idx ? 'var(--accent-cyan)' : 'inherit'
                                        }}
                                        onClick={() => setActiveStageIdx(idx)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{stage.label}</div>
                                        </div>
                                        <button style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleDeleteStage(idx); }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Middle: Content Builder */}
                    <div className="glass-card" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', padding: 0 }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                                <div style={{ padding: '0.5rem', background: 'rgba(0, 255, 163, 0.1)', borderRadius: '8px', color: 'var(--accent-cyan)' }}>
                                    <FaLayerGroup size={18} />
                                </div>
                                <input
                                    type="text"
                                    className="dark-input"
                                    style={{ fontSize: '1.25rem', fontWeight: 'bold', background: 'transparent', border: 'none', padding: 0, width: '150px', minWidth: '100px', color: '#fff' }}
                                    value={stages[activeStageIdx]?.label}
                                    onChange={(e) => {
                                        const newStages = [...stages];
                                        newStages[activeStageIdx].label = e.target.value;
                                        setStages(newStages);
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {stages[activeStageIdx]?.setting_ids?.map(sId => {
                                        const setting = globalSettings.find(s => s.id === sId);
                                        if (!setting) return null;
                                        const unit = setting.scheme_type === 'UVLS' ? 'kV' : 'Hz';
                                        return (
                                            <div key={sId} style={{
                                                fontSize: '0.75rem', color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.15)',
                                                padding: '4px 10px', borderRadius: '6px', fontWeight: 600, border: '1px solid rgba(59, 130, 246, 0.3)'
                                            }}>
                                                {setting.threshold}{unit} {setting.time_delay}s
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {schemeType !== 'EMLS' && (
                                    <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.75rem', position: 'relative' }} onClick={() => setShowStageSettingsModal(true)}>
                                        <SettingsIcon size={14} /> Stage Settings
                                        {stages[activeStageIdx]?.setting_ids?.length > 0 && (
                                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--accent-cyan)', color: '#000', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                {stages[activeStageIdx].setting_ids.length}
                                            </div>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '4rem' }}>
                            {/* Transformer Assignment */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                        <FaBolt size={14} style={{ color: 'var(--accent-cyan)' }} /> Transformer Bays
                                    </h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                                            {calculateTotalMW(stages[activeStageIdx])} {calculateTotalMW(stages[activeStageIdx]) === "Loading..." ? "" : "MW"}
                                        </div>
                                        <button
                                            title="Fetch detailed bay mapping data"
                                            onClick={() => refreshStageData(activeStageIdx)}
                                            style={{
                                                background: 'rgba(0, 255, 163, 0.1)', border: '1px solid rgba(0, 255, 163, 0.2)', color: 'var(--accent-cyan)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                padding: '4px', borderRadius: '4px', cursor: 'pointer'
                                            }}
                                            className="hover-glow"
                                        >
                                            <RefreshCw size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {stages[activeStageIdx]?.transformer_bays?.map((bay, idx) => {
                                        const subId = bay.relay_substation_id;
                                        const detail = detailedSubstations[subId];
                                        let infoDisplay = `${bay.transformers?.length || 0} TXs`;
                                        let voltageLabel = "";

                                        if (detail && detail.db_transformers && detail.transformers) {
                                            const labels = [];
                                            let detectedVoltage = null;
                                            bay.transformers?.forEach(txObj => {
                                                const tId = typeof txObj === 'object' ? txObj.id : txObj;
                                                const dbTx = detail.db_transformers.find(t => String(t.id) === String(tId));
                                                if (dbTx) {
                                                    labels.push(`T${dbTx.transformer_no}`);
                                                    if (!detectedVoltage && dbTx.lv_voltage) detectedVoltage = dbTx.lv_voltage;
                                                }
                                            });
                                            if (labels.length > 0) {
                                                const relayObj = relays.find(r => r.id === bay.relay);
                                                if (relayObj && relayObj.relay_name) {
                                                    voltageLabel = relayObj.relay_name.replace(' System', '');
                                                } else if (detectedVoltage) {
                                                    voltageLabel = `${detectedVoltage}kV`;
                                                }
                                                infoDisplay = `${voltageLabel ? voltageLabel + ' | ' : ''}${labels.join(', ')}`;
                                            }
                                        }

                                        return (
                                            <div key={bay.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                padding: '0.3rem 0.4rem 0.3rem 0.5rem', borderRadius: '16px',
                                                background: 'rgba(0, 255, 163, 0.05)', border: '1px solid rgba(0, 255, 163, 0.2)'
                                            }}>
                                                <FaBolt size={10} style={{ color: 'var(--accent-cyan)' }} />
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, fontFamily: 'monospace', color: '#fff' }}>{subId}</div>
                                                <div style={{
                                                    fontSize: '0.7rem',
                                                    color: 'var(--accent-cyan)',
                                                    fontWeight: 600,
                                                    paddingLeft: '0.2rem',
                                                    borderLeft: '1px solid rgba(0, 255, 163, 0.2)'
                                                }}>
                                                    {infoDisplay}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const newStages = [...stages];
                                                        newStages[activeStageIdx].transformer_bays.splice(idx, 1);
                                                        setStages(newStages);
                                                    }}
                                                    style={{
                                                        background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        width: '18px', height: '18px', borderRadius: '50%',
                                                        transition: 'all 0.2s', marginLeft: '0.2rem'
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(239, 68, 68, 0.6)'; }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {(!stages[activeStageIdx]?.transformer_bays || stages[activeStageIdx].transformer_bays.length === 0) && (
                                        <div style={{ width: '100%', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'default' }}>
                                            <div style={{ fontSize: '0.85rem' }}>Click assets in the Library to add them</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pocket Assignment Placeholder */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, opacity: 0.5 }}>
                                        <FaCircleNodes size={14} style={{ color: 'var(--accent-blue)' }} /> Network Pockets
                                    </h4>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {/* Once integrated, map pocket_bays similar to transformer_bays with pills */}
                                    <div style={{ width: '100%', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'not-allowed', opacity: 0.3 }}>
                                        <div style={{ fontSize: '0.75rem' }}>Pocket Generation API pending integration</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sticky Footer */}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1rem 1.5rem', background: 'rgba(10, 12, 16, 0.9)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFAB00' }}></div>
                                Draft Mode Active
                            </div>
                            <button
                                className="btn-primary"
                                onClick={handleSaveWorkspace}
                                disabled={saving}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', fontSize: '0.85rem', boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)', opacity: saving ? 0.7 : 1 }}
                            >
                                {saving ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />}
                                {saving ? 'Saving...' : 'Save Workspace'}
                            </button>
                        </div>
                    </div>

                    {/* Right: Asset Library */}
                    <div className="glass-card" style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Asset Library</div>
                            <div style={{ position: 'relative' }}>
                                <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={14} />
                                <input
                                    type="text"
                                    placeholder="Search Relay / Substation..."
                                    className="dark-input"
                                    style={{ paddingLeft: '2.25rem', fontSize: '0.85rem', width: '100%' }}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {(() => {
                                // 1. Group relays by Region -> Grid -> Substation
                                const tree = {};
                                const term = searchTerm.toLowerCase();

                                relays.forEach(relay => {
                                    const sub = substations.find(s => s.substation_id === relay.substation);
                                    if (!sub) return;

                                    const region = sub.region || 'Unknown Region';
                                    const grid = sub.grid || 'Unknown Grid';
                                    const subId = sub.substation_id;

                                    if (term && !subId.toLowerCase().includes(term) && !(relay.relay_name || "").toLowerCase().includes(term)) {
                                        return;
                                    }

                                    if (!tree[region]) tree[region] = {};
                                    if (!tree[region][grid]) tree[region][grid] = {};
                                    if (!tree[region][grid][subId]) tree[region][grid][subId] = { substation: sub, relays: [] };

                                    tree[region][grid][subId].relays.push(relay);
                                });

                                const toggleNode = (nodeId) => {
                                    setExpandedNodes(prev => {
                                        const newSet = new Set(prev);
                                        if (newSet.has(nodeId)) {
                                            newSet.delete(nodeId);
                                        } else {
                                            newSet.add(nodeId);
                                        }
                                        return newSet;
                                    });
                                };

                                const handleExpandRelay = async (relayId, subId) => {
                                    const rId = `relay-${relayId}`;
                                    toggleNode(rId);

                                    // If already fetching or fetched, return
                                    if (detailedSubstations[subId]) return;

                                    try {
                                        const [res, txRes] = await Promise.all([
                                            api.get(`/substations/${subId}/`),
                                            api.get(`/load-transformers/?substation=${subId}`)
                                        ]);

                                        const data = res.data;
                                        data.db_transformers = txRes.data;

                                        setDetailedSubstations(prev => ({
                                            ...prev,
                                            [subId]: data
                                        }));
                                    } catch (err) {
                                        console.error("Failed to fetch substation details for expansion", err);
                                        setDetailedSubstations(prev => ({
                                            ...prev,
                                            [subId]: { transformers: [], db_transformers: [] }
                                        }));
                                    }
                                };

                                const renderNodeHeader = (id, label, level, icon) => {
                                    const isExpanded = expandedNodes.has(id);
                                    return (
                                        <div
                                            onClick={() => toggleNode(id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                padding: '0.5rem', paddingLeft: `${0.5 + level * 1}rem`,
                                                cursor: 'pointer', borderRadius: '4px',
                                                background: 'transparent',
                                                transition: 'background 0.2s'
                                            }}
                                            className="hover-glow"
                                        >
                                            {isExpanded ? <ChevronDown size={14} color="var(--text-secondary)" /> : <ChevronRight size={14} color="var(--text-secondary)" />}
                                            {icon && <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>{icon}</span>}
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isExpanded ? '#fff' : 'var(--text-secondary)' }}>{label}</span>
                                        </div>
                                    );
                                };

                                const renderRelayNode = (relay, sub, paddingLevel) => {
                                    const rId = `relay-${relay.id}`;
                                    const isExpanded = expandedNodes.has(rId);

                                    let assignedStageLabel = null;
                                    for (const stage of stages) {
                                        if (stage.transformer_bays && stage.transformer_bays.some(bay => String(bay.relay) === String(relay.id))) {
                                            assignedStageLabel = stage.label || `Stage ${stage.stage_number}`;
                                            break;
                                        }
                                    }

                                    // CALCULATE TOTAL MW for this relay
                                    let totalMw = 0;
                                    let isTxDataLoading = false;
                                    let isTxDataAvailable = false;
                                    let txCount = 0;

                                    const detail = detailedSubstations[sub.substation_id];

                                    (Array.isArray(relay.load_transformers) ? relay.load_transformers : []).forEach(transformerId => {
                                        txCount++;
                                        if (detail && detail.transformers && detail.db_transformers) {
                                            const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId));
                                            if (dbTx) {
                                                const expectedName = `TX T${dbTx.transformer_no}`;
                                                const tx = detail.transformers.find(t => t.name.includes(expectedName) || t.name === expectedName);
                                                if (tx && tx.load_mw != null) {
                                                    totalMw += parseFloat(tx.load_mw);
                                                    isTxDataAvailable = true;
                                                }
                                            }
                                        } else if (expandedNodes.has(rId) && !detail) {
                                            isTxDataLoading = true;
                                        }
                                    });

                                    let mwBadge = null;
                                    if (txCount > 0) {
                                        if (isTxDataAvailable) {
                                            mwBadge = <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', background: 'rgba(0, 255, 163, 0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{totalMw.toFixed(2)} MW</span>;
                                        } else if (isTxDataLoading) {
                                            mwBadge = <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>Loading...</span>;
                                        } else if (!detail) {
                                            mwBadge = <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>-- MW</span>;
                                        }
                                    }

                                    return (
                                        <div key={relay.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div
                                                onClick={() => handleExpandRelay(relay.id, sub.substation_id)}
                                                style={{
                                                    display: 'flex', flexDirection: 'column', gap: '0.4rem',
                                                    padding: '0.4rem 0.5rem', paddingLeft: `${0.5 + paddingLevel * 1}rem`,
                                                    cursor: 'pointer', borderRadius: '4px',
                                                    background: 'transparent',
                                                    transition: 'background 0.2s'
                                                }}
                                                className="hover-glow"
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                    {/* Row 1: Chevron, Checkbox, Voltage, and MW */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div
                                                            style={{ display: 'flex', alignItems: 'center', padding: '0.2rem', marginLeft: '-0.2rem' }}
                                                        >
                                                            {isExpanded ? <ChevronDown size={14} color="var(--accent-cyan)" /> : <ChevronRight size={14} color="var(--accent-cyan)" />}
                                                        </div>
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!assignedStageLabel) addTransformerToStage(relay);
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                cursor: assignedStageLabel ? 'not-allowed' : 'pointer',
                                                                opacity: assignedStageLabel ? 0.5 : 1
                                                            }}
                                                        >
                                                            {assignedStageLabel ? <CheckSquare size={14} color="var(--text-secondary)" /> : <Square size={14} color="var(--accent-cyan)" />}
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: assignedStageLabel ? 'var(--text-secondary)' : 'var(--accent-cyan)' }}>
                                                            {(relay.relay_name || 'System Relay').replace(' System', '')}
                                                        </span>
                                                        <div style={{ marginLeft: 'auto' }}>
                                                            {mwBadge}
                                                        </div>
                                                    </div>

                                                    {/* Row 2: Stage Label (if assigned) */}
                                                    {assignedStageLabel && (
                                                        <div style={{ paddingLeft: '2.5rem' }}>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                                Assigned: {assignedStageLabel}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '4px', paddingBottom: '8px' }}>
                                                    {(Array.isArray(relay.load_transformers) ? relay.load_transformers : []).map(transformerId => {
                                                        const detail = detailedSubstations[sub.substation_id];
                                                        let mwDisplay = "Loading...";
                                                        let labelDisplay = `TRF ID: ${transformerId}`;

                                                        let dbTx = null;
                                                        if (detail && detail.db_transformers) {
                                                            dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId));
                                                            if (dbTx) labelDisplay = `T${dbTx.transformer_no} (ID: ${transformerId})`;
                                                        }

                                                        if (detail && detail.transformers) {
                                                            let tx = null;
                                                            if (dbTx) {
                                                                const expectedName = `TX T${dbTx.transformer_no}`;
                                                                tx = detail.transformers.find(t => t.name.includes(expectedName) || t.name === expectedName);
                                                            }
                                                            if (tx) {
                                                                mwDisplay = `${tx.load_mw} MW`;
                                                                labelDisplay = `T${dbTx.transformer_no}`;
                                                            } else {
                                                                mwDisplay = "N/A";
                                                            }
                                                        } else if (expandedNodes.has(`relay-${relay.id}`) && !detailedSubstations[sub.substation_id]) {
                                                            mwDisplay = "Loading...";
                                                        } else {
                                                            mwDisplay = "N/A";
                                                        }

                                                        return (
                                                            <div key={`tx-${transformerId}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.3rem 0.5rem', paddingLeft: `${1.5 + paddingLevel * 1}rem`, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                    <FaBolt size={10} color="#FFAB00" />
                                                                    <span>{labelDisplay}</span>
                                                                </div>
                                                                <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', padding: '2px 4px', borderRadius: '2px', color: mwDisplay.includes('MW') ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>{mwDisplay}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {(!Array.isArray(relay.load_transformers) || relay.load_transformers.length === 0) && (
                                                        <div style={{ paddingLeft: `${1.5 + paddingLevel * 1}rem`, fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic', paddingBottom: '4px' }}>No Transformers</div>
                                                    )}

                                                    {(Array.isArray(relay.auto_transformers) ? relay.auto_transformers : []).map(atId => (
                                                        <div key={`at-${atId}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', paddingLeft: `${1.5 + paddingLevel * 1}rem`, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                            <FaBolt size={10} color="#FFAB00" />
                                                            <span>AutoTRF: {atId}</span>
                                                        </div>
                                                    ))}

                                                    {(Array.isArray(relay.incoming_branches) ? relay.incoming_branches : []).map(ibId => (
                                                        <div key={`ib-${ibId}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.5rem', paddingLeft: `${1.5 + paddingLevel * 1}rem`, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                            <FaCircleNodes size={10} color="var(--accent-blue)" />
                                                            <span>Branch: {ibId}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                };

                                return Object.keys(tree || {}).sort().map(region => {
                                    const rId = `region-${region}`;
                                    const grids = tree[region] || {};
                                    return (
                                        <div key={region}>
                                            {renderNodeHeader(rId, region, 0)}
                                            {expandedNodes.has(rId) && Object.keys(grids).sort().map(grid => {
                                                const gId = `grid-${region}-${grid}`;
                                                const subs = grids[grid] || {};
                                                return (
                                                    <div key={grid} style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: '12px' }}>
                                                        {renderNodeHeader(gId, grid, 1)}
                                                        {expandedNodes.has(gId) && Object.keys(subs).sort().map(subId => {
                                                            const sId = `sub-${region}-${grid}-${subId}`;
                                                            const nodeData = subs[subId];
                                                            if (!nodeData) return null;
                                                            const substation = nodeData.substation || { name: 'Unknown' };
                                                            const nodeRelays = nodeData.relays || [];
                                                            return (
                                                                <div key={subId} style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: '12px' }}>
                                                                    {renderNodeHeader(sId, `${substation.name} (${subId})`, 2)}
                                                                    {expandedNodes.has(sId) && (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                                                                            {nodeRelays.map(relay => renderRelayNode(relay, substation, 3))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                });
                            })()}

                            {relays.length === 0 && !loading && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    No load shedding relays found in the database.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: SCHEME SETTINGS */}
            {activeTab === 'settings' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Global Stage Settings</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Manage Trip Settings for UFLS and UVLS schemes. Settings are shared globally.</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>
                            {/* Left: Datatable */}
                            <div style={{ gridColumn: 'span 8' }}>
                                <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                <th style={{ padding: '1rem', fontWeight: 600 }}>Label</th>
                                                <th style={{ padding: '1rem', fontWeight: 600 }}>Type</th>
                                                <th style={{ padding: '1rem', fontWeight: 600 }}>Threshold</th>
                                                <th style={{ padding: '1rem', fontWeight: 600 }}>Time Delay</th>
                                                {isStaff && <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getSortedSettings(globalSettings.filter(s => s.scheme_type === schemeType)).map(s => (
                                                <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                                    <td style={{ padding: '1rem', fontWeight: 500 }}>{s.label}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 500 }}>{s.scheme_type}</span>
                                                    </td>
                                                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{s.threshold} {s.scheme_type === 'UVLS' ? 'p.u.' : 'Hz'}</td>
                                                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{s.time_delay} s</td>
                                                    {isStaff && (
                                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                            <button onClick={() => handleDeleteSetting(s.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}>
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                            {globalSettings.length === 0 && (
                                                <tr>
                                                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No settings defined.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Right: Add Form */}
                            <div style={{ gridColumn: 'span 4' }}>
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1.5rem', position: 'sticky', top: 0 }}>
                                    <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Add New Setting</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Threshold ({schemeType === 'UVLS' ? 'p.u.' : 'Hz'})</label>
                                            <input type="number" step="0.01" className="dark-input" style={{ width: '100%' }} value={newSettingThreshold} onChange={e => setNewSettingThreshold(e.target.value)} placeholder="e.g. 49.2" />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Time Delay (Seconds)</label>
                                            <input type="number" step="0.1" className="dark-input" style={{ width: '100%' }} value={newSettingTimeDelay} onChange={e => setNewSettingTimeDelay(e.target.value)} placeholder="e.g. 0.2" />
                                        </div>
                                        <button className="btn-primary" onClick={handleAddNewSetting} style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                                            <Plus size={16} /> Create Setting
                                        </button>
                                    </div>
                                    {!isStaff && (
                                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255, 171, 0, 0.05)', borderLeft: '3px solid #FFAB00', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <strong>Note:</strong> As a standard user, you can add new settings but only administrators can delete them.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STAGE SETTINGS MODAL */}
            <AnimatePresence>
                {showStageSettingsModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 9999
                        }}
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 20, opacity: 0, scale: 0.95 }}
                            className="glass-card"
                            style={{ width: '800px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}
                        >
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Assign Trip Settings</h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Choose which globally defined settings dictate this stage.</p>
                                </div>
                                <button onClick={() => setShowStageSettingsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                                {/* Left list of existing settings */}
                                <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '1rem', marginTop: 0 }}>Available {schemeType} Settings</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {getSortedSettings(globalSettings.filter(s => s.scheme_type === (schemeType.includes('UFLS') ? 'UFLS' : 'UVLS'))).map(s => {
                                            const isSelected = (stages[activeStageIdx]?.setting_ids || []).includes(s.id);
                                            return (
                                                <div
                                                    key={s.id}
                                                    onClick={() => toggleStageSetting(s.id)}
                                                    style={{
                                                        padding: '1rem',
                                                        borderRadius: '8px',
                                                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.1)',
                                                        background: isSelected ? 'rgba(0, 255, 163, 0.05)' : 'rgba(255,255,255,0.02)',
                                                        cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.label}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '4px' }}>{s.threshold} {s.scheme_type === 'UFLS' ? 'Hz' : 'pu'} • {s.time_delay}s</div>
                                                    </div>
                                                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: isSelected ? 'none' : '1px solid var(--text-secondary)', background: isSelected ? 'var(--accent-cyan)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {globalSettings.filter(s => s.scheme_type === (schemeType.includes('UFLS') ? 'UFLS' : 'UVLS')).length === 0 && (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                                                No existing settings found for {schemeType}. Add one to the right.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right quick-add form */}
                                <div style={{ width: '250px', padding: '1.5rem', background: 'rgba(0,0,0,0.2)' }}>
                                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', marginTop: 0 }}>Quick Add New Setting</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Threshold ({schemeType === 'UVLS' ? 'pu' : 'Hz'})</label>
                                            <input type="number" step="0.01" className="dark-input" style={{ width: '100%' }} value={newSettingThreshold} onChange={e => setNewSettingThreshold(e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Delay (s)</label>
                                            <input type="number" step="0.1" className="dark-input" style={{ width: '100%' }} value={newSettingTimeDelay} onChange={e => setNewSettingTimeDelay(e.target.value)} />
                                        </div>
                                        <button className="btn-secondary" onClick={handleAddNewSetting} style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)' }}>
                                            <Plus size={14} /> Add & Assign
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CREATE STAGE MODAL */}
            <AnimatePresence>
                {showCreateStageModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 9999
                        }}
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 20, opacity: 0, scale: 0.95 }}
                            className="glass-card"
                            style={{ width: '500px', maxWidth: '90vw', padding: '2rem' }}
                        >
                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Create New Stage</h3>
                            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Define the parameters for the next load shedding step.</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Stage Number</label>
                                        <input
                                            type="number"
                                            className="dark-input"
                                            style={{ width: '100%' }}
                                            value={newStageNumber}
                                            onChange={e => setNewStageNumber(Number(e.target.value))}
                                        />
                                    </div>
                                    <div style={{ flex: 2 }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Stage Label</label>
                                        <input
                                            type="text"
                                            className="dark-input"
                                            style={{ width: '100%' }}
                                            placeholder="e.g. Stage 5"
                                            value={newStageLabel}
                                            onChange={e => setNewStageLabel(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Assign Settings</label>
                                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        {getSortedSettings(globalSettings.filter(s => s.scheme_type === (schemeType.includes('UFLS') ? 'UFLS' : 'UVLS'))).map(s => (
                                            <div
                                                key={s.id}
                                                onClick={() => {
                                                    if (newStageSettings.includes(s.id)) {
                                                        setNewStageSettings(newStageSettings.filter(id => id !== s.id));
                                                    } else {
                                                        setNewStageSettings([...newStageSettings, s.id]);
                                                    }
                                                }}
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    background: newStageSettings.includes(s.id) ? 'rgba(0, 255, 163, 0.1)' : 'transparent',
                                                    marginBottom: '2px'
                                                }}
                                            >
                                                <span style={{ fontSize: '0.8rem', color: newStageSettings.includes(s.id) ? 'var(--accent-cyan)' : 'inherit' }}>{s.label}</span>
                                                {newStageSettings.includes(s.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                            </div>
                                        ))}
                                        {globalSettings.filter(s => s.scheme_type === (schemeType.includes('UFLS') ? 'UFLS' : 'UVLS')).length === 0 && (
                                            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No global settings found for {schemeType}.</div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                    <button className="btn-secondary" style={{ flex: 1, padding: '0.75rem' }} onClick={() => setShowCreateStageModal(false)}>Cancel</button>
                                    <button className="btn-primary" style={{ flex: 1, padding: '0.75rem' }} onClick={confirmAddStage}>Create Stage</button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

class DesignerErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("DESIGNER CRASHED:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: 'red', background: '#fff' }}>
                    <h2>Something went wrong in LoadSheddingDesigner.</h2>
                    <details style={{ whiteSpace: 'pre-wrap' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function LoadSheddingDesignerWrapper(props) {
    return (
        <DesignerErrorBoundary>
            <LoadSheddingDesigner {...props} />
        </DesignerErrorBoundary>
    );
}
