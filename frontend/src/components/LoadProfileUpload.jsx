import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, TrendingUp, AlertTriangle, CheckCircle2, X, Zap, Database, Loader2, AlertCircle, Search, MapPin, Edit2, Plus, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

const LoadProfileUpload = ({ onUploadComplete, onCancel, onResolveIssue }) => {
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [inspectorData, setInspectorData] = useState(null);
    const [inspectorSearch, setInspectorSearch] = useState('');
    const [analysisData, setAnalysisData] = useState(null); // Contains both missing_substations and missing_bays
    const [expandedMnemonics, setExpandedMnemonics] = useState({}); // { mnemonic: boolean }
    const [detailsCache, setDetailsCache] = useState({}); // { mnemonic: [rows] }
    const fileInputRef = useRef(null);

    const toggleMnemonic = async (mnemonic) => {
        const isExpanded = !!expandedMnemonics[mnemonic];

        // Toggle state
        setExpandedMnemonics(prev => ({ ...prev, [mnemonic]: !isExpanded }));

        // Fetch details if expanding and not cached
        if (!isExpanded && !detailsCache[mnemonic]) {
            try {
                const response = await api.get('/load-profiles/mnemonic_details/', {
                    params: { mnemonic }
                });
                setDetailsCache(prev => ({ ...prev, [mnemonic]: response.data.rows }));
            } catch (err) {
                console.error("Failed to fetch details for", mnemonic, err);
            }
        }
    };

    // Fetch latest upload results on mount
    React.useEffect(() => {
        fetchLatestUpload();
        fetchInspector();
        fetchAnalysis();
    }, []);

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

    const fetchInspector = async () => {
        try {
            const response = await api.get('/load-profiles/uploaded_mnemonics/');
            if (response.data.has_data) {
                setInspectorData(response.data);
            }
        } catch (err) {
            console.error('Failed to fetch inspector data:', err);
        }
    };

    const fetchAnalysis = async () => {
        try {
            const response = await api.get('/load-profiles/unmatched_analysis/');
            setAnalysisData(response.data);
        } catch (err) {
            console.error('Failed to fetch analysis:', err);
        }
    };

    const handleResolve = (type, item) => {
        if (!onResolveIssue) return;

        if (type === 'create_substation') {
            // item is { substation_id, voltage, mnemonic ... }
            // Mnemonic parsing is redundant if backend provides it, but here's a fallback or direct pass
            onResolveIssue({
                type: 'create_substation',
                data: {
                    mnemonic: item.mnemonic,
                    voltage: item.voltage,
                    substation_id: item.substation_id
                }
            });
        } else if (type === 'edit_substation') {
            onResolveIssue({
                type: 'edit_substation',
                data: {
                    substation_id: item.substation_id
                }
            });
        }
    };

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
            fetchInspector(); // Refresh inspector after new upload

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

    // Filter inspector data
    const filteredMnemonics = inspectorData?.mnemonics.filter(m =>
        m.mnemonic.toLowerCase().includes(inspectorSearch.toLowerCase()) ||
        m.sample_bus.toLowerCase().includes(inspectorSearch.toLowerCase())
    ) || [];

    return (
        <div style={{
            minHeight: '100vh',
            padding: '3rem 2rem',
            background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 100%)'
        }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
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

                {/* Consolidated Data Inspector */}
                {inspectorData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                            marginTop: '3rem',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            overflow: 'hidden',
                            backdropFilter: 'blur(20px)'
                        }}
                    >
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileSpreadsheet size={20} color="#00e5ff" />
                                    File Content Inspector
                                </h3>
                                {/* Analysis Summaries */}
                                {analysisData && (
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                                        {analysisData.missing_substations.length > 0 && (
                                            <span style={{
                                                fontSize: '0.8rem',
                                                color: '#ff3b30',
                                                background: 'rgba(255, 59, 48, 0.1)',
                                                border: '1px solid rgba(255, 59, 48, 0.3)',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontWeight: 600
                                            }}>
                                                Substations Not Created: {analysisData.missing_substations.length}
                                            </span>
                                        )}
                                        {analysisData.missing_bays.length > 0 && (
                                            <span style={{
                                                fontSize: '0.8rem',
                                                color: '#ff9500',
                                                background: 'rgba(255, 149, 0, 0.1)',
                                                border: '1px solid rgba(255, 149, 0, 0.3)',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontWeight: 600
                                            }}>
                                                Bays Not Matched: {analysisData.missing_bays.length}
                                            </span>
                                        )}
                                        {analysisData.missing_substations.length === 0 && analysisData.missing_bays.length === 0 && (
                                            <span style={{
                                                fontSize: '0.8rem',
                                                color: '#34c759',
                                                background: 'rgba(52, 199, 89, 0.1)',
                                                border: '1px solid rgba(52, 199, 89, 0.3)',
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <CheckCircle2 size={12} /> Ready for Sync
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ position: 'relative', width: '300px' }}>
                                <Search
                                    size={16}
                                    style={{
                                        position: 'absolute',
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'rgba(255,255,255,0.4)'
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Search mnemonics..."
                                    value={inspectorSearch}
                                    onChange={(e) => setInspectorSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.1)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '8px',
                                        padding: '10px 12px 10px 40px',
                                        color: '#fff',
                                        outline: 'none',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Combined Content Table */}
                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'rgba(0,0,0,0.2)', position: 'sticky', top: 0 }}>
                                    <tr>
                                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: '0.9rem' }}>Mnemonic</th>
                                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: '0.9rem' }}>Sample Bus Name</th>
                                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: '0.9rem' }}>Total Rows</th>
                                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: '0.9rem' }}>Status</th>
                                        <th style={{ padding: '1rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: '0.9rem' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMnemonics.length > 0 ? (
                                        filteredMnemonics.map((m, idx) => {
                                            const isExpanded = !!expandedMnemonics[m.mnemonic];
                                            const details = detailsCache[m.mnemonic];
                                            // Debug log
                                            // console.log('Rendering row:', m.mnemonic, isExpanded);

                                            // Check analysis data for specific issues to determine button action
                                            const missingSub = analysisData?.missing_substations.find(s => s.mnemonic === m.mnemonic);
                                            // Since mnemonics map to substations 1:1 usually, check bays if sub exists
                                            // Note: m.mnemonic is raw, analysisData.missing_bays uses substation_id. We need a bridge or assume mnemonic match.
                                            // Looking at backend, unmatched_analysis returns 'mnemonic' for missing_substations.
                                            // For missing_bays, it returns substation_id and bay_name.
                                            // We might need to match m.mnemonic to the substation_id derived from it?
                                            // Or simplified: Status 'Unmatched' means SOMETHING is wrong.

                                            // Logic:
                                            // 1. Is it a missing substation? -> Create
                                            // 2. Is it a missing bay (but sub exists)? -> Edit

                                            let actionButton = null;

                                            if (missingSub) {
                                                actionButton = (
                                                    <button
                                                        onClick={() => handleResolve('create_substation', missingSub)}
                                                        style={{
                                                            background: 'rgba(255, 59, 48, 0.2)',
                                                            color: '#ff3b30',
                                                            border: '1px solid rgba(255, 59, 48, 0.3)',
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <Plus size={14} /> Create Sub
                                                    </button>
                                                );
                                            } else if (m.status === 'Partial' || m.status === 'Unmatched') {
                                                // If not a missing sub, it must be missing bays or config
                                                // We need the Substation ID to edit. The mnemonic table might not have it if it wasn't matched?
                                                // Actually, if status is Partial, it matched a substation but failed bays.
                                                // If Unmatched, it might have failed regex entirely OR failed substation lookup.
                                                // Since we checked missingSub (failed lookup), this else block implies Sub exists but bays failed.

                                                // We need to find the substation_id associated with this mnemonic.
                                                // The 'inspectorData' doesn't explicitly give substation_id for every row, just raw mnemonic.
                                                // But 'analysisData.missing_bays' has {substation_id...}
                                                // We can try to find a missing_bay entry that logically corresponds, or just ask user to find it.

                                                // Safer bet: If we can't link to a precise ID, maybe disable or generic link?
                                                // But usually standard mnemonic -> ID is predictable.
                                                // Let's rely on finding a matching entry in missing_bays to get the ID.

                                                const relatedBayIssue = analysisData?.missing_bays.find(b => b.substation_id.includes(m.mnemonic) || m.sample_bus.includes(b.substation_id));
                                                // This is fuzzy.
                                                // Better approach: API sends enough info.
                                                // Let's assume for 'Partial', we act on the matched substation.
                                                // The backend 'uploaded_mnemonics' could be enriched with 'matched_substation_id'.
                                                // For now, let's look for it in missing_bays by simple string check or just generic "Edit" if we can't find it.

                                                if (relatedBayIssue) {
                                                    actionButton = (
                                                        <button
                                                            onClick={() => handleResolve('edit_substation', { substation_id: relatedBayIssue.substation_id })}
                                                            style={{
                                                                background: 'rgba(255, 149, 0, 0.2)',
                                                                color: '#ff9500',
                                                                border: '1px solid rgba(255, 149, 0, 0.3)',
                                                                padding: '6px 12px',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                        >
                                                            <Edit2 size={14} /> Update Config
                                                        </button>
                                                    );
                                                }
                                            }

                                            return (
                                                <React.Fragment key={idx}>
                                                    <tr
                                                        onClick={() => toggleMnemonic(m.mnemonic)}
                                                        style={{
                                                            borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.05)',
                                                            cursor: 'pointer',
                                                            background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
                                                            transition: 'background 0.2s'
                                                        }}
                                                    >
                                                        <td style={{ padding: '1rem', color: '#fff', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            {isExpanded ? <ChevronDown size={16} color="rgba(255,255,255,0.5)" /> : <ChevronRight size={16} color="rgba(255,255,255,0.5)" />}
                                                            {m.mnemonic}
                                                        </td>
                                                        <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{m.sample_bus}</td>
                                                        <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{m.total_rows}</td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <span style={{
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                background: m.status === 'Complete' ? 'rgba(52, 199, 89, 0.1)' : m.status === 'Unmatched' ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255, 149, 0, 0.1)',
                                                                color: m.status === 'Complete' ? '#34c759' : m.status === 'Unmatched' ? '#ff3b30' : '#ff9500',
                                                                border: `1px solid ${m.status === 'Complete' ? 'rgba(52, 199, 89, 0.3)' : m.status === 'Unmatched' ? 'rgba(255, 59, 48, 0.3)' : 'rgba(255, 149, 0, 0.3)'}`
                                                            }}>
                                                                {m.status}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            {actionButton}
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                                                            <td colSpan="5" style={{ padding: '0 0 1rem 3rem' }}>
                                                                <div style={{ padding: '1rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                                                                    {!details ? (
                                                                        <div style={{ color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <Loader2 size={16} className="animate-spin" /> Loading details...
                                                                        </div>
                                                                    ) : (
                                                                        <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                                                            <thead>
                                                                                <tr style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                                                                                    <th style={{ paddingBottom: '8px' }}>Bay ID</th>
                                                                                    <th style={{ paddingBottom: '8px' }}>Bus Name</th>
                                                                                    <th style={{ paddingBottom: '8px' }}>Load (MW / MVar)</th>
                                                                                    <th style={{ paddingBottom: '8px' }}>Status Detail</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {details.map((row, rIdx) => (
                                                                                    <tr key={rIdx} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                                                        <td style={{ padding: '8px 0', fontFamily: 'monospace', color: '#fff' }}>{row.bay_identifier}</td>
                                                                                        <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.7)' }}>{row.bus_name}</td>
                                                                                        <td style={{ padding: '8px 0', color: 'rgba(255,255,255,0.7)' }}>
                                                                                            {row.pload_mw} MW / {row.qload_mvar} MVar
                                                                                        </td>
                                                                                        <td style={{ padding: '8px 0' }}>
                                                                                            <span style={{
                                                                                                color: row.matched ? '#34c759' : '#ff3b30',
                                                                                                display: 'flex', alignItems: 'center', gap: '6px'
                                                                                            }}>
                                                                                                {row.matched ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                                                                                {row.status_detail}
                                                                                            </span>
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                                                No mnemonics found matching "{inspectorSearch}"
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
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
