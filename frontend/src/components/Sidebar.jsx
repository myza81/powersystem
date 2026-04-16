import React, { useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Radar,
    LayoutGrid,
    Activity,
    Boxes,
    Building2,
    ShieldAlert,
    Unplug,
    MonitorPlay,
    PencilRuler,
    Sliders,
    Terminal,
    LogOut,
    LogIn,
    User,
    Ghost,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Navigation structure ────────────────────────────────────────────────────
const NAV_GROUPS = [
    {
        id: 'grid',
        label: 'Grid',
        icon: Radar,
        items: [
            { id: 'snapshots',  label: 'Snapshot',       icon: Activity },
            { id: 'dashboard',  label: 'Load Analytics', icon: LayoutGrid },
        ],
    },
    {
        id: 'assets',
        label: 'Asset Management',
        icon: Boxes,
        items: [
            { id: 'list',                  label: 'Substation',        icon: Building2 },
            { id: 'critical-substations',  label: 'Critical Substations', icon: ShieldAlert },
        ],
    },
    {
        id: 'load-shedding',
        label: 'Load Shedding',
        icon: Unplug,
        items: [
            { id: 'load-shedding-viewer',   label: 'Viewer',   icon: MonitorPlay },
            { id: 'load-shedding-designer', label: 'Designer', icon: PencilRuler },
        ],
    },
];

const SYSTEM_ITEMS = [
    { id: 'dev-tools', label: 'Developer Tools', icon: Terminal },
];

// ── Component ───────────────────────────────────────────────────────────────
const Sidebar = ({ currentView, onViewChange, currentUser, onLogout, onShowLogin }) => {
    const [collapsed, setCollapsed] = useState(false);

    // Track which groups are open — all open by default
    const [openGroups, setOpenGroups] = useState(() =>
        Object.fromEntries(NAV_GROUPS.map(g => [g.id, true]))
    );

    const toggleGroup = (id) =>
        setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

    const navigate = (view) => onViewChange(view);

    // Returns true if any item in a group matches currentView
    const groupIsActive = (group) => group.items.some(i => i.id === currentView);

    return (
        <motion.div
            className={`sidebar ${collapsed ? 'collapsed' : ''}`}
            initial={{ width: 260 }}
            animate={{ width: collapsed ? 80 : 260 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            {/* Header */}
            <div className={`sidebar-header ${collapsed ? 'justify-center' : ''}`}>
                <div className="brand-container">
                    {!collapsed && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="logo-text">
                            <span className="logo-text-bold">Grid</span> Defence
                        </motion.div>
                    )}
                </div>
                <button
                    className="collapse-btn-floating"
                    onClick={() => setCollapsed(c => !c)}
                    title={collapsed ? 'Expand' : 'Collapse'}
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">

                {/* Main groups */}
                {NAV_GROUPS.map(group => (
                    <div key={group.id} className="nav-group">
                        <div
                            className={`nav-group-header ${collapsed ? 'collapsed' : ''} ${groupIsActive(group) ? 'group-active' : ''}`}
                            onClick={() => toggleGroup(group.id)}
                        >
                            <div className="nav-group-title">
                                <group.icon size={20} className="nav-icon" />
                                {!collapsed && <span>{group.label}</span>}
                            </div>
                            {!collapsed && (
                                <ChevronDown
                                    size={14}
                                    className={`chevron ${openGroups[group.id] ? 'open' : ''}`}
                                />
                            )}
                        </div>

                        <AnimatePresence initial={false}>
                            {openGroups[group.id] && (
                                <motion.div
                                    key="items"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    {group.items.map(item => (
                                        <a
                                            key={item.id}
                                            href={`?view=${item.id}`}
                                            className={[
                                                'nav-item sub-item',
                                                collapsed ? 'collapsed' : '',
                                                currentView === item.id ? 'active' : '',
                                            ].filter(Boolean).join(' ')}
                                            onClick={(e) => { e.preventDefault(); navigate(item.id); }}
                                            title={collapsed ? item.label : ''}
                                        >
                                            <item.icon size={16} />
                                            {!collapsed && <span className="nav-label">{item.label}</span>}
                                        </a>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}

                {/* System — pinned to bottom, always visible */}
                <div className="nav-group system-section">
                    <div className={`nav-group-header ${collapsed ? 'collapsed' : ''}`} style={{ cursor: 'default', pointerEvents: 'none' }}>
                        <div className="nav-group-title">
                            <Sliders size={20} className="nav-icon" />
                            {!collapsed && <span>System</span>}
                        </div>
                    </div>
                    {SYSTEM_ITEMS.map(item => (
                        <a
                            key={item.id}
                            href={`?view=${item.id}`}
                            className={[
                                'nav-item sub-item',
                                collapsed ? 'collapsed' : '',
                                currentView === item.id ? 'active' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={(e) => { e.preventDefault(); navigate(item.id); }}
                            title={collapsed ? item.label : ''}
                        >
                            <item.icon size={16} />
                            {!collapsed && <span className="nav-label">{item.label}</span>}
                        </a>
                    ))}
                </div>

            </nav>

            {/* Footer / User */}
            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className={`avatar ${currentUser?.is_anonymous ? 'guest' : ''}`}>
                        {currentUser?.is_anonymous
                            ? <Ghost size={18} color="var(--text-secondary)" />
                            : <User size={20} />}
                    </div>
                    {!collapsed && (
                        <div className="user-info">
                            <div className="user-name">
                                {currentUser?.is_anonymous ? 'Anonymous' : (currentUser?.username || 'Guest')}
                            </div>
                            <div className="user-role" style={currentUser?.is_anonymous ? { color: 'rgba(75, 85, 99, 0.7)' } : {}}>
                                {currentUser?.is_anonymous ? 'Guest Access' : (currentUser?.is_staff ? 'Administrator' : 'User')}
                            </div>
                        </div>
                    )}
                </div>
                {!collapsed && (
                    currentUser?.is_anonymous ? (
                        <button className="login-sidebar-btn" onClick={onShowLogin} title="Sign In">
                            <LogIn size={15} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Sign In</span>
                        </button>
                    ) : (
                        currentUser && (
                            <button className="logout-btn" onClick={onLogout} title="Logout">
                                <LogOut size={16} />
                            </button>
                        )
                    )
                )}
            </div>
        </motion.div>
    );
};

export default Sidebar;
