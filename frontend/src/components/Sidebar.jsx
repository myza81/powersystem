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
            { id: 'snapshots',  label: 'Snapshot',       icon: Activity,    requiresStaff: true },
            { id: 'dashboard',  label: 'Load Analytics', icon: LayoutGrid },
        ],
    },
    {
        id: 'assets',
        label: 'Asset Management',
        icon: Boxes,
        items: [
            { id: 'list',                  label: 'Substation',           icon: Building2 },
            { id: 'critical-substations',  label: 'Critical Substations', icon: ShieldAlert },
        ],
    },
    {
        id: 'load-shedding',
        label: 'Load Shedding',
        icon: Unplug,
        items: [
            { id: 'load-shedding-viewer',   label: 'Viewer',   icon: MonitorPlay },
            { id: 'load-shedding-designer', label: 'Designer', icon: PencilRuler, requiresStaff: true },
        ],
    },
];

const SYSTEM_ITEMS = [
    { id: 'dev-tools', label: 'Developer Tools', icon: Terminal, requiresAdmin: true },
];

// ── Component ───────────────────────────────────────────────────────────────
const Sidebar = ({ currentView, onViewChange, currentUser, onLogout, onShowLogin, mobileOpen, onMobileClose }) => {
    const [collapsed, setCollapsed] = useState(false);
    const isMobile = mobileOpen !== undefined;

    const isStaff = currentUser?.is_staff || currentUser?.is_superuser || false;
    const isAdmin = currentUser?.is_superuser || false;

    const canSeeItem = (item) => {
        if (item.requiresAdmin) return isAdmin;
        if (item.requiresStaff) return isStaff;
        return true;
    };

    const [openGroups, setOpenGroups] = useState(() =>
        Object.fromEntries(NAV_GROUPS.map(g => [g.id, true]))
    );

    const toggleGroup = (id) =>
        setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

    const navigate = (view) => {
        onViewChange(view);
        if (onMobileClose) onMobileClose();
    };

    const userRoleLabel = () => {
        if (currentUser?.is_anonymous) return 'Guest Access';
        if (currentUser?.is_superuser) return 'Administrator';
        if (currentUser?.is_staff) return 'Staff';
        return 'User';
    };

    const effectiveCollapsed = isMobile ? false : collapsed;
    const sidebarWidth = effectiveCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)';

    return (
        <>
            {/* Mobile backdrop */}
            {isMobile && (
                <div
                    className={`sidebar-backdrop ${mobileOpen ? 'visible' : ''}`}
                    onClick={onMobileClose}
                />
            )}

            <motion.div
                className={`sidebar ${isMobile ? (mobileOpen ? 'mobile-open' : '') : ''}`}
                initial={false}
                animate={{ width: sidebarWidth }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                style={{ minWidth: sidebarWidth }}
            >
                {/* Header */}
                <div className={`sidebar-header ${effectiveCollapsed ? 'justify-center' : ''}`}>
                    <div className="brand-container">
                        {!effectiveCollapsed && (
                            <motion.div
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.18 }}
                                className="logo-text"
                            >
                                <span className="logo-text-bold">Grid</span> Defence
                            </motion.div>
                        )}
                    </div>
                    {!isMobile && (
                        <button
                            className="collapse-btn-floating"
                            onClick={() => setCollapsed(c => !c)}
                            title={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {effectiveCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {NAV_GROUPS.map(group => (
                        <div key={group.id} className="nav-group">
                            <div
                                className={`nav-group-header ${effectiveCollapsed ? 'collapsed' : ''}`}
                                onClick={() => !effectiveCollapsed && toggleGroup(group.id)}
                                title={effectiveCollapsed ? group.label : ''}
                            >
                                <div className="nav-group-title">
                                    <group.icon size={14} className="nav-icon" />
                                    {!effectiveCollapsed && <span>{group.label}</span>}
                                </div>
                                {!effectiveCollapsed && (
                                    <ChevronDown
                                        size={12}
                                        className={`chevron ${openGroups[group.id] ? 'open' : ''}`}
                                    />
                                )}
                            </div>

                            <AnimatePresence initial={false}>
                                {(openGroups[group.id] || effectiveCollapsed) && (
                                    <motion.div
                                        key="items"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.16 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        {group.items.filter(canSeeItem).map(item => (
                                            <a
                                                key={item.id}
                                                href={`?view=${item.id}`}
                                                className={[
                                                    'nav-item sub-item',
                                                    effectiveCollapsed ? 'collapsed' : '',
                                                    currentView === item.id ? 'active' : '',
                                                ].filter(Boolean).join(' ')}
                                                onClick={(e) => { e.preventDefault(); navigate(item.id); }}
                                                title={effectiveCollapsed ? item.label : ''}
                                            >
                                                <item.icon size={15} className="nav-icon" />
                                                {!effectiveCollapsed && (
                                                    <span className="nav-label">{item.label}</span>
                                                )}
                                            </a>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}

                    {/* System section */}
                    {SYSTEM_ITEMS.some(canSeeItem) && (
                        <div className="nav-group system-section">
                            <div
                                className={`nav-group-header ${effectiveCollapsed ? 'collapsed' : ''}`}
                                style={{ cursor: 'default', pointerEvents: 'none' }}
                            >
                                <div className="nav-group-title">
                                    <Sliders size={14} className="nav-icon" />
                                    {!effectiveCollapsed && <span>System</span>}
                                </div>
                            </div>
                            {SYSTEM_ITEMS.filter(canSeeItem).map(item => (
                                <a
                                    key={item.id}
                                    href={`?view=${item.id}`}
                                    className={[
                                        'nav-item sub-item',
                                        effectiveCollapsed ? 'collapsed' : '',
                                        currentView === item.id ? 'active' : '',
                                    ].filter(Boolean).join(' ')}
                                    onClick={(e) => { e.preventDefault(); navigate(item.id); }}
                                    title={effectiveCollapsed ? item.label : ''}
                                >
                                    <item.icon size={15} className="nav-icon" />
                                    {!effectiveCollapsed && (
                                        <span className="nav-label">{item.label}</span>
                                    )}
                                </a>
                            ))}
                        </div>
                    )}
                </nav>

                {/* Footer / User */}
                <div className="sidebar-footer">
                    <div className="user-profile">
                        <div className={`avatar ${currentUser?.is_anonymous ? 'guest' : ''}`}>
                            {currentUser?.is_anonymous
                                ? <Ghost size={16} color="var(--text-2)" />
                                : <User size={17} color="var(--text-2)" />}
                        </div>
                        {!effectiveCollapsed && (
                            <div className="user-info">
                                <div className="user-name">
                                    {currentUser?.is_anonymous ? 'Anonymous' : (currentUser?.username || 'Guest')}
                                </div>
                                <div className="user-role">
                                    {userRoleLabel()}
                                </div>
                            </div>
                        )}
                    </div>
                    {!effectiveCollapsed && (
                        currentUser?.is_anonymous ? (
                            <button className="login-sidebar-btn" onClick={onShowLogin}>
                                <LogIn size={14} />
                                Sign In
                            </button>
                        ) : (
                            currentUser && (
                                <button className="logout-btn" onClick={onLogout} title="Sign out">
                                    <LogOut size={15} />
                                </button>
                            )
                        )
                    )}
                </div>
            </motion.div>
        </>
    );
};

export default Sidebar;
