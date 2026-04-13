import React, { useState, useEffect, useMemo } from 'react';
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
import { computeSchemeMetrics } from '../utils/loadSheddingUtils';
import api from '../api';
import { CardLoader } from './Loader';

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
    const [isNewlyCloned, setIsNewlyCloned] = useState(() => getInitialState('isNewlyCloned', false));

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

    // --- Workspace Panel State ---
    const [showLibrary, setShowLibrary] = useState(true);
    const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
    const [showProfilePopover, setShowProfilePopover] = useState(false);

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
                activeVersionId, schemeType, versionLabel, reviewYear, targetPercentage, isMetricsDrawerOpen, isNewlyCloned, stages, activeStageIdx, detailedSubstations
            };
            sessionStorage.setItem('ls_draft_state', JSON.stringify(draftState));
        }
    }, [activeVersionId, schemeType, versionLabel, reviewYear, targetPercentage, isMetricsDrawerOpen, isNewlyCloned, stages, activeStageIdx, detailedSubstations, view]);

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

                    // Removed auto-create allowing users to stack multiple boundaries before explicitly committing

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
        setIsNewlyCloned(false);
        setView('designer');
        setActiveTab('stages');
    };

    const handleResumeDraft = async (vId) => {
        setLoading(true);
        setIsNewlyCloned(false);
        try {
            const res = await api.get(`/load-shedding-versions/${vId}/`);
            const vData = res.data;
            setSchemeType(vData.scheme_type);
            setReviewYear(vData.review_year);
            setVersionLabel(vData.notes);
            setTargetPercentage(vData.target_percentage || (vData.scheme_type === 'UVLS' ? 15 : 60));
            setActiveVersionId(vData.id);

            // Fetch detailed substation data for existing stages to ensure MW displays correctly
            if (vData.stages && vData.stages.length > 0) {
                const subIds = [...new Set(vData.stages.flatMap(s => [
                    ...(s.transformer_bays?.map(b => b.relay_substation_id) || []),
                    ...(s.pocket_bays?.flatMap(p => p.topology_cache?.isolated_substations || []) || [])
                ]))];
                for (const subId of subIds) {
                    if (subId && !detailedSubstations[subId]) {
                        try {
                            const [sRes, tRes] = await Promise.all([
                                api.get(`/substations/${subId}/`),
                                api.get(`/load-transformers/?substation=${subId}`)
                            ]);
                            const data = sRes.data;
                            data.db_transformers = tRes.data;
                            setDetailedSubstations(prev => ({ ...prev, [subId]: data }));
                        } catch (e) {
                             console.error("Failed to pre-fetch sub", subId, e);
                        }
                    }
                }
            }

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
                setIsNewlyCloned(true);
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
        // Compare exactly with order preserved
        const newSettingsStr = [...newStageSettings].filter(Boolean).join(',');
        const duplicateSettings = stages.find((s, i) => {
            if (i === editingStageIdx) return false;
            const existing = [...(s.setting_ids || [])].filter(Boolean).join(',');
            return existing === newSettingsStr;
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
                setting_ids: newStageSettings.filter(Boolean),
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
                setting_ids: newStageSettings.filter(Boolean),
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

        setStages(prevStages => {
            const assignment = getBranchAssignmentInfo(fullId, prevStages);
            if (assignment && assignment.stageIdx !== activeStageIdx) {
                return prevStages;
            }

            return prevStages.map((stage, idx) => {
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
            });
        });
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

    const stageContainsBranch = (stage, fullBranchId) => {
        if (!stage || !fullBranchId) return false;
        if ((stage.pocket_branches || []).includes(fullBranchId)) return true;
        return (stage.computed_pockets || []).some(pocket => (pocket.branches || []).includes(fullBranchId));
    };

    const getBranchAssignmentInfo = (fullBranchId, stageList = stages) => {
        if (!fullBranchId) return null;
        for (let idx = 0; idx < stageList.length; idx++) {
            const stage = stageList[idx];
            if (stageContainsBranch(stage, fullBranchId)) {
                return { stageIdx: idx, stage };
            }
        }
        return null;
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
                    target_percentage: targetPercentage,
                    notes: versionLabel,
                    status: 'draft'
                });
                vId = versionRes.data.id;
                setActiveVersionId(vId);
            } else {
                // Update target_percentage and notes for existing draft
                await api.patch(`/load-shedding-versions/${vId}/`, {
                    target_percentage: targetPercentage,
                    notes: versionLabel,
                    scheme_type: schemeType,
                    review_year: reviewYear
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
            
            // 4. Trigger backend recompute to sync mw_cache for Viewer
            try {
                await api.post('/load-shedding-transformer-bays/recompute/', { version_id: vId });
            } catch (recompErr) {
                console.error("Post-save recompute failed", recompErr);
                // Non-blocking for the save itself
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

    const handleUnpublishWorkspace = async () => {
        setPublishing(true);
        try {
            if (!activeVersionId) return;

            await api.post(`/load-shedding-versions/${activeVersionId}/unpublish/`);
            await fetchMasterData();
            window.dispatchEvent(new CustomEvent('load-shedding-published'));
            alert('Scheme unpublished successfully.');
        } catch (err) {
            console.error('Failed to unpublish scheme', err);
            alert(`Failed to unpublish scheme. ${err?.response?.data?.error || err.message}`);
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

    // --- Metrics & Calculations ---

    /**
     * Compute scheme-wide metrics using unified utility for 100% parity with Viewer.
     */
    const schemeMetrics = useMemo(() => {
        return computeSchemeMetrics(
            stages,
            substations,
            (stage) => getEffectiveStagePockets(stage, stages.indexOf(stage)),
            (bay) => {
                let bayMW = 0;
                const subId = bay.relay_substation_id;
                const detail = detailedSubstations[subId];
                if (detail && detail.transformers && detail.db_transformers) {
                    bay.transformers?.forEach(transformerObj => {
                        const transformerId = typeof transformerObj === 'object' ? transformerObj.id : transformerObj;
                        const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId));
                        if (dbTx) {
                            const expectedName = `TX T${dbTx.transformer_no}`;
                            // Use exact match first, then fallback to includes but with word boundary or specific suffix
                            const tx = detail.transformers.find(t => t.name === expectedName) || 
                                       detail.transformers.find(t => t.name.split(' ').pop() === `T${dbTx.transformer_no}`);
                            if (tx && tx.load_mw != null) bayMW += parseFloat(tx.load_mw);
                        }
                    });
                }
                return bayMW;
            },
            (bay) => {
                const subId = bay.relay_substation_id;
                return criticalAssets.some(ca => String(ca.substation_id) === String(subId));
            },
            criticalAssets
        );
    }, [stages, substations, detailedSubstations, criticalAssets]);

    const calculateOverallAssignedMW = () => schemeMetrics.totalMW;

    const calculateTargetMW = () => {
        if (!gridData || !gridData.total_pload_mw) return 0;
        return (targetPercentage / 100) * gridData.total_pload_mw;
    };

    const calculateRemainingTargetMW = () => {
        const totalTarget = calculateTargetMW();
        const totalAssigned = calculateOverallAssignedMW();
        return totalAssigned - totalTarget;
    };

    const calculateTotalMW = (stage, stageIdx = activeStageIdx) => {
        if (!stage) return 0;
        // Use unified utility for single stage to ensure logic parity
        const metrics = computeSchemeMetrics(
            [stage],
            substations,
            (s) => getEffectiveStagePockets(s, stageIdx),
            (bay) => {
                let bayMW = 0;
                const subId = bay.relay_substation_id;
                const detail = detailedSubstations[subId];
                if (detail && detail.transformers && detail.db_transformers) {
                    bay.transformers?.forEach(transformerObj => {
                        const transformerId = typeof transformerObj === 'object' ? transformerObj.id : transformerObj;
                        const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId));
                        if (dbTx) {
                            const expectedName = `TX T${dbTx.transformer_no}`;
                            // Use exact match first, then fallback to includes but with word boundary or specific suffix
                            const tx = detail.transformers.find(t => t.name === expectedName) || 
                                       detail.transformers.find(t => t.name.split(' ').pop() === `T${dbTx.transformer_no}`);
                            if (tx && tx.load_mw != null) bayMW += parseFloat(tx.load_mw);
                        }
                    });
                }
                return bayMW;
            },
            (bay) => {
                const subId = bay.relay_substation_id;
                return criticalAssets.some(ca => String(ca.substation_id) === String(subId));
            },
            criticalAssets
        );
        return metrics.totalMW;
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
                    const tx = detail.transformers.find(t => t.name === expectedName) || 
                               detail.transformers.find(t => t.name.split(' ').pop() === `T${dbTx.transformer_no}`);
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
        const metrics = computeSchemeMetrics(
            [stage],
            substations,
            (s) => getEffectiveStagePockets(s, stages.indexOf(stage)),
            (bay) => {
                let bayMW = 0;
                const subId = bay.relay_substation_id;
                const detail = detailedSubstations[subId];
                if (detail && detail.transformers && detail.db_transformers) {
                    bay.transformers?.forEach(transformerId => {
                        const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId));
                        if (dbTx) {
                            const expectedName = `TX T${dbTx.transformer_no}`;
                            // Use exact match first, then fallback to includes but with word boundary or specific suffix
                            const tx = detail.transformers.find(t => t.name === expectedName) || 
                                       detail.transformers.find(t => t.name.split(' ').pop() === `T${dbTx.transformer_no}`);
                            if (tx && tx.load_mw != null) bayMW += parseFloat(tx.load_mw);
                        }
                    });
                }
                return bayMW;
            },
            (bay) => {
                const subId = bay.relay_substation_id;
                return criticalAssets.some(ca => String(ca.substation_id) === String(subId));
            },
            criticalAssets
        );
        return metrics.regionalAssigned[region] || 0;
    };

    const getOverallRegionalSpiralData = () => {
        if (!gridData || !gridData.regional_breakdown) return [];
        return gridData.regional_breakdown.map(reg => {
            const target_mw = (targetPercentage / 100) * reg.total_pload_mw;
            const assigned_mw = schemeMetrics.regionalAssigned[reg.region] || 0;
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
                    const subRelays = relays.filter(r => 
                        (r.substation_id === sub.substation_id || r.substation === sub.substation_id) && 
                        r.is_active && 
                        ((r.load_transformers && r.load_transformers.length > 0) || (r.incoming_branches && r.incoming_branches.length > 0))
                    );
                    return subRelays.length > 0;
                })
                .reduce((sum, sub) => sum + (parseFloat(sub.total_pload_mw) || 0), 0);
            
            const assigned_mw = schemeMetrics.regionalAssigned[reg.region] || 0;
            
            return {
                region: reg.region,
                potential_mw,
                assigned_mw
            };
        });
    };

    const getAssignedSubstationMetrics = (stageArray, includePockets = false) => {
        return computeSchemeMetrics(
            stageArray,
            substations,
            (stage) => includePockets ? getEffectiveStagePockets(stage, stages.indexOf(stage)) : [],
            (bay) => {
                const subId = bay.relay_substation_id;
                let subMW = 0;
                const detail = detailedSubstations[subId];
                if (detail && detail.transformers && detail.db_transformers) {
                    bay.transformers?.forEach(tObj => {
                        const tId = typeof tObj === 'object' ? tObj.id : tObj;
                        const dbTx = detail.db_transformers.find(t => String(t.id) === String(tId));
                        if (dbTx) {
                            const expectedName = `TX T${dbTx.transformer_no}`;
                            const tx = detail.transformers.find(t => t.name === expectedName) || 
                                       detail.transformers.find(t => t.name.split(' ').pop() === `T${dbTx.transformer_no}`);
                            if (tx && tx.load_mw != null) {
                                subMW += parseFloat(tx.load_mw);
                            }
                        }
                    });
                }
                return subMW;
            },
            (bay) => {
                return (bay.transformers || []).some(tObj => {
                    const tIdVal = typeof tObj === 'object' ? tObj.id : tObj;
                    return (criticalAssets || []).some(ca => (ca.load_transformers || []).includes(Number(tIdVal)));
                });
            },
            criticalAssets
        );
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
        const stageSettings = (stage?.setting_ids || [])
            .map(sId => globalSettings.find(s => s.id === sId) || null);

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
            
            const txRows = [];
            (stage.transformer_bays || []).forEach(bay => {
                const relay = relays.find(r => String(r.id) === String(bay.relay));
                const sub = substations.find(s => s.substation_id === bay.relay_substation_id);
                if (!relay || !sub) return;

                const selectedIds = (bay.transformers || []).map(t => typeof t === 'object' ? t.id : t);
                const selectedTransformers = (relay.load_transformers || []).filter(t => selectedIds.includes(typeof t === 'object' ? t.id : t));

                const assignedFeeder = selectedTransformers.length > 0
                    ? selectedTransformers.map(t => `T${t.transformer_no}`).join(' & ')
                    : (bay.transformers && bay.transformers.length > 0)
                        ? bay.transformers.map(t => typeof t === 'object' ? `T${t.id}` : `T${t}`).join(' & ')
                        : (bay.frozen_assets || []).map(a => `T${a}`).join(' & ');

                const breakerNumber = selectedTransformers
                    .map(t => t.lv_breaker_number)
                    .filter(Boolean)
                    .join(' & ') || 'n/a';

                const voltageRaw = selectedTransformers.map(t => t.lv_voltage).filter(Boolean);
                const txVoltage = voltageRaw.length > 0 ? [...new Set(voltageRaw)].join(' & ') : '';

                txRows.push({
                    grid: sub.grid || '',
                    substationName: sub.name || '',
                    substationId: sub.substation_id || '',
                    voltage: txVoltage || sub.voltage || '',
                    assignedFeeder: assignedFeeder || 'n/a',
                    breakerNumber,
                    ...settingCells,
                });
            });
            txRows.sort((a, b) => a.substationId.localeCompare(b.substationId));

            const pocketRows = [];
            const pockets = getEffectiveStagePockets(stage, stageIdx);
            pockets.forEach(card => {
                const singlePocketRows = [];
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

                    singlePocketRows.push({
                        grid: localSub.grid || '',
                        substationName: localSub.name || '',
                        substationId: localSub.substation_id || '',
                        voltage: localSub.voltage || '',
                        assignedFeeder: assignedFeeder || 'n/a',
                        breakerNumber,
                        ...settingCells,
                    });
                });
                singlePocketRows.sort((a, b) => a.substationId.localeCompare(b.substationId));
                pocketRows.push(...singlePocketRows);
            });

            const combined = [...txRows, ...pocketRows];
            combined.forEach((row, idx) => {
                row.stageLabel = idx === 0 ? stage.label : '';
                rows.push(row);
            });
        });

        return rows;
    };

    const isStaff = currentUser?.is_staff || false;
    const drafts = versions.filter(v => v.status === 'draft');
    const published = versions.filter(v => ['active', 'deactivated'].includes(v.status));

    if (loading && view === 'manager') {
        return (
            <div style={{ height: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CardLoader show={true} message="Loading designer..." />
            </div>
        );
    }

    // ==========================================
    // VIEW: MANAGER
    // ==========================================
    // VIEW: MANAGER
    // ==========================================
    if (view === 'manager') {
        const hasDrafts = drafts.length > 0;
        const activePublished = published.filter(v => v.status === 'active');
        const inactivePublished = published.filter(v => v.status !== 'active');

        const DraftStatusBadge = ({ v }) => {
            const wasUnpublished = !!v.notes && v.notes.startsWith('Unpublished from');
            if (wasUnpublished) return (
                <span style={{ fontSize: '0.6rem', fontWeight: 600, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '2px 7px', borderRadius: '999px' }}>
                    Unpublished
                </span>
            );
            return (
                <span style={{ fontSize: '0.6rem', fontWeight: 600, background: '#fefce8', border: '1px solid #fde68a', color: '#92400e', padding: '2px 7px', borderRadius: '999px' }}>
                    Draft
                </span>
            );
        };

        const PublishedStatusBadge = ({ status }) => status === 'active'
            ? <span style={{ fontSize: '0.6rem', fontWeight: 600, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '2px 8px', borderRadius: '999px' }}>Active</span>
            : <span style={{ fontSize: '0.6rem', fontWeight: 600, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '2px 8px', borderRadius: '999px' }}>Inactive</span>;

        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif", background: '#fff' }}>

                {/* ── Header ──────────────────────────────────────────── */}
                <div style={{ flexShrink: 0, padding: '1.5rem 2rem 0', background: '#fff' }}>

                    {/* Title */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.68rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(30,41,59,0.45)', marginBottom: '0.4rem' }}>
                            Load Shedding Registry
                        </div>
                        <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 600, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                            Scheme Designer
                        </h1>
                    </div>

                    {/* Info / action bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem 1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>

                        {/* Stats */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>Your Drafts</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{drafts.length}</span>
                            </div>
                            <div style={{ width: '1px', height: '28px', background: '#e2e8f0' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>Published</span>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{published.length}</span>
                            </div>
                        </div>

                        {/* New Scheme button — pushed to far right */}
                        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                            <button
                                onClick={handleCreateNew}
                                style={{
                                    height: '36px', padding: '0 16px',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    fontSize: '0.8rem', fontFamily: "'Poppins', sans-serif", fontWeight: 600,
                                    color: '#0f172a', background: '#fff',
                                    border: '1px solid #e2e8f0', borderRadius: '8px',
                                    cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                            >
                                <Plus size={15} /> New Scheme
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Two-column body ──────────────────────────────────── */}
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.25rem', padding: '0 2rem 2rem', overflow: 'hidden' }}>

                    {/* Left: Your Drafts */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', background: '#fff' }}>

                        {/* Section label */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            <FaFolderTree size={13} style={{ color: '#64748b' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>Your Drafts</span>
                            {hasDrafts && (
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '1px 7px', borderRadius: '999px' }}>
                                    {drafts.length}
                                </span>
                            )}
                        </div>

                        {/* Multi-draft warning */}
                        {drafts.length > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 0.85rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.72rem', color: '#92400e', flexShrink: 0 }}>
                                <TriangleAlert size={13} style={{ flexShrink: 0, color: '#d97706' }} />
                                <span>Multiple drafts detected — select which one to continue.</span>
                            </div>
                        )}

                        {hasDrafts ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', overflowY: 'auto', flex: 1, alignContent: 'start' }}>
                                {drafts.map(v => {
                                    const stageCount = v.stages?.length ?? '—';
                                    return (
                                        <div key={v.id} style={{ padding: '1rem', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem', transition: 'border-color 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                        {v.scheme_type} {v.review_year} v{v.version}
                                                    </span>
                                                    <DraftStatusBadge v={v} />
                                                </div>
                                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {v.notes || 'Unnamed Document'}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                                                        {stageCount} stage{stageCount !== 1 ? 's' : ''}
                                                    </span>
                                                    {v.updated_at && (
                                                        <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                                                            Edited {new Date(v.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                <button
                                                    style={{ flex: 1, height: '32px', fontSize: '0.75rem', fontFamily: "'Poppins', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }}
                                                    onClick={() => handleResumeDraft(v.id)}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
                                                >
                                                    <FolderOpen size={12} /> Open
                                                </button>
                                                <button
                                                    style={{ height: '32px', padding: '0 10px', background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                                                    onClick={() => handleDeleteDraft(v.id)}
                                                    title="Delete this draft"
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
                                <FaFolderTree size={32} style={{ color: '#e2e8f0', marginBottom: '0.85rem' }} />
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>No active drafts</div>
                                <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.5 }}>Create a new scheme or clone a published version to get started.</div>
                            </div>
                        )}
                    </div>

                    {/* Right: Clone from Published */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', background: '#fff' }}>

                        {/* Section label */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            <FaShieldHalved size={13} style={{ color: '#64748b' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>Clone from Published</span>
                        </div>

                        {published.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0', overflowY: 'auto', flex: 1 }}>
                                {activePublished.length > 0 && (
                                    <>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#166534', marginBottom: '6px', flexShrink: 0 }}>Active</div>
                                        {activePublished.map(v => (
                                            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '3px' }}>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{v.scheme_type} {v.review_year} v{v.version}</span>
                                                        <PublishedStatusBadge status={v.status} />
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes || 'System Baseline'}</div>
                                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '2px' }}>{v.stages?.length ?? '—'} stages · {formatDate(v.published_at)}</div>
                                                </div>
                                                <button
                                                    style={{ height: '30px', padding: '0 12px', fontSize: '0.72rem', fontFamily: "'Poppins', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                                                    onClick={() => handleCloneAndEdit(v.id)}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                                >
                                                    <Copy size={11} /> Clone
                                                </button>
                                            </div>
                                        ))}
                                    </>
                                )}
                                {activePublished.length > 0 && inactivePublished.length > 0 && (
                                    <div style={{ height: '1px', background: '#f1f5f9', margin: '10px 0', flexShrink: 0 }} />
                                )}
                                {inactivePublished.length > 0 && (
                                    <>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '6px', flexShrink: 0 }}>Inactive</div>
                                        {inactivePublished.map(v => (
                                            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9', opacity: 0.8 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '3px' }}>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{v.scheme_type} {v.review_year} v{v.version}</span>
                                                        <PublishedStatusBadge status={v.status} />
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes || 'System Baseline'}</div>
                                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '2px' }}>{v.stages?.length ?? '—'} stages · {formatDate(v.published_at)}</div>
                                                </div>
                                                <button
                                                    style={{ height: '30px', padding: '0 12px', fontSize: '0.72rem', fontFamily: "'Poppins', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                                                    onClick={() => handleCloneAndEdit(v.id)}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                                >
                                                    <Copy size={11} /> Clone
                                                </button>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
                                <FaShieldHalved size={32} style={{ color: '#e2e8f0', marginBottom: '0.85rem' }} />
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>No published schemes</div>
                                <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '4px' }}>Publish a scheme to enable cloning.</div>
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
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Poppins', sans-serif", background: '#fff' }}>

            {/* ── TOP BAR ──────────────────────────────────────────── */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 1.25rem', height: '50px', borderBottom: '1px solid #e2e8f0', background: '#fff', gap: '0.5rem' }}>
                {/* Left: back + breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                    <button onClick={() => setView('manager')} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <ChevronRight size={13} style={{ transform: 'rotate(180deg)', color: '#64748b' }} />
                    </button>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>Scheme Designer</span>
                    <ChevronRight size={11} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schemeType} {reviewYear}</span>
                    {versionLabel && <span style={{ fontSize: '0.7rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {versionLabel}</span>}
                    {activeVersionMeta?.status === 'active'
                        ? <span style={{ fontSize: '0.57rem', fontWeight: 700, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '2px 7px', borderRadius: '999px', flexShrink: 0 }}>Published</span>
                        : <span style={{ fontSize: '0.57rem', fontWeight: 700, background: '#fefce8', border: '1px solid #fde68a', color: '#92400e', padding: '2px 7px', borderRadius: '999px', flexShrink: 0 }}>Draft</span>
                    }
                </div>
                {/* Right: toggles + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    {/* Panel toggles */}
                    <button onClick={() => setIsMetricsDrawerOpen(v => !v)} style={{ height: '28px', padding: '0 9px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: isMetricsDrawerOpen ? '#0f172a' : '#94a3b8', background: isMetricsDrawerOpen ? '#f1f5f9' : '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>
                        <FaGaugeHigh size={11} /> Metrics
                    </button>
                    <button onClick={() => setShowLibrary(v => !v)} style={{ height: '28px', padding: '0 9px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: showLibrary ? '#0f172a' : '#94a3b8', background: showLibrary ? '#f1f5f9' : '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>
                        <FaBolt size={11} /> Library
                    </button>
                    <div style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 2px' }} />
                    {/* Profile */}
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowProfilePopover(v => !v)} style={{ height: '28px', padding: '0 9px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: showProfilePopover ? '#0f172a' : '#64748b', background: showProfilePopover ? '#f1f5f9' : '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => { if (!showProfilePopover) e.currentTarget.style.background = '#fff'; }}>
                            <Lock size={11} /> Profile
                        </button>
                        {showProfilePopover && (
                            <>
                                <div onClick={() => setShowProfilePopover(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                                <div style={{ position: 'absolute', top: '34px', right: 0, zIndex: 99, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', padding: '1rem', width: '300px', fontFamily: "'Poppins',sans-serif" }}>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: '0.75rem' }}>Scheme Profile</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Scheme Type {(activeVersionId && !isNewlyCloned) && <Lock size={10} style={{ display: 'inline', color: '#94a3b8' }} />}</label>
                                            <select value={schemeType} onChange={e => setSchemeType(e.target.value)} disabled={!!activeVersionId && !isNewlyCloned} style={{ width: '100%', padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.72rem', color: '#0f172a', background: '#fff', outline: 'none', opacity: (activeVersionId && !isNewlyCloned) ? 0.6 : 1, cursor: (activeVersionId && !isNewlyCloned) ? 'not-allowed' : 'default' }}>
                                                <option value="UFLS">UFLS (Under Frequency)</option>
                                                <option value="UVLS">UVLS (Under Voltage)</option>
                                                <option value="EMLS">EMLS (Manual)</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Review Year</label>
                                                <input type="number" value={reviewYear} onChange={e => setReviewYear(Number(e.target.value))} disabled={!!activeVersionId && !isNewlyCloned} style={{ width: '100%', padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.72rem', color: '#0f172a', outline: 'none', background: '#fff', opacity: (activeVersionId && !isNewlyCloned) ? 0.6 : 1, boxSizing: 'border-box' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Target (%)</label>
                                                <div style={{ position: 'relative' }}>
                                                    <input type="text" value={formatInputNumber(targetPercentage)} onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (raw === '' || !isNaN(raw)) setTargetPercentage(raw); }} style={{ width: '100%', padding: '0.45rem 1.5rem 0.45rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.72rem', color: '#0f172a', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
                                                    <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', color: '#94a3b8' }}>%</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Document Name</label>
                                            <input type="text" placeholder="e.g. 2026 National UFLS" value={versionLabel} onChange={e => setVersionLabel(e.target.value)} disabled={!!activeVersionId && !isNewlyCloned} style={{ width: '100%', padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.72rem', color: '#0f172a', outline: 'none', background: '#fff', opacity: (activeVersionId && !isNewlyCloned) ? 0.6 : 1, boxSizing: 'border-box' }} />
                                        </div>
                                        {activeVersionId && <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontStyle: 'italic' }}>Profile is locked for existing drafts.</div>}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {/* Settings drawer */}
                    <button onClick={() => setShowSettingsDrawer(v => !v)} style={{ height: '28px', padding: '0 9px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: showSettingsDrawer ? '#0f172a' : '#64748b', background: showSettingsDrawer ? '#f1f5f9' : '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => { if (!showSettingsDrawer) e.currentTarget.style.background = '#fff'; }}>
                        <FaGear size={11} /> Settings
                    </button>
                    <div style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 2px' }} />
                    {/* Summary */}
                    <button onClick={() => setShowSummaryModal(true)} style={{ height: '28px', padding: '0 9px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#64748b', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <FaTableList size={11} /> Summary
                    </button>
                    {/* Publish / Unpublish */}
                    {activeVersionMeta?.status === 'active' ? (
                        <button onClick={handleUnpublishWorkspace} disabled={publishing} style={{ height: '28px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer', opacity: publishing ? 0.6 : 1 }}>
                            <RotateCcw size={11} /> {publishing ? 'Unpublishing...' : 'Unpublish'}
                        </button>
                    ) : (
                        <button onClick={handlePublishWorkspace} disabled={publishing} style={{ height: '28px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer', opacity: publishing ? 0.6 : 1 }}>
                            <FaShieldHalved size={11} /> {publishing ? 'Publishing...' : 'Publish'}
                        </button>
                    )}
                    {/* Save */}
                    <button onClick={handleSaveWorkspace} disabled={saving || publishing} style={{ height: '28px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 700, color: '#fff', background: '#0f172a', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: (saving || publishing) ? 0.6 : 1 }} onMouseEnter={e => { if (!saving && !publishing) e.currentTarget.style.background = '#1e293b'; }} onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}>
                        {saving ? <RotateCcw size={11} className="animate-spin" /> : <Save size={11} />}
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* ── STAGE TAB BAR ────────────────────────────────────── */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', borderBottom: '1px solid #e2e8f0', padding: '0 1.25rem', background: '#fff', overflowX: 'auto', gap: '2px', minHeight: '42px' }}>
                {stages.map((stage, idx) => {
                    const stageMW = calculateTotalMW(stage, idx);
                    const isActive = activeStageIdx === idx;
                    const chips = (stage.setting_ids || []).map(sId => globalSettings.find(g => g.id === sId)).filter(Boolean);
                    return (
                        <button key={stage.id} onClick={() => setActiveStageIdx(idx)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0 0.85rem', height: '41px', flexShrink: 0, background: 'none', border: 'none', borderBottom: `2px solid ${isActive ? '#0f172a' : 'transparent'}`, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#0f172a' : '#64748b', whiteSpace: 'nowrap' }}>{stage.label}</span>
                            <span style={{ fontSize: '0.63rem', fontFamily: 'monospace', fontWeight: 600, color: isActive ? '#334155' : '#94a3b8', whiteSpace: 'nowrap' }}>{formatMW(stageMW)} MW</span>
                            {chips.length > 0 && <span style={{ fontSize: '0.53rem', fontWeight: 700, background: isActive ? '#f1f5f9' : 'transparent', border: `1px solid ${isActive ? '#cbd5e1' : '#e2e8f0'}`, color: isActive ? '#475569' : '#94a3b8', padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{chips[0].label}{chips.length > 1 ? ` +${chips.length - 1}` : ''}</span>}
                            {isActive && (
                                <span style={{ display: 'flex', gap: '1px', marginLeft: '2px' }}>
                                    <span onClick={e => { e.stopPropagation(); handleOpenEditStage(idx); }} style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', cursor: 'pointer', color: '#94a3b8' }} onMouseEnter={e => { e.currentTarget.style.color = '#334155'; e.currentTarget.style.background = '#f1f5f9'; }} onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none'; }}><Edit3 size={10} /></span>
                                    <span onClick={e => { e.stopPropagation(); handleDeleteStage(idx); }} style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', cursor: 'pointer', color: '#94a3b8' }} onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }} onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none'; }}><Trash2 size={10} /></span>
                                </span>
                            )}
                        </button>
                    );
                })}
                <button onClick={handleOpenAddStage} style={{ height: '41px', padding: '0 0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.7rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, cursor: 'pointer', flexShrink: 0, borderBottom: '2px solid transparent' }} onMouseEnter={e => e.currentTarget.style.color = '#0f172a'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                    <Plus size={13} /> Add Stage
                </button>
            </div>

            {/* ── BODY: 3-COLUMN ──────────────────────────────────── */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

            {/* ── LEFT: Scheme Metrics ──────────────────────── */}
            {isMetricsDrawerOpen && (
                <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid #e2e8f0', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#fff' }}>
                    {(() => {
                        const schemeTotalMW = calculateOverallAssignedMW();
                        const targetMW = calculateTargetMW();
                        const remaining = calculateRemainingTargetMW();
                        const pct = targetMW > 0 ? Math.abs(remaining / targetMW) * 100 : 0;
                        const isOnTarget = Math.abs(pct) <= 3;
                        return (
                            <>
                                {/* Scheme total */}
                                <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '0.65rem' }}>Scheme Total</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', lineHeight: 1, marginBottom: '3px' }}>
                                        {formatMW(schemeTotalMW)} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b' }}>MW</span>
                                    </div>
                                    {gridData && (
                                        <>
                                            <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '6px' }}>Target: {formatMW(targetMW)} MW ({targetPercentage}%)</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.58rem', color: '#94a3b8' }}>Remaining:</span>
                                                <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, color: isOnTarget ? '#166534' : remaining > 0 ? '#92400e' : '#dc2626' }}>
                                                    {remaining > 0 ? '+' : ''}{formatMW(remaining)} MW
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    {/* Stage rows */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        {stages.map((stage, idx) => {
                                            const mw = calculateTotalMW(stage, idx);
                                            const tgt = stage.target_mw || 0;
                                            const isActive = idx === activeStageIdx;
                                            const p = tgt > 0 ? Math.min((mw / tgt) * 100, 100) : 0;
                                            return (
                                                <div key={stage.id} onClick={() => setActiveStageIdx(idx)} style={{ padding: '4px 6px', borderRadius: '5px', cursor: 'pointer', background: isActive ? '#f8fafc' : 'transparent', border: isActive ? '1px solid #e2e8f0' : '1px solid transparent' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: tgt > 0 ? '3px' : 0 }}>
                                                        <span style={{ fontSize: '0.62rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#0f172a' : '#64748b' }}>{stage.label}</span>
                                                        <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', fontWeight: 600, color: isActive ? '#0f172a' : '#94a3b8' }}>{formatMW(mw)}</span>
                                                    </div>
                                                    {tgt > 0 && (
                                                        <div style={{ height: '2px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${p}%`, background: p >= 100 ? '#166534' : '#0f172a', borderRadius: '999px' }} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* Regional breakdown */}
                                {gridData?.regional_breakdown && (
                                    <div style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '0.65rem' }}>Regional</div>
                                        <CompactRegionalMetrics data={getOverallRegionalSpiralData()} labelKey="region" valueKey="assigned_mw" targetKey="target_mw" />
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* ── CENTER: Assignment Canvas ──────────────────── */}
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {stages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#94a3b8', padding: '3rem' }}>
                        <FaLayerGroup size={28} style={{ color: '#e2e8f0' }} />
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No stages defined</div>
                        <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Add a stage using the tab bar above.</div>
                    </div>
                ) : (
                    <>
                        {/* ── TRANSFORMER BAYS ── */}
                        <div style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <FaBolt size={11} style={{ color: '#64748b' }} />
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>Transformer Bays</span>
                                </div>
                                <span style={{ fontSize: '0.67rem', fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>{formatMW(calculateTransformerMW(stages[activeStageIdx]))} MW</span>
                            </div>
                            {stages[activeStageIdx]?.transformer_bays?.length > 0 ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '0.4rem 1.25rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '22%' }}>Relay System</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '22%' }}>Substation</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>Transformers</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '70px' }}>MW</th>
                                            <th style={{ padding: '0.4rem 1.25rem 0.4rem 0.4rem', borderBottom: '1px solid #f1f5f9', width: '32px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stages[activeStageIdx].transformer_bays.map((bay, bayIdx) => {
                                            const subId = bay.relay_substation_id;
                                            const detail = detailedSubstations[subId];
                                            const relayObj = relays.find(r => r.id === bay.relay);
                                            const relayLabel = relayObj?.relay_name?.replace(' System', '') || '—';
                                            const sub = substations.find(s => s.substation_id === subId);
                                            let txLabels = [], bayMW = 0, hasCritical = false;
                                            if (detail?.db_transformers) {
                                                (bay.transformers || []).forEach(txObj => {
                                                    const tId = typeof txObj === 'object' ? txObj.id : txObj;
                                                    const dbTx = detail.db_transformers.find(t => String(t.id) === String(tId));
                                                    if (dbTx) {
                                                        txLabels.push(`T${dbTx.transformer_no}`);
                                                        const tx = detail.transformers?.find(t => t.name === `TX T${dbTx.transformer_no}`) || detail.transformers?.find(t => t.name.split(' ').pop() === `T${dbTx.transformer_no}`);
                                                        if (tx?.load_mw != null) bayMW += parseFloat(tx.load_mw);
                                                        const tidVal = typeof tId === 'object' ? tId.id : tId;
                                                        if (criticalAssets.some(ca => ca.load_transformers?.includes(Number(tidVal)))) hasCritical = true;
                                                    }
                                                });
                                            }
                                            if (txLabels.length === 0) txLabels = [`${bay.transformers?.length || 0} TXs`];
                                            return (
                                                <tr key={bay.id} style={{ borderBottom: '1px solid #f8fafc' }} onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                    <td style={{ padding: '0.5rem 1.25rem', fontSize: '0.7rem', color: '#334155', fontWeight: 500 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {hasCritical && <FiAlertCircle size={10} style={{ color: '#f97316', flexShrink: 0 }} title="Critical asset" />}
                                                            {relayLabel}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0f172a' }}>{subId}</div>
                                                        {sub?.name && <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>{sub.name}</div>}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', color: '#334155', fontFamily: 'monospace' }}>{txLabels.join(', ')}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{formatMW(bayMW)}</td>
                                                    <td style={{ padding: '0.5rem 1.25rem 0.5rem 0.4rem', textAlign: 'right' }}>
                                                        <button onClick={() => { const ns = [...stages]; const nb = [...ns[activeStageIdx].transformer_bays]; nb.splice(bayIdx, 1); ns[activeStageIdx] = { ...ns[activeStageIdx], transformer_bays: nb }; setStages(ns); }} style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', color: '#ef4444' }} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                                            <X size={10} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FaBolt size={13} style={{ color: '#e2e8f0', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Click transformers in the Asset Library to assign them to this stage.</span>
                                </div>
                            )}
                        </div>

                        {/* ── NETWORK POCKETS ── */}
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <FaCodeBranch size={11} style={{ color: '#64748b' }} />
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>Network Pockets</span>
                                </div>
                                <span style={{ fontSize: '0.67rem', fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>
                                    {(() => { const p = stages[activeStageIdx]?.computed_pockets || []; return `${formatMW(p.reduce((s, c) => s + (c.total_p_mw || 0), 0) + (pocketPreview?.total_p_mw || 0))} MW`; })()}
                                </span>
                            </div>
                            {(stages[activeStageIdx]?.computed_pockets || []).length > 0 && (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '0.4rem 1.25rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '40px' }}>#</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>Island Substations</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>Source Branches</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '70px' }}>MW</th>
                                            <th style={{ padding: '0.4rem 1.25rem 0.4rem 0.4rem', borderBottom: '1px solid #f1f5f9', width: '48px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(stages[activeStageIdx].computed_pockets || []).map((pocket, pIdx) => {
                                            const subs = (pocket.pocket_substation_details || pocket.pocket_substations || []).map(s => s.substation_id || s).join(', ');
                                            const branches = pocket.branchGroups?.map(g => `${g.subId}: ${g.branches.join(', ')}`).join(' · ') || pocket.branches?.join(', ') || '—';
                                            return (
                                                <tr key={pocket.id} style={{ borderBottom: '1px solid #f8fafc' }} onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                    <td style={{ padding: '0.5rem 1.25rem', fontWeight: 700, color: '#334155', fontSize: '0.7rem' }}>P{pIdx + 1}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', color: '#334155', maxWidth: '180px' }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subs || '—'}</span></td>
                                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.65rem', color: '#64748b', maxWidth: '180px' }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branches}</span></td>
                                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{formatMW(pocket.total_p_mw ?? 0)}</td>
                                                    <td style={{ padding: '0.5rem 1.25rem 0.5rem 0.4rem', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '3px' }}>
                                                            <button onClick={() => { const ns = [...stages]; const a = { ...ns[activeStageIdx] }; a.computed_pockets = (a.computed_pockets || []).filter(c => c.id !== pocket.id); a.pocket_branches = [...new Set([...(a.pocket_branches || []), ...(pocket.branches || [])])]; ns[activeStageIdx] = a; setStages(ns); }} title="Edit" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', color: '#64748b' }} onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}><FiEdit2 size={10} /></button>
                                                            <button onClick={() => { const ns = [...stages]; const a = { ...ns[activeStageIdx] }; a.computed_pockets = (a.computed_pockets || []).filter(c => c.id !== pocket.id); ns[activeStageIdx] = a; setStages(ns); }} title="Remove" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', color: '#ef4444' }} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}><X size={10} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                            {(stages[activeStageIdx]?.computed_pockets || []).length === 0 && (stages[activeStageIdx]?.pocket_branches || []).length === 0 && !fetchingPocket && (
                                <div style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FaCodeBranch size={13} style={{ color: '#e2e8f0', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Click incoming branches in the Asset Library to build a network pocket.</span>
                                </div>
                            )}
                            {/* ── WORKING TRAY ── */}
                            {(fetchingPocket || (stages[activeStageIdx]?.pocket_branches?.length > 0)) && (() => {
                                const brs = stages[activeStageIdx]?.pocket_branches || [];
                                const gKey = (subId, v) => `${subId}||${v || ''}`;
                                const groups = {};
                                brs.forEach(fullId => { const pts = fullId.split('_'); if (pts.length >= 3) { const ls = pts[0]; const vv = substations.find(s => s.substation_id === ls)?.voltage; const k = gKey(ls, vv); if (!groups[k]) groups[k] = { subId: ls, voltage: vv ? `${vv}kV` : '', branches: [] }; groups[k].branches.push(pts.slice(1).join('_')); } });
                                return (
                                    <div style={{ margin: '0.75rem 1.25rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.42rem 0.75rem', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>Working Tray</span>
                                                {fetchingPocket && <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.58rem', color: '#94a3b8' }}><RefreshCw size={9} style={{ animation: 'spin 1s linear infinite' }} /> Computing...</div>}
                                                {pocketPreview && !pocketPreview.error && !fetchingPocket && <span style={{ fontSize: '0.58rem', fontFamily: 'monospace', fontWeight: 600, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 5px', borderRadius: '4px' }}>{pocketPreview.pocket_substations?.length || 0} subs · {formatMW(pocketPreview.total_p_mw ?? 0)} MW</span>}
                                            </div>
                                            <button onClick={() => { const ns = [...stages]; ns[activeStageIdx] = { ...ns[activeStageIdx], pocket_branches: [] }; setStages(ns); setPocketPreview(null); }} style={{ fontSize: '0.6rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 5px', borderRadius: '3px', fontFamily: "'Poppins',sans-serif" }} onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }} onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none'; }}>Clear</button>
                                        </div>
                                        {brs.length > 0 && (
                                            <div style={{ padding: '0.5rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                {Object.values(groups).sort((a, b) => a.subId.localeCompare(b.subId)).map(group => (
                                                    <div key={gKey(group.subId, group.voltage)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.1rem 0.3rem 0.1rem 0.4rem', borderRadius: '5px', background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.63rem' }}>
                                                        <FaCodeBranch size={8} style={{ color: '#64748b' }} />
                                                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{group.subId}</span>
                                                        <span style={{ color: '#94a3b8' }}>·</span>
                                                        <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{group.branches.sort().join(', ')}</span>
                                                        <button onClick={() => { const ns = [...stages]; const nb = [...(ns[activeStageIdx].pocket_branches || [])]; group.branches.forEach(s => { const i = nb.indexOf(`${group.subId}_${s}`); if (i > -1) nb.splice(i, 1); }); ns[activeStageIdx] = { ...ns[activeStageIdx], pocket_branches: nb }; setStages(ns); }} style={{ width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', marginLeft: '2px', padding: 0 }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}><X size={9} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {pocketPreview?.warning && <div style={{ margin: '0 0.75rem 0.5rem', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.63rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', padding: '0.35rem 0.5rem', borderRadius: '5px' }}><TriangleAlert size={10} style={{ flexShrink: 0 }} />{pocketPreview.warning}</div>}
                                        {pocketPreview?.error && <div style={{ margin: '0 0.75rem 0.5rem', fontSize: '0.63rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.35rem 0.5rem', borderRadius: '5px' }}>{pocketPreview.error}</div>}
                                        {pocketPreview && !pocketPreview.error && (
                                            <div style={{ padding: '0 0.75rem 0.6rem' }}>
                                                <button onClick={() => { const brs2 = stages[activeStageIdx].pocket_branches || []; const gk = (s, v) => `${s}||${v||''}`; const grps = {}; brs2.forEach(fullId => { const pts = fullId.split('_'); if (pts.length >= 3) { const ls = pts[0]; const vv = substations.find(s => s.substation_id === ls)?.voltage; const k = gk(ls, vv); if (!grps[k]) grps[k] = { subId: ls, voltage: vv ? `${vv}kV` : '', branches: [] }; grps[k].branches.push(pts.slice(1).join('_')); } }); const np = { id: Date.now(), branches: [...brs2], branchGroups: Object.values(grps), pocket_substations: pocketPreview.pocket_substations || [], pocket_substation_details: pocketPreview.pocket_substation_details || [], total_p_mw: pocketPreview.total_p_mw || 0, substation_mw: (pocketPreview.pocket_substation_details || []).reduce((acc, s) => { acc[s.substation_id] = { total_p_mw: s.p_mw, total_q_mvar: s.q_mvar }; return acc; }, {}), total_q_mvar: pocketPreview.total_q_mvar || 0 }; const ns = [...stages]; const a = { ...ns[activeStageIdx] }; a.computed_pockets = [...(a.computed_pockets || []), np]; a.pocket_branches = []; ns[activeStageIdx] = a; setStages(ns); setPocketPreview(null); }} style={{ width: '100%', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '5px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'} onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}>
                                                    <FaLock size={10} />
                                                    {pocketPreview.pocket_substations?.length > 0 && !pocketPreview.warning ? `Lock Pocket · ${pocketPreview.pocket_substations.length} sub${pocketPreview.pocket_substations.length > 1 ? 's' : ''}` : 'Lock Anyway'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </>
                )}
            </div>

            {/* ── RIGHT: Asset Library ───────────────────────── */}
            {showLibrary && (
                <div style={{ width: '280px', flexShrink: 0, borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                        {['library', 'alerts'].map(tab => (
                            <button key={tab} onClick={() => setAssetLibraryTab(tab)} style={{ flex: 1, padding: '0.5rem', fontSize: '0.63rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: assetLibraryTab === tab ? '#0f172a' : '#94a3b8', background: 'none', border: 'none', borderBottom: `2px solid ${assetLibraryTab === tab ? '#0f172a' : 'transparent'}`, cursor: 'pointer' }}>
                                {tab === 'library' ? 'Asset Library' : 'Alert Message'}
                            </button>
                        ))}
                    </div>
                    {assetLibraryTab === 'library' ? (
                        <>
                            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                                <div style={{ position: 'relative' }}>
                                    <Search style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} size={12} />
                                    <input type="text" placeholder="Search substation / relay..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.4rem 1.6rem 0.4rem 1.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '0.68rem', outline: 'none', fontFamily: "'Poppins',sans-serif", boxSizing: 'border-box' }} onFocus={e => { e.target.style.borderColor = '#94a3b8'; e.target.style.background = '#fff'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }} />
                                    {searchTerm && <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', borderRadius: '999px', border: 'none', background: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><X size={9} /></button>}
                                </div>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0.2rem 0' }}>
                                {(() => {
                                    const tree = {};
                                    const term = searchTerm.toLowerCase();
                                    relays.forEach(relay => {
                                        const sub = substations.find(s => s.substation_id === (relay.substation_id || relay.substation));
                                        if (!sub) return;
                                        const region = sub.region || 'Unknown Region';
                                        const grid = sub.grid || 'Unknown Grid';
                                        const subId = sub.substation_id;
                                        if (term && !subId.toLowerCase().includes(term) && !(relay.relay_name || '').toLowerCase().includes(term)) return;
                                        if (!tree[region]) tree[region] = {};
                                        if (!tree[region][grid]) tree[region][grid] = {};
                                        if (!tree[region][grid][subId]) tree[region][grid][subId] = { substation: sub, relays: [] };
                                        tree[region][grid][subId].relays.push(relay);
                                    });
                                    const toggleNode = (nodeId) => setExpandedNodes(prev => { const n = new Set(prev); n.has(nodeId) ? n.delete(nodeId) : n.add(nodeId); return n; });
                                    const handleExpandRelay = async (relayId, subId) => {
                                        toggleNode(`relay-${relayId}`);
                                        if (detailedSubstations[subId]) return;
                                        try {
                                            const [res, txRes] = await Promise.all([api.get(`/substations/${subId}/`), api.get(`/load-transformers/?substation=${subId}`)]);
                                            const data = res.data; data.db_transformers = txRes.data;
                                            setDetailedSubstations(prev => ({ ...prev, [subId]: data }));
                                        } catch { setDetailedSubstations(prev => ({ ...prev, [subId]: { transformers: [], db_transformers: [] } })); }
                                    };
                                    const renderNodeHeader = (id, label, level, icon, refreshAction = null) => {
                                        const isExpanded = expandedNodes.has(id);
                                        return (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.5rem', paddingLeft: `${0.5 + level * 0.8}rem`, borderRadius: '4px' }} className="hover-glow">
                                                <div onClick={() => toggleNode(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, cursor: 'pointer' }}>
                                                    {isExpanded ? <ChevronDown size={11} color="#94a3b8" /> : <ChevronRight size={11} color="#94a3b8" />}
                                                    {icon && <span style={{ color: '#64748b', display: 'flex' }}>{icon}</span>}
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isExpanded ? '#0f172a' : '#64748b' }}>{label}</span>
                                                </div>
                                                {refreshAction && <button onClick={e => { e.stopPropagation(); refreshAction(); }} style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#cbd5e1', display: 'flex' }} onMouseEnter={e => e.currentTarget.style.color = '#64748b'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}><RefreshCw size={10} /></button>}
                                            </div>
                                        );
                                    };
                                    const renderRelayNode = (relay, sub, paddingLevel) => {
                                        const rId = `relay-${relay.id}`;
                                        const isExpanded = expandedNodes.has(rId);
                                        let transformerAssignedStage = null;
                                        for (const stage of stages) { if (stage.transformer_bays?.some(bay => String(bay.relay) === String(relay.id))) { transformerAssignedStage = stage.label || `Stage ${stage.stage_number}`; break; } }
                                        let totalMw = 0;
                                        const detail = detailedSubstations[sub.substation_id];
                                        (Array.isArray(relay.load_transformers) ? relay.load_transformers : []).forEach(txVal => { const transformerId = typeof txVal === 'object' ? txVal.id : txVal; if (detail?.transformers && detail?.db_transformers) { const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId)); if (dbTx) { const tx = detail.transformers.find(t => t.name === `TX T${dbTx.transformer_no}`) || detail.transformers.find(t => t.name.split(' ').pop() === `T${dbTx.transformer_no}`); if (tx?.load_mw != null) totalMw += parseFloat(tx.load_mw); } } });
                                        const hasCriticalAsset = (Array.isArray(relay.load_transformers) ? relay.load_transformers : []).some(txVal => { const transformerId = typeof txVal === 'object' ? txVal.id : txVal; return criticalAssets.some(ca => ca.load_transformers?.includes(Number(transformerId))); });
                                        const relayBranches = relay.incoming_branches || [];
                                        const stageHasBranch = (stage, fullId) => stageContainsBranch(stage, fullId);
                                        const getBranchAssignmentStage = () => { for (const stage of stages) { const allAssigned = relayBranches.length > 0 && relayBranches.every(b => { const bayId = typeof b === 'object' ? b.bay_id : b; const fullId = String(bayId || '').includes('_') ? String(bayId) : `${sub.substation_id}_${bayId}`; return stageHasBranch(stage, fullId); }); if (allAssigned) return stage.label || `Stage ${stage.stage_number}`; } return null; };
                                        const toggleAllBranches = () => { setStages(prevStages => { const branchIds = relayBranches.map(b => String(typeof b === 'object' ? b.bay_id : b) || ''); const eligibleBranchIds = branchIds.filter(id => { const assignment = getBranchAssignmentInfo(id.includes('_') ? id : `${sub.substation_id}_${id}`, prevStages); return !assignment || assignment.stageIdx === activeStageIdx; }).map(id => (id.includes('_') ? id : `${sub.substation_id}_${id}`)); if (eligibleBranchIds.length === 0) return prevStages; return prevStages.map((stage, idx) => { if (idx !== activeStageIdx) return stage; const existing = stage.pocket_branches || []; const allAssigned = eligibleBranchIds.every(id => existing.includes(id)); const pocketContainsAll = (stage.computed_pockets || []).some(pocket => eligibleBranchIds.every(id => (pocket.branches || []).includes(id))); if (pocketContainsAll) return { ...stage, computed_pockets: (stage.computed_pockets || []).filter(pocket => !eligibleBranchIds.every(id => (pocket.branches || []).includes(id))) }; return { ...stage, pocket_branches: allAssigned ? existing.filter(id => !eligibleBranchIds.includes(id)) : [...new Set([...existing, ...eligibleBranchIds])] }; }); }); };
                                        const hasTransformers = (relay.load_transformers || []).length > 0;
                                        return (
                                            <div key={relay.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                                {hasTransformers && (
                                                    <div onClick={() => handleExpandRelay(relay.id, sub.substation_id)} style={{ padding: '0.32rem 0.5rem', paddingLeft: `${0.5 + paddingLevel * 0.8}rem`, cursor: 'pointer', borderRadius: '4px' }} className="hover-glow">
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                                                            <div style={{ height: '15px', display: 'flex', alignItems: 'center' }}>{isExpanded ? <ChevronDown size={11} color="#0f172a" /> : <ChevronRight size={11} color="#0f172a" />}</div>
                                                            <div onClick={e => { e.stopPropagation(); if (!transformerAssignedStage) addTransformerToStage(relay); }} style={{ height: '15px', display: 'flex', alignItems: 'center' }}>
                                                                {transformerAssignedStage ? <CheckSquare size={11} color="#94a3b8" /> : <Square size={11} color="#0f172a" />}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: transformerAssignedStage ? '#94a3b8' : '#0f172a' }}>
                                                                        {hasCriticalAsset && <FiAlertCircle size={9} style={{ color: '#f97316', marginRight: '3px', verticalAlign: 'middle' }} />}
                                                                        {relay.relay_name?.replace(' System', '') || 'Relay'}
                                                                    </span>
                                                                    <span style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: '#64748b', marginLeft: '4px' }}>{formatMW(totalMw)} MW</span>
                                                                </div>
                                                                {transformerAssignedStage && <div style={{ fontSize: '0.57rem', color: '#f59e0b', fontStyle: 'italic', marginTop: '1px' }}>Assigned: {transformerAssignedStage}</div>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {(hasTransformers ? isExpanded : true) && (
                                                    <div style={{ paddingBottom: '3px' }}>
                                                        {(Array.isArray(relay.load_transformers) ? relay.load_transformers : []).map(txVal => {
                                                            const transformerId = typeof txVal === 'object' ? txVal.id : txVal;
                                                            let txLabel = `T-Bay ${transformerId}`, txMw = 0;
                                                            if (detail?.db_transformers) { const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId)); if (dbTx) { txLabel = `T${dbTx.transformer_no}`; const tx = detail.transformers?.find(t => t.name === `TX T${dbTx.transformer_no}`) || detail.transformers?.find(t => t.name.split(' ').pop() === `T${dbTx.transformer_no}`); if (tx?.load_mw != null) txMw = parseFloat(tx.load_mw); } }
                                                            const isTxAssigned = (stages[activeStageIdx]?.transformer_bays || []).some(tb => String(tb.relay) === String(relay.id) && tb.transformers.some(t => { const tId = typeof t === 'object' ? t.id : t; return String(tId) === String(transformerId); }));
                                                            return (
                                                                <div key={transformerId} onClick={e => { e.stopPropagation(); toggleTransformerInStage(relay, transformerId); }} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.17rem 0.5rem', paddingLeft: `${1.35 + paddingLevel * 0.8}rem`, fontSize: '0.65rem', color: isTxAssigned ? '#166534' : '#64748b', cursor: 'pointer' }} className="hover-glow">
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                        <FaBolt size={8} style={{ opacity: isTxAssigned ? 1 : 0.4 }} />
                                                                        <span style={{ fontWeight: isTxAssigned ? 700 : 400 }}>{txLabel}</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.62rem' }}>{formatMW(txMw)} MW</span>
                                                                        {isTxAssigned && <CheckSquare size={9} color="#166534" />}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {relayBranches.length > 0 && (
                                                            <div style={{ paddingTop: '3px', borderTop: '1px solid #f1f5f9', marginTop: '2px' }}>
                                                                {(() => {
                                                                    const assignedStage = getBranchAssignmentStage();
                                                                    let assignedCount = 0, assignableCount = 0, lockedElsewhereCount = 0;
                                                                    relayBranches.forEach(b => { const bayId = typeof b === 'object' ? b.bay_id : b; const bayIdStr = String(bayId || ''); const fullId = bayIdStr.includes('_') ? bayIdStr : `${sub.substation_id}_${bayIdStr}`; const assignment = getBranchAssignmentInfo(fullId); const isAssignable = !assignment || assignment.stageIdx === activeStageIdx; if (isAssignable) { assignableCount += 1; if (stageHasBranch(stages[activeStageIdx] || {}, fullId)) assignedCount += 1; } else lockedElsewhereCount += 1; });
                                                                    const allAssigned = assignableCount > 0 && assignedCount === assignableCount;
                                                                    return (
                                                                        <div style={{ marginBottom: '2px' }}>
                                                                            <div style={{ padding: '0.17rem 0.5rem', paddingLeft: `${(hasTransformers ? 1.35 : 0.5) + paddingLevel * 0.8}rem`, cursor: 'pointer', borderRadius: '4px', background: allAssigned ? '#f0fdf4' : 'transparent' }} className="hover-glow">
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    {!hasTransformers && <div onClick={e => { e.stopPropagation(); toggleNode(rId); }} style={{ height: '15px', display: 'flex', alignItems: 'center' }}>{isExpanded ? <ChevronDown size={11} color="#94a3b8" /> : <ChevronRight size={11} color="#94a3b8" />}</div>}
                                                                                    <div onClick={e => { e.stopPropagation(); toggleAllBranches(); }} style={{ height: '15px', display: 'flex', alignItems: 'center' }}>{allAssigned ? <CheckSquare size={10} color="#166534" /> : <Square size={10} color="#0f172a" />}</div>
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: allAssigned ? '#166534' : '#64748b' }} onClick={() => { if (!hasTransformers) toggleNode(rId); }}>BRANCHES</span>
                                                                                            <span style={{ fontSize: '0.58rem', color: '#94a3b8' }}>[{assignedCount}/{relayBranches.length}]</span>
                                                                                        </div>
                                                                                        {assignedStage && <div style={{ fontSize: '0.55rem', color: '#f59e0b', fontStyle: 'italic' }}>Assigned: {assignedStage}</div>}
                                                                                        {lockedElsewhereCount > 0 && <div style={{ fontSize: '0.55rem', color: '#f97316' }}>{lockedElsewhereCount} in other stages</div>}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            {(hasTransformers || isExpanded) && relayBranches.map(branch => {
                                                                                const bayId = typeof branch === 'object' ? branch.bay_id : branch;
                                                                                const bayIdStr = String(bayId || '');
                                                                                const localPrefix = `${sub.substation_id}_`;
                                                                                const displayId = bayIdStr.startsWith(localPrefix) ? bayIdStr.replace(localPrefix, '') : bayIdStr;
                                                                                const fullId = bayIdStr.includes('_') ? bayIdStr : `${sub.substation_id}_${bayIdStr}`;
                                                                                const branchAssignment = getBranchAssignmentInfo(fullId) || null;
                                                                                const isAssignedHere = branchAssignment?.stageIdx === activeStageIdx;
                                                                                const isLockedElsewhere = Boolean(branchAssignment && branchAssignment.stageIdx !== activeStageIdx);
                                                                                const assignedStageLabel = branchAssignment ? (branchAssignment.stage?.label || `Stage ${branchAssignment.stage?.stage_number || (branchAssignment.stageIdx + 1)}`) : null;
                                                                                const rowColor = isLockedElsewhere ? '#94a3b8' : (isAssignedHere ? '#166534' : '#64748b');
                                                                                return (
                                                                                    <div key={typeof branch === 'object' ? branch.id : branch} onClick={() => { if (isLockedElsewhere) return; toggleBranchInStage(bayId, sub.substation_id); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.17rem 0.5rem', paddingLeft: `${(hasTransformers ? 2.3 : 1.35) + paddingLevel * 0.8}rem`, fontSize: '0.62rem', color: rowColor, cursor: isLockedElsewhere ? 'not-allowed' : 'pointer', opacity: isLockedElsewhere ? 0.65 : 1 }} className="hover-glow">
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                                            {isLockedElsewhere ? <Lock size={9} color="#94a3b8" /> : (isAssignedHere ? <CheckSquare size={9} color="#166634" /> : <Square size={9} color="#0f172a" />)}
                                                                                            <FaCodeBranch size={8} style={{ opacity: isAssignedHere ? 1 : 0.4 }} />
                                                                                            <span style={{ fontWeight: isAssignedHere ? 700 : 400 }}>{displayId}</span>
                                                                                        </div>
                                                                                        {isLockedElsewhere && assignedStageLabel && <span style={{ fontSize: '0.55rem', color: '#f59e0b', fontWeight: 600 }}>{assignedStageLabel}</span>}
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
                                        return (
                                            <div key={region}>
                                                {renderNodeHeader(rId, region, 0)}
                                                {expandedNodes.has(rId) && Object.keys(tree[region]).sort().map(grid => {
                                                    const gId = `grid-${region}-${grid}`;
                                                    return (
                                                        <div key={grid} style={{ borderLeft: '1px solid #f1f5f9', marginLeft: '9px' }}>
                                                            {renderNodeHeader(gId, grid, 1)}
                                                            {expandedNodes.has(gId) && Object.keys(tree[region][grid]).sort().map(subId => {
                                                                const sId = `sub-${region}-${grid}-${subId}`;
                                                                const nodeData = tree[region][grid][subId];
                                                                const substation = nodeData.substation;
                                                                return (
                                                                    <div key={subId} style={{ borderLeft: '1px solid #f1f5f9', marginLeft: '9px' }}>
                                                                        {renderNodeHeader(sId, `${substation.name || subId} (${subId})`, 2, null, async () => { try { const [res, txRes] = await Promise.all([api.get(`/substations/${subId}/`), api.get(`/load-transformers/?substation=${subId}`)]); const data = res.data; data.db_transformers = txRes.data; setDetailedSubstations(prev => ({ ...prev, [subId]: data })); } catch(e) { console.error('Refresh failed', e); } })}
                                                                        {expandedNodes.has(sId) && <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '1px' }}>{nodeData.relays.map(relay => renderRelayNode(relay, substation, 3))}</div>}
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
                                {relays.length === 0 && !loading && <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.72rem' }}>No load shedding relays found.</div>}
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.72rem', textAlign: 'center' }}>
                            <div><Shield size={20} style={{ color: '#e2e8f0', marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} /><div>Alert Message Content area</div></div>
                        </div>
                    )}
                </div>
            )}

            </div> {/* end 3-column body */}

            {/* ── SETTINGS DRAWER ─────────────────────────────── */}
            {showSettingsDrawer && (
                <>
                    <div onClick={() => setShowSettingsDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.12)', zIndex: 100 }} />
                    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '700px', maxWidth: '90vw', background: '#fff', borderLeft: '1px solid #e2e8f0', boxShadow: '-4px 0 24px rgba(0,0,0,0.08)', zIndex: 101, display: 'flex', flexDirection: 'column', fontFamily: "'Poppins',sans-serif" }}>
                        <div style={{ padding: '0.85rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <div>
                                <div style={{ fontSize: '0.55rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '2px' }}>Configuration</div>
                                <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>Scheme Settings</h2>
                            </div>
                            <button onClick={() => setShowSettingsDrawer(false)} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#64748b' }}><X size={13} /></button>
                        </div>
                        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 1.5rem', flexShrink: 0 }}>
                            {[['ufls', 'UFLS Settings'], ['uvls', 'UVLS Settings'], ['conflict', 'Critical Conflicts']].map(([key, label]) => (
                                <button key={key} onClick={() => setActiveGlobalSettingsTab(key)} style={{ padding: '0.55rem 0.85rem', fontSize: '0.7rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: activeGlobalSettingsTab === key ? '#0f172a' : '#94a3b8', background: 'none', border: 'none', borderBottom: `2px solid ${activeGlobalSettingsTab === key ? '#0f172a' : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
                            ))}
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                            {activeGlobalSettingsTab !== 'conflict' ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '1.25rem' }}>
                                    {(() => {
                                        const selectedSchemeType = activeGlobalSettingsTab === 'uvls' ? 'UVLS' : 'UFLS';
                                        const thresholdUnit = selectedSchemeType === 'UVLS' ? 'p.u.' : 'Hz';
                                        const settingsForTab = getSortedSettings(globalSettings.filter(s => s.scheme_type === selectedSchemeType));
                                        return (
                                            <>
                                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                                        <thead>
                                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Label</th>
                                                                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Threshold</th>
                                                                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Delay</th>
                                                                {isStaff && <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}></th>}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {settingsForTab.map(s => (
                                                                <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }} onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                                    <td style={{ padding: '0.55rem 1rem', fontWeight: 500, color: '#334155' }}>{s.label}</td>
                                                                    <td style={{ padding: '0.55rem 1rem', fontFamily: 'monospace', color: '#0f172a' }}>{s.threshold} {thresholdUnit}</td>
                                                                    <td style={{ padding: '0.55rem 1rem', fontFamily: 'monospace', color: '#0f172a' }}>{s.time_delay} s</td>
                                                                    {isStaff && <td style={{ padding: '0.55rem 1rem', textAlign: 'right' }}><button onClick={() => handleDeleteSetting(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}><Trash2 size={14} /></button></td>}
                                                                </tr>
                                                            ))}
                                                            {settingsForTab.length === 0 && <tr><td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.72rem' }}>No settings defined.</td></tr>}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', alignSelf: 'start', position: 'sticky', top: 0 }}>
                                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.85rem' }}>Add {selectedSchemeType} Setting</div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                                        <div>
                                                            <label style={{ fontSize: '0.62rem', color: '#64748b', display: 'block', marginBottom: '3px' }}>Threshold ({thresholdUnit})</label>
                                                            <input type="number" step="0.01" value={newSettingThreshold} onChange={e => setNewSettingThreshold(e.target.value)} placeholder={selectedSchemeType === 'UVLS' ? 'e.g. 0.85' : 'e.g. 49.2'} style={{ width: '100%', padding: '0.42rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.7rem', color: '#0f172a', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: '0.62rem', color: '#64748b', display: 'block', marginBottom: '3px' }}>Time Delay (s)</label>
                                                            <input type="number" step="0.1" value={newSettingTimeDelay} onChange={e => setNewSettingTimeDelay(e.target.value)} placeholder="e.g. 0.2" style={{ width: '100%', padding: '0.42rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.7rem', color: '#0f172a', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
                                                        </div>
                                                        <button onClick={handleAddNewSetting} style={{ height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.7rem', fontFamily: "'Poppins',sans-serif", fontWeight: 700, color: '#fff', background: '#0f172a', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '3px' }} onMouseEnter={e => e.currentTarget.style.background = '#1e293b'} onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}><Plus size={12} /> Create Setting</button>
                                                    </div>
                                                    {!isStaff && <div style={{ marginTop: '0.85rem', padding: '0.55rem 0.65rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '0.62rem', color: '#92400e' }}><strong>Note:</strong> Admins can delete settings.</div>}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div>
                                    {(() => {
                                        const conflictGroups = [];
                                        const criticalBySub = {};
                                        criticalAssets.forEach(ca => { const subId = ca.substation_id || ca.substation; if (!subId) return; if (!criticalBySub[subId]) criticalBySub[subId] = []; criticalBySub[subId].push(ca); });
                                        Object.entries(criticalBySub).forEach(([subId, assets]) => { const stagesWithAsset = []; stages.forEach(stage => { if (stage.transformer_bays?.some(bay => bay.relay_substation_id === subId)) stagesWithAsset.push(stage.label || `Stage ${stage.stage_number}`); }); if (stagesWithAsset.length > 1) conflictGroups.push({ subId, assets, stages: stagesWithAsset }); });
                                        if (conflictGroups.length === 0) return (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem', textAlign: 'center' }}>
                                                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} style={{ color: '#166534' }} /></div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>No Conflicts Detected</div>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', maxWidth: '280px', lineHeight: 1.5 }}>Critical substations are not assigned to multiple stages simultaneously.</div>
                                            </div>
                                        );
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                                {conflictGroups.map((group, idx) => (
                                                    <div key={idx} style={{ padding: '0.75rem 0.85rem', borderRadius: '8px', background: '#fff7ed', border: '1px solid #fed7aa' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '3px' }}>
                                                            <FiAlertCircle size={13} style={{ color: '#f97316' }} />
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>{group.subId}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: '1.5rem' }}>Assigned to: <strong style={{ color: '#0f172a' }}>{group.stages.join(', ')}</strong></div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

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
                                                <th style={{ padding: '0.85rem' }}>Substation ID</th>
                                                <th style={{ padding: '0.85rem' }}>Assigned Feeder</th>
                                                <th style={{ padding: '0.85rem' }}>Voltage</th>
                                                <th style={{ padding: '0.85rem' }}>Breaker Number</th>
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
                                                    <td style={{ padding: '0.85rem' }}>{row.assignedFeeder}</td>
                                                    <td style={{ padding: '0.85rem' }}>{row.voltage}</td>
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
                                            className="platinum-input"
                                            style={{ width: '100%' }}
                                            value={newStageNumber}
                                            onChange={e => setNewStageNumber(Number(e.target.value))}
                                        />
                                    </div>
                                    <div style={{ flex: 2 }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Stage Label</label>
                                        <input
                                            type="text"
                                            className="platinum-input"
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
                                                className="platinum-input"
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
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Threshold Setting 1</label>
                                            <select
                                                className="platinum-input"
                                                style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)' }}
                                                value={newStageSettings[0] || ''}
                                                onChange={e => {
                                                    const updated = [...newStageSettings];
                                                    updated[0] = e.target.value || null;
                                                    setNewStageSettings(updated);
                                                }}
                                            >
                                                <option value="">-- None --</option>
                                                {globalSettings.filter(s => s.scheme_type === (schemeType.includes('UFLS') ? 'UFLS' : 'UVLS')).map(s => (
                                                    <option key={s.id} value={s.id}>{s.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Threshold Setting 2</label>
                                            <select
                                                className="platinum-input"
                                                style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)' }}
                                                value={newStageSettings[1] || ''}
                                                onChange={e => {
                                                    const updated = [...newStageSettings];
                                                    if (updated.length === 0) updated.push(null);
                                                    updated[1] = e.target.value || null;
                                                    setNewStageSettings(updated);
                                                }}
                                            >
                                                <option value="">-- None --</option>
                                                {globalSettings.filter(s => s.scheme_type === (schemeType.includes('UFLS') ? 'UFLS' : 'UVLS')).map(s => (
                                                    <option key={s.id} value={s.id}>{s.label}</option>
                                                ))}
                                            </select>
                                        </div>
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
