import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, TrendingUp, AlertTriangle, CheckCircle2, X, Zap, Database, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

const LoadProfileUpload = ({ onUploadComplete, onCancel }) => {
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);

    // Fetch latest upload results on mount
    React.useEffect(() => {
        const fetchLatestUpload = async () => {
            try {
                const response = await api.get('/load-profiles/latest_upload/');
                if (response.data.has_data) {
                    setResults(response.data);
                }
            } catch (err) {
                console.error('Failed to fetch latest upload:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchLatestUpload();
    }, []);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const validateFile = (file) => {
        const validExtensions = ['.xlsx', '.xls'];
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!validExtensions.includes(extension)) {
            setError('Invalid file type. Please upload an Excel file (.xlsx or .xls)');
            return false;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            setError('File too large. Maximum size is 10MB');
            return false;
        }

        return true;
    };

    const processFile = async (file) => {
        if (!validateFile(file)) return;

        setError(null);
        setUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            const response = await api.post('/load-profiles/upload/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            setResults(response.data);

            setTimeout(() => {
                if (onUploadComplete) onUploadComplete(response.data);
            }, 2000);

        } catch (err) {
            console.error('Upload error:', err);
            setError(err.response?.data?.error || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const resetUpload = () => {
        setResults(null);
        setError(null);
        setUploadProgress(0);
    };

    return (
        <div style={{
            minHeight: '100vh',
            padding: '3rem 2rem',
            background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)'
        }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '3rem' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '60px',
                                height: '60px',
                                background: 'linear-gradient(135deg, #00e5ff 0%, #00a8ff 100%)',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 24px rgba(0, 229, 255, 0.3)'
                            }}>
                                <TrendingUp size={32} color="#000" strokeWidth={2.5} />
                            </div>
                            <div>
                                <h1 style={{
                                    fontSize: '2.5rem',
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #fff 0%, #00e5ff 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    margin: 0
                                }}>
                                    Load Profile Upload
                                </h1>
                                <p style={{ color: 'rgba(255,255,255,0.6)', margin: '4px 0 0 0', fontSize: '0.95rem' }}>
                                    Upload Excel snapshot to compute grid demand analytics
                                </p>
                            </div>
                        </div>
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'rgba(255,255,255,0.7)',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.3s'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(255,255,255,0.1)';
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(255,255,255,0.05)';
                                    e.target.style.color = 'rgba(255,255,255,0.7)';
                                }}
                            >
                                Back to Dashboard
                            </button>
                        )}
                    </div>
                </motion.div>

                {loading ? (
                    <div style={{
                        padding: '4rem',
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.5)'
                    }}>
                        <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                        <p>Loading previous upload data...</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {!results && !error ? (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                            >
                                {/* Upload Zone */}
                                <div
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    style={{
                                        position: 'relative',
                                        padding: '4rem 3rem',
                                        border: dragActive
                                            ? '3px dashed #00e5ff'
                                            : '3px dashed rgba(0, 229, 255, 0.3)',
                                        borderRadius: '24px',
                                        background: dragActive
                                            ? 'rgba(0, 229, 255, 0.05)'
                                            : 'rgba(0, 0, 0, 0.3)',
                                        backdropFilter: 'blur(20px)',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: dragActive
                                            ? '0 0 60px rgba(0, 229, 255, 0.2)'
                                            : '0 8px 32px rgba(0, 0, 0, 0.4)'
                                    }}
                                    onClick={!uploading ? handleButtonClick : undefined}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleChange}
                                        style={{ display: 'none' }}
                                    />

                                    {!uploading ? (
                                        <>
                                            <motion.div
                                                animate={{
                                                    y: dragActive ? -10 : 0,
                                                    scale: dragActive ? 1.1 : 1
                                                }}
                                                transition={{ type: 'spring', stiffness: 300 }}
                                            >
                                                <FileSpreadsheet
                                                    size={80}
                                                    color={dragActive ? '#00e5ff' : 'rgba(0, 229, 255, 0.5)'}
                                                    strokeWidth={1.5}
                                                    style={{ margin: '0 auto 2rem' }}
                                                />
                                            </motion.div>

                                            <h3 style={{
                                                fontSize: '1.5rem',
                                                color: '#fff',
                                                marginBottom: '1rem',
                                                fontWeight: 600
                                            }}>
                                                {dragActive ? 'Drop your file here' : 'Drag & Drop Load Profile'}
                                            </h3>

                                            <p style={{
                                                color: 'rgba(255,255,255,0.5)',
                                                marginBottom: '2rem',
                                                fontSize: '0.95rem'
                                            }}>
                                                or click to browse • Excel files only (.xlsx, .xls)
                                            </p>

                                            <div style={{
                                                display: 'inline-block',
                                                padding: '1rem 2.5rem',
                                                background: 'linear-gradient(135deg, #00e5ff 0%, #00a8ff 100%)',
                                                color: '#000',
                                                borderRadius: '12px',
                                                fontWeight: 600,
                                                fontSize: '1rem',
                                                boxShadow: '0 8px 24px rgba(0, 229, 255, 0.4)',
                                                transition: 'all 0.3s'
                                            }}>
                                                Select File
                                            </div>

                                            <div style={{
                                                marginTop: '3rem',
                                                padding: '1.5rem',
                                                background: 'rgba(0, 229, 255, 0.05)',
                                                borderRadius: '12px',
                                                border: '1px solid rgba(0, 229, 255, 0.2)'
                                            }}>
                                                <p style={{
                                                    color: 'rgba(255,255,255,0.7)',
                                                    fontSize: '0.85rem',
                                                    margin: 0,
                                                    lineHeight: 1.6
                                                }}>
                                                    <strong style={{ color: '#00e5ff' }}>Expected Format:</strong> Bus Number, Bus Name, Mnemonic, Id, Pload (MW), Qload (Mvar)
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <div>
                                            <div style={{
                                                width: '100px',
                                                height: '100px',
                                                margin: '0 auto 2rem',
                                                position: 'relative'
                                            }}>
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                                    style={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        borderRadius: '50%',
                                                        border: '4px solid rgba(0, 229, 255, 0.2)',
                                                        borderTopColor: '#00e5ff'
                                                    }}
                                                />
                                                <div style={{
                                                    position: 'absolute',
                                                    inset: '20%',
                                                    borderRadius: '50%',
                                                    background: 'rgba(0, 229, 255, 0.1)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <Database size={40} color="#00e5ff" />
                                                </div>
                                            </div>

                                            <h3 style={{
                                                fontSize: '1.5rem',
                                                color: '#fff',
                                                marginBottom: '1rem',
                                                fontWeight: 600
                                            }}>
                                                Processing Load Data
                                            </h3>

                                            <div style={{
                                                marginBottom: '1rem',
                                                fontSize: '2rem',
                                                fontWeight: 700,
                                                color: '#00e5ff',
                                                fontFamily: 'monospace'
                                            }}>
                                                {uploadProgress}%
                                            </div>

                                            <div style={{
                                                width: '100%',
                                                height: '8px',
                                                background: 'rgba(255,255,255,0.1)',
                                                borderRadius: '4px',
                                                overflow: 'hidden'
                                            }}>
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${uploadProgress}%` }}
                                                    transition={{ duration: 0.3 }}
                                                    style={{
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, #00e5ff 0%, #00a8ff 100%)',
                                                        boxShadow: '0 0 20px rgba(0, 229, 255, 0.6)'
                                                    }}
                                                />
                                            </div>

                                            <p style={{
                                                marginTop: '1.5rem',
                                                color: 'rgba(255,255,255,0.5)',
                                                fontSize: '0.9rem'
                                            }}>
                                                Matching bay IDs and computing aggregations...
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : error ? (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                style={{
                                    padding: '3rem',
                                    background: 'rgba(255, 59, 48, 0.1)',
                                    border: '2px solid rgba(255, 59, 48, 0.5)',
                                    borderRadius: '24px',
                                    textAlign: 'center'
                                }}
                            >
                                <AlertTriangle size={60} color="#ff3b30" style={{ marginBottom: '1.5rem' }} />
                                <h3 style={{ fontSize: '1.5rem', color: '#ff3b30', marginBottom: '1rem' }}>
                                    Upload Failed
                                </h3>
                                <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' }}>
                                    {error}
                                </p>
                                <button
                                    onClick={resetUpload}
                                    style={{
                                        padding: '1rem 2rem',
                                        background: 'linear-gradient(135deg, #00e5ff 0%, #00a8ff 100%)',
                                        color: '#000',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Try Again
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                            >
                                <div style={{
                                    padding: '3rem',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    backdropFilter: 'blur(20px)',
                                    borderRadius: '24px',
                                    border: '2px solid rgba(0, 229, 255, 0.3)'
                                }}>
                                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                                        >
                                            <CheckCircle2 size={80} color="#00e5ff" style={{ marginBottom: '1.5rem' }} />
                                        </motion.div>
                                        <h2 style={{
                                            fontSize: '2rem',
                                            color: '#fff',
                                            marginBottom: '0.5rem',
                                            fontWeight: 700
                                        }}>
                                            Upload Complete
                                        </h2>
                                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
                                            Load profile data successfully processed
                                        </p>
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '1.5rem',
                                        marginBottom: '2rem'
                                    }}>
                                        <StatCard
                                            icon={<Database size={24} />}
                                            label="Total Rows"
                                            value={results?.total_rows || 0}
                                            color="#00e5ff"
                                        />
                                        <StatCard
                                            icon={<CheckCircle2 size={24} />}
                                            label="Matched"
                                            value={results?.matched || 0}
                                            color="#34c759"
                                        />
                                        <StatCard
                                            icon={<AlertTriangle size={24} />}
                                            label="Unmatched"
                                            value={results?.unmatched || 0}
                                            color="#ff9500"
                                        />
                                        <StatCard
                                            icon={<Zap size={24} />}
                                            label="Success Rate"
                                            value={`${Math.round((results?.matched / results?.total_rows) * 100) || 0}%`}
                                            color="#00e5ff"
                                        />
                                    </div>

                                    {results?.unmatched > 0 && results?.unmatched_details && (
                                        <div style={{
                                            marginTop: '2rem',
                                            padding: '1.5rem',
                                            background: 'rgba(255, 149, 0, 0.1)',
                                            border: '1px solid rgba(255, 149, 0, 0.3)',
                                            borderRadius: '12px'
                                        }}>
                                            <h4 style={{ color: '#ff9500', marginBottom: '1rem', fontSize: '1.1rem' }}>
                                                Unmatched Entries ({results.unmatched})
                                            </h4>
                                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                {results.unmatched_details.slice(0, 10).map((item, idx) => (
                                                    <div key={idx} style={{
                                                        padding: '0.75rem',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        marginBottom: '0.5rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.85rem',
                                                        color: 'rgba(255,255,255,0.7)'
                                                    }}>
                                                        <strong>{item.mnemonic}-{item.id}</strong>: {item.reason}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'center' }}>
                                        <button
                                            onClick={resetUpload}
                                            style={{
                                                padding: '1rem 2rem',
                                                background: 'rgba(255,255,255,0.1)',
                                                color: '#fff',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                borderRadius: '12px',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Upload New File
                                        </button>
                                        {onCancel && (
                                            <button
                                                onClick={onCancel}
                                                style={{
                                                    padding: '1rem 2rem',
                                                    background: 'linear-gradient(135deg, #00e5ff 0%, #00a8ff 100%)',
                                                    color: '#000',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    boxShadow: '0 8px 24px rgba(0, 229, 255, 0.4)'
                                                }}
                                            >
                                                View Dashboard
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, color }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
            padding: '1.5rem',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '16px',
            border: `1px solid ${color}33`,
            position: 'relative',
            overflow: 'hidden'
        }}
    >
        <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '100px',
            height: '100px',
            background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
        }} />
        <div style={{ color, marginBottom: '0.75rem' }}>
            {icon}
        </div>
        <div style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '0.25rem',
            fontFamily: 'monospace'
        }}>
            {value}
        </div>
        <div style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        }}>
            {label}
        </div>
    </motion.div>
);

export default LoadProfileUpload;
