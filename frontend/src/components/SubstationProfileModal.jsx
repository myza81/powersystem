import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Edit2, FileText, MapPin, ChevronDown, ChevronUp,
    Copy, Check, ShieldAlert, Zap, GitBranch,
} from 'lucide-react';
import { LuCircuitBoard } from 'react-icons/lu';
import { FiAlertCircle } from 'react-icons/fi';
import { MapContainer, TileLayer, CircleMarker, Tooltip as MapTooltip, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api';
import SldViewer from './SldViewer';
import { CardLoader } from './Loader';


const SENSITIVITY_LABEL = { 1: 'Low', 2: 'Medium', 3: 'High' };
const SENSITIVITY_COLOR = { 1: '#16a34a', 2: '#d97706', 3: '#dc2626' };

// Returns a stroke/fill color based on voltage level
const voltageColor = (v) => {
    if (!v) return '#94a3b8';
    if (v >= 500) return '#334155';   // 500 kV — dark slate
    if (v >= 275) return '#0369a1';   // 275 kV — blue
    if (v >= 230) return '#b45309';   // 230 kV — amber
    return '#047d60';                  // 132 kV and below — green
};

// Fits the map viewport to include all given latlng points
const FitBounds = ({ points }) => {
    const map = useMap();
    React.useEffect(() => {
        if (points.length > 1) {
            map.fitBounds(points, { padding: [32, 32] });
        }
    }, [map, points]);
    return null;
};

// ── sub-components ───────────────────────────────────────────────────────────

const SectionLabel = ({ icon: Icon, children }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '0.7rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.09em',
        color: '#94a3b8',
        marginBottom: '8px', paddingBottom: '6px',
        borderBottom: '1px solid #f1f5f9',
        fontFamily: "'Poppins', sans-serif",
    }}>
        {Icon && <Icon size={11} />}
        {children}
    </div>
);

const InfoRow = ({ label, value, mono = false }) => {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline', padding: '3px 0',
            borderBottom: '1px solid #f8fafc',
        }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: "'Poppins', sans-serif" }}>
                {label}
            </span>
            <span style={{
                fontSize: '0.68rem', fontWeight: 600, color: '#1e293b',
                fontFamily: "'Poppins', sans-serif",
            }}>
                {value}
            </span>
        </div>
    );
};

const EmptySlot = ({ message }) => (
    <div style={{
        padding: '10px', borderRadius: '6px',
        border: '1px dashed #e2e8f0',
        textAlign: 'center',
        fontSize: '0.65rem', color: '#cbd5e1',
        fontFamily: "'Poppins', sans-serif",
    }}>
        {message}
    </div>
);

const AssetRow = ({ left, right, leftColor = '#047d60' }) => (
    <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 0', borderBottom: '1px solid #f8fafc',
    }}>
        <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: leftColor, fontWeight: 600 }}>
            {left}
        </span>
        <span style={{ fontSize: '0.62rem', color: '#64748b', fontFamily: "'Poppins', sans-serif" }}>
            {right}
        </span>
    </div>
);

// ── main component ───────────────────────────────────────────────────────────

const SubstationProfileModal = ({ substation: initialData, onClose, onEdit }) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [criticalExpanded, setCriticalExpanded] = useState(false);
    const [viewingSld, setViewingSld] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let active = true;
        setLoading(true);
        api.get(`/substations/${initialData.substation_id}/`)
            .then(res => { if (active) setDetail(res.data); })
            .catch(err => console.error('Profile fetch error:', err))
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [initialData.substation_id]);

    const sub = detail || initialData;
    const lat = parseFloat(sub.latitude);
    const lng = parseFloat(sub.longitude);
    const hasCoords = !isNaN(lat) && !isNaN(lng);

    const copyCoords = () => {
        navigator.clipboard.writeText(`${lat}, ${lng}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const loadTransformers  = detail?.load_transformers   || [];
    const autoTransformers  = detail?.auto_transformers   || [];
    const incomingBranches  = detail?.incoming_branches   || [];
    const lsRelays          = detail?.load_shedding_relays || [];
    const criticalAssets    = detail?.critical_assets     || [];

    return (
        <>
            {/* ── Outer wrapper — flex centering (same pattern as SubstationForm) ── */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem',
                }}
            >
                <motion.div
                    onClick={e => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{
                        width: '100%',
                        maxWidth: '960px',
                        maxHeight: '88vh',
                        overflowY: 'auto',
                        background: '#fff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
                        display: 'flex',
                        flexDirection: 'column',
                        fontFamily: "'Poppins', sans-serif",
                    }}
                >
                    {/* ════════ HEADER ════════ */}
                    <div style={{
                        padding: '1.25rem 1.75rem',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        background: 'linear-gradient(135deg, rgba(4,125,96,0.04), rgba(5,150,105,0.02))',
                        flexShrink: 0,
                    }}>
                        {/* Left: ID + Name + pills */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Substation ID */}
                                <span style={{
                                    fontSize: '1.1rem', fontWeight: 700,
                                    color: '#047d60', fontFamily: 'monospace', letterSpacing: '0.04em',
                                }}>
                                    {sub.substation_id}
                                </span>
                                {/* Status badges */}
                                {sub.is_critical && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                        fontSize: '0.6rem', fontWeight: 600,
                                        background: '#fef2f2', color: '#dc2626',
                                        border: '1px solid #fecaca',
                                        padding: '1px 6px', borderRadius: '4px',
                                    }}>
                                        <FiAlertCircle size={9} /> Critical
                                    </span>
                                )}
                                {sub.has_active_relay && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                        fontSize: '0.6rem', fontWeight: 600,
                                        background: '#fffbeb', color: '#d97706',
                                        border: '1px solid #fde68a',
                                        padding: '1px 6px', borderRadius: '4px',
                                    }}>
                                        <LuCircuitBoard size={9} /> Load Shed Relay
                                    </span>
                                )}
                            </div>
                            {/* Name */}
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
                                {sub.name}
                            </span>
                        </div>

                        {/* Right: Edit + Close */}
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '1rem' }}>
                            <button
                                onClick={onEdit}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    background: '#047d60', color: '#fff',
                                    border: 'none',
                                    padding: '7px 16px', borderRadius: '8px',
                                    fontSize: '0.78rem', fontWeight: 600,
                                    cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                                    boxShadow: '0 1px 4px rgba(4,125,96,0.25)',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#059669'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#047d60'; }}
                            >
                                <Edit2 size={13} /> Edit
                            </button>
                            <button
                                onClick={onClose}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    background: '#f1f5f9', color: '#64748b',
                                    border: '1px solid #e2e8f0',
                                    width: '34px', height: '34px', borderRadius: '8px',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    {/* ════════ BODY ════════ */}
                    {loading ? (
                        <div style={{ minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CardLoader show={true} message="Loading substation data…" />
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '196px 1fr 220px' }}>

                            {/* ── Col 1: Identity ── */}
                            <div style={{
                                padding: '1.25rem 1rem',
                                borderRight: '1px solid #f1f5f9',
                                display: 'flex', flexDirection: 'column', gap: '1.1rem',
                            }}>
                                <div>
                                    <SectionLabel>Technical</SectionLabel>
                                    <InfoRow label="Voltage"   value={`${sub.voltage} kV`} />
                                    <InfoRow label="Ownership" value={sub.ownership} />
                                    <InfoRow label="Grid"      value={sub.grid} />
                                    <InfoRow label="Region"    value={sub.region} />
                                    <InfoRow label="State"     value={sub.state} />
                                    <InfoRow label="Mnemonic"  value={sub.mnemonic} mono />
                                </div>

                                <div>
                                    <SectionLabel>Dates</SectionLabel>
                                    <InfoRow
                                        label="Commissioned"
                                        value={sub.commission_date
                                            ? new Date(sub.commission_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : '—'}
                                    />
                                    <InfoRow
                                        label="Last updated"
                                        value={sub.updated_at
                                            ? new Date(sub.updated_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : '—'}
                                    />
                                </div>

                                {hasCoords && (
                                    <div>
                                        <SectionLabel icon={MapPin}>Coordinates</SectionLabel>
                                        <div style={{
                                            background: '#f8fafc', border: '1px solid #e2e8f0',
                                            borderRadius: '7px', padding: '8px 10px',
                                            display: 'flex', flexDirection: 'column', gap: '2px',
                                        }}>
                                            <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#475569' }}>
                                                {lat.toFixed(6)}°N
                                            </span>
                                            <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#475569' }}>
                                                {lng.toFixed(6)}°E
                                            </span>
                                            <button
                                                onClick={copyCoords}
                                                style={{
                                                    marginTop: '6px',
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    background: copied ? '#f0fdf4' : '#f1f5f9',
                                                    color: copied ? '#047d60' : '#64748b',
                                                    border: `1px solid ${copied ? '#a7f3d0' : '#e2e8f0'}`,
                                                    borderRadius: '5px', padding: '3px 8px',
                                                    fontSize: '0.62rem', cursor: 'pointer',
                                                    fontFamily: "'Poppins', sans-serif",
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                {copied ? <Check size={10} /> : <Copy size={10} />}
                                                {copied ? 'Copied!' : 'Copy coords'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <SectionLabel icon={FileText}>SLD</SectionLabel>
                                    {sub.sld_file ? (
                                        <button
                                            onClick={() => setViewingSld(true)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                                                background: '#f0fdf4', border: '1px solid #a7f3d0',
                                                borderRadius: '7px', padding: '8px 10px',
                                                color: '#047d60', cursor: 'pointer',
                                                fontFamily: "'Poppins', sans-serif",
                                                textAlign: 'left', transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; }}
                                        >
                                            <FileText size={14} style={{ flexShrink: 0 }} />
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {sub.sld}
                                                </div>
                                                <div style={{ fontSize: '0.58rem', color: '#16a34a', marginTop: '1px' }}>Click to view full SLD</div>
                                            </div>
                                        </button>
                                    ) : (
                                        <EmptySlot message="No SLD uploaded" />
                                    )}
                                </div>
                            </div>

                            {/* ── Col 2: Map ── */}
                            <div style={{ padding: '1.25rem 1.25rem', borderRight: '1px solid #f1f5f9' }}>
                                <SectionLabel icon={MapPin}>Geographic Location</SectionLabel>
                                {hasCoords ? (
                                    <div style={{
                                        height: '340px', borderRadius: '9px',
                                        overflow: 'hidden', border: '1px solid #e2e8f0',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                    }}>
                                        <MapContainer
                                            center={[lat, lng]}
                                            zoom={12}
                                            zoomControl={true}
                                            dragging={true}
                                            touchZoom={true}
                                            doubleClickZoom={true}
                                            scrollWheelZoom={true}
                                            boxZoom={true}
                                            keyboard={true}
                                            attributionControl={false}
                                            style={{ height: '100%', width: '100%' }}
                                        >
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                            {(() => {
                                                const remotes = incomingBranches
                                                    .map(ib => ib.to_substation_detail)
                                                    .filter(d => d && d.latitude && d.longitude);
                                                const allPoints = [[lat, lng], ...remotes.map(d => [parseFloat(d.latitude), parseFloat(d.longitude)])];
                                                return (
                                                    <>
                                                        <FitBounds points={allPoints} />
                                                        {/* Lines from main substation to each remote end */}
                                                        {remotes.map((d, i) => (
                                                            <Polyline
                                                                key={i}
                                                                positions={[[lat, lng], [parseFloat(d.latitude), parseFloat(d.longitude)]]}
                                                                pathOptions={{ color: voltageColor(d.voltage), weight: 2.5, opacity: 0.75 }}
                                                            />
                                                        ))}
                                                        {/* Remote end substation markers */}
                                                        {remotes.map((d, i) => {
                                                            const vc = voltageColor(d.voltage);
                                                            return (
                                                                <CircleMarker
                                                                    key={i}
                                                                    center={[parseFloat(d.latitude), parseFloat(d.longitude)]}
                                                                    radius={7}
                                                                    pathOptions={{ color: vc, fillColor: vc, fillOpacity: 0.6, weight: 2 }}
                                                                >
                                                                    <MapTooltip direction="top" offset={[0, -10]}>
                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{d.substation_id}</span>
                                                                        {d.voltage && <span style={{ fontSize: '0.6rem', color: '#64748b' }}> · {d.voltage} kV</span>}
                                                                    </MapTooltip>
                                                                </CircleMarker>
                                                            );
                                                        })}
                                                        {/* Main substation marker — on top */}
                                                        <CircleMarker
                                                            center={[lat, lng]}
                                                            radius={9}
                                                            pathOptions={{ color: '#047d60', fillColor: '#047d60', fillOpacity: 0.85, weight: 2 }}
                                                        >
                                                            <MapTooltip permanent direction="top" offset={[0, -12]}>
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{sub.substation_id}</span>
                                                            </MapTooltip>
                                                        </CircleMarker>
                                                    </>
                                                );
                                            })()}
                                        </MapContainer>
                                    </div>
                                ) : (
                                    <EmptySlot message="No coordinates on record" />
                                )}
                            </div>

                            {/* ── Col 3: Bay Assets ── */}
                            <div style={{
                                padding: '1.25rem 1rem',
                                display: 'flex', flexDirection: 'column', gap: '1.1rem',
                                overflowY: 'auto',
                            }}>
                                {/* Load Transformers */}
                                <div>
                                    <SectionLabel icon={Zap}>
                                        Load Transformers
                                        <span style={{ marginLeft: 'auto', background: '#f1f5f9', color: '#64748b', fontSize: '0.6rem', padding: '0 5px', borderRadius: '8px' }}>
                                            {loadTransformers.length}
                                        </span>
                                    </SectionLabel>
                                    {loadTransformers.length === 0
                                        ? <EmptySlot message="None recorded" />
                                        : loadTransformers.map(lt => (
                                            <AssetRow
                                                key={lt.id}
                                                left={lt.bay_id.split('_').pop().toUpperCase()}
                                                right={`${lt.capacity_mva ? lt.capacity_mva + ' MVA · ' : ''}${lt.lv_voltage} kV`}
                                                leftColor="#047d60"
                                            />
                                        ))
                                    }
                                </div>

                                {/* Interbus Transformers */}
                                <div>
                                    <SectionLabel icon={Zap}>
                                        Interbus Transformers
                                        <span style={{ marginLeft: 'auto', background: '#f1f5f9', color: '#64748b', fontSize: '0.6rem', padding: '0 5px', borderRadius: '8px' }}>
                                            {autoTransformers.length}
                                        </span>
                                    </SectionLabel>
                                    {autoTransformers.length === 0
                                        ? <EmptySlot message="None recorded" />
                                        : autoTransformers.map(at => (
                                            <AssetRow
                                                key={at.id}
                                                left={at.bay_id}
                                                right={`${at.hv_voltage}/${at.lv_voltage} kV`}
                                                leftColor="#7c3aed"
                                            />
                                        ))
                                    }
                                </div>

                                {/* Incoming Branches */}
                                <div>
                                    <SectionLabel icon={GitBranch}>
                                        Incoming Branches
                                        <span style={{ marginLeft: 'auto', background: '#f1f5f9', color: '#64748b', fontSize: '0.6rem', padding: '0 5px', borderRadius: '8px' }}>
                                            {incomingBranches.length}
                                        </span>
                                    </SectionLabel>
                                    {incomingBranches.length === 0
                                        ? <EmptySlot message="None recorded" />
                                        : incomingBranches.map(ib => (
                                            <AssetRow
                                                key={ib.id}
                                                left={ib.bay_id}
                                                right={`→ ${ib.to_substation}`}
                                                leftColor="#ea580c"
                                            />
                                        ))
                                    }
                                </div>

                                {/* Load Shed Relay */}
                                <div>
                                    <SectionLabel icon={LuCircuitBoard}>
                                        Load Shedding Relay
                                        <span style={{ marginLeft: 'auto', background: '#f1f5f9', color: '#64748b', fontSize: '0.6rem', padding: '0 5px', borderRadius: '8px' }}>
                                            {lsRelays.length}
                                        </span>
                                    </SectionLabel>
                                    {lsRelays.length === 0
                                        ? <EmptySlot message="None recorded" />
                                        : lsRelays.map(relay => (
                                            <div key={relay.id} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '4px 0', borderBottom: '1px solid #f8fafc',
                                            }}>
                                                <span style={{ fontSize: '0.65rem', color: '#1e293b', fontFamily: "'Poppins', sans-serif" }}>
                                                    {relay.relay_name}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.58rem', fontWeight: 600,
                                                    color: relay.is_active ? '#047d60' : '#94a3b8',
                                                    background: relay.is_active ? '#f0fdf4' : '#f8fafc',
                                                    border: `1px solid ${relay.is_active ? '#a7f3d0' : '#e2e8f0'}`,
                                                    padding: '1px 6px', borderRadius: '4px',
                                                    fontFamily: "'Poppins', sans-serif",
                                                }}>
                                                    {relay.is_active ? '● Active' : '○ Off'}
                                                </span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════════ FOOTER: Critical Customers ════════ */}
                    {!loading && (
                        <div style={{ borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
                            <button
                                onClick={() => setCriticalExpanded(x => !x)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '0.75rem 1.75rem',
                                    background: criticalExpanded ? '#fef2f2' : '#fff',
                                    border: 'none',
                                    borderBottom: criticalExpanded ? '1px solid #fecaca' : 'none',
                                    color: criticalAssets.length > 0 ? '#dc2626' : '#94a3b8',
                                    cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = criticalExpanded ? '#fef2f2' : '#fff'; }}
                            >
                                <ShieldAlert size={13} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Critical Customers</span>
                                <span style={{
                                    fontSize: '0.62rem', fontWeight: 600,
                                    background: criticalAssets.length > 0 ? '#fef2f2' : '#f1f5f9',
                                    color: criticalAssets.length > 0 ? '#dc2626' : '#94a3b8',
                                    border: `1px solid ${criticalAssets.length > 0 ? '#fecaca' : '#e2e8f0'}`,
                                    padding: '0 7px', borderRadius: '10px',
                                    fontFamily: "'Poppins', sans-serif",
                                }}>
                                    {criticalAssets.length}
                                </span>
                                <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
                                    {criticalExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </span>
                            </button>

                            <AnimatePresence>
                                {criticalExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        {criticalAssets.length === 0 ? (
                                            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', fontFamily: "'Poppins', sans-serif" }}>
                                                No critical customers assigned to this substation.
                                            </div>
                                        ) : (
                                            <div style={{ padding: '0.75rem 1.75rem 1.1rem' }}>
                                                {/* Table header */}
                                                <div style={{
                                                    display: 'grid', gridTemplateColumns: '1fr 130px 160px 100px 80px 40px',
                                                    gap: '0.5rem', paddingBottom: '6px',
                                                    borderBottom: '1px solid #f1f5f9', marginBottom: '2px',
                                                }}>
                                                    {['Customer', 'Load Tx', 'Category', 'Sensitivity', 'Status', 'Docs'].map(h => (
                                                        <span key={h} style={{
                                                            fontSize: '0.58rem', fontWeight: 700,
                                                            textTransform: 'uppercase', letterSpacing: '0.08em',
                                                            color: '#94a3b8', fontFamily: "'Poppins', sans-serif",
                                                        }}>{h}</span>
                                                    ))}
                                                </div>
                                                {criticalAssets.map(ca => {
                                                    const voltGroups = (ca.load_transformers_details || []).reduce((acc, lt) => {
                                                        const v = lt.lv_voltage ? `${lt.lv_voltage}kV` : 'Unknown';
                                                        const parts = lt.bay_id.split('_');
                                                        const tx = parts[parts.length - 1].toUpperCase();
                                                        if (!acc[v]) acc[v] = [];
                                                        acc[v].push(tx);
                                                        return acc;
                                                    }, {});
                                                    const loadTxLabel = Object.entries(voltGroups)
                                                        .map(([v, txs]) => `${txs.join(', ')} ${v}`)
                                                        .join('; ') || '—';
                                                    return (
                                                    <div key={ca.id} style={{
                                                        display: 'grid', gridTemplateColumns: '1fr 130px 160px 100px 80px 40px',
                                                        gap: '0.5rem', padding: '6px 0',
                                                        borderBottom: '1px solid #f8fafc', alignItems: 'center',
                                                    }}>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#1e293b', fontFamily: "'Poppins', sans-serif" }}>
                                                            {ca.asset}
                                                        </span>
                                                        <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#475569' }}>
                                                            {loadTxLabel}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.62rem', fontWeight: 500,
                                                            background: '#f1f5f9', color: '#64748b',
                                                            padding: '1px 7px', borderRadius: '4px',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                            fontFamily: "'Poppins', sans-serif",
                                                        }}>
                                                            {ca.category_name || '—'}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.65rem', fontWeight: 600,
                                                            color: SENSITIVITY_COLOR[ca.sensitivity_impact] || '#64748b',
                                                            fontFamily: "'Poppins', sans-serif",
                                                        }}>
                                                            {SENSITIVITY_LABEL[ca.sensitivity_impact] || '—'}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '0.65rem', fontWeight: 600,
                                                            color: ca.is_inforce ? '#047d60' : '#94a3b8',
                                                            fontFamily: "'Poppins', sans-serif",
                                                        }}>
                                                            {ca.is_inforce ? '● Active' : '○ Inactive'}
                                                        </span>
                                                        <div>
                                                            {ca.source_file ? (
                                                                <a
                                                                    href={ca.source_file}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title="View source document"
                                                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '3px', borderRadius: '4px', border: '1px solid #e2e8f0', color: '#64748b', textDecoration: 'none', transition: 'all 0.15s' }}
                                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,159,67,0.08)'; e.currentTarget.style.borderColor = '#ff9f43'; e.currentTarget.style.color = '#ff9f43'; }}
                                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                                                                >
                                                                    <FileText size={12} />
                                                                </a>
                                                            ) : <span style={{ color: '#e2e8f0', fontSize: '0.65rem' }}>—</span>}
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Full SLD overlay */}
            <AnimatePresence>
                {viewingSld && (
                    <SldViewer substation={sub} onClose={() => setViewingSld(false)} />
                )}
            </AnimatePresence>
        </>
    );
};

export default SubstationProfileModal;
