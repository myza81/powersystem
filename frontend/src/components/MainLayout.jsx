import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

const MainLayout = ({ children, currentView, onViewChange, currentUser, onLogout, onShowLogin }) => {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="app-container">
            {/* Mobile top bar — hidden on desktop via CSS */}
            <div className="mobile-topbar">
                <button
                    className="hamburger-btn"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open navigation"
                >
                    <Menu size={18} />
                </button>
                <span className="mobile-topbar-title">
                    <span style={{ fontWeight: 800 }}>Grid</span> Defence
                </span>
            </div>

            <Sidebar
                currentView={currentView}
                onViewChange={onViewChange}
                currentUser={currentUser}
                onLogout={onLogout}
                onShowLogin={onShowLogin}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />

            <main className="content-area">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
