import React from 'react';
import { ArrowLeft, Edit3 } from 'lucide-react';

const ShedDesign = ({ version, onBack, onPublished }) => {
    return (
        <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
            <button onClick={onBack} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.88rem', padding: 0,
            }}>
                <ArrowLeft size={16} /> Back
            </button>

            <div style={{
                padding: '3rem', textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)',
            }}>
                <Edit3 size={32} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: '1rem' }} />
                <h2 style={{ color: '#f1f5f9', marginBottom: '1rem', marginTop: 0 }}>Shedding Designer</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2rem' }}>
                    Designer for {version?.scheme_type} Version {version?.version_number} is currently under construction.
                </p>
                <button onClick={onPublished} style={{
                    padding: '8px 20px', borderRadius: '8px',
                    background: `rgba(167,139,250,0.15)`, border: `1px solid rgba(167,139,250,0.3)`,
                    color: '#a78bfa', cursor: 'pointer', fontWeight: 600,
                }}>
                    Acknowledge
                </button>
            </div>
        </div>
    );
};

export default ShedDesign;
