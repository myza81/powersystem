import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    ShieldAlert, Cpu, CheckCircle2, Loader2, ArrowLeft, ZoomIn, ZoomOut, Network, Maximize2, Minimize2, MapPin, Eye, Filter, EyeOff, List, Layers, Unlock, Database, Building2, TrendingUp, Download, Settings2, ListChecks, Pause, ArrowUpRight, Check, Activity, BarChart2, CheckCircle, Navigation, Anchor, MousePointerClick, Move, Info
} from 'lucide-react';
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

// ─── Comparison helpers ───────────────────────────────────────────────────────

const COMP_STAGE_COLORS = [
    '#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#ef4444', '#eab308', '#ec4899', '#06b6d4'
];

const COMP_CHANGE_META = {
    new:       { label: 'New Assignment', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
    revised:   { label: 'Revised',        color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    defeated:  { label: 'Defeated',       color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    unchanged: { label: 'Unchanged',      color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

const compactMnemonicComp = (subId) => String(subId || '').replace(/\d+$/, '');

// Match a transformer from the snapshot list by its DB transformer_no.
// Physical topology transformers are named "TX {ckt_id}" (e.g. "TX 1");
// load-based ones are named "TX T{load_id}" (e.g. "TX T1"). Both need to resolve.
const findTransformerByNo = (transformers, transformerNo) => {
    if (!transformers) return null;
    const n = transformerNo;
    return (
        transformers.find(t => t.name === `TX T${n}`) ||  // load-based: "TX T1"
        transformers.find(t => t.name === `TX ${n}`)   || // physical topology: "TX 1"
        transformers.find(t => t.name.split(' ').pop() === `T${n}`) // last-resort partial
    );
};

// Return total MW for a transformer bay.
// Prefers bay.mw_cache (pre-computed on save) over the live snapshot lookup,
// which requires topology data that may not be loaded for all substations.
const getBayMW = (bay, detail) => {
    if (bay.mw_cache != null && bay.mw_cache.mw != null) {
        return parseFloat(bay.mw_cache.mw);
    }
    // Fallback: snapshot-based per-transformer lookup (works for newly added bays)
    if (!detail?.transformers?.length || !detail?.db_transformers) return 0;
    let total = 0;
    (bay.transformers || []).forEach(txObj => {
        const tId = typeof txObj === 'object' ? txObj.id : txObj;
        const dbTx = detail.db_transformers.find(t => String(t.id) === String(tId));
        if (dbTx) {
            const tx = findTransformerByNo(detail.transformers, dbTx.transformer_no);
            if (tx?.load_mw != null) total += parseFloat(tx.load_mw);
        }
    });
    return total;
};

const DrawerInfoTip = ({ text }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, cursor: 'default' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <Info size={10} style={{ color: '#475569' }} />
            <AnimatePresence>
                {hovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.12 }}
                        style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: 0,
                            marginBottom: '5px',
                            background: 'rgba(15, 23, 42, 0.96)',
                            border: '1px solid rgba(148,163,184,0.2)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '0.65rem',
                            color: '#e2e8f0',
                            zIndex: 9999,
                            whiteSpace: 'pre-line',
                            pointerEvents: 'none',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                            maxWidth: '210px',
                            lineHeight: '1.55',
                        }}
                    >
                        {text}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const buildPublishedRows = (stageDetails, substations, relays) => {
    const subLookup = {};
    substations.forEach(s => { subLookup[s.substation_id] = s; });
    const relayLookup = {};
    relays.forEach(r => { relayLookup[r.id] = r; });
    const rows = [];

    stageDetails.forEach((stage, stageIdx) => {
        const stageColor = COMP_STAGE_COLORS[stageIdx % COMP_STAGE_COLORS.length];
        const settings = stage.settings || [];
        const threshold1 = settings[0]?.threshold ?? '—';
        const delay1 = settings[0]?.time_delay ?? '—';
        const threshold2 = settings[1]?.threshold ?? '—';
        const delay2 = settings[1]?.time_delay ?? '—';

        (stage.transformer_bays || []).forEach(bay => {
            const sub = subLookup[bay.relay_substation_id];
            const relay = relayLookup[bay.relay];
            const selectedIds = (bay.transformers || []).map(t => typeof t === 'object' ? t.id : t);
            const selectedTxs = (relay?.load_transformers || []).filter(t =>
                selectedIds.includes(typeof t === 'object' ? t.id : t)
            );
            const feeder = selectedTxs.length > 0
                ? selectedTxs.map(t => `T${t.transformer_no}`).join(' & ')
                : (bay.transformers || []).map(t => typeof t === 'object' ? `T${t.id}` : `T${t}`).join(' & ') || '—';
            const breakerNumber = selectedTxs.map(t => t.lv_breaker_number).filter(Boolean).join(' & ') || '—';
            const voltageRaw = selectedTxs.map(t => t.lv_voltage).filter(Boolean);
            const voltage = voltageRaw.length > 0 ? [...new Set(voltageRaw)].join(' & ') : (sub?.voltage || '—');

            rows.push({
                stageId: stage.id, stageLabel: stage.label, stageColor, stageOrder: stageIdx,
                type: 'transformer',
                substationName: sub?.name || bay.relay_substation_id || 'Unknown',
                substationId: sub?.substation_id || bay.relay_substation_id || '',
                region: sub?.region || '—', grid: sub?.grid || '—',
                feeder, breakerNumber, voltage,
                threshold1, delay1, threshold2, delay2,
            });
        });

        (stage.pocket_bays || []).forEach((pocket, pocketIdx) => {
            const pocketLabel = `Pocket ${pocketIdx + 1}`;
            const boundaries = pocket.boundaries || [];
            const isMultiBoundary = boundaries.length > 1;
            const pocketId = `${stage.id}-pocket-${pocketIdx}`;

            if (isMultiBoundary) {
                rows.push({
                    stageId: stage.id, stageLabel: stage.label, stageColor, stageOrder: stageIdx,
                    type: 'pocket_header', pocketId, pocketLabel,
                    substationName: '', substationId: '', region: '—', grid: '—', feeder: '', breakerNumber: '',
                    threshold1, delay1, threshold2, delay2,
                });
            }

            boundaries.forEach(boundary => {
                const sub = subLookup[boundary.relay_substation_id];
                const relay = relayLookup[boundary.relay];
                const selectedIds = (boundary.branches || []).map(b => typeof b === 'object' ? b.id : b);
                const branchObjects = (relay?.incoming_branches || []).filter(b =>
                    selectedIds.includes(typeof b === 'object' ? b.id : b)
                );
                const feeder = branchObjects.length > 0
                    ? branchObjects.map(b => `${compactMnemonicComp(b.to_substation)} ${b.ckt_id}`).join(' & ')
                    : (boundary.frozen_assets || []).map(a => `${compactMnemonicComp(a.to_sub)} ${a.ckt_id}`).join(' & ')
                    || `Boundary: ${boundary.relay_name || '—'}`;
                const breakerNumber = branchObjects.map(b => b.breaker_number).filter(Boolean).join(' & ') || '—';

                rows.push({
                    stageId: stage.id, stageLabel: stage.label, stageColor, stageOrder: stageIdx,
                    type: isMultiBoundary ? 'pocket_boundary' : 'pocket',
                    pocketId: isMultiBoundary ? pocketId : undefined, pocketLabel,
                    substationName: sub?.name || boundary.relay_substation_id || 'Unknown',
                    substationId: sub?.substation_id || boundary.relay_substation_id || '',
                    region: sub?.region || '—', grid: sub?.grid || '—',
                    feeder, breakerNumber, voltage: sub?.voltage || '—',
                    threshold1, delay1, threshold2, delay2,
                });
            });
        });
    });
    return rows;
};

const buildComparisonRowsComp = (rowsA, rowsB) => {
    const keyOf = r => `${r.substationId}||${r.feeder}||${r.type === 'pocket_boundary' ? 'pocket' : r.type}`;
    const mapA = new Map();
    rowsA.filter(r => r.type !== 'pocket_header').forEach(r => mapA.set(keyOf(r), r));
    const mapB = new Map();
    rowsB.filter(r => r.type !== 'pocket_header').forEach(r => mapB.set(keyOf(r), r));
    const results = [];
    mapA.forEach((rowA, key) => {
        const rowB = mapB.get(key);
        if (!rowB) {
            results.push({ ...rowA, changeType: 'new', oldStageLabel: '—', oldStageColor: null });
        } else if (rowA.stageLabel !== rowB.stageLabel) {
            results.push({ ...rowA, changeType: 'revised', oldStageLabel: rowB.stageLabel, oldStageColor: rowB.stageColor });
        } else {
            results.push({ ...rowA, changeType: 'unchanged', oldStageLabel: rowB.stageLabel, oldStageColor: rowB.stageColor });
        }
    });
    mapB.forEach((rowB, key) => {
        if (!mapA.has(key)) {
            results.push({ ...rowB, changeType: 'defeated', oldStageLabel: rowB.stageLabel, oldStageColor: rowB.stageColor, stageLabel: '—' });
        }
    });
    return results;
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
    const [detailedSubstations, setDetailedSubstations] = useState({});

    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Publish changelog modal state
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishDiff, setPublishDiff] = useState([]);
    const [publishReasons, setPublishReasons] = useState({});
    const [publishActiveVersionId, setPublishActiveVersionId] = useState(null);
    const [publishDraftVersionId, setPublishDraftVersionId] = useState(null);
    const skipDirtyRef = useRef(true); // skip dirty on initial hydration and draft loads
    const sessionSaveTimerRef = useRef(null);

    // Mark workspace dirty whenever stages change, except on initial load or after a draft load/save
    useEffect(() => {
        if (skipDirtyRef.current) {
            skipDirtyRef.current = false;
            return;
        }
        setIsDirty(true);
    }, [stages]);
    const [searchTerm, setSearchTerm] = useState('');
    const [gridData, setGridData] = useState(null);
    const [fetchingAnalytics, setFetchingAnalytics] = useState(false);
    const [pocketPreview, setPocketPreview] = useState(null);
    const [fetchingPocket, setFetchingPocket] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareRows, setCompareRows] = useState([]);
    const [comparePublishedLabel, setComparePublishedLabel] = useState('');
    const [compareGroupBy, setCompareGroupBy] = useState('change-type');

    // --- Workspace Panel State ---
    const [showLibrary, setShowLibrary] = useState(true);
    const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
    const [leftPanelWidth, setLeftPanelWidth] = useState(220);
    const [rightPanelWidth, setRightPanelWidth] = useState(280);
    const leftPanelRef = useRef(null);
    const rightPanelRef = useRef(null);
    const [showProfilePopover, setShowProfilePopover] = useState(false);
    const [editingBayId, setEditingBayId] = useState(null);
    const [editingPocketId, setEditingPocketId] = useState(null);
    const [hoveredPocketId, setHoveredPocketId] = useState(null);
    const [baySortConfig, setBaySortConfig] = useState({ key: null, direction: 'asc' });

    // --- Settings Tab State ---
    const [activeGlobalSettingsTab, setActiveGlobalSettingsTab] = useState('ufls'); // 'ufls' | 'uvls' | 'conflict'

    // Inline add setting form
    const [newSettingThreshold, setNewSettingThreshold] = useState('');
    const [newSettingTimeDelay, setNewSettingTimeDelay] = useState('');

    // --- Alert Rule Config State ---
    const [alertConfigs, setAlertConfigs] = useState([]); // [{id, scheme_type, ufls_protected_stages, critical_restricted_stages, rule1_enforcement, rule2_enforcement}]
    const [alertConfigLoading, setAlertConfigLoading] = useState(false);
    const [protectedBaysData, setProtectedBaysData] = useState(null); // {protected_substation_ids, protected_stage_numbers, stage_bay_map}
    const [showAlertConfigModal, setShowAlertConfigModal] = useState(false);

    const getSortedSettings = (settingsList) => {
        return [...settingsList].sort((a, b) => {
            if (b.threshold !== a.threshold) {
                return b.threshold - a.threshold; // Higher threshold first
            }
            return a.time_delay - b.time_delay; // or smaller delay first (per example: 0s before 60s)
        });
    };

    const handleBaySort = (key) => {
        setBaySortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const sortedTransformerBays = useMemo(() => {
        const bays = stages[activeStageIdx]?.transformer_bays || [];
        const defaultSort = (a, b) => {
            const subIdA = a.relay_substation_id || '';
            const subIdB = b.relay_substation_id || '';
            const subA = substations.find(s => s.substation_id === subIdA);
            const subB = substations.find(s => s.substation_id === subIdB);
            const relayA = relays.find(r => r.id === a.relay);
            const relayB = relays.find(r => r.id === b.relay);
            return (subA?.grid || '').localeCompare(subB?.grid || '') ||
                subIdA.localeCompare(subIdB) ||
                (relayA?.relay_name || '').localeCompare(relayB?.relay_name || '');
        };
        if (!baySortConfig.key) return [...bays].sort(defaultSort);
        return [...bays].sort((a, b) => {
            const subIdA = a.relay_substation_id || '';
            const subIdB = b.relay_substation_id || '';
            const detailA = detailedSubstations[subIdA];
            const detailB = detailedSubstations[subIdB];
            let valA, valB;
            if (baySortConfig.key === 'substation') {
                valA = subIdA.toLowerCase();
                valB = subIdB.toLowerCase();
            } else if (baySortConfig.key === 'voltage') {
                valA = detailA?.voltage || '';
                valB = detailB?.voltage || '';
            } else if (baySortConfig.key === 'mw') {
                valA = getBayMW(a, detailA);
                valB = getBayMW(b, detailB);
            }
            if (valA < valB) return baySortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return baySortConfig.direction === 'asc' ? 1 : -1;
            return defaultSort(a, b);
        });
    }, [stages, activeStageIdx, baySortConfig, detailedSubstations, substations, relays]);

    // --- Alert Violation Logic ---
    const alertViolations = useMemo(() => {
        const violations = [];
        const currentConfig = alertConfigs.find(c => c.scheme_type === schemeType);
        if (!currentConfig) return violations;

        const criticalSubIds = new Set(
            (criticalAssets || []).map(ca => ca.substation_id || ca.substation).filter(Boolean)
        );

        // Rule 1: Bidirectional cross-scheme overlap check.
        // protectedBaysData.conflict_substation_ids is already scoped correctly by the backend:
        //   designing=UFLS  → conflict set = published UVLS + EMLS bays (any stage)
        //   designing=UVLS/EMLS → conflict set = published UFLS protected stage bays
        if (protectedBaysData && protectedBaysData.conflict_substation_ids?.length > 0) {
            const conflictSet = new Set(protectedBaysData.conflict_substation_ids);

            // Build subId → [scheme, ...] map from conflict_info (only populated when designing=UFLS)
            const subToSchemes = {};
            if (protectedBaysData.conflict_info) {
                Object.entries(protectedBaysData.conflict_info).forEach(([scheme, info]) => {
                    (info.substation_ids || []).forEach(subId => {
                        if (!subToSchemes[subId]) subToSchemes[subId] = [];
                        subToSchemes[subId].push(scheme);
                    });
                });
            }

            const stagesToCheck = schemeType === 'UFLS'
                ? stages.filter(s => (currentConfig.ufls_protected_stages || []).includes(s.stage_number))
                : stages;

            stagesToCheck.forEach(stage => {
                (stage.transformer_bays || []).forEach(bay => {
                    const subId = bay.relay_substation_id;
                    if (conflictSet.has(subId)) {
                        let context;
                        if (schemeType === 'UFLS') {
                            const schemes = subToSchemes[subId]?.join(' and ') || 'UVLS/EMLS';
                            context = `already exists in the active published ${schemes}.`;
                        } else {
                            context = `already exists in the active published UFLS protected stages (${protectedBaysData.protected_stage_numbers?.join(', ')}).`;
                        }
                        violations.push({
                            rule: 1,
                            severity: 'error',
                            substation_id: subId,
                            stage_label: stage.label,
                            message: `${subId} is assigned to ${stage.label} but ${context}`,
                        });
                    }
                });
            });
        }

        // Rule 2: Critical substations in restricted stages
        const restrictedStages = new Set(currentConfig.critical_restricted_stages || []);
        if (restrictedStages.size > 0) {
            stages.forEach(stage => {
                if (!restrictedStages.has(stage.stage_number)) return;
                (stage.transformer_bays || []).forEach(bay => {
                    const subId = bay.relay_substation_id;
                    if (criticalSubIds.has(subId)) {
                        violations.push({
                            rule: 2,
                            severity: 'warning',
                            substation_id: subId,
                            stage_label: stage.label,
                            message: `${subId} is a critical substation assigned to ${stage.label}, which is a restricted stage for ${schemeType}.`,
                        });
                    }
                });
            });
        }

        return violations;
    }, [stages, schemeType, alertConfigs, criticalAssets, protectedBaysData]);

    // Derive per-rule enforcement modes for the current scheme type
    const currentRule1Enforcement = useMemo(() => {
        return alertConfigs.find(c => c.scheme_type === schemeType)?.rule1_enforcement || 'warn';
    }, [alertConfigs, schemeType]);

    const currentRule2Enforcement = useMemo(() => {
        return alertConfigs.find(c => c.scheme_type === schemeType)?.rule2_enforcement || 'warn';
    }, [alertConfigs, schemeType]);

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
            }).catch(err => {
                // 404 means no snapshot is loaded yet — not an error, analytics will be unavailable
                if (err?.response?.status !== 404) {
                    console.error("Failed to fetch grid analytics", err);
                }
            }).finally(() => {
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

    const fetchAlertConfigs = async () => {
        setAlertConfigLoading(true);
        try {
            const res = await api.get('/load-shedding-alert-configs/');
            setAlertConfigs(res.data);
        } catch (err) {
            console.error('Failed to fetch alert configs', err);
        } finally {
            setAlertConfigLoading(false);
        }
    };

    const fetchProtectedBays = async (designing) => {
        try {
            const res = await api.get(`/load-shedding-versions/active-protected-bays/?designing=${designing}`);
            setProtectedBaysData(res.data);
        } catch (err) {
            console.error('Failed to fetch protected bays', err);
        }
    };

    useEffect(() => {
        fetchAlertConfigs();
    }, []);

    // Re-fetch conflict set whenever the scheme being designed changes
    useEffect(() => {
        fetchProtectedBays(schemeType);
    }, [schemeType]);

    const saveAlertConfig = async (configId, patch) => {
        try {
            const res = await api.patch(`/load-shedding-alert-configs/${configId}/`, patch);
            setAlertConfigs(prev => prev.map(c => c.id === configId ? res.data : c));
            // Re-fetch conflict bays if protected stages config changed
            if (patch.ufls_protected_stages !== undefined) {
                fetchProtectedBays(schemeType);
            }
        } catch (err) {
            console.error('Failed to save alert config', err);
        }
    };

    // --- Session Storage Auto-Save (debounced) ---
    // detailedSubstations is excluded — it's large topology data that is re-fetched on resume.
    useEffect(() => {
        if (view !== 'designer') return;
        clearTimeout(sessionSaveTimerRef.current);
        sessionSaveTimerRef.current = setTimeout(() => {
            const draftState = {
                activeVersionId, schemeType, versionLabel, reviewYear, targetPercentage,
                isMetricsDrawerOpen, isNewlyCloned, stages, activeStageIdx,
            };
            sessionStorage.setItem('ls_draft_state', JSON.stringify(draftState));
        }, 500);
        return () => clearTimeout(sessionSaveTimerRef.current);
    }, [activeVersionId, schemeType, versionLabel, reviewYear, targetPercentage, isMetricsDrawerOpen, isNewlyCloned, stages, activeStageIdx, view]);

    // --- On-mount detail fetch for session-storage restore ---
    // detailedSubstations is never persisted. When stages are hydrated from session storage
    // (page refresh with saved draft), handleResumeDraft is NOT called, so we must fetch here.
    useEffect(() => {
        const subIds = [...new Set(
            stages.flatMap(s => (s.transformer_bays || []).map(b => b.relay_substation_id).filter(Boolean))
        )];
        if (subIds.length === 0) return;
        subIds.forEach(async (subId) => {
            try {
                const [res, txRes] = await Promise.all([
                    api.get(`/substations/${subId}/`),
                    api.get(`/load-transformers/?substation=${subId}`),
                ]);
                const data = res.data;
                data.db_transformers = txRes.data;
                setDetailedSubstations(prev => ({ ...prev, [subId]: data }));
            } catch (e) {
                console.error(`Failed to pre-fetch sub detail for ${subId}`, e);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally runs once on mount only

    // --- Asset Library: auto-expand tree to matching nodes on search ---
    useEffect(() => {
        if (!searchTerm) return;
        const term = searchTerm.toLowerCase();
        const toExpand = new Set();
        relays.forEach(relay => {
            const sub = substations.find(s => s.substation_id === (relay.substation_id || relay.substation));
            if (!sub) return;
            const subId = sub.substation_id;
            const region = sub.region || 'Unknown Region';
            const grid = sub.grid || 'Unknown Grid';
            const subMatches = subId.toLowerCase().includes(term) || (sub.name || '').toLowerCase().includes(term);
            const relayMatches = (relay.relay_name || '').toLowerCase().includes(term);
            if (subMatches || relayMatches) {
                toExpand.add(`region-${region}`);
                toExpand.add(`grid-${region}-${grid}`);
                toExpand.add(`sub-${region}-${grid}-${subId}`);
            }
            if (relayMatches) {
                toExpand.add(`relay-${relay.id}`);
            }
        });
        if (toExpand.size > 0) {
            setExpandedNodes(prev => new Set([...prev, ...toExpand]));
        }
    }, [searchTerm, relays, substations]);

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
                skipDirtyRef.current = true;
                setStages(detailedStages);
                setIsDirty(false);

                // Auto-recompute mw_cache if any bay is missing it (e.g. cloned or old version never published)
                const hasMissingCache = detailedStages.some(s =>
                    (s.transformer_bays || []).some(b => b.mw_cache == null)
                );
                if (hasMissingCache) {
                    api.post('/load-shedding-transformer-bays/recompute/', { version_id: vId })
                        .then(recompRes => {
                            const mwByBayId = {};
                            (recompRes.data.results || []).forEach(r => {
                                if (r.status === 'success') mwByBayId[r.id] = r.mw;
                            });
                            const snapshotId = recompRes.data.snapshot_id;
                            setStages(prev => prev.map(stage => ({
                                ...stage,
                                transformer_bays: (stage.transformer_bays || []).map(bay => ({
                                    ...bay,
                                    mw_cache: mwByBayId[bay.id] != null
                                        ? { mw: mwByBayId[bay.id], snapshot_id: snapshotId }
                                        : bay.mw_cache,
                                })),
                            })));
                        })
                        .catch(e => console.error('Auto-recompute on load failed', e));
                }

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
                skipDirtyRef.current = true;
                setStages([{ id: Date.now(), stage_number: 1, label: 'Stage 1', target_mw: 1000, transformer_bays: [], pocket_bays: [], setting_ids: [] }]);
                setIsDirty(false);
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

        // Alert rule enforcement — each rule checked independently per its own enforcement mode
        {
            const subId = relay.substation_id || relay.substation;
            const currentConfig = alertConfigs.find(c => c.scheme_type === schemeType);

            // Rule 1: bidirectional cross-scheme overlap check (block if rule1_enforcement === 'block')
            if (currentRule1Enforcement === 'block') {
                const conflictIds = protectedBaysData?.conflict_substation_ids || [];
                const isProtectedStageForUfls =
                    schemeType === 'UFLS' &&
                    (currentConfig?.ufls_protected_stages || []).includes(active.stage_number);
                const isAnyStageForOthers = schemeType !== 'UFLS';
                if ((isProtectedStageForUfls || isAnyStageForOthers) && conflictIds.includes(subId)) {
                    let context;
                    if (schemeType === 'UFLS') {
                        const subToSchemes = {};
                        Object.entries(protectedBaysData?.conflict_info || {}).forEach(([scheme, info]) => {
                            (info.substation_ids || []).forEach(id => {
                                if (!subToSchemes[id]) subToSchemes[id] = [];
                                subToSchemes[id].push(scheme);
                            });
                        });
                        const schemes = subToSchemes[subId]?.join(' and ') || 'UVLS/EMLS';
                        context = `already exists in the active published ${schemes}`;
                    } else {
                        context = `already exists in the active published UFLS protected stages (${protectedBaysData?.protected_stage_numbers?.join(', ')})`;
                    }
                    alert(`Blocked: ${subId} ${context}. Rule 1 prevents this overlap.`);
                    return;
                }
            }

            // Rule 2: critical substation in restricted stage (block if rule2_enforcement === 'block')
            if (currentRule2Enforcement === 'block') {
                const restrictedStages = new Set(currentConfig?.critical_restricted_stages || []);
                const isCritical = (criticalAssets || []).some(ca => (ca.substation_id || ca.substation) === subId);
                if (restrictedStages.has(active.stage_number) && isCritical) {
                    alert(`Blocked: ${subId} is a critical substation and Stage ${active.stage_number} is a restricted stage for ${schemeType}. Rule 2 prevents this assignment.`);
                    return;
                }
            }
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
            
            // 4. Trigger backend recompute to sync mw_cache, then reload bays so UI shows fresh MW
            // (stages were deleted/recreated, so old local bay IDs no longer exist in DB)
            try {
                await api.post('/load-shedding-transformer-bays/recompute/', { version_id: vId });
                const freshRes = await api.get(`/load-shedding-stages/?version=${vId}&include_bays=true`);
                const freshByStageNo = {};
                (freshRes.data || []).forEach(s => { freshByStageNo[s.stage_number] = s.transformer_bays || []; });
                setStages(prev => prev.map(stage => ({
                    ...stage,
                    transformer_bays: freshByStageNo[stage.stage_number] ?? stage.transformer_bays,
                })));
            } catch (recompErr) {
                console.error("Post-save recompute failed", recompErr);
            }

            sessionStorage.removeItem('ls_draft_state');
            setIsDirty(false);
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

            const diffRes = await api.get(`/load-shedding-versions/${vId}/pre-publish-diff/`);
            const { active_version_id, has_active } = diffRes.data;

            if (!has_active) {
                // First-ever publish for this scheme type — no comparison needed
                await api.post(`/load-shedding-versions/${vId}/publish/`, {
                    change_reasons: [],
                    compared_to_version_id: null,
                });
                await fetchMasterData();
                window.dispatchEvent(new CustomEvent('load-shedding-published'));
                alert('Scheme published successfully.');
                return;
            }

            // Fetch stages for both versions and compute the diff
            const [draftRes, activeRes] = await Promise.all([
                api.get(`/load-shedding-stages/?version=${vId}&include_bays=true`),
                api.get(`/load-shedding-stages/?version=${active_version_id}&include_bays=true`),
            ]);
            const draftRows = buildPublishedRows(draftRes.data, substations, relays);
            const activeRows = buildPublishedRows(activeRes.data, substations, relays);
            const allComp = buildComparisonRowsComp(draftRows, activeRows);
            const changedRows = allComp.filter(r => r.changeType !== 'unchanged');

            if (changedRows.length === 0) {
                await api.post(`/load-shedding-versions/${vId}/publish/`, {
                    change_reasons: [],
                    compared_to_version_id: active_version_id,
                });
                await fetchMasterData();
                window.dispatchEvent(new CustomEvent('load-shedding-published'));
                alert('Scheme published successfully. No changes detected from current active version.');
                return;
            }

            // Show the reason modal
            setPublishDiff(changedRows);
            setPublishReasons({});
            setPublishActiveVersionId(active_version_id);
            setPublishDraftVersionId(vId);
            setShowPublishModal(true);
        } catch (err) {
            console.error('Failed to prepare publish', err);
            alert(`Failed to publish scheme. ${err?.response?.data?.error || err.message}`);
        } finally {
            setPublishing(false);
        }
    };

    const handleSubmitPublish = async () => {
        const rowKey = r => `${r.substationId}||${r.feeder}||${r.changeType}`;
        const missing = publishDiff.filter(r => !publishReasons[rowKey(r)]?.trim());
        if (missing.length > 0) {
            alert(`Please fill in a reason for all ${missing.length} highlighted row(s).`);
            return;
        }
        setPublishing(true);
        try {
            const change_reasons = publishDiff.map(r => ({
                change_type: r.changeType,
                substation_id: r.substationId,
                substation_name: r.substationName,
                feeder: r.feeder,
                old_stage_label: r.oldStageLabel || '',
                new_stage_label: r.changeType === 'defeated' ? '' : (r.stageLabel || ''),
                reason: publishReasons[rowKey(r)].trim(),
            }));
            await api.post(`/load-shedding-versions/${publishDraftVersionId}/publish/`, {
                change_reasons,
                compared_to_version_id: publishActiveVersionId,
            });
            setShowPublishModal(false);
            await fetchMasterData();
            window.dispatchEvent(new CustomEvent('load-shedding-published'));
            alert('Scheme published successfully.');
        } catch (err) {
            console.error('Failed to publish', err);
            alert(`Failed to publish. ${err?.response?.data?.error || err.message}`);
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
            (bay) => getBayMW(bay, detailedSubstations[bay.relay_substation_id]),
            (bay) => criticalAssets.some(ca => String(ca.substation_id) === String(bay.relay_substation_id)),
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
            (bay) => getBayMW(bay, detailedSubstations[bay.relay_substation_id]),
            (bay) => criticalAssets.some(ca => String(ca.substation_id) === String(bay.relay_substation_id)),
            criticalAssets
        );
        return metrics.totalMW;
    };

    const calculateTransformerMW = (stage) => {
        if (!stage) return 0;
        return (stage.transformer_bays || []).reduce((total, bay) =>
            total + getBayMW(bay, detailedSubstations[bay.relay_substation_id]), 0);
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
                return getBayMW(bay, detail);
            },
            (bay) => criticalAssets.some(ca => String(ca.substation_id) === String(bay.relay_substation_id)),
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
                            const tx = findTransformerByNo(detail.transformers, dbTx.transformer_no);
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

    const buildDraftRows = () => {
        const rows = [];
        stages.forEach((stage, stageIdx) => {
            const stageColor = COMP_STAGE_COLORS[stageIdx % COMP_STAGE_COLORS.length];
            const settingCells = getStageSettingCells(stage);

            (stage.transformer_bays || []).forEach(bay => {
                const relay = relays.find(r => String(r.id) === String(bay.relay));
                const sub = substations.find(s => s.substation_id === bay.relay_substation_id);
                if (!relay || !sub) return;

                const selectedIds = (bay.transformers || []).map(t => typeof t === 'object' ? t.id : t);
                const selectedTxs = (relay.load_transformers || []).filter(t => selectedIds.includes(typeof t === 'object' ? t.id : t));

                const feeder = selectedTxs.length > 0
                    ? selectedTxs.map(t => `T${t.transformer_no}`).join(' & ')
                    : (bay.transformers && bay.transformers.length > 0)
                        ? bay.transformers.map(t => typeof t === 'object' ? `T${t.id}` : `T${t}`).join(' & ')
                        : (bay.frozen_assets || []).map(a => `T${a}`).join(' & ') || '—';

                rows.push({
                    stageId: stage.id, stageLabel: stage.label, stageColor, stageOrder: stageIdx,
                    type: 'transformer',
                    substationName: sub.name || '',
                    substationId: sub.substation_id || '',
                    region: sub.region || '—', grid: sub.grid || '—',
                    feeder,
                    breakerNumber: selectedTxs.map(t => t.lv_breaker_number).filter(Boolean).join(' & ') || '—',
                    voltage: sub.voltage || '',
                    ...settingCells,
                });
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

                    const feeder = branchObjects.length > 0
                        ? branchObjects.map(branch => `${compactSubstationMnemonic(branch.to_substation)} ${branch.ckt_id}`).join(' & ')
                        : (group.branches || []).join(' & ') || '—';

                    rows.push({
                        stageId: stage.id, stageLabel: stage.label, stageColor, stageOrder: stageIdx,
                        type: 'pocket',
                        substationName: localSub.name || '',
                        substationId: localSub.substation_id || '',
                        region: localSub.region || '—', grid: localSub.grid || '—',
                        feeder,
                        breakerNumber: branchObjects.map(b => b.breaker_number).filter(Boolean).join(' & ') || '—',
                        voltage: localSub.voltage || '',
                        ...settingCells,
                    });
                });
            });
        });
        return rows;
    };

    const openCompareModal = async () => {
        setShowCompareModal(true);
        setCompareLoading(true);
        setCompareRows([]);
        setComparePublishedLabel('');

        const publishedV = versions
            .filter(v => v.status === 'active' && v.scheme_type === schemeType)
            .sort((a, b) => b.review_year - a.review_year || b.version - a.version)[0];

        if (!publishedV) {
            setCompareLoading(false);
            return;
        }

        setComparePublishedLabel(`${publishedV.scheme_type} ${publishedV.review_year} v${publishedV.version}`);

        try {
            const res = await api.get(`/load-shedding-stages/?version=${publishedV.id}&include_bays=true`);
            const publishedRows = buildPublishedRows(res.data, substations, relays);
            const draftRows = buildDraftRows();
            setCompareRows(buildComparisonRowsComp(draftRows, publishedRows));
        } catch (err) {
            console.error('Compare fetch failed', err);
        } finally {
            setCompareLoading(false);
        }
    };

    const isStaff = currentUser?.is_staff || false;
    const drafts = versions.filter(v => v.status === 'draft');
    const published = versions.filter(v => ['active', 'deactivated'].includes(v.status));

    if (loading && view === 'manager') {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-card)' }}>

                {/* ── Command bar ──────────────────────────────────────────── */}
                <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0 1.5rem', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>

                    {/* Icon + title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <FaLayerGroup size={15} color="var(--brand-mid)" />
                        <span style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-1)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                            Scheme Designer
                        </span>
                    </div>

                    {/* Divider */}
                    <div style={{ width: 1, height: 20, background: 'var(--border-default)', flexShrink: 0 }} />

                    {/* Stats */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>Drafts</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{drafts.length}</span>
                        </div>
                        <div style={{ width: 1, height: 20, background: 'var(--border-default)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>Published</span>
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{published.length}</span>
                        </div>
                    </div>

                    {/* New Scheme button */}
                    <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        <button
                            onClick={handleCreateNew}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', background: 'var(--brand-gradient)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(2,64,49,0.18)', whiteSpace: 'nowrap', transition: 'filter 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
                            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                        >
                            <Plus size={14} /> New Scheme
                        </button>
                    </div>
                </div>

                {/* ── Two-column body ──────────────────────────────────── */}
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.25rem', padding: '1rem 1.5rem 1.5rem', overflow: 'hidden' }}>

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
        <>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-card)' }}>

            {/* ── TOP BAR ──────────────────────────────────────────── */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 1.25rem', height: 52, borderBottom: '1px solid var(--border-default)', background: 'var(--surface-card)', gap: '0.5rem' }}>
                {/* Left: back + breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                    <button onClick={() => setView('manager')} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer', flexShrink: 0 }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <ChevronRight size={13} style={{ transform: 'rotate(180deg)', color: '#64748b' }} />
                    </button>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>Scheme Designer</span>
                    <ChevronRight size={11} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schemeType} {reviewYear}</span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.7rem', flexShrink: 0 }}>·</span>
                    <input
                        key={activeVersionId || 'new'}
                        type="text"
                        defaultValue={versionLabel}
                        placeholder="Add label..."
                        style={{
                            fontSize: '0.7rem',
                            color: '#64748b',
                            fontFamily: "'Poppins', sans-serif",
                            fontWeight: 400,
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px dashed transparent',
                            outline: 'none',
                            padding: '1px 2px',
                            minWidth: '70px',
                            maxWidth: '200px',
                            cursor: 'text',
                            transition: 'border-color 0.15s',
                        }}
                        onFocus={e => { e.target.style.borderBottomColor = '#94a3b8'; }}
                        onBlur={e => {
                            e.target.style.borderBottomColor = 'transparent';
                            setVersionLabel(e.target.value);
                            if (!isDirty) setIsDirty(true);
                        }}
                    />
                    {activeVersionMeta?.status === 'active'
                        ? <span style={{ fontSize: '0.57rem', fontWeight: 700, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '2px 7px', borderRadius: '999px', flexShrink: 0 }}>Published</span>
                        : <span style={{ fontSize: '0.57rem', fontWeight: 700, background: '#fefce8', border: '1px solid #fde68a', color: '#92400e', padding: '2px 7px', borderRadius: '999px', flexShrink: 0 }}>Draft</span>
                    }
                </div>
                {/* Right: toggles + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    {/* Panel toggles — icon only to save space */}
                    <button onClick={() => setIsMetricsDrawerOpen(v => !v)} title="Metrics panel" style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isMetricsDrawerOpen ? 'var(--text-1)' : 'var(--text-3)', background: isMetricsDrawerOpen ? 'var(--surface-raised)' : 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                        <FaGaugeHigh size={12} />
                    </button>
                    <button onClick={() => setShowLibrary(v => !v)} title="Asset library" style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: showLibrary ? 'var(--text-1)' : 'var(--text-3)', background: showLibrary ? 'var(--surface-raised)' : 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                        <FaBolt size={12} />
                    </button>
                    <div style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 2px' }} />
                    {/* Profile — icon only */}
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowProfilePopover(v => !v)} title="Scheme profile" style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showProfilePopover ? '#0f172a' : '#64748b', background: showProfilePopover ? '#f1f5f9' : '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => { if (!showProfilePopover) e.currentTarget.style.background = '#fff'; }}>
                            <Lock size={12} />
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
                                            <input type="text" placeholder="e.g. 2026 National UFLS" value={versionLabel} onChange={e => { setVersionLabel(e.target.value); setIsDirty(true); }} disabled={!!activeVersionId && !isNewlyCloned} style={{ width: '100%', padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.72rem', color: '#0f172a', outline: 'none', background: '#fff', opacity: (activeVersionId && !isNewlyCloned) ? 0.6 : 1, boxSizing: 'border-box' }} />
                                        </div>
                                        {activeVersionId && <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontStyle: 'italic' }}>Profile is locked for existing drafts.</div>}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {/* Settings drawer — icon only */}
                    <button onClick={() => setShowSettingsDrawer(v => !v)} title="Settings" style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showSettingsDrawer ? '#0f172a' : '#64748b', background: showSettingsDrawer ? '#f1f5f9' : '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => { if (!showSettingsDrawer) e.currentTarget.style.background = '#fff'; }}>
                        <FaGear size={12} />
                    </button>
                    <div style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 2px' }} />
                    {/* Summary */}
                    <button onClick={() => setShowSummaryModal(true)} style={{ height: '28px', padding: '0 8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#64748b', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <FaTableList size={11} /> Summary
                    </button>
                    {/* Compare with published */}
                    <button onClick={openCompareModal} style={{ height: '28px', padding: '0 8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#64748b', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <FaCodeBranch size={11} /> Compare
                    </button>
                    {/* Publish / Unpublish */}
                    {activeVersionMeta?.status === 'active' ? (
                        <button onClick={handleUnpublishWorkspace} disabled={publishing} style={{ height: '28px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer', opacity: publishing ? 0.6 : 1 }}>
                            <RotateCcw size={11} className={publishing ? 'animate-spin' : ''} /> {publishing ? 'Unpublishing...' : 'Unpublish'}
                        </button>
                    ) : (
                        <button onClick={handlePublishWorkspace} disabled={publishing} style={{ height: '28px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer', opacity: publishing ? 0.6 : 1 }}>
                            {publishing ? <RotateCcw size={11} className="animate-spin" /> : <FaShieldHalved size={11} />} {publishing ? 'Publishing...' : 'Publish'}
                        </button>
                    )}
                    {/* Save */}
                    <button onClick={handleSaveWorkspace} disabled={saving || publishing || !isDirty} style={{ height: '28px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontFamily: "'Poppins',sans-serif", fontWeight: 700, color: '#fff', background: isDirty ? '#059669' : '#94a3b8', border: 'none', borderRadius: '6px', cursor: isDirty ? 'pointer' : 'default', opacity: (saving || publishing) ? 0.6 : 1, transition: 'background 0.2s' }} onMouseEnter={e => { if (isDirty && !saving && !publishing) e.currentTarget.style.background = '#047857'; }} onMouseLeave={e => e.currentTarget.style.background = isDirty ? '#059669' : '#94a3b8'}>
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
                        <button key={stage.id} onClick={() => setActiveStageIdx(idx)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0 0.85rem', height: '41px', flexShrink: 0, background: 'none', border: 'none', borderBottom: `2px solid ${isActive ? '#2563eb' : 'transparent'}`, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#2563eb' : '#64748b', whiteSpace: 'nowrap' }}>{stage.label}</span>
                            <span style={{ fontSize: '0.63rem', fontFamily: 'monospace', fontWeight: 600, color: isActive ? '#1d4ed8' : '#94a3b8', whiteSpace: 'nowrap' }}>{formatMW(stageMW)} MW</span>
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
                <div ref={leftPanelRef} style={{ width: leftPanelWidth + 'px', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#fff' }}>
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
                                                            <div style={{ height: '100%', width: `${p}%`, background: p >= 100 ? '#059669' : '#7c3aed', borderRadius: '999px' }} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* Regional breakdown — scheme-wide */}
                                {gridData?.regional_breakdown && (
                                    <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '0.65rem' }}>
                                            <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>All-Stage Regional</div>
                                            <DrawerInfoTip text={`Total MW assigned per region across all stages, compared against each region's proportional target.\n\nBar = assigned ÷ target. Regions over-assigned show in red.`} />
                                        </div>
                                        <CompactRegionalMetrics data={getOverallRegionalSpiralData()} labelKey="region" valueKey="assigned_mw" targetKey="target_mw" />
                                    </div>
                                )}
                                {/* Regional Distribution by Stage — dual metric (stage share + grid coverage) */}
                                {gridData?.regional_breakdown && stages[activeStageIdx] && (
                                    <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>Regional by Stage</div>
                                                <DrawerInfoTip text={`For the active stage, two ratios per region:\n\n• Stage share (blue): Region MW ÷ Stage Total MW — this region's contribution to the stage's shed load.\n\n• Grid coverage (orange): Region MW ÷ Region Total Grid MW — fraction of the region's total load being shed.`} />
                                            </div>
                                            <span style={{ fontSize: '0.57rem', fontWeight: 600, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 5px' }}>
                                                {stages[activeStageIdx].label}
                                            </span>
                                        </div>

                                        {/* Metric legend */}
                                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <div style={{ width: 12, height: 3, borderRadius: '2px', background: '#3b82f6', flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.55rem', fontWeight: 600, color: '#64748b' }} title="Region MW ÷ Stage Total MW × 100">Stage share</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <div style={{ width: 12, height: 3, borderRadius: '2px', background: '#f97316', flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.55rem', fontWeight: 600, color: '#64748b' }} title="Region MW ÷ Region Total Grid MW × 100">Grid coverage</span>
                                            </div>
                                        </div>

                                        {/* Region rows */}
                                        {(() => {
                                            const regionTotalMap = Object.fromEntries(
                                                gridData.regional_breakdown.map(r => [r.region, r.total_pload_mw || 0])
                                            );
                                            const stageData = getStageRegionalSpiralData(stages[activeStageIdx]);
                                            const filtered = stageData.filter(d => (d.assigned_mw || 0) > 0).sort((a, b) => (b.assigned_mw || 0) - (a.assigned_mw || 0));
                                            if (!filtered.length) return (
                                                <div style={{ fontSize: '0.63rem', color: '#475569', textAlign: 'center', padding: '0.5rem 0' }}>No assignments for this stage</div>
                                            );
                                            const stageTotalMW = filtered.reduce((s, d) => s + (d.assigned_mw || 0), 0);
                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    {filtered.map(d => {
                                                        const stagePct = stageTotalMW > 0 ? (d.assigned_mw / stageTotalMW) * 100 : 0;
                                                        const regionTotal = regionTotalMap[d.region] || 0;
                                                        const coveragePct = regionTotal > 0 ? (d.assigned_mw / regionTotal) * 100 : null;
                                                        return (
                                                            <div key={d.region} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                                                                        {d.region}
                                                                    </span>
                                                                    <span style={{ fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: 600, color: '#10b981', flexShrink: 0 }}>
                                                                        {(d.assigned_mw || 0).toFixed(1)} MW
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px', gap: '4px', alignItems: 'center' }}>
                                                                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '3px', height: 4, overflow: 'hidden' }}>
                                                                        <div style={{ width: `${stagePct}%`, height: '100%', background: '#3b82f6', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                                                                    </div>
                                                                    <span style={{ fontSize: '0.57rem', fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{stagePct.toFixed(1)}%</span>
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px', gap: '4px', alignItems: 'center' }}>
                                                                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '3px', height: 4, overflow: 'hidden' }}>
                                                                        <div style={{ width: `${Math.min(coveragePct || 0, 100)}%`, height: '100%', background: '#f97316', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                                                                    </div>
                                                                    <span style={{ fontSize: '0.57rem', fontWeight: 600, color: coveragePct != null ? '#f97316' : '#475569', textAlign: 'right' }}>
                                                                        {coveragePct != null ? `${coveragePct.toFixed(1)}%` : '—'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Left resize handle */}
            {isMetricsDrawerOpen && (
                <div
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const startX = e.clientX;
                        const startW = leftPanelRef.current?.offsetWidth ?? leftPanelWidth;
                        document.body.style.cursor = 'col-resize';
                        document.body.style.userSelect = 'none';
                        const onMove = (mv) => setLeftPanelWidth(Math.max(160, Math.min(420, startW + mv.clientX - startX)));
                        const onUp = () => {
                            document.body.style.cursor = '';
                            document.body.style.userSelect = '';
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                        };
                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                    }}
                    style={{ width: '4px', flexShrink: 0, cursor: 'col-resize', background: '#e2e8f0', zIndex: 1, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#94a3b8'}
                    onMouseLeave={e => e.currentTarget.style.background = '#e2e8f0'}
                />
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
                            {sortedTransformerBays.length > 0 ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th onClick={() => handleBaySort('substation')} style={{ padding: '0.4rem 1.25rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '26%', cursor: 'pointer' }}>Substation {baySortConfig.key === 'substation' ? (baySortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>Transformers</th>
                                            <th onClick={() => handleBaySort('voltage')} style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '26%', cursor: 'pointer' }}>Voltage {baySortConfig.key === 'voltage' ? (baySortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                            <th onClick={() => handleBaySort('mw')} style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '70px', cursor: 'pointer' }}>MW {baySortConfig.key === 'mw' ? (baySortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                            <th style={{ padding: '0.4rem 1.25rem 0.4rem 0.4rem', borderBottom: '1px solid #f1f5f9', width: '48px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedTransformerBays.map((bay, bayIdx) => {
                                            const subId = bay.relay_substation_id;
                                            const detail = detailedSubstations[subId];
                                            const relayObj = relays.find(r => r.id === bay.relay);
                                            const relayLabel = relayObj?.relay_name?.replace(' System', '') || '—';
                                            const sub = substations.find(s => s.substation_id === subId);
                                            let txLabels = [], hasCritical = false;
                                            const bayMW = getBayMW(bay, detail);
                                            if (detail?.db_transformers) {
                                                (bay.transformers || []).forEach(txObj => {
                                                    const tId = typeof txObj === 'object' ? txObj.id : txObj;
                                                    const dbTx = detail.db_transformers.find(t => String(t.id) === String(tId));
                                                    if (dbTx) {
                                                        txLabels.push(`T${dbTx.transformer_no}`);
                                                        const tidVal = typeof tId === 'object' ? tId.id : tId;
                                                        if (criticalAssets.some(ca => ca.load_transformers?.includes(Number(tidVal)))) hasCritical = true;
                                                    }
                                                });
                                            }
                                            if (txLabels.length === 0) txLabels = [`${bay.transformers?.length || 0} TXs`];
                                            return (
                                                <React.Fragment key={bay.id}>
                                                <tr style={{ borderBottom: '1px solid #f8fafc' }} onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                    <td style={{ padding: '0.5rem 0.75rem 0.5rem 1.25rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0f172a' }}>{subId}</span>
                                                            {hasCritical && <FiAlertCircle size={10} style={{ color: '#f97316', flexShrink: 0 }} title="Critical asset" />}
                                                        </div>
                                                        {sub?.name && <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>{sub.name}</div>}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', color: '#334155', fontFamily: 'monospace' }}>{txLabels.join(', ')}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#334155', fontWeight: 500 }}>{relayLabel}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{formatMW(bayMW)}</td>
                                                    <td style={{ padding: '0.5rem 1.25rem 0.5rem 0.4rem', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '3px' }}>
                                                            <button onClick={() => setEditingBayId(editingBayId === bay.id ? null : bay.id)} title="Edit transformers" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: editingBayId === bay.id ? '#f1f5f9' : '#fff', border: `1px solid ${editingBayId === bay.id ? '#cbd5e1' : '#e2e8f0'}`, borderRadius: '4px', cursor: 'pointer', color: editingBayId === bay.id ? '#0f172a' : '#64748b' }} onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }} onMouseLeave={e => { if (editingBayId !== bay.id) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}><FiEdit2 size={10} /></button>
                                                            <button onClick={() => { const ns = [...stages]; const nb = ns[activeStageIdx].transformer_bays.filter(b => b.id !== bay.id); ns[activeStageIdx] = { ...ns[activeStageIdx], transformer_bays: nb }; setStages(ns); }} title="Remove" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', color: '#ef4444' }} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}><X size={10} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {editingBayId === bay.id && (
                                                    <tr>
                                                        <td colSpan={5} style={{ padding: '0', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                            <div style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginRight: '4px', flexShrink: 0 }}>Transformers</span>
                                                                {(relayObj?.load_transformers || []).map(txVal => {
                                                                    const transformerId = typeof txVal === 'object' ? txVal.id : txVal;
                                                                    const dbTx = detail?.db_transformers?.find(t => String(t.id) === String(transformerId));
                                                                    const txLabel = dbTx ? `T${dbTx.transformer_no}` : `#${transformerId}`;
                                                                    const tx = dbTx ? findTransformerByNo(detail.transformers, dbTx.transformer_no) : null;
                                                                    const txMw = tx?.load_mw != null ? parseFloat(tx.load_mw) : null;
                                                                    const isAssigned = bay.transformers.some(t => String(typeof t === 'object' ? t.id : t) === String(transformerId));
                                                                    return (
                                                                        <button key={transformerId} onClick={() => toggleTransformerInStage(relayObj, transformerId)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '5px', border: `1px solid ${isAssigned ? '#bbf7d0' : '#e2e8f0'}`, background: isAssigned ? '#f0fdf4' : '#fff', cursor: 'pointer', fontSize: '0.65rem', fontFamily: "'Poppins',sans-serif", fontWeight: isAssigned ? 700 : 500, color: isAssigned ? '#166534' : '#64748b' }}>
                                                                            {isAssigned ? <CheckSquare size={9} color="#166534" /> : <Square size={9} color="#94a3b8" />}
                                                                            {txLabel}
                                                                            {txMw != null && <span style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: isAssigned ? '#166534' : '#94a3b8' }}>{formatMW(txMw)}</span>}
                                                                        </button>
                                                                    );
                                                                })}
                                                                <button onClick={() => setEditingBayId(null)} style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: '5px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.63rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>Done</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                </React.Fragment>
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
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '22%' }}>Source Sub</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '80px' }}>Voltage</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>Branch Bays</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '22%' }}>Island Subs</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', width: '64px' }}>MW</th>
                                            <th style={{ padding: '0.4rem 1.25rem 0.4rem 0.4rem', borderBottom: '1px solid #f1f5f9', width: '48px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...(stages[activeStageIdx].computed_pockets || [])].sort((a, b) => {
                                            const subIdA = a.branchGroups?.[0]?.subId || a.branches?.[0] || '';
                                            const subIdB = b.branchGroups?.[0]?.subId || b.branches?.[0] || '';
                                            const subA = substations.find(s => s.substation_id === subIdA);
                                            const subB = substations.find(s => s.substation_id === subIdB);
                                            return (subA?.grid || '').localeCompare(subB?.grid || '') || subIdA.localeCompare(subIdB);
                                        }).map((pocket, pIdx) => {
                                            const subItems = (pocket.pocket_substation_details || pocket.pocket_substations || []).map(s => s.substation_id || s);
                                            const groups = (pocket.branchGroups && pocket.branchGroups.length > 0)
                                                ? pocket.branchGroups
                                                : [{ subId: '—', voltage: '', branches: pocket.branches || [] }];
                                            const isEditingPocket = editingPocketId === pocket.id;
                                            const isHovered = hoveredPocketId === pocket.id;
                                            return (
                                                <React.Fragment key={pocket.id}>
                                                {groups.map((group, gIdx) => {
                                                    const isFirst = gIdx === 0;
                                                    const isLast = gIdx === groups.length - 1;
                                                    return (
                                                        <tr key={`${pocket.id}-g${gIdx}`}
                                                            style={{ background: isHovered ? '#fafafa' : '', borderBottom: isLast && !isEditingPocket ? '1px solid #e2e8f0' : '1px solid #f8fafc' }}
                                                            onMouseEnter={() => setHoveredPocketId(pocket.id)}
                                                            onMouseLeave={() => setHoveredPocketId(null)}
                                                        >
                                                            {/* # */}
                                                            <td style={{ padding: '0.5rem 1.25rem', fontWeight: 700, color: '#334155', fontSize: '0.7rem', verticalAlign: 'top' }}>
                                                                {isFirst ? `P${pIdx + 1}` : ''}
                                                            </td>
                                                            {/* Source Sub */}
                                                            <td style={{ padding: isFirst ? '0.5rem 0.75rem' : '0.3rem 0.75rem', fontSize: '0.7rem', fontWeight: 600, color: '#0f172a', verticalAlign: 'top' }}>
                                                                {group.subId}
                                                                {(() => { const sv = substations.find(s => s.substation_id === group.subId); return sv?.name ? <div style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 400 }}>{sv.name}</div> : null; })()}
                                                            </td>
                                                            {/* Voltage */}
                                                            <td style={{ padding: isFirst ? '0.5rem 0.75rem' : '0.3rem 0.75rem', fontSize: '0.7rem', color: '#334155', fontWeight: 500, verticalAlign: 'top' }}>
                                                                {group.voltage || '—'}
                                                            </td>
                                                            {/* Branch Bays */}
                                                            <td style={{ padding: isFirst ? '0.5rem 0.75rem' : '0.3rem 0.75rem', fontSize: '0.68rem', color: '#334155', fontFamily: 'monospace', verticalAlign: 'top' }}>
                                                                {group.branches.join(', ') || '—'}
                                                            </td>
                                                            {/* Island Subs — first row only */}
                                                            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', color: '#334155', verticalAlign: 'top' }}>
                                                                {isFirst && (subItems.length === 0 ? '—' : (
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 6px' }}>
                                                                        {subItems.map(subId => {
                                                                            const isCritical = criticalAssets.some(ca => String(ca.substation_id) === String(subId));
                                                                            return (
                                                                                <span key={subId} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                                                                    <span>{subId}</span>
                                                                                    {isCritical && <FiAlertCircle size={9} style={{ color: '#f97316', flexShrink: 0 }} title="Critical substation" />}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ))}
                                                            </td>
                                                            {/* MW — first row only */}
                                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', verticalAlign: 'top' }}>
                                                                {isFirst ? formatMW(pocket.total_p_mw ?? 0) : ''}
                                                            </td>
                                                            {/* Actions — first row only */}
                                                            <td style={{ padding: '0.5rem 1.25rem 0.5rem 0.4rem', textAlign: 'right', verticalAlign: 'top' }}>
                                                                {isFirst && (
                                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '3px' }}>
                                                                        <button onClick={() => setEditingPocketId(isEditingPocket ? null : pocket.id)} title="Edit" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isEditingPocket ? '#f1f5f9' : '#fff', border: `1px solid ${isEditingPocket ? '#cbd5e1' : '#e2e8f0'}`, borderRadius: '4px', cursor: 'pointer', color: isEditingPocket ? '#0f172a' : '#64748b' }} onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }} onMouseLeave={e => { if (!isEditingPocket) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}><FiEdit2 size={10} /></button>
                                                                        <button onClick={() => { const ns = [...stages]; const a = { ...ns[activeStageIdx] }; a.computed_pockets = (a.computed_pockets || []).filter(c => c.id !== pocket.id); ns[activeStageIdx] = a; setStages(ns); }} title="Remove" style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', color: '#ef4444' }} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}><X size={10} /></button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {isEditingPocket && (
                                                    <tr onMouseEnter={() => setHoveredPocketId(pocket.id)} onMouseLeave={() => setHoveredPocketId(null)}>
                                                        <td colSpan={7} style={{ padding: '0', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                            <div style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginRight: '4px', flexShrink: 0 }}>Branches</span>
                                                                {(pocket.branches || []).map(branchId => {
                                                                    const pts = branchId.split('_');
                                                                    const subId = pts[0];
                                                                    const branchLabel = pts.slice(1).join('_');
                                                                    return (
                                                                        <div key={branchId} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 6px 2px 8px', borderRadius: '5px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.63rem', color: '#334155' }}>
                                                                            <FaCodeBranch size={8} style={{ color: '#64748b' }} />
                                                                            <span style={{ fontWeight: 600 }}>{subId}</span>
                                                                            <span style={{ color: '#94a3b8' }}>·</span>
                                                                            <span style={{ fontFamily: 'monospace' }}>{branchLabel}</span>
                                                                            <button onClick={() => { const ns = [...stages]; const a = { ...ns[activeStageIdx] }; const updatedPocket = { ...pocket, branches: pocket.branches.filter(b => b !== branchId), branchGroups: pocket.branchGroups?.map(g => ({ ...g, branches: g.branches.filter(b => `${g.subId}_${b}` !== branchId) })).filter(g => g.branches.length > 0) }; a.computed_pockets = a.computed_pockets.map(c => c.id === pocket.id ? updatedPocket : c); ns[activeStageIdx] = a; setStages(ns); }} style={{ width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, marginLeft: '2px' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}><X size={9} /></button>
                                                                        </div>
                                                                    );
                                                                })}
                                                                <button onClick={() => { const ns = [...stages]; const a = { ...ns[activeStageIdx] }; a.computed_pockets = (a.computed_pockets || []).filter(c => c.id !== pocket.id); a.pocket_branches = [...new Set([...(a.pocket_branches || []), ...(pocket.branches || [])])]; ns[activeStageIdx] = a; setStages(ns); setEditingPocketId(null); }} style={{ padding: '3px 10px', borderRadius: '5px', border: '1px solid #fde68a', background: '#fffbeb', fontSize: '0.63rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#92400e', cursor: 'pointer' }}>Dissolve to Tray</button>
                                                                <button onClick={() => setEditingPocketId(null)} style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: '5px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.63rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>Done</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                </React.Fragment>
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

            {/* Right resize handle */}
            {showLibrary && (
                <div
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const startX = e.clientX;
                        const startW = rightPanelRef.current?.offsetWidth ?? rightPanelWidth;
                        document.body.style.cursor = 'col-resize';
                        document.body.style.userSelect = 'none';
                        const onMove = (mv) => setRightPanelWidth(Math.max(200, Math.min(520, startW - (mv.clientX - startX))));
                        const onUp = () => {
                            document.body.style.cursor = '';
                            document.body.style.userSelect = '';
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                        };
                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                    }}
                    style={{ width: '4px', flexShrink: 0, cursor: 'col-resize', background: '#e2e8f0', zIndex: 1, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#94a3b8'}
                    onMouseLeave={e => e.currentTarget.style.background = '#e2e8f0'}
                />
            )}

            {/* ── RIGHT: Asset Library ───────────────────────── */}
            {showLibrary && (
                <div ref={rightPanelRef} style={{ width: rightPanelWidth + 'px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                        {['library', 'alerts'].map(tab => (
                            <button key={tab} onClick={() => setAssetLibraryTab(tab)} style={{ flex: 1, padding: '0.5rem', fontSize: '0.63rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, color: assetLibraryTab === tab ? '#0f172a' : '#94a3b8', background: 'none', border: 'none', borderBottom: `2px solid ${assetLibraryTab === tab ? '#0f172a' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                                {tab === 'library' ? 'Asset Library' : (
                                    <>
                                        Alert Message
                                        {alertViolations.length > 0 && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '16px', height: '16px', padding: '0 4px', borderRadius: '999px', background: '#ef4444', color: '#fff', fontSize: '0.52rem', fontWeight: 700, lineHeight: 1 }}>
                                                {alertViolations.length}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        ))}
                    </div>
                    {assetLibraryTab === 'library' ? (
                        <>
                            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                                <div style={{ position: 'relative' }}>
                                    <Search style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} size={12} />
                                    <input type="text" placeholder="Search substation" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.4rem 1.6rem 0.4rem 1.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#0f172a', fontSize: '0.68rem', outline: 'none', fontFamily: "'Poppins',sans-serif", boxSizing: 'border-box' }} onFocus={e => { e.target.style.borderColor = '#94a3b8'; e.target.style.background = '#fff'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }} />
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
                                        if (term && !subId.toLowerCase().includes(term) && !(sub.name || '').toLowerCase().includes(term) && !(relay.relay_name || '').toLowerCase().includes(term)) return;
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
                                        (Array.isArray(relay.load_transformers) ? relay.load_transformers : []).forEach(txVal => { const transformerId = typeof txVal === 'object' ? txVal.id : txVal; if (detail?.transformers && detail?.db_transformers) { const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId)); if (dbTx) { const tx = findTransformerByNo(detail.transformers, dbTx.transformer_no); if (tx?.load_mw != null) totalMw += parseFloat(tx.load_mw); } } });
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
                                                            if (detail?.db_transformers) { const dbTx = detail.db_transformers.find(t => String(t.id) === String(transformerId)); if (dbTx) { txLabel = `T${dbTx.transformer_no}`; const tx = findTransformerByNo(detail.transformers, dbTx.transformer_no); if (tx?.load_mw != null) txMw = parseFloat(tx.load_mw); } }
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
                        /* ── ALERT MESSAGE TAB ── */
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {/* Header bar */}
                            <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <ShieldAlert size={13} color={alertViolations.length > 0 ? '#ef4444' : '#22c55e'} />
                                    <span style={{ fontSize: '0.63rem', fontWeight: 600, color: '#0f172a' }}>
                                        {alertViolations.length === 0 ? 'No Violations' : `${alertViolations.length} Violation${alertViolations.length > 1 ? 's' : ''}`}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setShowAlertConfigModal(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', fontSize: '0.6rem', fontWeight: 600, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}
                                >
                                    <FaGear size={9} /> Rules
                                </button>
                            </div>
                            {/* Enforcement badges — one per rule */}
                            <div style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                {[['R1', currentRule1Enforcement], ['R2', currentRule2Enforcement]].map(([label, mode]) => (
                                    <span key={label} style={{ fontSize: '0.55rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: mode === 'block' ? '#fee2e2' : '#fef9c3', color: mode === 'block' ? '#b91c1c' : '#92400e', fontWeight: 700 }}>
                                        {label}: {mode === 'block' ? 'BLOCK' : 'WARN'}
                                    </span>
                                ))}
                            </div>
                            {/* Violation list */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem 0' }}>
                                {alertViolations.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', color: '#94a3b8', textAlign: 'center' }}>
                                        <CheckCircle2 size={24} color="#22c55e" style={{ marginBottom: '0.5rem' }} />
                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>All rules satisfied</div>
                                        <div style={{ fontSize: '0.6rem', lineHeight: 1.5 }}>No design rule violations detected for the current {schemeType} workspace.</div>
                                    </div>
                                ) : (
                                    alertViolations.map((v, i) => (
                                        <div key={i} style={{ margin: '0.4rem 0.6rem', padding: '0.5rem 0.65rem', borderRadius: '8px', background: v.severity === 'error' ? '#fef2f2' : '#fffbeb', border: `1px solid ${v.severity === 'error' ? '#fecaca' : '#fde68a'}` }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                                                <TriangleAlert size={11} color={v.severity === 'error' ? '#ef4444' : '#f59e0b'} style={{ marginTop: '1px', flexShrink: 0 }} />
                                                <div>
                                                    <div style={{ fontSize: '0.58rem', fontWeight: 700, color: v.severity === 'error' ? '#b91c1c' : '#92400e', marginBottom: '0.2rem' }}>
                                                        Rule {v.rule} — {v.stage_label}
                                                    </div>
                                                    <div style={{ fontSize: '0.6rem', color: '#374151', lineHeight: 1.5 }}>{v.message}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            </div> {/* end 3-column body */}

            {/* ── ALERT CONFIG MODAL ───────────────────────────── */}
            {showAlertConfigModal && (() => {
                const SCHEME_LABELS = { UFLS: 'UFLS', UVLS: 'UVLS', EMLS: 'EMLS' };

                const getStageOptions = (schemeKey) => {
                    // Build stage number options from all stages of the current workspace if same scheme,
                    // else offer numbers 1–13 as the full range
                    if (schemeKey === schemeType) {
                        const nums = stages.map(s => s.stage_number).sort((a, b) => a - b);
                        return [...new Set([...nums, ...Array.from({ length: 13 }, (_, i) => i + 1)])].sort((a, b) => a - b);
                    }
                    return Array.from({ length: 13 }, (_, i) => i + 1);
                };

                const renderSchemeSection = (cfg) => {
                    if (!cfg) return null;
                    const stageOptions = getStageOptions(cfg.scheme_type);

                    const toggleProtectedStage = (num) => {
                        const current = cfg.ufls_protected_stages || [];
                        const next = current.includes(num) ? current.filter(n => n !== num) : [...current, num].sort((a, b) => a - b);
                        saveAlertConfig(cfg.id, { ufls_protected_stages: next });
                    };

                    const toggleRestrictedStage = (num) => {
                        const current = cfg.critical_restricted_stages || [];
                        const next = current.includes(num) ? current.filter(n => n !== num) : [...current, num].sort((a, b) => a - b);
                        saveAlertConfig(cfg.id, { critical_restricted_stages: next });
                    };

                    const toggleRule1Enforcement = () => {
                        saveAlertConfig(cfg.id, { rule1_enforcement: cfg.rule1_enforcement === 'block' ? 'warn' : 'block' });
                    };

                    const toggleRule2Enforcement = () => {
                        saveAlertConfig(cfg.id, { rule2_enforcement: cfg.rule2_enforcement === 'block' ? 'warn' : 'block' });
                    };

                    const EnforcementToggle = ({ label, mode, onToggle }) => (
                        <button
                            onClick={onToggle}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: "'Poppins',sans-serif", fontSize: '0.58rem', fontWeight: 700, background: mode === 'block' ? '#fee2e2' : '#fef9c3', color: mode === 'block' ? '#b91c1c' : '#92400e' }}
                        >
                            {mode === 'block' ? <Lock size={8} /> : <FiAlertCircle size={8} />}
                            {label}: {mode === 'block' ? 'Block' : 'Warn'}
                        </button>
                    );

                    return (
                        <div key={cfg.scheme_type} style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fafafa' }}>
                            <div style={{ marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>{SCHEME_LABELS[cfg.scheme_type]}</span>
                            </div>

                            {/* Rule 1: UFLS Protected Stages — only shown on UFLS row; toggle for all schemes */}
                            {cfg.scheme_type === 'UFLS' && (
                                <div style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px dashed #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                        <div style={{ fontSize: '0.63rem', fontWeight: 600, color: '#374151' }}>Rule 1 — UFLS Protected Stages</div>
                                        <EnforcementToggle label="Rule 1" mode={cfg.rule1_enforcement} onToggle={toggleRule1Enforcement} />
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: '#64748b', marginBottom: '0.45rem', lineHeight: 1.5 }}>
                                        Substations in these UFLS stages (active published version) may not be reused in any other load shedding scheme.
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                        {stageOptions.slice(0, 13).map(num => {
                                            const active = (cfg.ufls_protected_stages || []).includes(num);
                                            return (
                                                <button key={num} onClick={() => toggleProtectedStage(num)} style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', border: `1px solid ${active ? '#7c3aed' : '#e2e8f0'}`, background: active ? '#7c3aed' : '#fff', color: active ? '#fff' : '#64748b', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
                                                    S{num}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {cfg.scheme_type !== 'UFLS' && (
                                <div style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px dashed #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ fontSize: '0.63rem', fontWeight: 600, color: '#374151' }}>Rule 1 — No Overlap with UFLS Protected Stages</div>
                                        <EnforcementToggle label="Rule 1" mode={cfg.rule1_enforcement} onToggle={toggleRule1Enforcement} />
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '0.3rem', lineHeight: 1.5 }}>
                                        Bays already in active published UFLS protected stages must not be assigned here.
                                    </div>
                                </div>
                            )}

                            {/* Rule 2: Critical Substation Restricted Stages */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                    <div style={{ fontSize: '0.63rem', fontWeight: 600, color: '#374151' }}>Rule 2 — Critical Substation Restricted Stages</div>
                                    <EnforcementToggle label="Rule 2" mode={cfg.rule2_enforcement} onToggle={toggleRule2Enforcement} />
                                </div>
                                <div style={{ fontSize: '0.6rem', color: '#64748b', marginBottom: '0.45rem', lineHeight: 1.5 }}>
                                    Critical substations will not be allowed (or flagged) when assigned to these stages.
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                    {stageOptions.slice(0, 13).map(num => {
                                        const active = (cfg.critical_restricted_stages || []).includes(num);
                                        return (
                                            <button key={num} onClick={() => toggleRestrictedStage(num)} style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', border: `1px solid ${active ? '#0f172a' : '#e2e8f0'}`, background: active ? '#0f172a' : '#fff', color: active ? '#fff' : '#64748b', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
                                                S{num}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                };

                return (
                    <>
                        <div onClick={() => setShowAlertConfigModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 200 }} />
                        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '560px', maxWidth: '95vw', maxHeight: '90vh', background: '#fff', borderRadius: '14px', boxShadow: '0 24px 60px rgba(0,0,0,0.18)', zIndex: 201, display: 'flex', flexDirection: 'column', fontFamily: "'Poppins',sans-serif" }}>
                            {/* Modal header */}
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                                <div>
                                    <div style={{ fontSize: '0.52rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '2px' }}>Design Philosophy</div>
                                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Alert Rules & Configuration</h2>
                                </div>
                                <button onClick={() => setShowAlertConfigModal(false)} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#64748b' }}><X size={13} /></button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                                {/* Rules reference */}
                                <div style={{ marginBottom: '1.5rem', padding: '0.85rem 1rem', borderRadius: '10px', background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                                    <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#0369a1', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <FaShieldHalved size={11} /> Design Rules Reference
                                    </div>
                                    <div style={{ fontSize: '0.62rem', color: '#0c4a6e', lineHeight: 1.6 }}>
                                        <div style={{ marginBottom: '0.45rem' }}>
                                            <strong>Rule 1 — No Cross-Scheme Overlap:</strong> Substations assigned to UFLS protected stages (active published version) must not appear in any other load shedding scheme (UVLS or EMLS), in any stage. Default protected stages: 1, 2, 3.
                                        </div>
                                        <div>
                                            <strong>Rule 2 — Critical Substation Protection:</strong> Critical substations must not be assigned to designated restricted stages per scheme type. This ensures critical infrastructure remains available during early-stage load shedding. Default: UFLS stages 1–3 restricted; UVLS and EMLS unrestricted.
                                        </div>
                                    </div>
                                </div>

                                {/* Per-scheme config */}
                                <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#374151', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Per-Scheme Configuration</div>
                                {alertConfigLoading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', gap: '0.85rem' }}>
                                        <div style={{ position: 'relative', width: 36, height: 36 }}>
                                            <div style={{ position: 'absolute', inset: 0, border: '3px solid #f1f5f9', borderRadius: '50%' }} />
                                            <div style={{ position: 'absolute', inset: 0, border: '3px solid transparent', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                        </div>
                                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 500 }}>Loading alert config…</span>
                                    </div>
                                ) : (
                                    ['UFLS', 'UVLS', 'EMLS'].map(s => renderSchemeSection(alertConfigs.find(c => c.scheme_type === s)))
                                )}
                            </div>

                            <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowAlertConfigModal(false)} style={{ padding: '0.45rem 1.1rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins',sans-serif" }}>
                                    Done
                                </button>
                            </div>
                        </div>
                    </>
                );
            })()}

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
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Summary table view</p>
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

                {showCompareModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 20, opacity: 0, scale: 0.95 }}
                            className="glass-card"
                            style={{ width: '1200px', maxWidth: '96vw', height: '88vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
                        >
                            {/* Header */}
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Draft vs Published Comparison</h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {comparePublishedLabel
                                            ? <>Draft vs <strong>{comparePublishedLabel}</strong></>
                                            : `No active published ${schemeType} version found to compare against.`}
                                    </p>
                                </div>
                                <button onClick={() => setShowCompareModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '1.25rem 1.5rem 1.5rem', overflowY: 'auto', maxHeight: 'calc(88vh - 85px)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {compareLoading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', height: '12rem', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                                        <div style={{ position: 'relative', width: 40, height: 40 }}>
                                            <div style={{ position: 'absolute', inset: 0, border: '3px solid #f1f5f9', borderRadius: '50%' }} />
                                            <div style={{ position: 'absolute', inset: 0, border: '3px solid transparent', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                            <div style={{ position: 'absolute', inset: '8px', border: '2px solid transparent', borderTopColor: '#93c5fd', borderRadius: '50%', animation: 'spin 1.4s linear infinite reverse' }} />
                                        </div>
                                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>Loading comparison…</span>
                                    </div>
                                ) : !comparePublishedLabel ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '10rem', gap: '0.75rem' }}>
                                        <FaCodeBranch size={36} style={{ color: '#e2e8f0' }} />
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>No active published {schemeType} version to compare against.</div>
                                        <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Publish a version first before using comparison.</div>
                                    </div>
                                ) : compareRows.length === 0 ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.85rem' }}>
                                        No data to compare. Ensure the draft has bay assignments.
                                    </div>
                                ) : (
                                    <>
                                        {/* Summary counts + view toggle */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                            {Object.entries(COMP_CHANGE_META).map(([type, meta]) => {
                                                const count = compareRows.filter(r => r.changeType === type).length;
                                                return (
                                                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', background: meta.bg, border: `1px solid ${meta.border}` }}>
                                                        <span style={{ fontSize: '1rem', fontWeight: 700, color: meta.color, lineHeight: 1 }}>{count}</span>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: meta.color, whiteSpace: 'nowrap' }}>{meta.label}</span>
                                                    </div>
                                                );
                                            })}
                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                                                {[{ id: 'change-type', label: 'By Change Type' }, { id: 'stage', label: 'By Stage' }].map(opt => (
                                                    <button key={opt.id} onClick={() => setCompareGroupBy(opt.id)} style={{
                                                        padding: '6px 14px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                                                        fontFamily: "'Poppins', sans-serif", cursor: 'pointer', transition: 'all 0.15s',
                                                        background: compareGroupBy === opt.id ? '#0f172a' : '#f8fafc',
                                                        color: compareGroupBy === opt.id ? '#fff' : '#64748b',
                                                        border: compareGroupBy === opt.id ? 'none' : '1px solid #e2e8f0',
                                                    }}>{opt.label}</button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Table */}
                                        <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                            {/* Sticky header row */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 1fr 220px', gap: '0.75rem', padding: '0.6rem 1rem', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1 }}>
                                                {['Substation', 'ID', 'Region', 'Feeder', 'Change'].map((h, i) => (
                                                    <div key={i} style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                                                ))}
                                            </div>

                                            {/* Scrollable rows body */}
                                            <div style={{ overflowY: 'auto', maxHeight: 'calc(88vh - 220px)' }}>

                                            {compareGroupBy === 'change-type' ? (
                                                ['new', 'revised', 'defeated', 'unchanged'].map(ct => {
                                                    const rows = compareRows
                                                        .filter(r => r.changeType === ct)
                                                        .sort((a, b) => (a.region || '').localeCompare(b.region || '') || (a.substationId || '').localeCompare(b.substationId || ''));
                                                    if (rows.length === 0) return null;
                                                    const meta = COMP_CHANGE_META[ct];
                                                    return (
                                                        <div key={ct}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: meta.bg, borderBottom: `1px solid ${meta.border}`, borderTop: '1px solid #f1f5f9' }}>
                                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{meta.label}</span>
                                                                <span style={{ fontSize: '0.62rem', color: meta.color, opacity: 0.7 }}>{rows.length} assignment{rows.length !== 1 ? 's' : ''}</span>
                                                            </div>
                                                            {rows.map((row, i) => (
                                                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 1fr 220px', gap: '0.75rem', padding: '0.6rem 1rem', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}
                                                                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.substationName}</div>
                                                                    <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#475569', fontWeight: 500 }}>{row.substationId || '—'}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>{row.region}</div>
                                                                    <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.feeder}</div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.62rem', fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>{meta.label}</span>
                                                                        <span style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>{row.oldStageLabel || '—'} → {ct === 'defeated' ? '—' : row.stageLabel}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                (() => {
                                                    const stageGroups = new Map();
                                                    compareRows.forEach(row => {
                                                        const key = row.changeType === 'defeated' ? '__defeated__' : row.stageLabel;
                                                        if (!stageGroups.has(key)) stageGroups.set(key, { label: key, color: row.stageColor, rows: [] });
                                                        stageGroups.get(key).rows.push(row);
                                                    });
                                                    const CT_ORDER = { new: 0, revised: 1, defeated: 2, unchanged: 3 };
                                                    return [...stageGroups.entries()].map(([key, group]) => {
                                                        group.rows.sort((a, b) =>
                                                            (CT_ORDER[a.changeType] ?? 9) - (CT_ORDER[b.changeType] ?? 9) ||
                                                            (a.region || '').localeCompare(b.region || '') ||
                                                            (a.substationId || '').localeCompare(b.substationId || '')
                                                        );
                                                        return (
                                                        <div key={key}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', borderTop: '1px solid #f1f5f9' }}>
                                                                {key !== '__defeated__' && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: group.color, flexShrink: 0 }} />}
                                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: key === '__defeated__' ? '#dc2626' : '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                                    {key === '__defeated__' ? 'Defeated (Removed in draft)' : group.label}
                                                                </span>
                                                                <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{group.rows.length} assignment{group.rows.length !== 1 ? 's' : ''}</span>
                                                            </div>
                                                            {group.rows.map((row, i) => {
                                                                const meta = COMP_CHANGE_META[row.changeType];
                                                                return (
                                                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 1fr 220px', gap: '0.75rem', padding: '0.6rem 1rem', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}
                                                                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.substationName}</div>
                                                                        <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#475569', fontWeight: 500 }}>{row.substationId || '—'}</div>
                                                                        <div style={{ fontSize: '0.75rem', color: '#475569' }}>{row.region}</div>
                                                                        <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.feeder}</div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                            <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.62rem', fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>{meta.label}</span>
                                                                            <span style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>{row.oldStageLabel || '—'} → {row.changeType === 'defeated' ? '—' : row.stageLabel}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        );
                                                    });
                                                })()
                                            )}
                                            </div>{/* end scrollable rows */}
                                        </div>{/* end table */}
                                    </>
                                )}
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
                            background: 'rgba(15,23,42,0.35)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 9999
                        }}
                        onClick={e => { if (e.target === e.currentTarget) setShowCreateStageModal(false); }}
                    >
                        <motion.div
                            initial={{ y: 16, opacity: 0, scale: 0.97 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 16, opacity: 0, scale: 0.97 }}
                            transition={{ duration: 0.18 }}
                            style={{
                                width: '460px', maxWidth: '90vw',
                                background: '#fff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
                                overflow: 'hidden',
                                fontFamily: "'Poppins', sans-serif"
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Layers size={13} style={{ color: '#334155' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{editingStageIdx !== null ? 'Edit Stage' : 'New Stage'}</div>
                                        <div style={{ fontSize: '0.62rem', color: '#94a3b8', lineHeight: 1.2 }}>{editingStageIdx !== null ? 'Modify stage parameters' : 'Define the next load shedding step'}</div>
                                    </div>
                                </div>
                                <button onClick={() => setShowCreateStageModal(false)} style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', color: '#94a3b8' }} onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#334155'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}>
                                    <X size={12} />
                                </button>
                            </div>

                            {/* Body */}
                            <div style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Row: Stage No + Label + Target MW */}
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{ flex: '0 0 72px' }}>
                                        <label style={{ fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>No.</label>
                                        <input
                                            type="number"
                                            style={{ width: '100%', padding: '0.42rem 0.6rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.78rem', color: '#0f172a', fontFamily: "'Poppins', sans-serif", outline: 'none', boxSizing: 'border-box' }}
                                            value={newStageNumber}
                                            onChange={e => setNewStageNumber(Number(e.target.value))}
                                            onFocus={e => { e.target.style.borderColor = '#0f172a'; e.target.style.background = '#fff'; }}
                                            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Label</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Stage 5"
                                            style={{ width: '100%', padding: '0.42rem 0.6rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.78rem', color: '#0f172a', fontFamily: "'Poppins', sans-serif", outline: 'none', boxSizing: 'border-box' }}
                                            value={newStageLabel}
                                            onChange={e => setNewStageLabel(e.target.value)}
                                            onFocus={e => { e.target.style.borderColor = '#0f172a'; e.target.style.background = '#fff'; }}
                                            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                                        />
                                    </div>
                                    <div style={{ flex: '0 0 110px' }}>
                                        <label style={{ fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Target</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                style={{ width: '100%', padding: '0.42rem 2rem 0.42rem 0.6rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.78rem', color: '#0f172a', fontFamily: "'Poppins', sans-serif", outline: 'none', boxSizing: 'border-box' }}
                                                value={newStageTargetMW}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === '' || /^\d+$/.test(val)) setNewStageTargetMW(val === '' ? '' : parseInt(val, 10));
                                                }}
                                                onFocus={e => { e.target.style.borderColor = '#0f172a'; e.target.style.background = '#fff'; }}
                                                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                                            />
                                            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.62rem', fontWeight: 600, color: '#94a3b8', pointerEvents: 'none' }}>MW</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Settings */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8' }}>Threshold Settings</span>
                                        <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        {[0, 1].map(i => (
                                            <div key={i} style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.57rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Setting {i + 1}</label>
                                                <select
                                                    style={{ width: '100%', padding: '0.42rem 0.6rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.75rem', color: '#334155', fontFamily: "'Poppins', sans-serif", outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                                                    value={newStageSettings[i] || ''}
                                                    onChange={e => {
                                                        const updated = [...newStageSettings];
                                                        if (i === 1 && updated.length === 0) updated.push(null);
                                                        updated[i] = e.target.value || null;
                                                        setNewStageSettings(updated);
                                                    }}
                                                    onFocus={e => { e.target.style.borderColor = '#0f172a'; e.target.style.background = '#fff'; }}
                                                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                                                >
                                                    <option value="">— None —</option>
                                                    {globalSettings.filter(s => s.scheme_type === (schemeType.includes('UFLS') ? 'UFLS' : 'UVLS')).map(s => (
                                                        <option key={s.id} value={s.id}>{s.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ display: 'flex', gap: '0.6rem', padding: '0.85rem 1.25rem', borderTop: '1px solid #f1f5f9' }}>
                                <button
                                    onClick={() => setShowCreateStageModal(false)}
                                    style={{ flex: 1, padding: '0.5rem 1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', fontFamily: "'Poppins', sans-serif", cursor: 'pointer' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmAddStage}
                                    style={{ flex: 2, padding: '0.5rem 1rem', background: '#0891b2', border: '1px solid #0891b2', borderRadius: '7px', fontSize: '0.75rem', fontWeight: 600, color: '#fff', fontFamily: "'Poppins', sans-serif", cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#0e7490'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#0891b2'}
                                >
                                    {editingStageIdx !== null ? 'Save Changes' : 'Create Stage'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div >

        {/* ── Publish Change-Reason Modal ──────────────────────────────── */}
        <AnimatePresence>
            {showPublishModal && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '860px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
                    >
                        {/* Header */}
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexShrink: 0 }}>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Poppins',sans-serif" }}>
                                    Publish Requires Change Reasons
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px', fontFamily: "'Poppins',sans-serif" }}>
                                    {publishDiff.length} change{publishDiff.length !== 1 ? 's' : ''} detected vs current active version.
                                    Provide a reason for each before publishing.
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPublishModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px', borderRadius: '6px', flexShrink: 0 }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Table header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 130px 180px 1fr', gap: '0.5rem', padding: '0.5rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                            {['Change', 'Substation', 'ID', 'Stage Change', 'Reason *'].map(h => (
                                <div key={h} style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontFamily: "'Poppins',sans-serif" }}>{h}</div>
                            ))}
                        </div>

                        {/* Rows */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {publishDiff.map((row, i) => {
                                const key = `${row.substationId}||${row.feeder}||${row.changeType}`;
                                const meta = COMP_CHANGE_META[row.changeType];
                                const reason = publishReasons[key] || '';
                                const isEmpty = !reason.trim();
                                return (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 130px 180px 1fr', gap: '0.5rem', padding: '0.6rem 1.5rem', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.62rem', fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap', width: 'fit-content' }}>
                                            {meta.label}
                                        </span>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', fontFamily: "'Poppins',sans-serif" }}>{row.substationName}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>{row.feeder}</div>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#475569', fontFamily: 'monospace' }}>{row.substationId}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#475569', fontFamily: "'Poppins',sans-serif" }}>
                                            {row.oldStageLabel || '—'} → {row.changeType === 'defeated' ? '—' : (row.stageLabel || '—')}
                                        </div>
                                        <input
                                            type="text"
                                            maxLength={200}
                                            placeholder="Enter reason…"
                                            value={reason}
                                            onChange={e => setPublishReasons(prev => ({ ...prev, [key]: e.target.value }))}
                                            style={{
                                                width: '100%', padding: '5px 8px', fontSize: '0.75rem',
                                                fontFamily: "'Poppins',sans-serif",
                                                border: `1px solid ${isEmpty ? '#fca5a5' : '#cbd5e1'}`,
                                                borderRadius: '6px', outline: 'none',
                                                background: isEmpty ? '#fff7f7' : '#fff',
                                                boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 }}>
                            <button
                                onClick={() => setShowPublishModal(false)}
                                style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem', fontFamily: "'Poppins',sans-serif", fontWeight: 600, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitPublish}
                                disabled={publishing || publishDiff.some(r => !publishReasons[`${r.substationId}||${r.feeder}||${r.changeType}`]?.trim())}
                                style={{
                                    padding: '0.5rem 1.25rem', fontSize: '0.8rem', fontFamily: "'Poppins',sans-serif", fontWeight: 700,
                                    background: '#059669', color: '#fff', border: 'none', borderRadius: '8px',
                                    cursor: 'pointer', opacity: (publishing || publishDiff.some(r => !publishReasons[`${r.substationId}||${r.feeder}||${r.changeType}`]?.trim())) ? 0.5 : 1,
                                    transition: 'opacity 0.15s',
                                }}
                            >
                                {publishing ? 'Publishing…' : `Publish with ${publishDiff.length} Reason${publishDiff.length !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        </>
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
