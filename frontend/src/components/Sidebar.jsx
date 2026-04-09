import React, { useState } from 'react';
import {
    LayoutGrid,
    Boxes,
    ChevronLeft,
    ChevronRight,
    Radar,
    Sliders,
    LogOut,
    LogIn,
    User,
    Ghost,
    ChevronDown,
    Building2,
    Workflow,
    Unplug,
    Activity,
    Terminal,
    BadgeAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ currentView, onViewChange, currentUser, onLogout, onShowLogin }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [monitoringExpanded, setMonitoringExpanded] = useState(true);
    const [assetsExpanded, setAssetsExpanded] = useState(true);
    const [operationsExpanded, setOperationsExpanded] = useState(true);
    const [loadSheddingExpanded, setLoadSheddingExpanded] = useState(false);
    const [systemExpanded, setSystemExpanded] = useState(false);

    const toggleCollapse = () => setCollapsed(!collapsed);

    const monitoringItems = [
        { id: 'dashboard', label: 'Load Analytics', icon: LayoutGrid },
        { id: 'snapshots', label: 'Snapshot View', icon: Activity },
    ];

    const assetItems = [
        { id: 'list', label: 'Substation Assets', icon: Building2 },
    ];

    const operationItems = [
        {
            id: 'load-shedding',
            label: 'Load Shedding',
            icon: Unplug,
            children: [
                { id: 'load-shedding-viewer', label: 'Scheme Viewer' },
                { id: 'load-shedding-designer', label: 'Scheme Designer' },
            ]
        },
        { id: 'critical-substations', label: 'Critical Substations', icon: BadgeAlert },
    ];

    const systemItems = [
        { id: 'dev-tools', label: 'Developer Tools', icon: Terminal },
    ];

    const navItemClasses = (isActive, extra = '') => [
        'nav-item',
        extra,
        collapsed ? 'collapsed' : '',
        isActive ? 'active' : ''
    ].filter(Boolean).join(' ');

    const handleNavigate = (view) => {
        onViewChange(view);
    };

    return (
        <motion.div
            className={`sidebar ${collapsed ? 'collapsed' : ''}`}
            initial={{ width: 260 }}
            animate={{ width: collapsed ? 80 : 260 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
            {/* Header / Logo */}
            <div className={`sidebar-header ${collapsed ? 'justify-center' : ''}`}>
                <div className="brand-container">
                    {/* Icon removed per request */}
                    {!collapsed && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="logo-text"
                        >
                            <span className="logo-text-bold">Grid</span> Defence
                        </motion.div>
                    )}
                </div>
                {/* Floating Toggle */}
                <button className="collapse-btn-floating" onClick={toggleCollapse} title={collapsed ? "Expand" : "Collapse"}>
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">

                {/* Monitoring & Analysis */}
                <div className="nav-group">
                    <div
                        className={`nav-group-header ${collapsed ? 'collapsed' : ''}`}
                        onClick={() => setMonitoringExpanded(!monitoringExpanded)}
                    >
                        <div className="nav-group-title">
                            <Radar size={20} className="nav-icon" />
                            {!collapsed && <span>Grid Snapshot</span>}
                        </div>
                        {!collapsed && (
                            <ChevronDown
                                size={14}
                                className={`chevron ${monitoringExpanded ? 'open' : ''}`}
                            />
                        )}
                    </div>

                    <AnimatePresence>
                        {monitoringExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                            >
                                {monitoringItems.map(item => (
                                    <a
                                        key={item.id}
                                        href={`?view=${item.id}`}
                                        className={navItemClasses(currentView === item.id, 'sub-item')}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNavigate(item.id);
                                        }}
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

                {/* Asset Group */}
                <div className="nav-group">
                    <div
                        className={`nav-group-header ${collapsed ? 'collapsed' : ''}`}
                        onClick={() => {
                            // Only toggle the sub-menu state, do NOT expand sidebar
                            setAssetsExpanded(!assetsExpanded);
                        }}
                    >
                        <div className="nav-group-title">
                            <Boxes size={20} className="nav-icon" />
                            {!collapsed && <span>Assets</span>}
                        </div>
                        {!collapsed && (
                            <ChevronDown
                                size={14}
                                className={`chevron ${assetsExpanded ? 'open' : ''}`}
                            />
                        )}
                    </div>

                    <AnimatePresence>
                        {assetsExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                            >
                                {assetItems.map(item => (
                                    <a
                                        key={item.id}
                                        href={`?view=${item.id}`}
                                        className={navItemClasses(currentView === item.id, 'sub-item')}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNavigate(item.id);
                                        }}
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

                {/* Operations Group */}
                <div className="nav-group">
                    <div
                        className={`nav-group-header ${collapsed ? 'collapsed' : ''}`}
                        onClick={() => setOperationsExpanded(!operationsExpanded)}
                    >
                        <div className="nav-group-title">
                            <Workflow size={20} className="nav-icon" />
                            {!collapsed && <span>Operations</span>}
                        </div>
                        {!collapsed && (
                            <ChevronDown
                                size={14}
                                className={`chevron ${operationsExpanded ? 'open' : ''}`}
                            />
                        )}
                    </div>

                    <AnimatePresence>
                        {operationsExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                            >
                                {operationItems.map(item => (
                                    <div key={item.id} className="nested-group">
                                        <a
                                            href={`?view=${item.id}`}
                                            className={navItemClasses(
                                                currentView === item.id || (item.children && item.children.some(c => c.id === currentView)),
                                                'sub-item'
                                            )}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (item.children) {
                                                    setLoadSheddingExpanded(!loadSheddingExpanded);
                                                } else {
                                                    handleNavigate(item.id);
                                                }
                                            }}
                                            title={collapsed ? item.label : ''}
                                        >
                                            <item.icon size={16} />
                                            {!collapsed && (
                                                <>
                                                    <span className="nav-label">{item.label}</span>
                                                    {item.children && (
                                                        <ChevronDown
                                                            size={14}
                                                            className={`chevron ${loadSheddingExpanded ? 'open' : ''}`}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </a>

                                        {!collapsed && item.children && (
                                            <AnimatePresence>
                                                {loadSheddingExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="nested-children"
                                                    >
                                                        {item.children.map(child => (
                                                            <a
                                                                key={child.id}
                                                                href={`?view=${child.id}`}
                                                                className={navItemClasses(currentView === child.id, 'sub-item child')}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleNavigate(child.id);
                                                                }}
                                                            >
                                                                <span className="nav-label">{child.label}</span>
                                                            </a>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        )}
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* System Group */}
                <div className="nav-group system-section">
                    <div
                        className={`nav-group-header ${collapsed ? 'collapsed' : ''}`}
                        onClick={() => setSystemExpanded(!systemExpanded)}
                    >
                        <div className="nav-group-title">
                            <Sliders size={20} className="nav-icon" />
                            {!collapsed && <span>System</span>}
                        </div>
                        {!collapsed && (
                            <ChevronDown
                                size={14}
                                className={`chevron ${systemExpanded ? 'open' : ''}`}
                            />
                        )}
                    </div>

                    <AnimatePresence>
                        {systemExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                            >
                                {systemItems.map(item => (
                                    <a
                                        key={item.id}
                                        href={`?view=${item.id}`}
                                        className={navItemClasses(currentView === item.id, 'sub-item')}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNavigate(item.id);
                                        }}
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
            </nav>

            {/* Footer / User Profile */}
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
                        <button
                            className="login-sidebar-btn"
                            onClick={onShowLogin}
                            title="Sign In"
                        >
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
