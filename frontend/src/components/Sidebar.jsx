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
    Shield,
    Activity,
    Cpu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ currentView, onViewChange }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [monitoringExpanded, setMonitoringExpanded] = useState(true);
    const [assetsExpanded, setAssetsExpanded] = useState(true);
    const [operationsExpanded, setOperationsExpanded] = useState(true);
    const [systemExpanded, setSystemExpanded] = useState(false);

    const toggleCollapse = () => setCollapsed(!collapsed);

    const monitoringItems = [
        { id: 'dashboard', label: 'Live Dashboard', icon: LayoutDashboard },
        { id: 'snapshots', label: 'Network Analysis', icon: Activity },
    ];

    const assetItems = [
        { id: 'list', label: 'Substation Assets', icon: List },
        { id: 'create', label: 'Register New Entry', icon: PlusCircle },
        { id: 'load-transformers', label: 'Load Transformers', icon: Database },
        { id: 'auto-transformers', label: 'Auto Transformers', icon: Database },
        { id: 'incoming-branches', label: 'Incoming Branches', icon: Database },
    ];

    const operationItems = [
        { id: 'load-shedding', label: 'Load Shedding', icon: Shield },
    ];

    const systemItems = [
        { id: 'dev-tools', label: 'Developer Tools', icon: Cpu },
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

                {/* Monitoring & Analysis */}
                <div className="nav-group" style={{ position: 'relative' }}>
                    <div
                        className={`nav-group-header ${collapsed ? 'collapsed' : ''}`}
                        onClick={() => setMonitoringExpanded(!monitoringExpanded)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <LineChart size={20} className="nav-icon" style={{ color: 'var(--text-secondary)' }} />
                            {!collapsed && <span className="nav-label" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Monitoring</span>}
                        </div>
                        {!collapsed && <ChevronDown size={14} style={{ transform: monitoringExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-secondary)' }} />}
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
                                        className={`nav-item sub-item ${currentView === item.id ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNavigate(item.id);
                                        }}
                                        title={collapsed ? item.label : ''}
                                        style={collapsed ? { padding: '0.75rem 0', justifyContent: 'center' } : {}}
                                    >
                                        {!collapsed && <item.icon size={16} style={{ marginRight: '10px' }} />}
                                        {!collapsed && item.label}
                                        {collapsed && (
                                            <item.icon size={18} />
                                        )}
                                    </a>
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
                                    <a
                                        key={item.id}
                                        href={`?view=${item.id}`}
                                        className={`nav-item sub-item ${currentView === item.id ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNavigate(item.id);
                                        }}
                                        title={collapsed ? item.label : ''}
                                        style={collapsed ? { padding: '0.75rem 0', justifyContent: 'center' } : {}}
                                    >
                                        {!collapsed && <item.icon size={16} style={{ marginRight: '10px' }} />}
                                        {!collapsed && item.label}
                                        {collapsed && (
                                            <item.icon size={18} />
                                        )}
                                    </a>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Operations Group */}
                <div className="nav-group" style={{ position: 'relative' }}>
                    <div
                        className={`nav-group-header ${collapsed ? 'collapsed' : ''}`}
                        onClick={() => setOperationsExpanded(!operationsExpanded)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Shield size={20} className="nav-icon" style={{ color: 'var(--text-secondary)' }} />
                            {!collapsed && <span className="nav-label" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Operations</span>}
                        </div>
                        {!collapsed && <ChevronDown size={14} style={{ transform: operationsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-secondary)' }} />}
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
                                    <a
                                        key={item.id}
                                        href={`?view=${item.id}`}
                                        className={`nav-item sub-item ${currentView === item.id ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNavigate(item.id);
                                        }}
                                        title={collapsed ? item.label : ''}
                                        style={collapsed ? { padding: '0.75rem 0', justifyContent: 'center' } : {}}
                                    >
                                        {!collapsed && <item.icon size={16} style={{ marginRight: '10px' }} />}
                                        {!collapsed && item.label}
                                        {collapsed && <item.icon size={18} />}
                                    </a>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* System Group */}
                <div className="nav-group" style={{ position: 'relative', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                    <div
                        className={`nav-group-header ${collapsed ? 'collapsed' : ''}`}
                        onClick={() => setSystemExpanded(!systemExpanded)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Settings size={20} className="nav-icon" style={{ color: 'var(--text-secondary)' }} />
                            {!collapsed && <span className="nav-label" style={{ fontSize: '0.9rem', fontWeight: 500 }}>System</span>}
                        </div>
                        {!collapsed && <ChevronDown size={14} style={{ transform: systemExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-secondary)' }} />}
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
                                        className={`nav-item sub-item ${currentView === item.id ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNavigate(item.id);
                                        }}
                                        title={collapsed ? item.label : ''}
                                        style={collapsed ? { padding: '0.75rem 0', justifyContent: 'center' } : {}}
                                    >
                                        {!collapsed && <item.icon size={16} style={{ marginRight: '10px' }} />}
                                        {!collapsed && item.label}
                                        {collapsed && <item.icon size={18} />}
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
    <a
        href={`?view=${item.id}`}
        className={`nav-item ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
        onClick={(e) => {
            e.preventDefault();
            onClick();
        }}
        title={collapsed ? item.label : ''}
    >
        <item.icon size={20} className="nav-icon" />
        {!collapsed && <span className="nav-label">{item.label}</span>}
        {isActive && !collapsed && <motion.div layoutId="active-indicator" className="active-indicator" />}
    </a>
);

export default Sidebar;
