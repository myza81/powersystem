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
    RefreshCw,
    BarChart,
    ShieldAlert, Cpu, CheckCircle2, Loader2, ArrowLeft, ZoomIn, ZoomOut, Network, Maximize2, Minimize2, MapPin, Eye, Filter, EyeOff, List, Layers, Unlock, Database, Building2, TrendingUp, Download, Settings2, ListChecks, Pause, ArrowUpRight, Check, Activity, BarChart2, CheckCircle, Navigation, Anchor, MousePointerClick, Move
} from 'lucide-react';
import BulletChart from './BulletChart';
import CompactRegionalMetrics from './CompactRegionalMetrics';
import { FaWandMagicSparkles, FaFolderTree, FaShieldHalved, FaLayerGroup, FaBolt, FaCircleNodes, FaCodeBranch, FaLock, FaBullseye, FaGaugeHigh } from 'react-icons/fa6';
import { FiAlertCircle } from 'react-icons/fi';
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
    const [criticalAssets, setCriticalAssets] = useState([]);

    // --- Designer Workspace State ---
    const [substations, setSubstations] = useState([]);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [assetLibraryTab, setAssetLibraryTab] = useState('library'); // 'library' | 'alerts'

    const [activeVersionId, setActiveVersionId] = useState(() => getInitialState('activeVersionId', null));
    const [schemeType, setSchemeType] = useState(() => getInitialState('schemeType', 'UFLS'));
    const [versionLabel, setVersionLabel] = useState(() => getInitialState('versionLabel', ''));
    const [reviewYear, setReviewYear] = useState(() => getInitialState('reviewYear', new Date().getFullYear()));
    const [targetPercentage, setTargetPercentage] = useState(() => getInitialState('targetPercentage', 60));
    const [isMetricsDrawerOpen, setIsMetricsDrawerOpen] = useState(() => getInitialState('isMetricsDrawerOpen', true));

    // Auto-update default target percentage when scheme type changes for new drafts
    useEffect(() => {
        if (!activeVersionId) {
            if (schemeType === 'UFLS') setTargetPercentage(60);
            else if (schemeType === 'UVLS') setTargetPercentage(15);
            else setTargetPercentage(10);
        }
    }, [schemeType, activeVersionId]);

    const [stages, setStages] = useState(() => getInitialState('stages', [{ id: Date.now(), stage_number: 1, label: 'Stage 1', transformer_bays: [], pocket_bays: [], setting_ids: [], target_mw: 1000 }]));
    const [activeStageIdx, setActiveStageIdx] = useState(() => getInitialState('activeStageIdx', 0));
    const [detailedSubstations, setDetailedSubstations] = useState(() => getInitialState('detailedSubstations', {}));

    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [gridData, setGridData] = useState(null);
    const [fetchingAnalytics, setFetchingAnalytics] = useState(false);
    const [pocketPreview, setPocketPreview] = useState(null);
    const [fetchingPocket, setFetchingPocket] = useState(false);
    const [pocketCards, setPocketCards] = useState([]);

    // --- Settings Modal & Tab State ---
    const [showStageSettingsModal, setShowStageSettingsModal] = useState(false);
    const [activeStageSettingsTab, setActiveStageSettingsTab] = useState('general'); // 'general' | 'metrics'
    const [activeGlobalSettingsTab, setActiveGlobalSettingsTab] = useState('tripsettings'); // 'tripsettings' | 'conflict'

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
    const [editingStageIdx, setEditingStageIdx] = useState(null);
    const [newStageNumber, setNewStageNumber] = useState(1);
    const [newStageLabel, setNewStageLabel] = useState('');
    const [newStageTargetMW, setNewStageTargetMW] = useState(0);
    const [newStageSettings, setNewStageSettings] = useState([]);

    const fetchMasterData = async () => {
        setLoading(true);
        setFetchingAnalytics(true);
        try {
            // Fetch load analytics (System Total and Regional Breakdown)
            api.get('/load-analytics/aggregate/?level=grid').then(res => {
                setGridData(res.data);
                setFetchingAnalytics(false);
            }).catch(err => {
                console.error("Failed to fetch grid analytics", err);
                setFetchingAnalytics(false);
            });

            const [userRes, relayRes, versionRes, settingsRes, subsRes, criticalRes] = await Promise.all([
                api.get('/users/me/'),
                api.get('/load-shedding-relays/'),
                api.get('/load-shedding-versions/'),
                api.get('/load-shedding-settings/'),
                api.get('/substations/'),
                api.get('/critical-assets/')
            ]);
            setCurrentUser(userRes.data);
            setRelays(relayRes.data);
            setVersions(versionRes.data);
            setGlobalSettings(settingsRes.data);
            setSubstations(subsRes.data);
            setCriticalAssets(criticalRes.data);
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
                activeVersionId, schemeType, versionLabel, reviewYear, targetPercentage, isMetricsDrawerOpen, stages, activeStageIdx, detailedSubstations
            };
            sessionStorage.setItem('ls_draft_state', JSON.stringify(draftState));
        }
    }, [activeVersionId, schemeType, versionLabel, reviewYear, targetPercentage, isMetricsDrawerOpen, stages, activeStageIdx, detailedSubstations, view]);

    // --- Pocket Preview ---
    useEffect(() => {
        const activeBranches = stages[activeStageIdx]?.pocket_branches || [];
        if (activeBranches.length === 0) {
            setPocketPreview(null);
            return;
        }

        let cancelled = false;
        setFetchingPocket(true);
        api.post('/topology/pocket-preview/', { branch_ids: activeBranches })
            .then(res => {
                if (!cancelled) {
                    const data = res.data;
                    setPocketPreview(data);
                    // Auto-create pocket card if valid pocket formed (has substations and no warning)
                    if (data.pocket_substations?.length > 0 && !data.warning && !data.error) {
                        const groupKey = (subId, voltage) => `${subId}||${voltage || ''}`;
                        const groups = {};
                        activeBranches.forEach(fullId => {
                            const parts = fullId.split('_');
                            if (parts.length >= 3) {
                                const localSub = parts[0];
                                const voltageValue = substations.find(s => s.substation_id === localSub)?.voltage;
                                const key = groupKey(localSub, voltageValue);
                                if (!groups[key]) groups[key] = { subId: localSub, voltage: voltageValue ? `${voltageValue}kV` : '', branches: [] };
                                groups[key].branches.push(parts.slice(1).join('_'));
                            }
                        });
                        setPocketCards(prev => [...prev, {
                            id: Date.now(),
                            branches: [...activeBranches],
                            branchGroups: Object.values(groups),
                            pocket_substations: data.pocket_substations,
                            total_p_mw: data.total_p_mw,
                            total_q_mvar: data.total_q_mvar
                        }]);
                        // Clear branches after auto-creating pocket
                        const newStages = [...stages];
                        newStages[activeStageIdx] = { ...newStages[activeStageIdx], pocket_branches: [] };
                        setStages(newStages);
                    }
                }
            })
            .catch(() => {
                if (!cancelled) setPocketPreview({ error: "Failed to compute pocket." });
            })
            .finally(() => {
                if (!cancelled) setFetchingPocket(false);
            });

        return () => { cancelled = true; };
    }, [stages, activeStageIdx]);

    // ==========================================
    // VERSION MANAGER LOGIC
    // ==========================================

    const handleCreateNew = () => {
        sessionStorage.removeItem('ls_draft_state');
        setSchemeType('UFLS');
        setTargetPercentage(60);
        setReviewYear(new Date().getFullYear());
        setVersionLabel('');
        setStages([{ id: Date.now(), stage_number: 1, label: 'Stage 1', transformer_bays: [], pocket_bays: [], pocket_branches: [], setting_ids: [], target_mw: 1000 }]);
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
            setTargetPercentage(vData.target_percentage || (vData.scheme_type === 'UVLS' ? 15 : 60));
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
                            target_mw: stageData.target_mw || 0,
                            setting_ids: (stageData.settings || []).map(stg => stg.id),
                            transformer_bays: stageData.transformer_bays || [],
                            pocket_bays: stageData.pocket_bays || [],
                            pocket_branches: (stageData.pocket_bays || []).flatMap(pb =>
                                (pb.boundaries || []).flatMap(bound =>
                                    (bound.branches || []).map(bId => {
                                        let foundBayId = null;
                                        relays.forEach(r => {
                                            const br = (r.incoming_branches || []).find(b => b.id === bId);
                                            if (br) foundBayId = br.bay_id;
                                        });
                                        return foundBayId;
                                    })
                                )
                            ).filter(id => id !== null)
                        };
                    })
                );
                // Sort by stage_number
                detailedStages.sort((a, b) => a.stage_number - b.stage_number);
                setStages(detailedStages);
            } else {
                setStages([{ id: Date.now(), stage_number: 1, label: 'Stage 1', target_mw: 1000, transformer_bays: [], pocket_bays: [], setting_ids: [] }]);
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
        setEditingStageIdx(null);
        setNewStageNumber(nextNum);
        setNewStageLabel(`Stage ${nextNum}`);
        setNewStageTargetMW(1000);
        setNewStageSettings([]);
        setShowCreateStageModal(true);
    };

    const handleOpenEditStage = (idx) => {
        const stage = stages[idx];
        setEditingStageIdx(idx);
        setNewStageNumber(stage.stage_number);
        setNewStageLabel(stage.label);
        setNewStageTargetMW(stage.target_mw || 0);
        setNewStageSettings([...(stage.setting_ids || [])]);
        setShowCreateStageModal(true);
    };

    const confirmAddStage = () => {
        if (!newStageLabel.trim()) {
            alert("Please enter a stage label.");
            return;
        }

        // 1. Check for Duplicate Stage Number
        if (stages.some((s, i) => i !== editingStageIdx && s.stage_number === newStageNumber)) {
            alert(`A stage with number ${newStageNumber} already exists. Please use a unique number.`);
            return;
        }

        // 2. Check for Duplicate Settings Combination
        // Sort IDs to compare correctly as a set
        const sortedNewSettings = [...newStageSettings].sort().join(',');
        const duplicateSettings = stages.find((s, i) => {
            if (i === editingStageIdx) return false;
            const sortedExisting = [...(s.setting_ids || [])].sort().join(',');
            return sortedExisting === sortedNewSettings;
        });

        if (duplicateSettings) {
            alert(`A stage with this exact combination of settings already exists ("${duplicateSettings.label}").`);
            return;
        }

        if (editingStageIdx !== null) {
            const updatedStages = [...stages];
            updatedStages[editingStageIdx] = {
                ...updatedStages[editingStageIdx],
                stage_number: newStageNumber,
                label: newStageLabel,
                setting_ids: newStageSettings,
                target_mw: newStageTargetMW || 0.0
            };
            setStages(updatedStages);
            setEditingStageIdx(null);
        } else {
            const newStageObj = {
                id: Date.now(),
                stage_number: newStageNumber,
                label: newStageLabel,
                transformer_bays: [],
                pocket_bays: [],
                pocket_branches: [],
                setting_ids: newStageSettings,
                target_mw: newStageTargetMW || 0.0
            };
            setStages([...stages, newStageObj]);
            setActiveStageIdx(stages.length);
        }
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

        const activeBays = [...active.transformer_bays, {
            id: 'temp_' + Date.now(),
            relay: relay.id,
            relay_substation_id: relay.substation_id || relay.substation, // Use mnemonic if available
            transformers: (relay.load_transformers || []).map(tId => ({ id: tId })) // Store minimal ref
        }];

        currentStages[activeStageIdx] = {
            ...currentStages[activeStageIdx],
            transformer_bays: activeBays
        };

        setStages(currentStages);

        // Fetch exact substation data if not loaded via tree expansion
        const subId = relay.substation_id || relay.substation;
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

    const toggleBranchInStage = (bayId, localSubstationId) => {
        const currentStages = [...stages];
        const active = { ...currentStages[activeStageIdx] };

        // Reconstruct full bay_id if needed (incoming branches display as remote-end only)
        let fullId = bayId;
        if (localSubstationId && !fullId.includes('_')) {
            fullId = `${localSubstationId}_${fullId}`;
        }

        const existing = active.pocket_branches || [];
        const isAdded = existing.includes(fullId);
        active.pocket_branches = isAdded
            ? existing.filter(id => id !== fullId)
            : [...existing, fullId];

        currentStages[activeStageIdx] = active;
        setStages(currentStages);
    };

    const toggleTransformerInStage = (relay, transformerId) => {
        const currentStages = [...stages];
        const active = { ...currentStages[activeStageIdx] };
        const existingBayIdx = active.transformer_bays.findIndex(tb => tb.relay === relay.id);

        if (existingBayIdx > -1) {
            // Relay already in stage
            const bay = { ...active.transformer_bays[existingBayIdx] };
            const txList = [...bay.transformers];
            const txIdx = txList.findIndex(t => String(t.id) === String(transformerId));

            if (txIdx > -1) {
                // Remove transformer
                txList.splice(txIdx, 1);
                if (txList.length === 0) {
                    // Remove bay if empty
                    active.transformer_bays.splice(existingBayIdx, 1);
                } else {
                    bay.transformers = txList;
                    active.transformer_bays[existingBayIdx] = bay;
                }
            } else {
                // Add transformer
                txList.push({ id: transformerId });
                bay.transformers = txList;
                active.transformer_bays[existingBayIdx] = bay;
            }
        } else {
            // Relay not in stage, add it with this transformer
            active.transformer_bays.push({
                id: 'temp_' + Date.now(),
                relay: relay.id,
                relay_substation_id: relay.substation_id || relay.substation,
                transformers: [{ id: transformerId }]
            });
            // Fetch substation data if missing
            const subId = relay.substation_id || relay.substation;
            if (!detailedSubstations[subId]) {
                refreshStageData(activeStageIdx);
            }
        }

        currentStages[activeStageIdx] = active;
        setStages(currentStages);
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
                    target_mw: stage.target_mw || 0,
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

                // Add pocket bays
                const pocketBranches = stage.pocket_branches || [];
                if (pocketBranches.length > 0) {
                    // Group branches by relay
                    const relayGroups = {}; // relayId -> [branchId1, branchId2]

                    pocketBranches.forEach(bayId => {
                        // bayId is like SUB_SUB_CKT
                        // Find the relay and incoming branch ID in master data
                        let foundRelay = null;
                        let foundBranchId = null;

                        relays.forEach(r => {
                            const br = (r.incoming_branches || []).find(b => b.bay_id === bayId);
                            if (br) {
                                foundRelay = r;
                                foundBranchId = br.id;
                            }
                        });

                        if (foundRelay && foundBranchId) {
                            if (!relayGroups[foundRelay.id]) relayGroups[foundRelay.id] = [];
                            relayGroups[foundRelay.id].push(foundBranchId);
                        }
                    });

                    if (Object.keys(relayGroups).length > 0) {
                        // Create one pocket bay for the stage (or should it be one per relay?
                        // The model allows multiple boundaries per pocket. We'll create one pocket per stage for now.)
                        const pbRes = await api.post('/load-shedding-pocket-bays/', {
                            stage: stageId
                        });
                        const pbId = pbRes.data.id;

                        for (const [rId, branchIds] of Object.entries(relayGroups)) {
                            await api.post('/load-shedding-pocket-boundaries/', {
                                pocket: pbId,
                                relay: rId,
                                branches: branchIds
                            });
                        }
                    }
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

    const formatMW = (val, decimals = 1) => {
        if (val == null || isNaN(val)) return "0.0";
        return Number(val).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    const formatInputNumber = (val) => {
        if (val === "" || val == null) return "";
        const stringVal = String(val);
        if (stringVal.endsWith('.')) return stringVal.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const parts = stringVal.split(".");
        parts[0] = parts[0].replace(/,/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join(".");
    };

    const calculateTargetMW = () => {
        if (!gridData || !gridData.total_pload_mw) return 0;
        return (targetPercentage / 100) * gridData.total_pload_mw;
    };

    const calculateRemainingTargetMW = () => {
        const totalTarget = calculateTargetMW();
        const totalAssigned = calculateOverallAssignedMW();
        // Returns (Assigned - Target). 
        // Negative means short of target, Positive means over target.
        return totalAssigned - totalTarget;
    };

    const calculateOverallAssignedMW = () => {
        let total = 0;
        // Add all stages' transformer MW
        stages.forEach(stage => {
            stage.transformer_bays?.forEach(bay => {
                const subId = bay.relay_substation_id;
                const detail = detailedSubstations[subId];
                if (!detail || !detail.transformers || !detail.db_transformers) return;

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
        });

        // Add network pockets MW
        const lockedMW = pocketCards.reduce((sum, card) => sum + (card.total_p_mw || 0), 0);
        total += lockedMW;

        return total;
    };

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
        return formatMW(total);
    };
    const calculateRegionalMW = (stage, region) => {
        if (!stage || !region) return 0;
        let total = 0;

        stage.transformer_bays?.forEach(bay => {
            const subId = bay.relay_substation_id;
            const sub = substations.find(s => s.substation_id === subId);
            if (!sub || sub.region !== region) return;

            const detail = detailedSubstations[subId];
            if (!detail || !detail.transformers || !detail.db_transformers) return;

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

        return total.toFixed(2);
    };

    const getOverallRegionalSpiralData = () => {
        if (!gridData || !gridData.regional_breakdown) return [];
        return gridData.regional_breakdown.map(reg => {
            const target_mw = (targetPercentage / 100) * reg.total_pload_mw;
            const assigned_mw = stages.reduce((sum, s) => sum + Number(calculateRegionalMW(s, reg.region) || 0), 0);
            return {
                region: reg.region,
                target_mw,
                assigned_mw
            };
        });
    };

    const getOverallRegionalPotentialData = () => {
        if (!gridData || !gridData.regional_breakdown) return [];
        return gridData.regional_breakdown.map(reg => {
            const potential_mw = substations
                .filter(sub => {
                    if (sub.region !== reg.region || !sub.has_active_relay) return false;
                    // Check if this substation has any active relay that sheds transformers
                    const subRelays = relays.filter(r => 
                        (r.substation_id === sub.substation_id || r.substation === sub.substation_id) && 
                        r.is_active && 
                        r.load_transformers && r.load_transformers.length > 0
                    );
                    return subRelays.length > 0;
                })
                .reduce((sum, sub) => sum + (parseFloat(sub.total_pload_mw) || 0), 0);
            
            const assigned_mw = stages.reduce((sum, s) => sum + Number(calculateRegionalMW(s, reg.region) || 0), 0);
            
            return {
                region: reg.region,
                potential_mw,
                assigned_mw
            };
        });
    };

    const getStageRegionalSpiralData = (stage) => {
        if (!gridData || !gridData.regional_breakdown || !stage) return [];
        const stageTarget = Number(stage.target_mw) || 0;
        return gridData.regional_breakdown.map(reg => {
            const target_mw = gridData.total_pload_mw > 0 
                ? (reg.total_pload_mw / gridData.total_pload_mw) * stageTarget 
                : 0;
            const assigned_mw = Number(calculateRegionalMW(stage, reg.region) || 0);
            return {
                region: reg.region,
                target_mw,
                assigned_mw
            };
        });
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
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '1.5rem', overflow: 'hidden' }}>
                    {/* Left Sidebar: Scheme Settings & Stages */}
                    <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Profile</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Scheme Type</label>
                                        {activeVersionId && <Lock size={12} style={{ color: 'var(--accent-cyan)', opacity: 0.8 }} />}
                                    </div>
                                    <select
                                        style={{
                                            width: '100%',
                                            padding: '0.525rem 1rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.75rem',
                                            outline: 'none',
                                            opacity: activeVersionId ? 0.6 : 1,
                                            cursor: activeVersionId ? 'not-allowed' : 'default',
                                            transition: 'all 0.2s ease',
                                        }}
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
                                            style={{
                                                width: '100%',
                                                padding: '0.525rem 1rem',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '8px',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.75rem',
                                                outline: 'none',
                                                opacity: activeVersionId ? 0.6 : 1,
                                                cursor: activeVersionId ? 'not-allowed' : 'default',
                                                transition: 'all 0.2s ease',
                                            }}
                                            value={reviewYear}
                                            onChange={(e) => setReviewYear(Number(e.target.value))}
                                            disabled={!!activeVersionId}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Target (%)</label>
                                        </div>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.525rem 2.5rem 0.525rem 1rem',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.75rem',
                                                    outline: 'none',
                                                    transition: 'all 0.2s ease',
                                                }}
                                                value={formatInputNumber(targetPercentage)}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/,/g, '');
                                                    if (raw === '' || !isNaN(raw)) setTargetPercentage(raw);
                                                }}
                                            />
                                            <span style={{ position: 'absolute', right: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Document Name (Notes)</label>
                                        {activeVersionId && <Lock size={12} style={{ color: 'var(--accent-cyan)', opacity: 0.8 }} />}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="e.g. 2026 National UFLS"
                                        value={versionLabel}
                                        onChange={(e) => setVersionLabel(e.target.value)}
                                        disabled={!!activeVersionId}
                                        style={{
                                            width: '100%',
                                            padding: '0.525rem 1rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.75rem',
                                            outline: 'none',
                                            opacity: activeVersionId ? 0.6 : 1,
                                            cursor: activeVersionId ? 'not-allowed' : 'default',
                                            transition: 'all 0.2s ease',
                                        }}
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <button style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', padding: '4px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleOpenEditStage(idx); }}>
                                                <Edit3 size={14} />
                                            </button>
                                            <button style={{ color: activeStageIdx === idx ? '#EF4444' : 'var(--text-secondary)', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', opacity: activeStageIdx === idx ? 1 : 0.6 }} onClick={(e) => { e.stopPropagation(); handleDeleteStage(idx); }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Middle: Content Builder */}
                    <div className="glass-card" style={{ gridColumn: 'span 13', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', padding: 0 }}>
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
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {stages[activeStageIdx]?.transformer_bays?.map((bay, idx) => {
                                        const subId = bay.relay_substation_id;
                                        const detail = detailedSubstations[subId];
                                        let infoDisplay = `${bay.transformers?.length || 0} TXs`;
                                        let voltageLabel = "";
                                        let hasCriticalAsset = false;

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
                                            hasCriticalAsset = bay.transformers?.some(txObj => {
                                                const tId = typeof txObj === 'object' ? txObj.id : txObj;
                                                return criticalAssets.some(ca => ca.load_transformers && ca.load_transformers.includes(Number(tId)));
                                            }) || false;
                                        }

                                        return (
                                            <div key={bay.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                padding: '0.1rem 0.2rem 0.1rem 0.3rem', borderRadius: '12px',
                                                background: 'rgba(0, 255, 163, 0.05)', border: '1px solid rgba(0, 255, 163, 0.2)'
                                            }}>
                                                <FaBolt size={8} style={{ color: 'var(--accent-cyan)' }} />
                                                <div style={{ fontSize: '0.7rem', fontWeight: 600, fontFamily: 'monospace', color: '#fff' }}>{subId}</div>
                                                <div style={{
                                                    fontSize: '0.65rem',
                                                    color: hasCriticalAsset ? '#EF4444' : 'var(--accent-cyan)',
                                                    fontWeight: 600,
                                                    paddingLeft: '0.2rem',
                                                    borderLeft: '1px solid rgba(0, 255, 163, 0.2)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    {infoDisplay}
                                                    {hasCriticalAsset && (
                                                        <FiAlertCircle size={10} style={{ color: '#EF4444' }} title="Contains Critical Asset" />
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const newStages = [...stages];
                                                        const newBays = [...newStages[activeStageIdx].transformer_bays];
                                                        newBays.splice(idx, 1);
                                                        newStages[activeStageIdx] = {
                                                            ...newStages[activeStageIdx],
                                                            transformer_bays: newBays
                                                        };
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

                            {/* Network Pockets */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                        <FaCodeBranch size={14} style={{ color: 'var(--accent-cyan)' }} /> Network Pockets
                                    </h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                                            {(() => {
                                                const lockedMW = pocketCards.reduce((sum, card) => sum + (card.total_p_mw || 0), 0);
                                                const previewMW = pocketPreview?.total_p_mw || 0;
                                                const totalMW = lockedMW + previewMW;
                                                return `${formatMW(totalMW)} MW`;
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* POCKET CARDS */}
                                {pocketCards.map((card, idx) => (
                                    <div key={card.id} style={{
                                        background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 229, 255, 0.04) 100%)',
                                        border: '1px solid rgba(0, 229, 255, 0.25)',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem'
                                    }}>
                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <FaCodeBranch size={14} style={{ color: 'var(--accent-cyan)' }} />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    Pocket {idx + 1}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Load</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                                                        {formatMW(card.total_p_mw ?? 0)} MW
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Subs</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                                                        {card.pocket_substations?.length ?? 0}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Branch Pills */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                                            {card.branchGroups.map((grp, gIdx) => (
                                                <div key={gIdx} style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                    padding: '0.15rem 0.4rem 0.15rem 0.3rem', borderRadius: '12px',
                                                    background: 'rgba(0, 229, 255, 0.08)', border: '1px solid rgba(0, 229, 255, 0.2)'
                                                }}>
                                                    <FaCodeBranch size={8} style={{ color: 'var(--accent-cyan)' }} />
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, fontFamily: 'monospace', color: '#fff' }}>{grp.subId}</span>
                                                    <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', paddingLeft: '0.2rem', borderLeft: '1px solid rgba(0, 229, 255, 0.2)' }}>
                                                        {`${grp.voltage} | ${grp.branches.sort().join(', ')}`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Substations */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {card.pocket_substations.map(sub => (
                                                <span key={sub.substation_id} style={{
                                                    padding: '4px 10px', borderRadius: '6px',
                                                    background: 'rgba(0, 229, 255, 0.12)',
                                                    border: '1px solid rgba(0, 229, 255, 0.25)',
                                                    fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 500
                                                }}>
                                                    {sub.name || sub.substation_id}
                                                    {sub.p_mw != null && <span style={{ opacity: 0.7, marginLeft: '4px' }}>({formatMW(sub.p_mw)} MW)</span>}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Remove button */}
                                        <button
                                            onClick={() => setPocketCards(prev => prev.filter(c => c.id !== card.id))}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                                                color: '#EF4444', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                                                padding: '4px 10px', borderRadius: '6px',
                                                fontSize: '0.7rem', transition: 'all 0.2s', alignSelf: 'flex-start'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                                        >
                                            <X size={12} /> Remove Pocket
                                        </button>
                                    </div>
                                ))}

                                {/* BRANCHES BAY */}
                                <div style={{
                                    background: 'rgba(0, 229, 255, 0.04)',
                                    border: '1px solid rgba(0, 229, 255, 0.12)',
                                    borderRadius: '10px',
                                    padding: '0.75rem'
                                }}>
                                    <div style={{ fontSize: '0.6rem', color: 'rgba(0, 229, 255, 0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.5rem' }}>
                                        BRANCHES BAY
                                    </div>
                                    {fetchingPocket && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                            Computing...
                                        </div>
                                    )}
                                    {!fetchingPocket && (stages[activeStageIdx]?.pocket_branches?.length === 0 || !stages[activeStageIdx]?.pocket_branches) && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.5, fontStyle: 'italic' }}>
                                            No branches selected
                                        </div>
                                    )}
                                    {!fetchingPocket && (stages[activeStageIdx]?.pocket_branches?.length > 0) && (() => {
                                        const branches = stages[activeStageIdx].pocket_branches;
                                        const groupKey = (subId, voltage) => `${subId}||${voltage || ''}`;
                                        const groups = {};
                                        branches.forEach(fullId => {
                                            const parts = fullId.split('_');
                                            if (parts.length >= 3) {
                                                const localSub = parts[0];
                                                const voltageValue = substations.find(s => s.substation_id === localSub)?.voltage;
                                                const key = groupKey(localSub, voltageValue);
                                                if (!groups[key]) groups[key] = { subId: localSub, voltage: voltageValue ? `${voltageValue}kV` : '', branches: [] };
                                                groups[key].branches.push(parts.slice(1).join('_'));
                                            }
                                        });
                                        return (
                                            <>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    {Object.values(groups).sort((a, b) => a.subId.localeCompare(b.subId)).map(group => {
                                                        return (
                                                            <div key={groupKey(group.subId, group.voltage)} style={{
                                                                display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                                padding: '0.1rem 0.2rem 0.1rem 0.3rem', borderRadius: '12px',
                                                                background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)'
                                                            }}>
                                                                <FaCodeBranch size={8} style={{ color: 'var(--accent-cyan)' }} />
                                                                <div style={{ fontSize: '0.7rem', fontWeight: 600, fontFamily: 'monospace', color: '#fff' }}>{group.subId}</div>
                                                                <div style={{
                                                                    fontSize: '0.65rem',
                                                                    color: 'var(--accent-cyan)',
                                                                    fontWeight: 600,
                                                                    paddingLeft: '0.2rem',
                                                                    borderLeft: '1px solid rgba(0, 229, 255, 0.2)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}>
                                                                    {`${group.voltage} | ${group.branches.sort().join(', ')}`}
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        const newStages = [...stages];
                                                                        const newBranches = [...(newStages[activeStageIdx].pocket_branches || [])];
                                                                        group.branches.forEach(suffix => {
                                                                            const fullId = `${group.subId}_${suffix}`;
                                                                            const idx = newBranches.indexOf(fullId);
                                                                            if (idx > -1) newBranches.splice(idx, 1);
                                                                        });
                                                                        newStages[activeStageIdx] = { ...newStages[activeStageIdx], pocket_branches: newBranches };
                                                                        setStages(newStages);
                                                                    }}
                                                                    style={{
                                                                        background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        width: '18px', height: '18px', borderRadius: '50%',
                                                                        transition: 'all 0.2s', marginLeft: '0.2rem'
                                                                    }}
                                                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(239, 68, 68, 0.6)'; }}
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Preview / Fallback Lock Pocket section */}
                                                {pocketPreview && !pocketPreview.error && (pocketPreview.warning || pocketPreview.pocket_substations?.length === 0) && (
                                                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0, 229, 255, 0.1)' }}>
                                                        {pocketPreview.warning && (
                                                            <div style={{ fontSize: '0.75rem', color: '#FFAB00', marginBottom: '0.5rem' }}>
                                                                {pocketPreview.warning}
                                                            </div>
                                                        )}
                                                        {pocketPreview.pocket_substations?.length > 0 && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                                                Preview: {pocketPreview.pocket_substations.length} substations ({formatMW(pocketPreview.total_p_mw ?? 0)} MW)
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                const branches = stages[activeStageIdx].pocket_branches || [];
                                                                const groupKey = (subId, voltage) => `${subId}||${voltage || ''}`;
                                                                const groups = {};
                                                                branches.forEach(fullId => {
                                                                    const parts = fullId.split('_');
                                                                    if (parts.length >= 3) {
                                                                        const localSub = parts[0];
                                                                        const voltageValue = substations.find(s => s.substation_id === localSub)?.voltage;
                                                                        const key = groupKey(localSub, voltageValue);
                                                                        if (!groups[key]) groups[key] = { subId: localSub, voltage: voltageValue ? `${voltageValue}kV` : '', branches: [] };
                                                                        groups[key].branches.push(parts.slice(1).join('_'));
                                                                    }
                                                                });
                                                                setPocketCards(prev => [...prev, {
                                                                    id: Date.now(),
                                                                    branches: [...branches],
                                                                    branchGroups: Object.values(groups),
                                                                    pocket_substations: pocketPreview.pocket_substations || [],
                                                                    total_p_mw: pocketPreview.total_p_mw || 0,
                                                                    total_q_mvar: pocketPreview.total_q_mvar || 0
                                                                }]);
                                                                const newStages = [...stages];
                                                                newStages[activeStageIdx] = { ...newStages[activeStageIdx], pocket_branches: [] };
                                                                setStages(newStages);
                                                                setPocketPreview(null);
                                                            }}
                                                            style={{
                                                                background: 'rgba(0, 255, 163, 0.15)', border: '1px solid rgba(0, 255, 163, 0.3)',
                                                                color: 'var(--accent-green)', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                                                                padding: '6px 12px', borderRadius: '6px',
                                                                fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s', width: '100%'
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0, 255, 163, 0.25)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(0, 255, 163, 0.15)'; }}
                                                        >
                                                            <FaLock size={12} /> Lock Anyway
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Error state */}
                                {pocketPreview?.error && (
                                    <div style={{ fontSize: '0.75rem', color: '#EF4444', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                        {pocketPreview.error}
                                    </div>
                                )}
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
                    <div className="glass-card" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div
                                onClick={() => setAssetLibraryTab('library')}
                                style={{
                                    flex: 1, textAlign: 'center', padding: '0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                    color: assetLibraryTab === 'library' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                    borderBottom: assetLibraryTab === 'library' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Asset Library
                            </div>
                            <div
                                onClick={() => setAssetLibraryTab('alerts')}
                                style={{
                                    flex: 1, textAlign: 'center', padding: '0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                    color: assetLibraryTab === 'alerts' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                    borderBottom: assetLibraryTab === 'alerts' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Alert Message
                            </div>
                        </div>

                        {assetLibraryTab === 'library' ? (
                            <>
                                <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Search style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search Relay / Substation..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.525rem 1rem 0.525rem 2.5rem',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '8px',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.75rem',
                                                outline: 'none',
                                                transition: 'all 0.2s ease',
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.background = 'rgba(255,255,255,0.06)';
                                                e.target.style.borderColor = 'rgba(0, 255, 163, 0.4)';
                                                e.target.style.boxShadow = '0 0 0 3px rgba(0, 255, 163, 0.08)';
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.background = 'rgba(255,255,255,0.03)';
                                                e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        />
                                    </div>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {(() => {
                                        // 1. Group relays by Region -> Grid -> Substation
                                        const tree = {};
                                        const term = searchTerm.toLowerCase();

                                        relays.forEach(relay => {
                                            const sub = substations.find(s => s.substation_id === (relay.substation_id || relay.substation));
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

                                            let totalMw = 0;
                                            const detail = detailedSubstations[sub.substation_id];

                                            (Array.isArray(relay.load_transformers) ? relay.load_transformers : []).forEach(transformerId => {
                                                if (detail && detail.transformers && detail.db_transformers) {
                                                    const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId));
                                                    if (dbTx) {
                                                        const expectedName = `TX T${dbTx.transformer_no}`;
                                                        const tx = detail.transformers.find(t => t.name.includes(expectedName) || t.name === expectedName);
                                                        if (tx && tx.load_mw != null) {
                                                            totalMw += parseFloat(tx.load_mw);
                                                        }
                                                    }
                                                }
                                            });

                                            // Check if this relay contains any critical assets
                                            const hasCriticalAsset = (Array.isArray(relay.load_transformers) ? relay.load_transformers : []).some(transformerId => {
                                                return criticalAssets.some(ca => ca.load_transformers && ca.load_transformers.includes(Number(transformerId)));
                                            });

                                            return (
                                                <div key={relay.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <div
                                                        onClick={() => handleExpandRelay(relay.id, sub.substation_id)}
                                                        style={{
                                                            padding: '0.4rem 0.5rem', paddingLeft: `${0.5 + paddingLevel * 1}rem`,
                                                            cursor: 'pointer', borderRadius: '4px', transition: 'background 0.2s'
                                                        }}
                                                        className="hover-glow"
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                                            <div style={{ height: '18px', display: 'flex', alignItems: 'center' }}>
                                                                {isExpanded ? <ChevronDown size={14} color="var(--accent-cyan)" /> : <ChevronRight size={14} color="var(--accent-cyan)" />}
                                                            </div>
                                                            <div
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!assignedStageLabel) addTransformerToStage(relay);
                                                                }}
                                                                style={{ height: '18px', display: 'flex', alignItems: 'center' }}
                                                            >
                                                                {assignedStageLabel ? <CheckSquare size={14} color="var(--text-secondary)" /> : <Square size={14} color="var(--accent-cyan)" />}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: assignedStageLabel ? 'var(--text-secondary)' : 'var(--accent-cyan)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {relay.relay_name?.replace(' System', '') || 'Relay'}
                                                                    </span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {hasCriticalAsset && (
                                                                            <FiAlertCircle size={12} style={{ color: '#EF4444' }} title="Contains Critical Asset" />
                                                                        )}
                                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--accent-cyan)', whiteSpace: 'nowrap' }}>
                                                                            {formatMW(totalMw)} MW
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {assignedStageLabel && (
                                                                    <div style={{
                                                                        fontSize: '0.6rem',
                                                                        color: '#FFAB00',
                                                                        fontStyle: 'italic',
                                                                        marginTop: '2px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'flex-start'
                                                                    }}>
                                                                        <span style={{ lineHeight: '1.2' }}>Assigned: {assignedStageLabel}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <div style={{ paddingBottom: '8px' }}>
                                                            {(Array.isArray(relay.load_transformers) ? relay.load_transformers : []).map(transformerId => {
                                                                let txLabel = `T-Bay ${transformerId}`;
                                                                let txMw = 0;

                                                                if (detail && detail.db_transformers) {
                                                                    const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId));
                                                                    if (dbTx) {
                                                                        txLabel = `T${dbTx.transformer_no}`;
                                                                        const expectedName = `TX T${dbTx.transformer_no}`;
                                                                        const tx = detail.transformers?.find(t => t.name.includes(expectedName) || t.name === expectedName);
                                                                        if (tx && tx.load_mw != null) txMw = parseFloat(tx.load_mw);
                                                                    }
                                                                }

                                                                const isTxAssigned = (stages[activeStageIdx]?.transformer_bays || []).some(tb => 
                                                                    tb.relay === relay.id && tb.transformers.some(t => String(t.id) === String(transformerId))
                                                                );

                                                                return (
                                                                    <div 
                                                                        key={transformerId} 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleTransformerInStage(relay, transformerId);
                                                                        }}
                                                                        style={{ 
                                                                            display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.5rem', 
                                                                            paddingLeft: `${1.5 + paddingLevel * 1}rem`, fontSize: '0.7rem', 
                                                                            color: isTxAssigned ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        className="hover-glow"
                                                                    >
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <FaBolt size={10} style={{ opacity: isTxAssigned ? 1 : 0.5 }} />
                                                                            <span style={{ fontWeight: isTxAssigned ? 700 : 400 }}>{txLabel}</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span style={{ fontFamily: 'monospace' }}>{formatMW(txMw)} MW</span>
                                                                            {isTxAssigned && <CheckSquare size={12} color="var(--accent-cyan)" />}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}

                                                            {/* Incoming Branches */}
                                                            {(relay.incoming_branches || []).length > 0 && (
                                                                <div style={{ paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}>
                                                                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', paddingLeft: `${1.5 + paddingLevel * 1}rem`, marginBottom: '2px' }}>
                                                                        INCOMING BRANCHES
                                                                    </div>
                                                                    {(relay.incoming_branches || []).map(branch => {
                                                                        const localPrefix = `${sub.substation_id}_`;
                                                                        const bayId = typeof branch === 'object' ? branch.bay_id : branch;
                                                                        const displayId = bayId?.startsWith(localPrefix) ? bayId.replace(localPrefix, '') : bayId;
                                                                        const isAssigned = (stages[activeStageIdx]?.pocket_branches || []).includes(bayId);
                                                                        return (
                                                                            <div
                                                                                key={typeof branch === 'object' ? branch.id : branch}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleBranchInStage(bayId, sub.substation_id);
                                                                                }}
                                                                                style={{
                                                                                    display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.5rem',
                                                                                    paddingLeft: `${1.5 + paddingLevel * 1}rem`, fontSize: '0.7rem',
                                                                                    color: isAssigned ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                                                                    cursor: 'pointer',
                                                                                }}
                                                                                className="hover-glow"
                                                                            >
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <FaCodeBranch size={10} style={{ opacity: 0.5 }} />
                                                                                    <span style={{ fontWeight: isAssigned ? 700 : 400 }}>{displayId}</span>
                                                                                </div>
                                                                                {isAssigned && <CheckSquare size={12} color="var(--accent-cyan)" />}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        };

                                        return Object.keys(tree).sort().map(region => {
                                            const rId = `region-${region}`;
                                            const grids = tree[region];
                                            return (
                                                <div key={region}>
                                                    {renderNodeHeader(rId, region, 0)}
                                                    {expandedNodes.has(rId) && Object.keys(grids).sort().map(grid => {
                                                        const gId = `grid-${region}-${grid}`;
                                                        const subs = grids[grid];
                                                        return (
                                                            <div key={grid} style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: '12px' }}>
                                                                {renderNodeHeader(gId, grid, 1)}
                                                                {expandedNodes.has(gId) && Object.keys(subs).sort().map(subId => {
                                                                    const sId = `sub-${region}-${grid}-${subId}`;
                                                                    const nodeData = subs[subId];
                                                                    const substation = nodeData.substation;
                                                                    return (
                                                                        <div key={subId} style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: '12px' }}>
                                                                            {renderNodeHeader(sId, `${substation.name} (${subId})`, 2)}
                                                                            {expandedNodes.has(sId) && (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                                                                                    {nodeData.relays.map(relay => renderRelayNode(relay, substation, 3))}
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
                            </>
                        ) : (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ border: '1px dashed rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '8px', width: '100%' }}>
                                    <Shield size={24} style={{ color: 'var(--accent-cyan)', marginBottom: '1rem', opacity: 0.8, alignSelf: 'center', margin: '0 auto 1rem auto' }} />
                                    <div>Alert Message Content area</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: SCHEME SETTINGS */}
            {
                activeTab === 'settings' && (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Global Stage Settings</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Manage Trip Settings for UFLS and UVLS schemes. Settings are shared globally.</p>
                                </div>
                            </div>

                            {/* SETTINGS TABS */}
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
                                <div onClick={() => setActiveGlobalSettingsTab('tripsettings')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: activeGlobalSettingsTab === 'tripsettings' ? 'var(--accent-cyan)' : 'var(--text-secondary)', borderBottom: activeGlobalSettingsTab === 'tripsettings' ? '2px solid var(--accent-cyan)' : '2px solid transparent', transition: 'all 0.2s' }}>
                                    Trip Settings
                                </div>
                                <div onClick={() => setActiveGlobalSettingsTab('conflict')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: activeGlobalSettingsTab === 'conflict' ? 'var(--accent-cyan)' : 'var(--text-secondary)', borderBottom: activeGlobalSettingsTab === 'conflict' ? '2px solid var(--accent-cyan)' : '2px solid transparent', transition: 'all 0.2s' }}>
                                    Critical Substation Conflict
                                </div>
                            </div>

                            {activeGlobalSettingsTab === 'tripsettings' ? (
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
                            ) : (
                            <div style={{ padding: '1rem 0' }}>
                                {(() => {
                                    const conflictGroups = [];
                                    const criticalBySub = {};
                                    criticalAssets.forEach(ca => {
                                        const subId = ca.substation_id || ca.substation;
                                        if (!subId) return;
                                        if (!criticalBySub[subId]) criticalBySub[subId] = [];
                                        criticalBySub[subId].push(ca);
                                    });
                                    Object.entries(criticalBySub).forEach(([subId, assets]) => {
                                        const stagesWithAsset = [];
                                        stages.forEach((stage) => {
                                            const hasAsset = stage.transformer_bays?.some(bay => bay.relay_substation_id === subId);
                                            if (hasAsset) stagesWithAsset.push(stage.label || `Stage ${stage.stage_number}`);
                                        });
                                        if (stagesWithAsset.length > 1) {
                                            conflictGroups.push({ subId, assets, stages: stagesWithAsset });
                                        }
                                    });
                                    if (conflictGroups.length === 0) {
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--text-secondary)', gap: '1rem' }}>
                                                <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Shield size={24} style={{ color: 'var(--accent-cyan)' }} />
                                                </div>
                                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>No Conflicts Detected</h4>
                                                <p style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
                                                    Critical substations are not assigned to multiple stages simultaneously.
                                                </p>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {conflictGroups.map((group, idx) => (
                                                <div key={idx} style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                        <FiAlertCircle size={16} style={{ color: '#EF4444' }} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>{group.subId}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '1.75rem' }}>
                                                        Assigned to multiple stages: <strong style={{ color: '#fff' }}>{group.stages.join(', ')}</strong>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                            )}
                        </div>
                    </div>
                )
            }

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
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Stage Configuration</h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Configure settings and targets for {stages[activeStageIdx]?.label || `Stage ${stages[activeStageIdx]?.stage_number}`}</p>
                                </div>
                                <button onClick={() => setShowStageSettingsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* TABS HEADER */}
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div
                                    onClick={() => setActiveStageSettingsTab('general')}
                                    style={{
                                        padding: '0.75rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                        color: activeStageSettingsTab === 'general' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                        borderBottom: activeStageSettingsTab === 'general' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Trip Settings
                                </div>
                                <div
                                    onClick={() => setActiveStageSettingsTab('metrics')}
                                    style={{
                                        padding: '0.75rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                        color: activeStageSettingsTab === 'metrics' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                        borderBottom: activeStageSettingsTab === 'metrics' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Regional Targets
                                </div>
                            </div>

                            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                                {activeStageSettingsTab === 'general' ? (
                                    <>
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
                                    </>
                                ) : (
                                    /* METRICS TAB */
                                    <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                            <div>
                                                <h4 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '1rem' }}>Configuration</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    <div>
                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Target Load Shedding (MW)</label>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <input
                                                                type="number"
                                                                className="dark-input"
                                                                style={{ flex: 1, fontSize: '1rem', fontWeight: 600, color: 'var(--accent-cyan)' }}
                                                                value={stages[activeStageIdx]?.target_mw || 0}
                                                                onChange={(e) => {
                                                                    const newStages = [...stages];
                                                                    newStages[activeStageIdx].target_mw = parseFloat(e.target.value) || 0;
                                                                    setStages(newStages);
                                                                }}
                                                            />
                                                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0 1rem', display: 'flex', alignItems: 'center', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                                MW
                                                            </div>
                                                        </div>
                                                        {gridData?.total_pload_mw > 0 && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                                                Equivalent to <strong>{((stages[activeStageIdx]?.target_mw || 0) / gridData.total_pload_mw * 100).toFixed(2)}%</strong> of total system demand ({formatMW(gridData.total_pload_mw)} MW)
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div style={{ padding: '1rem', background: 'rgba(0, 229, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 229, 255, 0.1)' }}>
                                                        <div style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                                                            <Shield size={14} color="var(--accent-cyan)" /> Fairness Calculation
                                                        </div>
                                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>
                                                            Regional targets are automatically calculated based on the regional share of total demand.
                                                            Each region should ideally contribute the same percentage as the overall target.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '1.25rem' }}>Regional Distribution</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    {gridData?.regional_breakdown?.map(reg => {
                                                        const overallRatio = (stages[activeStageIdx]?.target_mw || 0) / (gridData.total_pload_mw || 1);
                                                        const regionalTarget = reg.total_pload_mw * overallRatio;
                                                        const regionalActual = calculateRegionalMW(stages[activeStageIdx], reg.region);

                                                        return (
                                                            <BulletChart
                                                                key={reg.region}
                                                                label={reg.region}
                                                                actual={regionalActual}
                                                                target={regionalTarget}
                                                                max={Math.max(reg.total_pload_mw * 0.4, regionalTarget * 1.5)} // Scale slightly larger than target
                                                                color={
                                                                    reg.region === 'North' ? '#F43F5E' :
                                                                        reg.region === 'Central' ? '#3B82F6' :
                                                                            reg.region === 'South' ? '#10B981' : '#F59E0B'
                                                                }
                                                            />
                                                        );
                                                    })}
                                                    {!gridData && (
                                                        <div style={{ opacity: 0.5, fontSize: '0.8rem', textAlign: 'center', padding: '2rem' }}>
                                                            {fetchingAnalytics ? "Fetching analytics..." : "Load analysis data unavailable."}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>{editingStageIdx !== null ? "Edit Stage Details" : "Create New Stage"}</h3>
                            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {editingStageIdx !== null ? "Modify the parameters for this load shedding step." : "Define the parameters for the next load shedding step."}
                            </p>

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
                                    <div style={{ flex: 1.5 }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Target (MW)</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                className="dark-input"
                                                style={{ width: '100%', paddingRight: '2rem' }}
                                                value={formatInputNumber(newStageTargetMW)}
                                                onChange={e => {
                                                    const raw = e.target.value.replace(/,/g, '');
                                                    if (raw === '' || !isNaN(raw)) setNewStageTargetMW(raw);
                                                }}
                                            />
                                            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>MW</span>
                                        </div>
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
                                    <button className="btn-primary" style={{ flex: 1, padding: '0.75rem' }} onClick={confirmAddStage}>
                                        {editingStageIdx !== null ? "Save Changes" : "Create Stage"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- METRICS DRAWER (Bottom Panel) --- */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(10, 15, 25, 0.95)',
                    borderTop: '1px solid rgba(0, 229, 255, 0.2)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                    transform: isMetricsDrawerOpen ? 'translateY(0)' : 'translateY(calc(100% - 40px))',
                    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '40vh'
                }}
            >
                {/* Drag Handle / Toggle */}
                <div
                    onClick={() => setIsMetricsDrawerOpen(!isMetricsDrawerOpen)}
                    style={{
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        color: 'var(--text-secondary)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, padding: '0 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FaGaugeHigh size={14} style={{ color: 'var(--accent-cyan)' }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Scheme Metrics Dashboard
                            </span>
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
                        </div>
                        <div style={{ color: 'var(--accent-cyan)' }}>
                            {isMetricsDrawerOpen ? <ChevronDown size={14} /> : <div style={{ transform: 'rotate(-90deg)', display: 'flex' }}><ChevronDown size={14} /></div>}
                        </div>
                    </div>
                </div>

                {/* Drawer Content */}
                <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Top Bar: General Metrics */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '2rem', alignItems: 'stretch' }}>
                        
                        {/* 1. Overall Bullet & Stats (Combined) */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FaBullseye size={14} style={{ color: 'var(--accent-cyan)' }} />
                                General Scheme Metrics
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
                                {/* Embedded Stats Grid (moved above Bullet Chart) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Target System %</span>
                                        <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>{targetPercentage}%</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>System Total Load</span>
                                        <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>{gridData ? formatMW(gridData.total_pload_mw) : '0.0'} MW</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Remaining Target</span>
                                            <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Assigned - Target</span>
                                        </div>
                                        <span style={{ 
                                            fontSize: '0.9rem', 
                                            fontFamily: 'monospace', 
                                            fontWeight: 700, 
                                            color: (() => {
                                                const diff = calculateRemainingTargetMW();
                                                const target = calculateTargetMW();
                                                if (target === 0) return '#fff';
                                                const percentDiff = (diff / target) * 100;
                                                return Math.abs(percentDiff) <= 3 ? '#10B981' : '#EF4444'; // Green if within 3%, else Red
                                            })()
                                        }}>
                                            {calculateRemainingTargetMW() > 0 ? '+' : ''}{formatMW(calculateRemainingTargetMW())} MW
                                        </span>
                                    </div>
                                </div>

                                <BulletChart 
                                    label="Overall Target vs Current Assigned"
                                    actual={Number(calculateOverallAssignedMW()) || 0} 
                                    target={Number(calculateTargetMW()) || 0} 
                                    unit="MW" 
                                    color="var(--accent-cyan)" 
                                />
                            </div>
                        </div>

                        {/* 2. Target vs Assigned Regional Progress */}
                        {gridData?.regional_breakdown && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '1.5rem' }}>
                                <h5 style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Regional Target vs Assigned</h5>
                                <div style={{ flex: 1, paddingRight: '0.5rem', paddingTop: '1.25rem' }}>
                                    <CompactRegionalMetrics 
                                        data={getOverallRegionalSpiralData()}
                                        labelKey="region"
                                        valueKey="assigned_mw"
                                        targetKey="target_mw"
                                    />
                                </div>
                            </div>
                        )}

                        {/* 3. Potential MW vs Assigned */}
                        {gridData?.regional_breakdown && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '1.5rem' }}>
                                <h5 style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Potential vs Assigned</h5>
                                <div style={{ flex: 1, paddingRight: '0.5rem', paddingTop: '1.25rem' }}>
                                    <CompactRegionalMetrics 
                                        data={getOverallRegionalPotentialData()}
                                        labelKey="region"
                                        valueKey="assigned_mw"
                                        targetKey="potential_mw"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stage Metrics List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FaLayerGroup size={14} style={{ color: 'var(--accent-cyan)' }} />
                            Individual Stage Metrics
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {stages.map((stage, idx) => {
                                const stageAssigned = calculateTotalMW(stage);
                                const stageAssignedVal = stageAssigned === "Loading..." ? 0 : parseFloat(stageAssigned);
                                
                                return (
                                    <div key={stage.id} style={{ padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: activeStageIdx === idx ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '3rem', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <BulletChart 
                                                label={`${stage.label} Target vs Assigned`} 
                                                actual={Number(stageAssignedVal) || 0} 
                                                target={Number(stage.target_mw) || 0} 
                                                unit="MW" 
                                                color={activeStageIdx === idx ? 'var(--accent-cyan)' : '#3B82F6'} 
                                            />
                                        </div>
                                        <div style={{ width: '40%', display: 'flex', flexDirection: 'column' }}>
                                            <h5 style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Regional Distribution</h5>
                                            <CompactRegionalMetrics 
                                                data={getStageRegionalSpiralData(stage)}
                                                labelKey="region"
                                                valueKey="assigned_mw"
                                                targetKey="target_mw"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>

        </div >
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
