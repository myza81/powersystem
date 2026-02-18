import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, AlertTriangle, X, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const api = axios.create({ baseURL: '/api/v1' });

const SldViewer = ({ substation, onClose }) => {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

    useEffect(() => {
        let active = true;
        const fetchSld = async () => {
            try {
                const response = await api.get(`/substations/${substation.substation_id}/view_sld/`);

                if (active) {
                    // Blob Proxy Logic for PDF to bypass X-Frame-Options & Mixed Content
                    if (response.data.type === 'pdf') {
                        try {
                            // Extract relative path to use Vite proxy (avoids hitting port 8000 directly)
                            let fetchUrl = response.data.url;
                            try {
                                const urlObj = new URL(fetchUrl);
                                fetchUrl = urlObj.pathname + urlObj.search;
                            } catch (e) {
                                // Already relative or invalid
                            }

                            const blobRes = await axios.get(fetchUrl, { responseType: 'blob' });
                            const objectUrl = URL.createObjectURL(blobRes.data);
                            setPdfBlobUrl(objectUrl);
                        } catch (blobErr) {
                            console.error("Blob fetch failed, falling back to direct URL", blobErr);
                        }
                    }
                    setContent(response.data);
                }
            } catch (err) {
                if (active) {
                    console.error("Failed to load SLD:", err);
                    setError("Failed to load SLD. Please try again.");
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        fetchSld();

        return () => {
            active = false;
            if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
        };
    }, [substation]);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Toolbar */}
            <div style={{
                padding: '1rem',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#1a1a1a'
            }}>
                <h3 style={{ color: '#fff', margin: 0 }}>
                    <FileText size={20} style={{ marginRight: '8px', verticalAlign: 'middle', color: '#00e5ff' }} />
                    SLD: {substation.name} ({substation.voltage}kV)
                </h3>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.7)',
                        cursor: 'pointer'
                    }}
                >
                    <X size={24} />
                </button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {loading && (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                        <Loader2 size={32} className="animate-spin" style={{ marginBottom: '1rem' }} />
                        <p>Loading SLD...</p>
                    </div>
                )}

                {error && (
                    <div style={{ textAlign: 'center', color: '#ff3b30' }}>
                        <AlertTriangle size={32} style={{ marginBottom: '1rem' }} />
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && content && (
                    content.type === 'pdf' ? (
                        <iframe
                            src={pdfBlobUrl || content.url}
                            style={{ width: '100%', height: '100%', border: 'none', background: '#333' }}
                            title="SLD PDF"
                        />
                    ) : (
                        <TransformWrapper
                            initialScale={1}
                            minScale={0.5}
                            maxScale={8}
                            centerOnInit={true}
                        >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    {/* Floating Controls */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '2rem',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        zIndex: 1001,
                                        background: 'rgba(0,0,0,0.8)',
                                        padding: '0.5rem',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        gap: '1rem'
                                    }}>
                                        <button onClick={() => zoomIn()} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><ZoomIn /></button>
                                        <button onClick={() => zoomOut()} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><ZoomOut /></button>
                                        <button onClick={() => resetTransform()} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Reset</button>
                                    </div>

                                        <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                                            {content.type === 'svg' && (
                                            content.content ? (
                                                <div
                                                    dangerouslySetInnerHTML={{ __html: content.content }}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        background: '#1a1a1a',
                                                        display: 'flex',
                                                        justifyContent: 'center',
                                                        alignItems: 'center'
                                                    }}
                                                />
                                            ) : (
                                                <img
                                                    src={content.url}
                                                    alt="SLD SVG"
                                                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                                                />
                                            )
                                        )}
                                        {content.type === 'image' && (
                                            <img
                                                src={content.url}
                                                alt="SLD"
                                                style={{ maxWidth: '100%', maxHeight: '100%' }}
                                            />
                                        )}
                                    </TransformComponent>
                                </>
                            )}
                        </TransformWrapper>
                    )
                )}
            </div>
        </div>
    );
};

export default SldViewer;
