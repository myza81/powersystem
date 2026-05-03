import React, { useMemo, useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (val, d = 1) => {
    if (val == null || isNaN(val)) return '0.0';
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};

// ─── Primitives ──────────────────────────────────────────────────────────────

const SectionCard = ({ title, desc, children, style = {} }) => (
    <div style={{
        background: '#fff',
        border: '1px solid #f1f5f9',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
        ...style,
    }}>
        {title && (
            <div style={{ marginBottom: '1rem' }}>
                <div style={{
                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: '#94a3b8',
                    marginBottom: desc ? '3px' : 0,
                }}>
                    {title}
                </div>
                {desc && (
                    <div style={{ fontSize: '0.67rem', color: '#b0bac7', lineHeight: 1.5 }}>
                        {desc}
                    </div>
                )}
            </div>
        )}
        {children}
    </div>
);

const HBar = ({ value, max, color = '#10b981', height = 7 }) => (
    <div style={{ background: '#f1f5f9', borderRadius: '4px', height, overflow: 'hidden', flex: 1 }}>
        <div style={{
            width: `${Math.max((value / Math.max(max, 1)) * 100, value > 0 ? 1 : 0)}%`,
            height: '100%',
            background: color,
            borderRadius: '4px',
            transition: 'width 0.5s ease',
        }} />
    </div>
);

const InfoTip = ({ text }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, cursor: 'default' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <Info size={11} style={{ color: '#94a3b8' }} />
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
                            right: 0,
                            marginBottom: '5px',
                            background: 'rgba(15, 23, 42, 0.94)',
                            border: '1px solid rgba(148, 163, 184, 0.25)',
                            padding: '5px 9px',
                            borderRadius: '5px',
                            fontSize: '0.67rem',
                            color: '#e2e8f0',
                            zIndex: 999,
                            whiteSpace: 'pre-line',
                            pointerEvents: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                            maxWidth: '220px',
                            lineHeight: '1.5',
                        }}
                    >
                        {text}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Pie chart palette ────────────────────────────────────────────────────────
const PIE_COLORS = [
    '#10b981', '#3b82f6', '#f97316', '#8b5cf6',
    '#ef4444', '#eab308', '#06b6d4', '#ec4899',
    '#14b8a6', '#a78bfa',
];

const PieChart = ({ data, size = 120 }) => {
    const total = data.reduce((s, d) => s + d.mw, 0);
    if (!total) return null;
    const cx = size / 2, cy = size / 2, r = size * 0.42;
    if (data.length === 1) {
        return (
            <svg width={size} height={size} style={{ flexShrink: 0 }}>
                <circle cx={cx} cy={cy} r={r} fill={data[0].color} />
            </svg>
        );
    }
    const slices = [];
    let cum = -Math.PI / 2;
    data.forEach((d) => {
        const sweep = (d.mw / total) * 2 * Math.PI;
        const start = cum;
        cum += sweep;
        slices.push({
            path: `M${cx},${cy}L${cx + r * Math.cos(start)},${cy + r * Math.sin(start)}A${r},${r},0,${sweep > Math.PI ? 1 : 0},1,${cx + r * Math.cos(cum)},${cy + r * Math.sin(cum)}Z`,
            fill: d.color,
        });
    });
    return (
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
            {slices.map((s, i) => (
                <path key={i} d={s.path} fill={s.fill} stroke="#fff" strokeWidth="1.5" />
            ))}
        </svg>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SchemeAnalytics = ({ allRows, substations, schemeMetrics, stageDetails = [] }) => {

    const [activeRegStageIdx, setActiveRegStageIdx] = useState(0);
    const [critStageFilter, setCritStageFilter] = useState('All');

    const subLookup = useMemo(() => {
        const m = {};
        substations.forEach(s => { m[s.substation_id] = s; });
        return m;
    }, [substations]);

    const regionTotalMWMap = useMemo(() => {
        const map = {};
        substations.forEach(s => {
            if (!s.region || s.region === '—') return;
            map[s.region] = (map[s.region] || 0) + (parseFloat(s.total_pload_mw) || 0);
        });
        return map;
    }, [substations]);

    const A = useMemo(() => {
        // Exclude pocket header rows and pocket boundary sub-rows from analytics
        const dataRows = allRows.filter(r => r.type !== 'pocket_header' && r.type !== 'pocket_boundary');

        // Build target MW lookup from stageDetails: { stageId -> target_mw }
        const stageTargetMap = {};
        stageDetails.forEach(s => { stageTargetMap[s.id] = Number(s.target_mw) || 0; });

        // ── Stage breakdown ────────────────────────────────────────────────
        const stageMap = new Map();
        dataRows.forEach(r => {
            if (!stageMap.has(r.stageId)) {
                stageMap.set(r.stageId, {
                    id: r.stageId,
                    label: r.stageLabel,
                    color: r.stageColor,
                    order: r.stageOrder,
                    mw: 0,
                    txCount: 0,
                    pocketCount: 0,
                    threshold1: r.threshold1,
                    delay1: r.delay1,
                    targetMW: stageTargetMap[r.stageId] || 0,
                });
            }
            const s = stageMap.get(r.stageId);
            s.mw += r.mw != null ? Number(r.mw) : 0;
            if (r.type === 'transformer') s.txCount++;
            else s.pocketCount++;
        });
        const stages = [...stageMap.values()].sort((a, b) => a.order - b.order);
        let cum = 0;
        stages.forEach(s => { cum += s.mw; s.cumMW = cum; });
        const maxStageMW = Math.max(...stages.map(s => s.mw), 1);

        // ── Asset type split ───────────────────────────────────────────────
        const txRows = dataRows.filter(r => r.type === 'transformer');
        const pocketRows = dataRows.filter(r => r.type === 'pocket');
        const txMW = txRows.reduce((sum, r) => sum + (r.mw != null ? Number(r.mw) : 0), 0);
        const pocketMW = pocketRows.reduce((sum, r) => sum + (r.mw != null ? Number(r.mw) : 0), 0);

        // ── Regional distribution ──────────────────────────────────────────
        const regionMap = new Map();
        dataRows.forEach(r => {
            if (!r.region || r.region === '—') return;
            if (!regionMap.has(r.region)) regionMap.set(r.region, { mw: 0, count: 0, critCount: 0 });
            const d = regionMap.get(r.region);
            d.mw += r.mw != null ? Number(r.mw) : 0;
            d.count++;
            if (r.isCritical) d.critCount++;
        });
        const regions = [...regionMap.entries()]
            .map(([name, d]) => ({ name, ...d }))
            .sort((a, b) => b.mw - a.mw);
        const maxRegionMW = Math.max(...regions.map(r => r.mw), 1);

        // ── Grid distribution ──────────────────────────────────────────────
        const gridMap = new Map();
        dataRows.forEach(r => {
            if (!r.grid || r.grid === '—') return;
            if (!gridMap.has(r.grid)) gridMap.set(r.grid, { mw: 0, count: 0 });
            const d = gridMap.get(r.grid);
            d.mw += r.mw != null ? Number(r.mw) : 0;
            d.count++;
        });
        const grids = [...gridMap.entries()]
            .map(([name, d]) => ({ name, ...d }))
            .sort((a, b) => b.mw - a.mw);
        const maxGridMW = Math.max(...grids.map(g => g.mw), 1);

        // ── Voltage distribution ───────────────────────────────────────────
        const voltMap = new Map();
        dataRows.forEach(r => {
            const v = r.voltage && r.voltage !== '—' ? String(r.voltage) : 'Unknown';
            if (!voltMap.has(v)) voltMap.set(v, { mw: 0, count: 0 });
            const d = voltMap.get(v);
            d.mw += r.mw != null ? Number(r.mw) : 0;
            d.count++;
        });
        const voltages = [...voltMap.entries()]
            .map(([kv, d]) => ({ kv, ...d }))
            .filter(v => String(v.kv) !== '230')
            .sort((a, b) => (Number(b.kv) || 0) - (Number(a.kv) || 0));
        const maxVoltMW = Math.max(...voltages.map(v => v.mw), 1);

        // ── Critical substation exposure ───────────────────────────────────
        const critRows = dataRows.filter(r => r.isCritical);
        const critMW = critRows.reduce((sum, r) => sum + (r.mw != null ? Number(r.mw) : 0), 0);
        const critStageMap = new Map();
        critRows.forEach(r => {
            if (!critStageMap.has(r.stageId)) {
                critStageMap.set(r.stageId, { stageId: r.stageId, label: r.stageLabel, color: r.stageColor, stageOrder: r.stageOrder, count: 0, mw: 0 });
            }
            const s = critStageMap.get(r.stageId);
            s.count++;
            s.mw += r.mw != null ? Number(r.mw) : 0;
        });
        const critByStage = [...critStageMap.values()];

        // ── Duplicate assignment detection ──────────────────────────────────
        // A problem occurs when the exact same substation + feeder combination
        // appears in more than one stage. The same substation with different
        // feeders (e.g. "11kV T1" in Stage 1 and "MSWK132 1" in Stage 3) is valid.
        const assignmentStageMap = new Map(); // "substationId|feeder" -> [{ stageId, stageLabel, stageColor, mw, feeder, substationName, region }]
        dataRows.forEach(r => {
            if (!r.substationId || !r.feeder || r.feeder === '—') return;
            const key = `${r.substationId}|${r.feeder}`;
            if (!assignmentStageMap.has(key)) assignmentStageMap.set(key, []);
            assignmentStageMap.get(key).push({
                stageId: r.stageId,
                stageLabel: r.stageLabel,
                stageColor: r.stageColor,
                mw: r.mw != null ? Number(r.mw) : 0,
                feeder: r.feeder,
                substationName: r.substationName,
                region: r.region,
            });
        });
        const duplicates = [];
        assignmentStageMap.forEach((entries, key) => {
            const uniqueStageIds = new Set(entries.map(e => e.stageId));
            if (uniqueStageIds.size > 1) {
                duplicates.push({
                    substationName: entries[0].substationName,
                    region: entries[0].region,
                    feeder: entries[0].feeder,
                    entries,
                });
            }
        });
        duplicates.sort((a, b) => a.substationName.localeCompare(b.substationName));

        // ── Region color map (consistent color per region name across all stages) ──
        const regionColorMap = {};
        regions.forEach((r, i) => { regionColorMap[r.name] = PIE_COLORS[i % PIE_COLORS.length]; });

        // ── Per-stage regional distribution ────────────────────────────────────────
        const stageRegionData = stages.map(stage => {
            const rMap = new Map();
            dataRows.filter(r => r.stageId === stage.id).forEach(r => {
                if (!r.region || r.region === '—') return;
                if (!rMap.has(r.region)) rMap.set(r.region, { mw: 0, count: 0 });
                const d = rMap.get(r.region);
                d.mw += r.mw != null ? Number(r.mw) : 0;
                d.count++;
            });
            return {
                stage,
                data: [...rMap.entries()]
                    .map(([name, d]) => ({ name, ...d, color: regionColorMap[name] || '#94a3b8' }))
                    .sort((a, b) => b.mw - a.mw),
            };
        });

        return {
            stages, maxStageMW,
            txRows, pocketRows, txMW, pocketMW,
            totalAssignments: dataRows.length,
            regions, maxRegionMW,
            grids, maxGridMW,
            voltages, maxVoltMW,
            critRows, critMW, critByStage,
            duplicates,
            stageRegionData,
        };
    }, [allRows, subLookup]);

    const {
        stages, maxStageMW,
        txRows, pocketRows, txMW, pocketMW, totalAssignments,
        regions, maxRegionMW,
        grids, maxGridMW,
        voltages, maxVoltMW,
        critRows, critMW, critByStage,
        duplicates,
        stageRegionData,
    } = A;

    const totalGridMW = useMemo(
        () => substations.reduce((sum, s) => sum + (parseFloat(s.total_pload_mw) || 0), 0),
        [substations]
    );
    const gridCoveragePct = totalGridMW > 0 ? (schemeMetrics.totalMW / totalGridMW) * 100 : 0;

    const critPct = schemeMetrics.totalMW > 0
        ? ((critMW / schemeMetrics.totalMW) * 100).toFixed(1)
        : '0.0';

    // SVG donut for asset split
    const DONUT_R = 36;
    const CIRC = 2 * Math.PI * DONUT_R;
    const txFrac = (txMW + pocketMW) > 0 ? txMW / (txMW + pocketMW) : 0;

    // ── Stat cards ─────────────────────────────────────────────────────────
    const statCards = [
        {
            label: 'Total Shed Capacity',
            value: `${fmt(schemeMetrics.totalMW)} MW`,
            sub: 'Total load MW assigned',
            accent: '#10b981',
        },
        {
            label: 'Stages',
            value: stages.length,
            sub: 'Frequency thresholds',
            accent: '#3b82f6',
        },
        {
            label: 'Total Assignments',
            value: totalAssignments,
            sub: `${txRows.length} TX Bay · ${pocketRows.length} Pocket`,
            accent: '#8b5cf6',
        },
        {
            label: 'Critical Subs Exposed',
            value: critRows.length,
            sub: critRows.length > 0 ? `${fmt(critMW)} MW · ${critPct}% of total` : 'None assigned',
            accent: critRows.length > 0 ? '#ef4444' : '#10b981',
        },
        {
            label: 'Regions Covered',
            value: regions.length,
            sub: `${grids.length} grid${grids.length !== 1 ? 's' : ''}`,
            accent: '#f97316',
        },
        {
            label: 'Grid Coverage',
            value: `${gridCoveragePct.toFixed(1)}%`,
            sub: `${fmt(schemeMetrics.totalMW)} of ${fmt(totalGridMW)} MW`,
            accent: '#f97316',
        },
    ];

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div style={{ fontFamily: "'Poppins', sans-serif", padding: '1.5rem 0 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* ── Panel 1: Stat Cards ───────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
                {statCards.map(card => (
                    <div key={card.label} style={{
                        background: '#fff',
                        border: '1px solid #f1f5f9',
                        borderTop: `3px solid ${card.accent}`,
                        borderRadius: '12px',
                        padding: '1rem 1.25rem',
                        boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
                    }}>
                        <div style={{
                            fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.07em', color: '#94a3b8', marginBottom: '0.5rem',
                        }}>
                            {card.label}
                        </div>
                        <div style={{
                            fontSize: '1.5rem', fontWeight: 700, color: '#0f172a',
                            letterSpacing: '-0.02em', lineHeight: 1.1,
                        }}>
                            {card.value}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px' }}>
                            {card.sub}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Panel 2: Stage MW Breakdown ──────────────────────────── */}
            <SectionCard title="Stage MW Breakdown" desc="MW quantum assigned per stage, showing how load shedding is distributed across frequency thresholds relative to each stage's target.">
                {stages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', padding: '1rem' }}>No stage data</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {stages.map(stage => (
                            <div key={stage.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '5px' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#334155', flex: 1 }}>
                                        {stage.label}
                                    </span>
                                    <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                                        {[
                                            stage.txCount > 0 ? `${stage.txCount} TX` : null,
                                            stage.pocketCount > 0 ? `${stage.pocketCount} Pocket` : null,
                                        ].filter(Boolean).join(' · ')}
                                    </span>
                                    {stage.threshold1 && stage.threshold1 !== '—' && (
                                        <span style={{ fontSize: '0.6rem', color: '#cbd5e1', fontFamily: 'monospace', flexShrink: 0 }}>
                                            {stage.threshold1} Hz
                                        </span>
                                    )}
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', minWidth: '70px', textAlign: 'right' }}>
                                        {fmt(stage.mw)} MW
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <HBar
                                        value={stage.mw}
                                        max={stage.targetMW > 0 ? stage.targetMW : maxStageMW}
                                        color={stage.targetMW > 0 && stage.mw > stage.targetMW ? '#ef4444' : stage.color}
                                        height={8}
                                    />
                                    <span style={{
                                        fontSize: '0.58rem',
                                        color: stage.targetMW > 0 && stage.mw > stage.targetMW ? '#ef4444' : '#cbd5e1',
                                        flexShrink: 0,
                                        minWidth: '36px',
                                        textAlign: 'right',
                                        fontWeight: stage.targetMW > 0 && stage.mw > stage.targetMW ? 700 : 400,
                                    }}>
                                        {stage.targetMW > 0
                                            ? `${((stage.mw / stage.targetMW) * 100).toFixed(0)}%`
                                            : `${((stage.mw / maxStageMW) * 100).toFixed(0)}%`}
                                    </span>
                                    <InfoTip text={
                                        stage.targetMW > 0
                                            ? `Assigned ÷ Target × 100\n${fmt(stage.mw)} ÷ ${fmt(stage.targetMW)} MW = ${((stage.mw / stage.targetMW) * 100).toFixed(1)}%`
                                            : `No target set — shown relative\nto highest stage (${fmt(maxStageMW)} MW)`
                                    } />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {/* ── Panel 3: Asset Type Split + Voltage Distribution ──────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

                {/* Asset Type Donut */}
                <SectionCard title="Assignment Type Distribution" desc="Proportion of total assigned MW coming from transformer bay (TX) assignments versus network pocket assignments.">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>

                        {/* SVG Donut */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <svg width="90" height="90" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
                                <circle cx="45" cy="45" r={DONUT_R} fill="none" stroke="#f1f5f9" strokeWidth="11" />
                                {/* TX Bay arc */}
                                <circle
                                    cx="45" cy="45" r={DONUT_R} fill="none"
                                    stroke="#3b82f6" strokeWidth="11"
                                    strokeDasharray={`${txFrac * CIRC} ${CIRC}`}
                                    strokeLinecap="butt"
                                />
                                {/* Pocket arc */}
                                <circle
                                    cx="45" cy="45" r={DONUT_R} fill="none"
                                    stroke="#10b981" strokeWidth="11"
                                    strokeDasharray={`${(1 - txFrac) * CIRC} ${CIRC}`}
                                    strokeDashoffset={`-${txFrac * CIRC}`}
                                    strokeLinecap="butt"
                                />
                            </svg>
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{totalAssignments}</span>
                                <span style={{ fontSize: '0.52rem', color: '#94a3b8', letterSpacing: '0.05em' }}>TOTAL</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: '#3b82f6', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#334155' }}>TX Bay</span>
                                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: 'auto' }}>{txRows.length}</span>
                                </div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', paddingLeft: '16px' }}>
                                    {fmt(txMW)} MW
                                </div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: '#10b981', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#334155' }}>Network Pocket</span>
                                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: 'auto' }}>{pocketRows.length}</span>
                                </div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', paddingLeft: '16px' }}>
                                    {fmt(pocketMW)} MW
                                </div>
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* Voltage Distribution */}
                <SectionCard title="Voltage Level Distribution" desc="Breakdown of assigned MW by the load voltage level of each assignment, indicating which voltage tiers carry the most shedding load.">
                    {voltages.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', padding: '1rem' }}>No data</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {voltages.map(v => (
                                <div key={v.kv} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 72px', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#475569' }}>
                                        {v.kv !== 'Unknown' ? `${v.kv} kV` : 'Unknown'}
                                    </span>
                                    <HBar value={v.mw} max={maxVoltMW} color="#8b5cf6" />
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#0f172a' }}>{fmt(v.mw)} MW</div>
                                        <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>{v.count} assign.</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* ── Panel 4: Regional Distribution + Regional by Stage ───── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

                <SectionCard title="Regional Distribution" desc="Total MW assigned per region, highlighting how shedding load is spread geographically across the grid.">
                    {regions.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', padding: '1rem' }}>No data</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {regions.map(r => (
                                <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 72px', gap: '8px', alignItems: 'center' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {r.name}
                                        </div>
                                        {r.critCount > 0 && (
                                            <div style={{ fontSize: '0.58rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                <AlertCircle size={9} />
                                                {r.critCount} critical
                                            </div>
                                        )}
                                    </div>
                                    <HBar value={r.mw} max={maxRegionMW} color="#10b981" />
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#0f172a' }}>{fmt(r.mw)} MW</div>
                                        <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>{r.count} assign.</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                <SectionCard
                    title="Regional Distribution by Stage"
                    desc="MW share per region for each stage — select a stage to see how shedding load is distributed geographically within that frequency threshold."
                >
                    {stages.length === 0 || !stageRegionData.some(s => s.data.length > 0) ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', padding: '1rem' }}>No data</div>
                    ) : (
                        <>
                            {/* Stage selector buttons */}
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                                {stages.map((stage, i) => {
                                    const isActive = i === activeRegStageIdx;
                                    return (
                                        <button
                                            key={stage.id}
                                            onClick={() => setActiveRegStageIdx(i)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                padding: '4px 10px',
                                                border: `1.5px solid ${isActive ? stage.color : '#e2e8f0'}`,
                                                borderRadius: '6px',
                                                background: isActive ? `${stage.color}18` : '#f8fafc',
                                                cursor: 'pointer',
                                                fontSize: '0.65rem',
                                                fontWeight: isActive ? 700 : 500,
                                                color: isActive ? stage.color : '#64748b',
                                                transition: 'all 0.15s ease',
                                                fontFamily: "'Poppins', sans-serif",
                                            }}
                                        >
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: stage.color, display: 'inline-block', flexShrink: 0 }} />
                                            {stage.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Pie chart + legend for the active stage */}
                            {(() => {
                                const { data } = stageRegionData[activeRegStageIdx] || { data: [] };
                                if (!data.length) return (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', padding: '1rem' }}>
                                        No regional data for this stage
                                    </div>
                                );
                                const total = data.reduce((s, d) => s + d.mw, 0);
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>

                                        {/* Metric legend header */}
                                        <div style={{ display: 'flex', gap: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <div style={{ width: 16, height: 4, borderRadius: '2px', background: '#3b82f6', flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#64748b' }}>Stage share</span>
                                                <InfoTip text={`% = Region MW ÷ Stage Total MW × 100\n\nHow much of this stage's total shed load comes from this region.`} />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <div style={{ width: 16, height: 4, borderRadius: '2px', background: '#f97316', flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#64748b' }}>Grid coverage</span>
                                                <InfoTip text={`% = Region MW (shed) ÷ Region Total Grid MW × 100\n\nWhat fraction of this region's total grid load is shed by this stage.`} />
                                            </div>
                                        </div>

                                        {/* Region rows */}
                                        {data.map(r => {
                                            const stagePct = total > 0 ? (r.mw / total) * 100 : 0;
                                            const regionTotal = regionTotalMWMap[r.name] || 0;
                                            const coveragePct = regionTotal > 0 ? (r.mw / regionTotal) * 100 : null;
                                            return (
                                                <div key={r.name} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: '2px', background: r.color, flexShrink: 0 }} />
                                                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {r.name}
                                                            </span>
                                                        </div>
                                                        <span style={{ fontSize: '0.66rem', fontWeight: 600, color: '#10b981', flexShrink: 0 }}>
                                                            {fmt(r.mw)} MW
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '66px 1fr 36px', gap: '5px', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.57rem', color: '#94a3b8' }}>Stage share</span>
                                                        <HBar value={stagePct} max={100} color="#3b82f6" height={5} />
                                                        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{stagePct.toFixed(1)}%</span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '66px 1fr 36px', gap: '5px', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.57rem', color: '#94a3b8' }}>Grid cover</span>
                                                        <HBar value={coveragePct || 0} max={100} color="#f97316" height={5} />
                                                        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: coveragePct != null ? '#f97316' : '#94a3b8', textAlign: 'right' }}>
                                                            {coveragePct != null ? `${coveragePct.toFixed(1)}%` : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </SectionCard>
            </div>

            {/* ── Panel 5a: Grid Distribution + Critical MW per Stage ───── */}
            <div style={{ display: 'grid', gridTemplateColumns: critByStage.length > 0 ? '1fr 1fr' : '1fr', gap: '1.25rem' }}>

                <SectionCard title="Grid Distribution" desc="Total MW assigned per grid zone, showing the shedding load contribution from each transmission grid.">
                    {grids.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', padding: '1rem' }}>No data</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {grids.map(g => (
                                <div key={g.name} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 72px', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {g.name}
                                    </span>
                                    <HBar value={g.mw} max={maxGridMW} color="#f97316" />
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#0f172a' }}>{fmt(g.mw)} MW</div>
                                        <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>{g.count} assign.</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {critByStage.length > 0 && (
                    <SectionCard title="Critical Substation MW by Stage" desc="For each stage, the portion of its assigned MW that belongs to critical substations — indicates the risk exposure if that stage is triggered.">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {critByStage
                                .slice()
                                .sort((a, b) => a.stageOrder - b.stageOrder)
                                .map((s, i) => {
                                    const stageTotalMW = stages.find(st => st.id === s.stageId)?.mw || 0;
                                    const pct = stageTotalMW > 0 ? ((s.mw / stageTotalMW) * 100).toFixed(1) : '0.0';
                                    return (
                                        <div key={i}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '5px' }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#334155', flex: 1 }}>
                                                    {s.label}
                                                </span>
                                                <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                                                    {s.count} sub{s.count !== 1 ? 's' : ''}
                                                </span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', minWidth: '70px', textAlign: 'right' }}>
                                                    {fmt(s.mw)} MW
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <HBar value={s.mw} max={stageTotalMW} color={s.color} height={8} />
                                                <span style={{ fontSize: '0.58rem', color: '#cbd5e1', flexShrink: 0, minWidth: '36px', textAlign: 'right' }}>
                                                    {pct}%
                                                </span>
                                                <InfoTip text={`Critical MW ÷ Stage total MW × 100\n${fmt(s.mw)} ÷ ${fmt(stageTotalMW)} MW = ${pct}%`} />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </SectionCard>
                )}
            </div>

            {/* ── Panel 5: Critical Substation Exposure ────────────────── */}
            <SectionCard title="Critical Substation Exposure" desc="Lists critical substations included in this scheme by stage. Select a stage to filter, or view all at once.">
                {critRows.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '1.25rem',
                        color: '#10b981', fontSize: '0.82rem', fontWeight: 500,
                        background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                    }}>
                        ✓ No critical substations are assigned to this scheme
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                        {/* Summary strip */}
                        <div style={{
                            display: 'flex', gap: '2rem', flexWrap: 'wrap',
                            padding: '0.75rem 1rem',
                            background: 'rgba(239, 68, 68, 0.05)',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            borderRadius: '8px',
                        }}>
                            {[
                                { label: 'Assignments', val: critRows.length },
                                { label: 'MW at Risk', val: `${fmt(critMW)} MW` },
                                { label: 'Stages Affected', val: critByStage.length },
                                { label: '% of Total MW', val: `${critPct}%` },
                            ].map(item => (
                                <div key={item.label}>
                                    <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                                        {item.label}
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444', lineHeight: 1.2 }}>
                                        {item.val}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Stage filter buttons */}
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {/* All Stages button */}
                            {(() => {
                                const isActive = critStageFilter === 'All';
                                return (
                                    <button
                                        onClick={() => setCritStageFilter('All')}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                            padding: '4px 10px',
                                            border: `1.5px solid ${isActive ? '#64748b' : '#e2e8f0'}`,
                                            borderRadius: '6px',
                                            background: isActive ? '#f1f5f9' : '#f8fafc',
                                            cursor: 'pointer',
                                            fontSize: '0.65rem',
                                            fontWeight: isActive ? 700 : 500,
                                            color: isActive ? '#334155' : '#94a3b8',
                                            fontFamily: "'Poppins', sans-serif",
                                        }}
                                    >
                                        All Stages
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            minWidth: '16px', height: '16px', padding: '0 3px',
                                            borderRadius: '999px',
                                            background: isActive ? '#64748b' : '#e2e8f0',
                                            color: isActive ? '#fff' : '#94a3b8',
                                            fontSize: '0.55rem', fontWeight: 700,
                                        }}>
                                            {critRows.length}
                                        </span>
                                    </button>
                                );
                            })()}
                            {/* Per-stage buttons */}
                            {critByStage.slice().sort((a, b) => a.stageOrder - b.stageOrder).map(s => {
                                const isActive = critStageFilter === s.stageId;
                                return (
                                    <button
                                        key={s.stageId}
                                        onClick={() => setCritStageFilter(s.stageId)}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                            padding: '4px 10px',
                                            border: `1.5px solid ${isActive ? s.color : '#e2e8f0'}`,
                                            borderRadius: '6px',
                                            background: isActive ? `${s.color}18` : '#f8fafc',
                                            cursor: 'pointer',
                                            fontSize: '0.65rem',
                                            fontWeight: isActive ? 700 : 500,
                                            color: isActive ? s.color : '#64748b',
                                            fontFamily: "'Poppins', sans-serif",
                                        }}
                                    >
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                                        {s.label}
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            minWidth: '16px', height: '16px', padding: '0 3px',
                                            borderRadius: '999px',
                                            background: isActive ? s.color : '#e2e8f0',
                                            color: isActive ? '#fff' : '#94a3b8',
                                            fontSize: '0.55rem', fontWeight: 700,
                                        }}>
                                            {s.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Table */}
                        {(() => {
                            const visibleRows = critStageFilter === 'All'
                                ? critRows
                                : critRows.filter(r => r.stageId === critStageFilter);
                            const activeStage = critStageFilter !== 'All'
                                ? critByStage.find(s => s.stageId === critStageFilter)
                                : null;
                            return (
                                <div style={{ borderRadius: '8px', overflow: 'hidden', border: `1px solid ${activeStage ? `${activeStage.color}44` : '#f1f5f9'}` }}>
                                    {/* Header */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.2fr 0.8fr 0.6fr 0.6fr',
                                        gap: '0.5rem', padding: '0.45rem 0.75rem',
                                        background: activeStage ? `${activeStage.color}10` : '#f8fafc',
                                        borderBottom: `1px solid ${activeStage ? `${activeStage.color}30` : '#f1f5f9'}`,
                                    }}>
                                        {['Substation', 'Feeder Bay', 'Voltage', 'Stage', 'Region', 'MW'].map(h => (
                                            <div key={h} style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                                                {h}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Rows */}
                                    {visibleRows.length === 0 ? (
                                        <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                                            No critical substations in this stage.
                                        </div>
                                    ) : visibleRows.map((r, i) => (
                                        <div key={i} style={{
                                            display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.2fr 0.8fr 0.6fr 0.6fr',
                                            gap: '0.5rem', padding: '0.5rem 0.75rem',
                                            background: i % 2 === 0 ? '#fff' : '#fafafa',
                                            borderBottom: i < visibleRows.length - 1 ? '1px solid #f8fafc' : 'none',
                                            alignItems: 'center',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                                                <AlertCircle size={11} style={{ color: '#ef4444', flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {r.substationName}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {r.feeder || '—'}
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: '#475569' }}>
                                                {r.voltage && r.voltage !== '—' ? `${r.voltage} kV` : '—'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.stageColor, flexShrink: 0 }} />
                                                <span style={{ fontSize: '0.65rem', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {r.stageLabel}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: '#475569' }}>{r.region}</div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#10b981' }}>
                                                {r.mw != null ? fmt(r.mw) : '—'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </SectionCard>

            {/* ── Panel 6: Duplicate Substation Detection ──────────────── */}
            {duplicates.length > 0 && (
                <SectionCard title="Duplicate Substation Assignments" desc="Detects cases where the same substation and feeder appears in more than one stage, which may cause incorrect shedding behaviour." style={{ border: '1px solid #fecaca' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                        {/* Warning banner */}
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                            background: '#fef2f2', border: '1px solid #fecaca',
                            borderRadius: '8px', padding: '0.65rem 0.9rem',
                        }}>
                            <AlertCircle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b91c1c', marginBottom: '2px' }}>
                                    {duplicates.length} assignment{duplicates.length > 1 ? 's' : ''} found in more than one stage
                                </div>
                                <div style={{ fontSize: '0.67rem', color: '#dc2626', lineHeight: 1.5 }}>
                                    The same substation + feeder pair should only appear in a single stage. These conflicts may cause unreliable shedding behaviour. Please review and remove the duplicate assignments.
                                </div>
                            </div>
                        </div>

                        {/* Duplicate table */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {/* Header */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 2fr',
                                gap: '0.5rem', padding: '0 0.75rem',
                            }}>
                                {['Substation', 'Feeder', 'Region', 'Conflicting Stages'].map(h => (
                                    <span key={h} style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>{h}</span>
                                ))}
                            </div>

                            {duplicates.map((dup, i) => (
                                <div key={i} style={{
                                    display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 2fr',
                                    gap: '0.5rem', padding: '0.5rem 0.75rem',
                                    background: '#fff5f5', border: '1px solid #fecaca',
                                    borderRadius: '6px', alignItems: 'start',
                                }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {dup.substationName}
                                    </span>
                                    <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {dup.feeder}
                                    </span>
                                    <span style={{ fontSize: '0.68rem', color: '#475569' }}>
                                        {dup.region || '—'}
                                    </span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {[...new Map(dup.entries.map(e => [e.stageId, e])).values()].map(e => (
                                            <span key={e.stageId} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                background: `${e.stageColor}18`,
                                                border: `1px solid ${e.stageColor}55`,
                                                borderRadius: '4px', padding: '1px 6px',
                                                fontSize: '0.62rem', fontWeight: 600, color: e.stageColor,
                                                whiteSpace: 'nowrap',
                                            }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.stageColor, display: 'inline-block', flexShrink: 0 }} />
                                                {e.stageLabel}
                                                <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {fmt(e.mw)} MW</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </SectionCard>
            )}

        </div>
    );
};

export default SchemeAnalytics;
