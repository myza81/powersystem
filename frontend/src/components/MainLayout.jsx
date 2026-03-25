import React from 'react';
import Sidebar from './Sidebar';

const MainLayout = ({ children, currentView, onViewChange, currentUser, onLogout }) => {
    return (
        <div className="app-container">
            <Sidebar currentView={currentView} onViewChange={onViewChange} currentUser={currentUser} onLogout={onLogout} />
            <main className="content-area">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
