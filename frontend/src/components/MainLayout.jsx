import React from 'react';
import Sidebar from './Sidebar';

const MainLayout = ({ children, currentView, onViewChange }) => {
    return (
        <div className="app-container">
            <Sidebar currentView={currentView} onViewChange={onViewChange} />
            <main className="content-area">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
