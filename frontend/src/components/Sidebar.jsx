import React, { useState } from 'react';
import {
    LayoutDashboard,
    Zap,
    Database,
    ChevronLeft,
    ChevronRight,
    LineChart,
    Settings,
    LogOut,
    User,
    ChevronDown,
    Menu,
    List,
    PlusCircle,
    Upload,
    Network
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ currentView, onViewChange }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [loadProfileExpanded, setLoadProfileExpanded] = useState(true);
    const [assetsExpanded, setAssetsExpanded] = useState(true);

    const toggleCollapse = () => setCollapsed(!collapsed);

    const loadProfileItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ];

    const assetItems = [
        { id: 'list', label: 'Substation', icon: List },
        { id: 'create', label: 'New Subs Entry', icon: PlusCircle },
        { id: 'topology', label: 'Network Topology', icon: Network },
    ];

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
                    <div className="logo-icon">
                        <Zap size={24} color="var(--accent-cyan)" fill="var(--accent-cyan)" />
                    </div>
                    {!collapsed && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="logo-text"
                        >
                            GridDefense <span style={{ color: 'var(--accent-blue)' }}>Ops</span>
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

                {/* Load Profile Group */}
                <div className="nav-group" style={{ position: 'relative' }}>
                    <div
                        className={`nav-group-header ${collapsed ? 'collapsed' : ''}`}
                        onClick={() => {
                            // Only toggle the sub-menu state, do NOT expand sidebar
                            setLoadProfileExpanded(!loadProfileExpanded);
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <LineChart size={20} className="nav-icon" style={{ color: 'var(--text-secondary)' }} />
                            {!collapsed && <span className="nav-label" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Load Profile</span>}
                        </div>
                        {!collapsed && <ChevronDown size={14} style={{ transform: loadProfileExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-secondary)' }} />}
                    </div>

                    <AnimatePresence>
                        {loadProfileExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden' }}
                            >
                                {loadProfileItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={`nav-item sub-item ${currentView === item.id ? 'active' : ''}`}
                                        onClick={() => handleNavigate(item.id)}
                                        title={collapsed ? item.label : ''}
                                        style={collapsed ? { padding: '0.75rem 0', justifyContent: 'center' } : {}}
                                    >
                                        {!collapsed && <item.icon size={16} style={{ marginRight: '10px' }} />}
                                        {!collapsed && item.label}
                                        {collapsed && (
                                            <item.icon size={18} />
                                        )}
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Asset Group */}
                <div className="nav-group" style={{ position: 'relative' }}>
                    <div
                        className={`nav-group-header ${collapsed ? 'collapsed' : ''}`}
                        onClick={() => {
                            // Only toggle the sub-menu state, do NOT expand sidebar
                            setAssetsExpanded(!assetsExpanded);
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Zap size={20} className="nav-icon" style={{ color: 'var(--text-secondary)' }} />
                            {!collapsed && <span className="nav-label" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Assets</span>}
                        </div>
                        {!collapsed && <ChevronDown size={14} style={{ transform: assetsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-secondary)' }} />}
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
                                    <div
                                        key={item.id}
                                        className={`nav-item sub-item ${currentView === item.id ? 'active' : ''}`}
                                        onClick={() => handleNavigate(item.id)}
                                        title={collapsed ? item.label : ''}
                                        style={collapsed ? { padding: '0.75rem 0', justifyContent: 'center' } : {}}
                                    >
                                        {!collapsed && <item.icon size={16} style={{ marginRight: '10px' }} />}
                                        {!collapsed && item.label}
                                        {collapsed && (
                                            <item.icon size={18} />
                                        )}
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* DevSync */}
                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                    <NavItem
                        item={{ id: 'dev-tools', label: 'DevSync', icon: Database }}
                        isActive={currentView === 'dev-tools'}
                        collapsed={collapsed}
                        onClick={() => handleNavigate('dev-tools')}
                    />
                </div>
            </nav>

            {/* Footer / User Profile */}
            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="avatar">
                        <User size={20} />
                    </div>
                    {!collapsed && (
                        <div className="user-info">
                            <div className="user-name">Ijat</div>
                            <div className="user-role">Administrator</div>
                        </div>
                    )}
                </div>
                {!collapsed && (
                    <button className="logout-btn">
                        <LogOut size={16} />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

const NavItem = ({ item, isActive, collapsed, onClick }) => (
    <div
        className={`nav-item ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
        onClick={onClick}
        title={collapsed ? item.label : ''}
    >
        <item.icon size={20} className="nav-icon" />
        {!collapsed && <span className="nav-label">{item.label}</span>}
        {isActive && !collapsed && <motion.div layoutId="active-indicator" className="active-indicator" />}
    </div>
);

export default Sidebar;
