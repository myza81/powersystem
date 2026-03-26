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
    TriangleAlert,
    ShieldAlert, Cpu, CheckCircle2, Loader2, ArrowLeft, ZoomIn, ZoomOut, Network, Maximize2, Minimize2, MapPin, Eye, Filter, EyeOff, List, Layers, Unlock, Database, Building2, TrendingUp, Download, Settings2, ListChecks, Pause, ArrowUpRight, Check, Activity, BarChart2, CheckCircle, Navigation, Anchor, MousePointerClick, Move
} from 'lucide-react';
import BulletChart from './BulletChart';
import CompactRegionalMetrics from './CompactRegionalMetrics';
import { FaWandMagicSparkles, FaFolderTree, FaShieldHalved, FaLayerGroup, FaBolt, FaCircleNodes, FaCodeBranch, FaLock, FaBullseye, FaGaugeHigh, FaTableList, FaGear } from 'react-icons/fa6';
import { FiAlertCircle, FiEdit2 } from 'react-icons/fi';
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

    const [stages, setStages] = useState(() => getInitialState('stages', [{ id: Date.now(), stage_number: 1, label: 'Stage 1', transformer_bays: [], pocket_bays: [], computed_pockets: [], setting_ids: [], target_mw: 1000 }]));
    const [activeStageIdx, setActiveStageIdx] = useState(() => getInitialState('activeStageIdx', 0));
    const [detailedSubstations, setDetailedSubstations] = useState(() => getInitialState('detailedSubstations', {}));

    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [gridData, setGridData] = useState(null);
    const [fetchingAnalytics, setFetchingAnalytics] = useState(false);
    const [pocketPreview, setPocketPreview] = useState(null);
    const [fetchingPocket, setFetchingPocket] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    // --- Settings Tab State ---
    const [activeGlobalSettingsTab, setActiveGlobalSettingsTab] = useState('ufls'); // 'ufls' | 'uvls' | 'conflict'

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

        const existingPocket = (stages[activeStageIdx]?.computed_pockets || []).find(p =>
            p.branches.length === activeBranches.length &&
            p.branches.every(b => activeBranches.includes(b))
        );
        if (existingPocket) {
            setPocketPreview({
                pocket_substations: existingPocket.pocket_substations,
                pocket_substation_details: existingPocket.pocket_substation_details || [],
                total_p_mw: existingPocket.total_p_mw,
                total_q_mvar: existingPocket.total_q_mvar,
            });
            return;
        }

        let cancelled = false;
        setFetchingPocket(true);
        api.post('/topology/pocket-preview/', { branch_ids: activeBranches })
            .then(res => {
                if (!cancelled) {
                    const data = res.data;
                    setPocketPreview(data);

                    const canAutoCreate = !data.error && !data.warning && (data.pocket_substations || []).length > 0;
                    if (canAutoCreate) {
                        const groupKey = (subId, voltage) => `${subId}||${voltage || ''}`;
                        const groups = {};
                        activeBranches.forEach(fullId => {
                            const parts = String(fullId).split('_');
                            if (parts.length >= 3) {
                                const localSub = parts[0];
                                const voltageValue = substations.find(s => s.substation_id === localSub)?.voltage;
                                const key = groupKey(localSub, voltageValue);
                                if (!groups[key]) groups[key] = { subId: localSub, voltage: voltageValue ? `${voltageValue}kV` : '', branches: [] };
                                groups[key].branches.push(parts.slice(1).join('_'));
                            }
                        });

                        setStages(prevStages => prevStages.map((stage, idx) => {
                            if (idx !== activeStageIdx) return stage;

                            const existingPocket = (stage.computed_pockets || []).find(p =>
                                (p.branches || []).length === activeBranches.length &&
                                (p.branches || []).every(branchId => activeBranches.includes(branchId))
                            );
                            if (existingPocket) {
                                return { ...stage, pocket_branches: [] };
                            }

                            const newPocket = {
                                id: Date.now(),
                                branches: [...activeBranches],
                                branchGroups: Object.values(groups),
                                pocket_substations: data.pocket_substations || [],
                                pocket_substation_details: data.pocket_substation_details || [],
                                total_p_mw: data.total_p_mw || 0,
                                substation_mw: (data.pocket_substation_details || []).reduce((acc, sub) => {
                                    acc[sub.substation_id] = { total_p_mw: sub.p_mw, total_q_mvar: sub.q_mvar };
                                    return acc;
                                }, {}),
                                total_q_mvar: data.total_q_mvar || 0,
                            };

                            return {
                                ...stage,
                                computed_pockets: [...(stage.computed_pockets || []), newPocket],
                                pocket_branches: [],
                            };
                        }));
                    }
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPocketPreview({ error: 'Failed to compute pocket.' });
                }
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
        setStages([{ id: Date.now(), stage_number: 1, label: 'Stage 1', transformer_bays: [], pocket_bays: [], computed_pockets: [], pocket_branches: [], setting_ids: [], target_mw: 1000 }]);
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
                            computed_pockets: (stageData.pocket_bays || []).map(pb => {
                                const cache = pb.topology_cache || {};
                                // Reconstruct the groups for UI display
                                const branchIds = (pb.boundaries || []).flatMap(bound => bound.branches || []);
                                const groupKey = (subId, voltage) => `${subId}||${voltage || ''}`;
                                const groups = {};
                                branchIds.forEach(bId => {
                                    relays.forEach(r => {
                                        const br = (r.incoming_branches || []).find(b => b.id === bId);
                                        if (br) {
                                            const subId = r.substation_id || r.substation;
                                            const voltageValue = substations.find(s => s.substation_id === subId)?.voltage;
                                            const key = groupKey(subId, voltageValue);
                                            if (!groups[key]) groups[key] = { subId, voltage: voltageValue ? `${voltageValue}kV` : '', branches: [] };
                                            groups[key].branches.push(br.bay_id.split('_').slice(1).join('_'));
                                        }
                                    });
                                });

                                return {
                                    id: pb.id,
                                    branches: branchIds.map(bId => {
                                        let foundBayId = null;
                                        relays.forEach(r => {
                                            const br = (r.incoming_branches || []).find(b => b.id === bId);
                                            if (br) foundBayId = br.bay_id;
                                        });
                                        return foundBayId;
                                    }).filter(id => id !== null),
                                    branchGroups: Object.values(groups),
                                    pocket_substations: cache.isolated_substations || [],
                                    total_p_mw: cache.mw || 0,
                                    substation_mw: cache.substation_mw || {},
                                    total_q_mvar: 0
                                };
                            }),
                            pocket_branches: [] // Do NOT reconstruct from saved pockets — branches are already in computed_pockets[].branches
                        };
                    })
                );
                // Sort by stage_number
                detailedStages.sort((a, b) => a.stage_number - b.stage_number);
                setStages(detailedStages);
                
                // Fetch detailed substation data for all substations in all stages (for MW calculations)
                const allSubIds = [...new Set(detailedStages.flatMap(s => 
                    [...(s.transformer_bays?.map(b => b.relay_substation_id) || []),
                     ...(s.computed_pockets?.flatMap(p => p.pocket_substations || []) || [])]
                ))];
                for (const subId of allSubIds) {
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
                            console.error(`Failed to fetch sub data for ${subId}`, err);
                        }
                    }
                }
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
            transformers: (relay.load_transformers || []).map(t => ({ id: typeof t === 'object' ? t.id : t })) // Store minimal ref
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
        let fullId = typeof bayId === 'string' ? bayId : String(bayId);
        if (localSubstationId && !fullId.includes('_')) {
            fullId = `${localSubstationId}_${fullId}`;
        }

        setStages(prevStages => prevStages.map((stage, idx) => {
            if (idx !== activeStageIdx) return stage;
            const existing = stage.pocket_branches || [];
            const isAdded = existing.includes(fullId);
            const pocketContainingBranch = (stage.computed_pockets || []).find(pocket => (pocket.branches || []).includes(fullId));

            if (pocketContainingBranch) {
                return {
                    ...stage,
                    computed_pockets: (stage.computed_pockets || []).filter(pocket => pocket.id !== pocketContainingBranch.id),
                };
            }

            return {
                ...stage,
                pocket_branches: isAdded
                    ? existing.filter(id => id !== fullId)
                    : [...existing, fullId],
            };
        }));
    };

    const toggleTransformerInStage = (relay, transformerVal) => {
        const transformerId = typeof transformerVal === 'object' ? transformerVal.id : transformerVal;
        const currentStages = [...stages];
        const active = { ...currentStages[activeStageIdx] };
        
        // Ensure we clone the transformer_bays array so we don't mutate state
        const activeBays = [...(active.transformer_bays || [])];
        const existingBayIdx = activeBays.findIndex(tb => tb.relay === relay.id);

        if (existingBayIdx > -1) {
            // Relay already in stage
            const bay = { ...activeBays[existingBayIdx] };
            const txList = [...bay.transformers];
            const txIdx = txList.findIndex(t => String(typeof t === 'object' ? t.id : t) === String(transformerId));

            if (txIdx > -1) {
                // Remove transformer
                txList.splice(txIdx, 1);
                if (txList.length === 0) {
                    // Remove bay if empty
                    activeBays.splice(existingBayIdx, 1);
                } else {
                    bay.transformers = txList;
                    activeBays[existingBayIdx] = bay;
                }
            } else {
                // Add transformer
                txList.push({ id: transformerId });
                bay.transformers = txList;
                activeBays[existingBayIdx] = bay;
            }
        } else {
            // Relay not in stage, add it with this transformer
            activeBays.push({
                id: 'temp_' + Date.now(),
                relay: relay.id,
                relay_substation_id: relay.substation_id || relay.substation,
                transformers: [{ id: transformerId }]
            });
            // Fetch substation data if missing
            const subId = relay.substation_id || relay.substation;
            if (!detailedSubstations[subId]) {
                Promise.all([
                    api.get(`/substations/${subId}/`),
                    api.get(`/load-transformers/?substation=${subId}`)
                ]).then(([res, txRes]) => {
                    const data = res.data;
                    data.db_transformers = txRes.data;
                    setDetailedSubstations(prev => ({ ...prev, [subId]: data }));
                }).catch(err => {
                    console.error("Failed to fetch sub data mapping for MW calc", err);
                });
            }
        }

        active.transformer_bays = activeBays;
        currentStages[activeStageIdx] = active;
        setStages(currentStages);
    };

    const buildPocketCardFromPreview = (branches, preview) => {
        const groupKey = (subId, voltage) => `${subId}||${voltage || ''}`;
        const groups = {};
        (branches || []).forEach(fullId => {
            const parts = String(fullId || '').split('_');
            if (parts.length >= 3) {
                const localSub = parts[0];
                const voltageValue = substations.find(s => s.substation_id === localSub)?.voltage;
                const key = groupKey(localSub, voltageValue);
                if (!groups[key]) groups[key] = { subId: localSub, voltage: voltageValue ? `${voltageValue}kV` : '', branches: [] };
                groups[key].branches.push(parts.slice(1).join('_'));
            }
        });

        return {
            id: `preview-${Date.now()}`,
            branches: [...(branches || [])],
            branchGroups: Object.values(groups),
            pocket_substations: preview?.pocket_substations || [],
            pocket_substation_details: preview?.pocket_substation_details || [],
            total_p_mw: preview?.total_p_mw || 0,
            substation_mw: (preview?.pocket_substation_details || []).reduce((acc, sub) => {
                acc[sub.substation_id] = { total_p_mw: sub.p_mw, total_q_mvar: sub.q_mvar };
                return acc;
            }, {}),
            total_q_mvar: preview?.total_q_mvar || 0,
        };
    };

    const getEffectiveStagePockets = (stage, stageIdx) => {
        const pockets = stage?.computed_pockets || [];
        if (stageIdx !== activeStageIdx) return pockets;

        const looseBranches = stage?.pocket_branches || [];
        const previewIsUsable = pocketPreview && !pocketPreview.error && (pocketPreview.pocket_substations || []).length > 0;
        if (!looseBranches.length || !previewIsUsable) return pockets;

        const duplicatePocket = pockets.some(pocket =>
            (pocket.branches || []).length === looseBranches.length &&
            (pocket.branches || []).every(branchId => looseBranches.includes(branchId))
        );
        if (duplicatePocket) return pockets;

        return [...pockets, buildPocketCardFromPreview(looseBranches, pocketPreview)];
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
                    const transformerIds = (tb.transformers || [])
                        .map(t => (typeof t === 'object' ? t?.id : t))
                        .filter(Boolean);

                    if (transformerIds.length === 0) continue;

                    await api.post('/load-shedding-transformer-bays/', {
                        stage: stageId,
                        relay: tb.relay,
                        transformers: transformerIds
                    });
                }

                // Add pocket bays
                const pockets = stage.computed_pockets || [];
                for (const pocket of pockets) {
                    const pbRes = await api.post('/load-shedding-pocket-bays/', {
                        stage: stageId
                    });
                    const pbId = pbRes.data.id;

                    // Group branches in this pocket by relay
                    const relayGroups = {};
                    (pocket.branches || []).forEach(bayId => {
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

                    for (const [rId, branchIds] of Object.entries(relayGroups)) {
                        await api.post('/load-shedding-pocket-boundaries/', {
                            pocket: pbId,
                            relay: rId,
                            branches: branchIds
                        });
                    }

                    if (Object.keys(relayGroups).length > 0) {
                        await api.post('/load-shedding-pocket-bays/recompute/', {
                            pocket_ids: [pbId]
                        });
                    }
                }

            }
            sessionStorage.removeItem('ls_draft_state');
            alert("Draft saved successfully!");
            return vId;
        } catch (err) {
            console.error("Failed to save scheme", err);
            console.error("Save failure details", {
                url: err?.config?.url,
                method: err?.config?.method,
                requestData: err?.config?.data,
                status: err?.response?.status,
                responseData: err?.response?.data,
            });
            // ... (rest of error handling)

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
            return null;
        } finally {
            setSaving(false);
        }
    };

    const activeVersionMeta = versions.find(v => String(v.id) === String(activeVersionId));


    const handlePublishWorkspace = async () => {
        setPublishing(true);
        try {
            let vId = activeVersionId;
            if (!vId || !activeVersionMeta || activeVersionMeta.status === 'draft') {
                vId = await handleSaveWorkspace();
            }

            if (!vId) return;

            await api.post(`/load-shedding-versions/${vId}/publish/`);
            await fetchMasterData();
            window.dispatchEvent(new CustomEvent('load-shedding-published'));
            alert('Scheme published successfully.');
        } catch (err) {
            console.error('Failed to publish scheme', err);
            alert(`Failed to publish scheme. ${err?.response?.data?.error || err.message}`);
        } finally {
            setPublishing(false);
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

        const selectedSchemeType = activeGlobalSettingsTab === 'uvls' ? 'UVLS' : 'UFLS';

        try {
            const res = await api.post('/load-shedding-settings/', {
                scheme_type: selectedSchemeType,
                threshold: parseFloat(newSettingThreshold),
                time_delay: parseFloat(newSettingTimeDelay)
            });
            const newSetting = res.data;
            setGlobalSettings([...globalSettings, newSetting]);

            setNewSettingThreshold('');
            setNewSettingTimeDelay('');

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

        // Add network pockets MW from all stages
        stages.forEach((stage, stageIdx) => {
            const pockets = getEffectiveStagePockets(stage, stageIdx);
            pockets.forEach(card => {
                total += (card.total_p_mw || 0);
            });
        });

        return total;
    };

    const calculateTotalMW = (stage, stageIdx = activeStageIdx) => {
        if (!stage) return 0;
        let total = 0;

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

        // Add network pockets MW
        const pockets = getEffectiveStagePockets(stage, stageIdx);
        pockets.forEach(card => {
            total += (card.total_p_mw || 0);
        });

        return total;
    };

    const calculateTransformerMW = (stage) => {
        if (!stage) return 0;
        let total = 0;

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

        return total;
    };
    const calculateRegionalMW = (stage, region) => {
        if (!stage) return 0;
        
        // Use a local map for this stage to handle overrides correctly
        const subDataMap = new Map(); // subId -> mw

        // 1. Process standard transformer bays for this stage
        stage.transformer_bays?.forEach(bay => {
            const subId = bay.relay_substation_id;
            const sub = substations.find(s => s.substation_id === subId);
            if (!sub || (region && sub.region !== region)) return;

            const detail = detailedSubstations[subId];
            if (!detail || !detail.transformers || !detail.db_transformers) {
                // Fallback: use substation's total_pload_mw if detailed data not available
                if (sub.total_pload_mw > 0) {
                    const bayCount = bay.transformers?.length || 1;
                    const fallbackMW = parseFloat(sub.total_pload_mw) / bayCount;
                    subDataMap.set(subId, (subDataMap.get(subId) || 0) + fallbackMW);
                }
                return;
            }

            if (!subDataMap.has(subId)) subDataMap.set(subId, 0);
            let subMW = subDataMap.get(subId);

            bay.transformers?.forEach(transformerObj => {
                const transformerId = typeof transformerObj === 'object' ? transformerObj.id : transformerObj;
                const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId));
                if (dbTx) {
                    const expectedName = `TX T${dbTx.transformer_no}`;
                    const tx = detail.transformers.find(t => t.name.includes(expectedName) || t.name === expectedName);
                    if (tx && tx.load_mw != null) {
                        subMW += parseFloat(tx.load_mw);
                    }
                }
            });
            subDataMap.set(subId, subMW);
        });

        // 2. Process Network Pockets for this stage
        const pockets = getEffectiveStagePockets(stage, stages.indexOf(stage));
        pockets.forEach(card => {
            (card.pocket_substations || []).forEach(subId => {
                const sub = substations.find(s => s.substation_id === subId);
                if (sub && (!region || sub.region === region)) {
                    // Pocket assignment drops the entire substation, so it overrides any transformer bays
                    // Use per-substation MW if available, otherwise distribute total evenly
                    const subMW = card.substation_mw?.[subId]?.total_p_mw;
                    if (subMW != null && subMW > 0) {
                        subDataMap.set(subId, parseFloat(subMW));
                    } else if (card.total_p_mw && card.pocket_substations?.length > 0) {
                        subDataMap.set(subId, parseFloat(card.total_p_mw) / card.pocket_substations.length);
                    }
                }
            });
        });

        // 3. Sum up the results for this region
        let total = 0;
        subDataMap.forEach(mw => {
            total += mw;
        });

        return total;
    };

    const getOverallRegionalSpiralData = () => {
        if (!gridData || !gridData.regional_breakdown) return [];
        return gridData.regional_breakdown.map(reg => {
            const target_mw = (targetPercentage / 100) * reg.total_pload_mw;
            const assigned_mw = stages.reduce((sum, s) => sum + (calculateRegionalMW(s, reg.region) || 0), 0);
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
                    // Check if this substation has any active relay that sheds transformers OR has incoming branches
                    const subRelays = relays.filter(r => 
                        (r.substation_id === sub.substation_id || r.substation === sub.substation_id) && 
                        r.is_active && 
                        ((r.load_transformers && r.load_transformers.length > 0) || (r.incoming_branches && r.incoming_branches.length > 0))
                    );
                    return subRelays.length > 0;
                })
                .reduce((sum, sub) => sum + (parseFloat(sub.total_pload_mw) || 0), 0);
            
            const assigned_mw = stages.reduce((sum, s) => sum + (calculateRegionalMW(s, reg.region) || 0), 0);
            
            return {
                region: reg.region,
                potential_mw,
                assigned_mw
            };
        });
    };

    const getAssignedSubstationMetrics = (stageArray, includePockets = false) => {
        const assignedSubMap = new Map();

        // 1. Process standard transformer bays
        stageArray.forEach(stage => {
            stage.transformer_bays?.forEach(bay => {
                const subId = bay.relay_substation_id;
                const subIdTrim = subId?.toString().trim().toUpperCase();
                if (!subId) return;

                if (!assignedSubMap.has(subId)) assignedSubMap.set(subId, { isCritical: false, mw: 0 });
                const subData = assignedSubMap.get(subId);

                const bayHasCritical = bay.transformers?.some(tObj => {
                    const tIdVal = typeof tObj === 'object' ? tObj.id : tObj;
                    const numId = Number(tIdVal);
                    return criticalAssets.some(ca => (ca.load_transformers || []).includes(numId));
                });
                if (bayHasCritical) subData.isCritical = true;

                // Fallback check: if substation itself is critical in the list
                if (!subData.isCritical && criticalAssets.some(ca => {
                    const caSub = (ca.substation_id || ca.substation)?.toString().trim().toUpperCase();
                    return caSub === subIdTrim;
                })) {
                    subData.isCritical = true;
                }

                const detail = detailedSubstations[subId];
                if (detail && detail.transformers && detail.db_transformers) {
                    bay.transformers?.forEach(tObj => {
                        const tId = typeof tObj === 'object' ? tObj.id : tObj;
                        const dbTx = detail.db_transformers.find(t => String(t.id) === String(tId));
                        if (dbTx) {
                            const expectedName = `TX T${dbTx.transformer_no}`;
                            const tx = detail.transformers.find(t => t.name.includes(expectedName) || t.name === expectedName);
                            if (tx && tx.load_mw != null) {
                                subData.mw += parseFloat(tx.load_mw);
                            }
                        }
                    });
                }
            });
        });

        // 2. Process overriding Network Pockets
        if (includePockets) {
            stageArray.forEach(stage => {
                const pockets = getEffectiveStagePockets(stage, stages.indexOf(stage));
                pockets.forEach(card => {
                    if (card.pocket_substations && card.pocket_substations.length > 0) {
                        card.pocket_substations.forEach(subId => {
                            const subIdTrim = subId?.toString().trim().toUpperCase();
                            if (!assignedSubMap.has(subId)) assignedSubMap.set(subId, { isCritical: false, mw: 0 });
                            const subData = assignedSubMap.get(subId);
                            
                            if (criticalAssets.some(ca => {
                                const caSub = (ca.substation_id || ca.substation)?.toString().trim().toUpperCase();
                                return caSub === subIdTrim;
                            })) {
                                subData.isCritical = true;
                            }
                            
                            // Use per-substation MW if available (newly computed), otherwise distribute total evenly
                            const subMW = card.substation_mw?.[subId]?.total_p_mw;
                            if (subMW != null && subMW > 0) {
                                subData.mw = parseFloat(subMW);
                            } else if (card.total_p_mw && card.pocket_substations?.length > 0) {
                                // Fallback: distribute total MW evenly among pocket substations
                                subData.mw = parseFloat(card.total_p_mw) / card.pocket_substations.length;
                            }
                        });
                    }
                });
            });
        }

        let totalSubs = 0;
        let totalMW = 0;
        let criticalSubs = 0;
        let criticalMW = 0;

        assignedSubMap.forEach(data => {
            totalSubs++;
            totalMW += data.mw;
            if (data.isCritical) {
                criticalSubs++;
                criticalMW += data.mw;
            }
        });

        return { totalSubs, totalMW, criticalSubs, criticalMW };
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

    const compactSubstationMnemonic = (subId) => String(subId || '').replace(/\d+$/, '');

    const getStageSettingCells = (stage) => {
        const stageSettings = getSortedSettings(
            (stage?.setting_ids || [])
                .map(sId => globalSettings.find(s => s.id === sId))
                .filter(Boolean)
        );

        return {
            threshold1: stageSettings[0]?.threshold ?? 'n/a',
            delay1: stageSettings[0]?.time_delay ?? 'n/a',
            threshold2: stageSettings[1]?.threshold ?? 'n/a',
            delay2: stageSettings[1]?.time_delay ?? 'n/a',
        };
    };

    const getSummaryRows = () => {
        const rows = [];

        stages.forEach((stage, stageIdx) => {
            const settingCells = getStageSettingCells(stage);
            let stageRowStarted = false;

            (stage.transformer_bays || []).forEach(bay => {
                const relay = relays.find(r => String(r.id) === String(bay.relay));
                const sub = substations.find(s => s.substation_id === bay.relay_substation_id);
                if (!relay || !sub) return;

                const selectedIds = (bay.transformers || []).map(t => typeof t === 'object' ? t.id : t);
                const selectedTransformers = (relay.load_transformers || []).filter(t => selectedIds.includes(typeof t === 'object' ? t.id : t));

                const assignedFeeder = selectedTransformers.length > 0
                    ? selectedTransformers.map(t => `T${t.transformer_no}`).join(' & ')
                    : (bay.transformers || []).map(t => typeof t === 'object' ? `T${t.id}` : `T${t}`).join(' & ');

                const breakerNumber = selectedTransformers
                    .map(t => t.lv_breaker_number)
                    .filter(Boolean)
                    .join(' & ') || 'n/a';

                rows.push({
                    stageLabel: !stageRowStarted ? stage.label : '',
                    grid: sub.grid || '',
                    substationName: sub.name || '',
                    substationId: sub.substation_id || '',
                    voltage: sub.voltage || '',
                    assignedFeeder: assignedFeeder || 'n/a',
                    breakerNumber,
                    ...settingCells,
                });
                stageRowStarted = true;
            });

            const pockets = getEffectiveStagePockets(stage, stageIdx);
            pockets.forEach(card => {
                (card.branchGroups || []).forEach(group => {
                    const localSub = substations.find(s => s.substation_id === group.subId);
                    if (!localSub) return;

                    const fullBranchIds = (card.branches || []).filter(branchId => String(branchId).startsWith(`${group.subId}_`));
                    const branchObjects = fullBranchIds.map(branchId => {
                        for (const relay of relays) {
                            const found = (relay.incoming_branches || []).find(branch => branch.bay_id === branchId);
                            if (found) return found;
                        }
                        return null;
                    }).filter(Boolean);

                    const assignedFeeder = branchObjects.length > 0
                        ? branchObjects.map(branch => `${compactSubstationMnemonic(branch.to_substation)} ${branch.ckt_id}`).join(' & ')
                        : (group.branches || []).join(' & ');

                    const breakerNumber = branchObjects
                        .map(branch => branch.breaker_number)
                        .filter(Boolean)
                        .join(' & ') || 'n/a';

                    rows.push({
                        stageLabel: !stageRowStarted ? stage.label : '',
                        grid: localSub.grid || '',
                        substationName: localSub.name || '',
                        substationId: localSub.substation_id || '',
                        voltage: localSub.voltage || '',
                        assignedFeeder: assignedFeeder || 'n/a',
                        breakerNumber,
                        ...settingCells,
                    });
                    stageRowStarted = true;
                });
            });
        });

        return rows;
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
                            border: hasDrafts && drafts.length > 1
                                ? '1px solid rgba(251, 191, 36, 0.4)'
                                : '1px solid rgba(255, 171, 0, 0.3)',
                            background: hasDrafts && drafts.length > 1
                                ? 'linear-gradient(180deg, rgba(251, 191, 36, 0.07) 0%, rgba(0,0,0,0.4) 100%)'
                                : 'linear-gradient(180deg, rgba(255, 171, 0, 0.05) 0%, rgba(0,0,0,0.4) 100%)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: drafts.length > 1 ? '0.75rem' : '1.5rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255, 171, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFAB00' }}>
                                <FaFolderTree size={20} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>Resume Active Drafts</h3>
                                    {hasDrafts && (
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 800,
                                            background: drafts.length > 1 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255, 171, 0, 0.15)',
                                            color: drafts.length > 1 ? '#fbbf24' : '#FFAB00',
                                            border: `1px solid ${drafts.length > 1 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(255, 171, 0, 0.3)'}`,
                                            padding: '2px 7px', borderRadius: '999px',
                                        }}>
                                            {drafts.length}
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Continue working on an existing design.</p>
                            </div>
                        </div>

                        {/* Multi-draft conflict banner */}
                        {drafts.length > 1 && (
                            <div className="draft-conflict-banner" style={{ marginBottom: '1rem' }}>
                                <TriangleAlert size={13} style={{ flexShrink: 0, color: '#fbbf24' }} />
                                <span>Multiple drafts detected — select which one to continue.</span>
                            </div>
                        )}

                        {hasDrafts ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto', maxHeight: '320px', paddingRight: '0.5rem' }}>
                                {drafts.map(v => {
                                    const stageCount = v.stages?.length ?? '—';
                                    const wasUnpublished = !!v.notes && v.notes.startsWith('Unpublished from');
                                    const isMulti = drafts.length > 1;
                                    return (
                                        <div key={v.id} style={{
                                            padding: isMulti ? '1.1rem' : '1rem',
                                            background: isMulti ? 'rgba(251, 191, 36, 0.04)' : 'rgba(0,0,0,0.3)',
                                            borderRadius: '8px',
                                            border: isMulti
                                                ? '1px solid rgba(251, 191, 36, 0.18)'
                                                : '1px solid rgba(255,255,255,0.05)',
                                            display: 'flex', flexDirection: 'column', gap: '0.75rem',
                                        }}>
                                            {/* Draft Meta */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '3px' }}>
                                                        <span style={{ fontSize: '0.7rem', color: '#FFAB00', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                                            {v.scheme_type} {v.review_year} v{v.version}
                                                        </span>
                                                        {wasUnpublished && (
                                                            <span style={{
                                                                fontSize: '0.6rem', fontWeight: 700,
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                color: '#f87171', padding: '1px 6px', borderRadius: '4px',
                                                            }}>
                                                                Unpublished
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {v.notes || 'Unnamed Document'}
                                                    </div>
                                                    {isMulti && (
                                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '4px', flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                                {stageCount} stage{stageCount !== 1 ? 's' : ''}
                                                            </span>
                                                            {v.created_at && (
                                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                                    Created {new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    className="btn-secondary"
                                                    style={{
                                                        flex: 1, fontSize: '0.75rem', padding: '0.45rem',
                                                        justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '5px',
                                                        background: isMulti ? 'rgba(255, 171, 0, 0.1)' : 'rgba(255,255,255,0.05)',
                                                        color: isMulti ? '#FFAB00' : '#fff',
                                                        border: isMulti ? '1px solid rgba(255, 171, 0, 0.25)' : undefined,
                                                        fontWeight: isMulti ? 600 : 400,
                                                    }}
                                                    onClick={() => handleResumeDraft(v.id)}
                                                >
                                                    <FolderOpen size={12} /> Open
                                                </button>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '0.45rem 0.65rem', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center' }}
                                                    onClick={() => handleDeleteDraft(v.id)}
                                                    title="Delete this draft"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
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
                        <FaLayerGroup size={14} /> Stage Designer
                    </button>
                    <button
                        style={{ padding: '0.5rem 1rem', background: activeTab === 'settings' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'settings' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        onClick={() => setActiveTab('settings')}
                    >
                        <FaGear size={14} /> Scheme Settings
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
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{stage.label}</div>
                                            {!!stage.setting_ids?.length && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                    {stage.setting_ids.map(sId => {
                                                        const setting = globalSettings.find(s => s.id === sId);
                                                        if (!setting) return null;
                                                        return (
                                                            <div
                                                                key={sId}
                                                                style={{
                                                                    fontSize: '0.55rem',
                                                                    color: activeStageIdx === idx ? '#062b22' : 'var(--accent-cyan)',
                                                                    background: activeStageIdx === idx ? 'rgba(0, 255, 163, 0.95)' : 'rgba(0, 229, 255, 0.10)',
                                                                    padding: '3px 8px',
                                                                    borderRadius: '999px',
                                                                    fontWeight: 700,
                                                                    border: activeStageIdx === idx ? '1px solid rgba(0, 255, 163, 0.95)' : '1px solid rgba(0, 229, 255, 0.22)',
                                                                    lineHeight: 1,
                                                                    whiteSpace: 'nowrap',
                                                                    boxShadow: activeStageIdx === idx ? '0 0 0 1px rgba(0,0,0,0.08) inset' : 'none'
                                                                }}
                                                            >
                                                                {setting.label.replace(', ', ' | ')}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
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
                                        const isUVLS = setting.scheme_type === 'UVLS';
                                        const unit = isUVLS ? 'pu' : 'Hz';
                                        return (
                                            <div key={sId} style={{
                                                fontSize: '0.75rem', color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.15)',
                                                padding: '4px 10px', borderRadius: '6px', fontWeight: 600, border: '1px solid rgba(59, 130, 246, 0.3)'
                                            }}>
                                                {setting.threshold}{unit} | {setting.time_delay}s
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }} />
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
                                            {formatMW(calculateTransformerMW(stages[activeStageIdx]))} MW
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
                                                const tidVal = typeof tId === 'object' ? tId.id : tId;
                                                return criticalAssets.some(ca => ca.load_transformers && ca.load_transformers.includes(Number(tidVal)));
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
                                                    color: hasCriticalAsset ? '#F97316' : 'var(--accent-cyan)',
                                                    fontWeight: 600,
                                                    paddingLeft: '0.2rem',
                                                    borderLeft: '1px solid rgba(0, 255, 163, 0.2)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    {infoDisplay}
                                                    {hasCriticalAsset && (
                                                        <FiAlertCircle size={10} style={{ color: '#F97316' }} title="Contains Critical Asset" />
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
                                                const pockets = stages[activeStageIdx]?.computed_pockets || [];
                                                const lockedMW = pockets.reduce((sum, card) => sum + (card.total_p_mw || 0), 0);
                                                const previewMW = pocketPreview?.total_p_mw || 0;
                                                const totalMW = lockedMW + previewMW;
                                                return `${formatMW(totalMW)} MW`;
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                { (stages[activeStageIdx]?.computed_pockets || []).map((card, idx) => (
                                    <div key={card.id} style={{
                                        background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.07) 0%, rgba(0, 229, 255, 0.025) 100%)',
                                        border: '1px solid rgba(0, 229, 255, 0.18)',
                                        borderRadius: '10px',
                                        padding: '0.7rem 0.8rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.55rem',
                                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                                                <FaCodeBranch size={14} style={{ color: 'var(--accent-cyan)' }} />
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                                                    Pocket {idx + 1}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                <div style={{
                                                    padding: '3px 8px',
                                                    borderRadius: '999px',
                                                    background: 'rgba(0, 229, 255, 0.10)',
                                                    border: '1px solid rgba(0, 229, 255, 0.16)',
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    color: 'var(--accent-cyan)',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {formatMW(card.total_p_mw ?? 0)} MW
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const newStages = [...stages];
                                                        const active = { ...newStages[activeStageIdx] };
                                                        active.computed_pockets = (active.computed_pockets || []).filter(c => c.id !== card.id);
                                                        newStages[activeStageIdx] = active;
                                                        setStages(newStages);
                                                    }}
                                                    style={{
                                                        width: '22px',
                                                        height: '22px',
                                                        borderRadius: '999px',
                                                        border: '1px solid rgba(239, 68, 68, 0.18)',
                                                        background: 'rgba(239, 68, 68, 0.08)',
                                                        color: 'rgba(239, 68, 68, 0.9)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        padding: 0,
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)';
                                                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.28)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                                                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.18)';
                                                    }}
                                                    aria-label={`Delete pocket ${idx + 1}`}
                                                    type="button"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{
                                            fontSize: '0.68rem',
                                            color: 'rgba(255,255,255,0.82)',
                                            lineHeight: 1.4,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            <span style={{ color: '#d7fbff', fontWeight: 700 }}>
                                                {card.branchGroups?.map(grp => grp.subId).join(', ') || `Pocket ${idx + 1}`}
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.28)', padding: '0 8px' }}>|</span>
                                            <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                                                {card.branchGroups?.map(grp => grp.branches.join(', ')).join('  •  ') || '-'}
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.28)', padding: '0 8px' }}>|</span>
                                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                                                {(card.pocket_substation_details || card.pocket_substations || []).map(sub => sub.substation_id || sub).join(', ')}
                                            </span>
                                        </div>
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

                                                {!fetchingPocket && pocketPreview?.warning && (
                                                    <div style={{ fontSize: '0.75rem', color: '#FFAB00', marginTop: '0.75rem' }}>
                                                        {pocketPreview.warning}
                                                    </div>
                                                )}

                                                {/* Preview / Fallback Lock Pocket section */}
                                                {pocketPreview && !pocketPreview.error && (pocketPreview.warning || pocketPreview.pocket_substations?.length === 0) && (
                                                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0, 229, 255, 0.1)' }}>
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
                                                                const newPocket = {
                                                                    id: Date.now(),
                                                                    branches: [...branches],
                                                                    branchGroups: Object.values(groups),
                                                                    pocket_substations: pocketPreview.pocket_substations || [],
                                                                    pocket_substation_details: pocketPreview.pocket_substation_details || [],
                                                                    total_p_mw: pocketPreview.total_p_mw || 0,
                                                                    substation_mw: (pocketPreview.pocket_substation_details || []).reduce((acc, sub) => {
                                                                        acc[sub.substation_id] = { total_p_mw: sub.p_mw, total_q_mvar: sub.q_mvar };
                                                                        return acc;
                                                                    }, {}),
                                                                    total_q_mvar: pocketPreview.total_q_mvar || 0
                                                                };
                                                                const newStages = [...stages];
                                                                const active = { ...newStages[activeStageIdx] };
                                                                active.computed_pockets = [...(active.computed_pockets || []), newPocket];
                                                                active.pocket_branches = [];
                                                                newStages[activeStageIdx] = active;
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
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeVersionMeta?.status === 'active' ? '#10B981' : '#FFAB00' }}></div>
                                {activeVersionMeta?.status === 'active' ? 'Published Version Active' : 'Draft Mode Active'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setShowSummaryModal(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                                >
                                    <FaTableList size={16} /> Summary
                                </button>
                                {activeVersionMeta?.status === 'active' ? (
                                    <button
                                        className="btn-secondary"
                                        onClick={handleUnpublishWorkspace}
                                        disabled={publishing}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: 'rgba(255, 171, 0, 0.08)', color: '#FFAB00', border: '1px solid rgba(255, 171, 0, 0.2)', opacity: publishing ? 0.7 : 1 }}
                                    >
                                        <RotateCcw size={16} /> {publishing ? 'Unpublishing...' : 'Unpublish'}
                                    </button>
                                ) : (
                                    <button
                                        className="btn-secondary"
                                        onClick={handlePublishWorkspace}
                                        disabled={publishing}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.08)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)', opacity: publishing ? 0.7 : 1 }}
                                    >
                                        <FaShieldHalved size={15} /> {publishing ? 'Publishing...' : 'Publish'}
                                    </button>
                                )}
                                <button
                                    className="btn-primary"
                                    onClick={handleSaveWorkspace}
                                    disabled={saving || publishing}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', fontSize: '0.85rem', boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)', opacity: (saving || publishing) ? 0.7 : 1 }}
                                >
                                    {saving ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />}
                                    {saving ? 'Saving...' : 'Save Workspace'}
                                </button>
                            </div>
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
                                                padding: '0.525rem 2.5rem 0.525rem 2.5rem',
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
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                type="button"
                                                style={{
                                                    position: 'absolute',
                                                    right: '0.625rem',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '999px',
                                                    border: 'none',
                                                    background: 'rgba(255,255,255,0.06)',
                                                    color: 'var(--text-secondary)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    padding: 0,
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                                                    e.currentTarget.style.color = '#EF4444';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                                }}
                                                aria-label="Clear search"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
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

                                            // Only check transformer assignment for relay header checkbox
                                            let transformerAssignedStage = null;
                                            for (const stage of stages) {
                                                if (stage.transformer_bays && stage.transformer_bays.some(bay => String(bay.relay) === String(relay.id))) {
                                                    transformerAssignedStage = stage.label || `Stage ${stage.stage_number}`;
                                                    break;
                                                }
                                            }

                                            let totalMw = 0;
                                            const detail = detailedSubstations[sub.substation_id];

                                            (Array.isArray(relay.load_transformers) ? relay.load_transformers : []).forEach(txVal => {
                                                const transformerId = typeof txVal === 'object' ? txVal.id : txVal;
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

                                            const hasIncomingBranches = (relay.incoming_branches || []).length > 0;

                                            // Check if this relay contains any critical assets
                                            const hasCriticalAsset = (Array.isArray(relay.load_transformers) ? relay.load_transformers : []).some(txVal => {
                                                const transformerId = typeof txVal === 'object' ? txVal.id : txVal;
                                                return criticalAssets.some(ca => ca.load_transformers && ca.load_transformers.includes(Number(transformerId)));
                                            });

                                            // Group incoming branches by voltage
                                            const relayBranches = relay.incoming_branches || [];

                                            const stageHasBranch = (stage, fullId) => {
                                                if ((stage.pocket_branches || []).includes(fullId)) return true;
                                                return (stage.computed_pockets || []).some(pocket => (pocket.branches || []).includes(fullId));
                                            };

                                            // Check branch assignment per voltage
                                            const getBranchAssignmentStage = () => {
                                                for (const stage of stages) {
                                                    const allAssigned = relayBranches.length > 0 && relayBranches.every(b => {
                                                        const bayId = typeof b === 'object' ? b.bay_id : b;
                                                        const fullId = bayId.includes('_') ? bayId : `${sub.substation_id}_${bayId}`;
                                                        return stageHasBranch(stage, fullId);
                                                    });
                                                    if (allAssigned) {
                                                        return stage.label || `Stage ${stage.stage_number}`;
                                                    }
                                                }
                                                return null;
                                            };

                                            const toggleAllBranches = () => {
                                                const branchIds = relayBranches.map(b => {
                                                    const bayId = typeof b === 'object' ? b.bay_id : b;
                                                    return String(bayId || '');
                                                });

                                                setStages(prevStages => prevStages.map((stage, idx) => {
                                                    if (idx !== activeStageIdx) return stage;
                                                    const existing = stage.pocket_branches || [];
                                                    const allAssigned = branchIds.every(id => existing.includes(id));
                                                    const pocketContainsAll = (stage.computed_pockets || []).some(pocket =>
                                                        branchIds.every(id => (pocket.branches || []).includes(id))
                                                    );

                                                    if (pocketContainsAll) {
                                                        return {
                                                            ...stage,
                                                            computed_pockets: (stage.computed_pockets || []).filter(pocket =>
                                                                !branchIds.every(id => (pocket.branches || []).includes(id))
                                                            ),
                                                        };
                                                    }

                                                    return {
                                                        ...stage,
                                                        pocket_branches: allAssigned
                                                            ? existing.filter(id => !branchIds.includes(id))
                                                            : [...new Set([...existing, ...branchIds])],
                                                    };
                                                }));
                                            };

                                            const hasTransformers = (relay.load_transformers || []).length > 0;

                                            return (
                                                <div key={relay.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                                    {hasTransformers && (
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
                                                                        if (!transformerAssignedStage) addTransformerToStage(relay);
                                                                    }}
                                                                    style={{ height: '18px', display: 'flex', alignItems: 'center' }}
                                                                >
                                                                    {transformerAssignedStage ? <CheckSquare size={14} color="var(--text-secondary)" /> : <Square size={14} color="var(--accent-cyan)" />}
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: transformerAssignedStage ? 'var(--text-secondary)' : 'var(--accent-cyan)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {relay.relay_name?.replace(' System', '') || 'Relay'}
                                                                        </span>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            {hasCriticalAsset && (
                                                                                <FiAlertCircle size={12} style={{ color: '#F97316' }} title="Contains Critical Asset" />
                                                                            )}
                                                                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--accent-cyan)', whiteSpace: 'nowrap' }}>
                                                                                {formatMW(totalMw)} MW
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    {transformerAssignedStage && (
                                                                        <div style={{
                                                                            fontSize: '0.6rem',
                                                                            color: '#FFAB00',
                                                                            fontStyle: 'italic',
                                                                            marginTop: '2px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'flex-start'
                                                                        }}>
                                                                            <span style={{ lineHeight: '1.2' }}>Assigned: {transformerAssignedStage}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(hasTransformers ? isExpanded : true) && (
                                                        <div style={{ paddingBottom: '8px' }}>
                                                            {(Array.isArray(relay.load_transformers) ? relay.load_transformers : []).map(txVal => {
                                                                const transformerId = typeof txVal === "object" ? txVal.id : txVal;
                                                                let txLabel = typeof txVal === "object" && txVal.bay_id ? txVal.bay_id : `T-Bay ${transformerId}`;
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
                                                                    String(tb.relay) === String(relay.id) && 
                                                                    tb.transformers.some(t => {
                                                                        const tId = typeof t === 'object' ? t.id : t;
                                                                        return String(tId) === String(transformerId);
                                                                    })
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
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <span style={{ fontFamily: 'monospace' }}>{formatMW(txMw)} MW</span>
                                                                            {isTxAssigned && <CheckSquare size={12} color="var(--accent-cyan)" />}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}

                                                            {/* Incoming Branches */}
                                                            {relayBranches.length > 0 && (
                                                                <div style={{ paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}>
                                                                    {(() => {
                                                                        const assignedStage = getBranchAssignmentStage();
                                                                        const assignedCount = relayBranches.filter(b => {
                                                                            const bayId = typeof b === 'object' ? b.bay_id : b;
                                                                            const fullId = bayId.includes('_') ? bayId : `${sub.substation_id}_${bayId}`;
                                                                            return stageHasBranch(stages[activeStageIdx] || {}, fullId);
                                                                        }).length;
                                                                        const allAssigned = assignedCount === relayBranches.length;

                                                                        return (
                                                                            <div style={{ marginBottom: '4px' }}>
                                                                                {/* Incoming Branches Header */}
                                                                                <div
                                                                                    style={{
                                                                                    padding: '0.2rem 0.5rem',
                                                                                    paddingLeft: `${(hasTransformers ? 1.5 : 0.5) + paddingLevel * 1}rem`,
                                                                                    cursor: 'pointer',
                                                                                    borderRadius: '4px',
                                                                                    background: allAssigned ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                                                                                }}
                                                                                className="hover-glow">
                                                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                                                        {!hasTransformers && (
                                                                                            <div
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    toggleNode(rId);
                                                                                                }}
                                                                                                style={{ height: '18px', display: 'flex', alignItems: 'center' }}
                                                                                            >
                                                                                                {isExpanded ? <ChevronDown size={14} color="var(--accent-cyan)" /> : <ChevronRight size={14} color="var(--accent-cyan)" />}
                                                                                            </div>
                                                                                        )}
                                                                                        <div
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                toggleAllBranches();
                                                                                            }}
                                                                                            style={{ height: '18px', display: 'flex', alignItems: 'center' }}
                                                                                        >
                                                                                            {allAssigned ? <CheckSquare size={12} color="var(--accent-cyan)" /> : <Square size={12} color="var(--accent-cyan)" />}
                                                                                        </div>
                                                                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                                <span
                                                                                                    style={{
                                                                                                        fontSize: '0.7rem',
                                                                                                        fontWeight: 600,
                                                                                                        color: allAssigned ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.4)'
                                                                                                    }}
                                                                                                    onClick={() => {
                                                                                                        if (!hasTransformers) toggleNode(rId);
                                                                                                    }}
                                                                                                >
                                                                                                    INCOMING BRANCHES
                                                                                                </span>
                                                                                                <span style={{
                                                                                                    fontSize: '0.65rem',
                                                                                                    color: 'rgba(255,255,255,0.25)'
                                                                                                }}>
                                                                                                    [{assignedCount}/{relayBranches.length}]
                                                                                                </span>
                                                                                            </div>
                                                                                            {assignedStage && (
                                                                                                <div style={{
                                                                                                    fontSize: '0.6rem',
                                                                                                    color: '#FFAB00',
                                                                                                    fontStyle: 'italic',
                                                                                                    marginTop: '2px',
                                                                                                    display: 'inline-flex',
                                                                                                    alignItems: 'flex-start'
                                                                                                }}>
                                                                                                    <span style={{ lineHeight: '1.2' }}>Assigned: {assignedStage}</span>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>

                                                                                {/* Individual Branches - Simple click like transformers */}
                                                                                {(hasTransformers || isExpanded) && relayBranches.map(branch => {
                                                                                    const bayId = typeof branch === 'object' ? branch.bay_id : branch;
                                                                                    const bayIdStr = String(bayId || '');
                                                                                    const localPrefix = `${sub.substation_id}_`;
                                                                                    const displayId = bayIdStr.startsWith(localPrefix) ? bayIdStr.replace(localPrefix, '') : bayIdStr;
                                                                                    const fullId = bayIdStr.includes('_') ? bayIdStr : `${sub.substation_id}_${bayIdStr}`;
                                                                                    const isAssigned = stageHasBranch(stages[activeStageIdx] || {}, fullId);

                                                                                    return (
                                                                                        <div
                                                                                            key={typeof branch === 'object' ? branch.id : branch}
                                                                                            onClick={() => toggleBranchInStage(bayId, sub.substation_id)}
                                                                                            style={{
                                                                                                display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.5rem',
                                                                                                paddingLeft: `${(hasTransformers ? 2.5 : 1.5) + paddingLevel * 1}rem`, fontSize: '0.7rem',
                                                                                                color: isAssigned ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                                                                                cursor: 'pointer',
                                                                                            }}
                                                                                            className="hover-glow"
                                                                                        >
                                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                                {isAssigned ? <CheckSquare size={12} color="var(--accent-cyan)" /> : <Square size={12} color="var(--accent-cyan)" />}
                                                                                                <FaCodeBranch size={10} style={{ opacity: isAssigned ? 1 : 0.5 }} />
                                                                                                <span style={{ fontWeight: isAssigned ? 700 : 400 }}>{displayId}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    })()}
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
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Configuration Settings</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Manage global scheme configurations such as UFLS settings, UVLS settings, logic rules, and other shared setup controls.</p>
                                </div>
                            </div>

                            {/* SETTINGS TABS */}
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
                                <div onClick={() => setActiveGlobalSettingsTab('ufls')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: activeGlobalSettingsTab === 'ufls' ? 'var(--accent-cyan)' : 'var(--text-secondary)', borderBottom: activeGlobalSettingsTab === 'ufls' ? '2px solid var(--accent-cyan)' : '2px solid transparent', transition: 'all 0.2s' }}>
                                    UFLS Settings
                                </div>
                                <div onClick={() => setActiveGlobalSettingsTab('uvls')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: activeGlobalSettingsTab === 'uvls' ? 'var(--accent-cyan)' : 'var(--text-secondary)', borderBottom: activeGlobalSettingsTab === 'uvls' ? '2px solid var(--accent-cyan)' : '2px solid transparent', transition: 'all 0.2s' }}>
                                    UVLS Settings
                                </div>
                                <div onClick={() => setActiveGlobalSettingsTab('conflict')} style={{ padding: '0.75rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: activeGlobalSettingsTab === 'conflict' ? 'var(--accent-cyan)' : 'var(--text-secondary)', borderBottom: activeGlobalSettingsTab === 'conflict' ? '2px solid var(--accent-cyan)' : '2px solid transparent', transition: 'all 0.2s' }}>
                                    Critical Substation Conflict
                                </div>
                            </div>

                            {activeGlobalSettingsTab !== 'conflict' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>
                                {(() => {
                                    const selectedSchemeType = activeGlobalSettingsTab === 'uvls' ? 'UVLS' : 'UFLS';
                                    const thresholdUnit = selectedSchemeType === 'UVLS' ? 'p.u.' : 'Hz';
                                    const settingsForTab = getSortedSettings(globalSettings.filter(s => s.scheme_type === selectedSchemeType));
                                    return (
                                        <>
                                {/* Left: Datatable */}
                                <div style={{ gridColumn: 'span 8' }}>
                                    <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <th style={{ padding: '1rem', fontWeight: 600 }}>Label</th>
                                                    <th style={{ padding: '1rem', fontWeight: 600 }}>Threshold</th>
                                                    <th style={{ padding: '1rem', fontWeight: 600 }}>Time Delay</th>
                                                    {isStaff && <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {settingsForTab.map(s => (
                                                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                                        <td style={{ padding: '1rem', fontWeight: 500 }}>{s.label}</td>
                                                        <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{s.threshold} {thresholdUnit}</td>
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
                                                {settingsForTab.length === 0 && (
                                                    <tr>
                                                        <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No settings defined.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Right: Add Form */}
                                <div style={{ gridColumn: 'span 4' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1.5rem', position: 'sticky', top: 0 }}>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Add New {selectedSchemeType} Setting</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Threshold ({thresholdUnit})</label>
                                                <input type="number" step="0.01" className="dark-input" style={{ width: '100%' }} value={newSettingThreshold} onChange={e => setNewSettingThreshold(e.target.value)} placeholder={selectedSchemeType === 'UVLS' ? 'e.g. 0.85' : 'e.g. 49.2'} />
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
                                        </>
                                    );
                                })()}
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
                                                <div key={idx} style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                        <FiAlertCircle size={16} style={{ color: '#F97316' }} />
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

            {/* CREATE STAGE MODAL */}
            <AnimatePresence>
                {showSummaryModal && (
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
                            style={{ width: '1400px', maxWidth: '96vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', padding: 0 }}
                        >
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Assignment Summary</h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Workbook-style summary using Stage Label, Grid, Substation, feeder, breaker, and setting columns.</p>
                                </div>
                                <button onClick={() => setShowSummaryModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ padding: '1rem 1.5rem 1.5rem 1.5rem', overflow: 'auto' }}>
                                <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                <th style={{ padding: '0.85rem' }}>Stage Label</th>
                                                <th style={{ padding: '0.85rem' }}>Grid</th>
                                                <th style={{ padding: '0.85rem' }}>Substation Name</th>
                                                <th style={{ padding: '0.85rem' }}>Substation id</th>
                                                <th style={{ padding: '0.85rem' }}>Voltage</th>
                                                <th style={{ padding: '0.85rem' }}>Assigned feeder</th>
                                                <th style={{ padding: '0.85rem' }}>Breaker number</th>
                                                <th style={{ padding: '0.85rem' }}>Threshold Setting 1</th>
                                                <th style={{ padding: '0.85rem' }}>Time Delay 1</th>
                                                <th style={{ padding: '0.85rem' }}>Threshold Setting 2</th>
                                                <th style={{ padding: '0.85rem' }}>Time Delay 2</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getSummaryRows().map((row, idx) => (
                                                <tr key={`${row.substationId}-${row.assignedFeeder}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '0.85rem', fontWeight: 600 }}>{row.stageLabel}</td>
                                                    <td style={{ padding: '0.85rem' }}>{row.grid}</td>
                                                    <td style={{ padding: '0.85rem' }}>{row.substationName}</td>
                                                    <td style={{ padding: '0.85rem', fontFamily: 'monospace' }}>{row.substationId}</td>
                                                    <td style={{ padding: '0.85rem' }}>{row.voltage}</td>
                                                    <td style={{ padding: '0.85rem' }}>{row.assignedFeeder}</td>
                                                    <td style={{ padding: '0.85rem' }}>{row.breakerNumber}</td>
                                                    <td style={{ padding: '0.85rem', fontFamily: 'monospace' }}>{row.threshold1}</td>
                                                    <td style={{ padding: '0.85rem', fontFamily: 'monospace' }}>{row.delay1}</td>
                                                    <td style={{ padding: '0.85rem', fontFamily: 'monospace' }}>{row.threshold2}</td>
                                                    <td style={{ padding: '0.85rem', fontFamily: 'monospace' }}>{row.delay2}</td>
                                                </tr>
                                            ))}
                                            {getSummaryRows().length === 0 && (
                                                <tr>
                                                    <td colSpan="11" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                        No assignments available to summarize.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

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

                                    {(() => {
                                        const metrics = getAssignedSubstationMetrics(stages, true);
                                        return (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Substations Assigned</span>
                                                    <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>
                                                        {metrics.totalSubs} <span style={{fontSize:'0.6rem', color: 'rgba(255,255,255,0.5)', marginLeft:'4px', opacity: 0.7}}>({formatMW(metrics.totalMW)} MW)</span>
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.65rem', color: '#F97316', textTransform: 'uppercase' }}>Of which are Critical</span>
                                                    <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700, color: '#F97316' }}>
                                                        {metrics.criticalSubs} <span style={{fontSize:'0.65rem', color: '#F97316', marginLeft:'6px', fontWeight: 500, opacity: 0.9}}>({formatMW(metrics.criticalMW)} MW)</span>
                                                    </span>
                                                </div>
                                            </>
                                        );
                                    })()}
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
                                const stageAssignedVal = calculateTotalMW(stage);
                                
                                return (
                                    <div key={stage.id} style={{ padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: activeStageIdx === idx ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '3rem', alignItems: 'center' }}>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <h5 style={{ margin: 0, fontSize: '0.8rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem' }}>#{stage.stage_number}</span>
                                                    {stage.label}
                                                </h5>
                                                <button 
                                                    onClick={() => {
                                                        setEditingStageIdx(idx);
                                                        setNewStageLabel(stage.label);
                                                        setNewStageNumber(stage.stage_number);
                                                        setNewStageTargetMW(stage.target_mw || 0);
                                                        setNewStageSettings(stage.setting_ids || []);
                                                        setShowCreateStageModal(true);
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                                                    title="Edit Stage"
                                                >
                                                    <FiEdit2 size={12} />
                                                </button>
                                            </div>
                                            
                                            {(() => {
                                                const sm = getAssignedSubstationMetrics([stage], true);
                                                return (
                                                    <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px', border: sm.criticalSubs > 0 ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                                                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subs Assigned</span>
                                                            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>{sm.totalSubs} <span style={{fontSize:'0.55rem', color: 'rgba(255,255,255,0.4)', marginLeft:'2px', opacity: 0.6}}>({formatMW(sm.totalMW)}MW)</span></span>
                                                        </div>
                                                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '0.6rem', color: '#F97316', textTransform: 'uppercase' }}>Critical Subs</span>
                                                            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, color: '#F97316' }}>{sm.criticalSubs} <span style={{fontSize:'0.6rem', color: '#F97316', marginLeft:'2px', fontWeight: 500, opacity: 0.9}}>({formatMW(sm.criticalMW)}MW)</span></span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <BulletChart 
                                                    label="Target vs Assigned" 
                                                    actual={Number(stageAssignedVal) || 0} 
                                                    target={Number(stage.target_mw) || 0} 
                                                    unit="MW" 
                                                    color={activeStageIdx === idx ? 'var(--accent-cyan)' : '#3B82F6'} 
                                                />
                                            </div>
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
