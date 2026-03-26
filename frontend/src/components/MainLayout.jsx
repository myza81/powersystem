import React from 'react';
import Sidebar from './Sidebar';

const MainLayout = ({ children, currentView, onViewChange, currentUser, onLogout, onShowLogin }) => {
    return (
        <div className="app-container">
            <Sidebar
                currentView={currentView}
                onViewChange={onViewChange}
                currentUser={currentUser}
                onLogout={onLogout}
                onShowLogin={onShowLogin}
            />
            <main className="content-area">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
