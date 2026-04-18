import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, User, Ghost, AlertCircle, ChevronRight, Shield } from 'lucide-react';
import { InlineLoader } from './Loader';


const LoginForm = ({ onLogin, onAnonymous, error, loading }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(username, password);
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(145deg, #e8f5f0 0%, #f0f7f4 50%, #eaf4f0 100%)',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: "'Poppins', sans-serif",
        }}>
            {/* Background grid */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(rgba(2,64,49,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(2,64,49,0.05) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
            }} />

            {/* Radial glow */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(2,64,49,0.06) 0%, transparent 70%)',
            }} />

            {/* Card */}
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    maxWidth: '420px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '20px',
                    padding: '2.5rem',
                    boxShadow: '0 8px 40px rgba(2,64,49,0.1), 0 1px 3px rgba(0,0,0,0.06)',
                }}
            >
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{ marginBottom: '2rem' }}
                >
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#024031', letterSpacing: '-0.02em' }}>
                        Grid <span style={{ fontWeight: 400 }}>Defence</span>
                    </div>
                    <div style={{
                        fontSize: '0.7rem', color: '#64748b',
                        letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '3px',
                    }}>
                        Load Shedding Scheme Management
                    </div>
                </motion.div>

                {/* Heading */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    style={{ marginBottom: '1.75rem' }}
                >
                    <h1 style={{
                        margin: 0, fontSize: '1.5rem', fontWeight: 700,
                        color: '#0f172a', letterSpacing: '-0.02em',
                        lineHeight: 1.2, marginBottom: '0.35rem',
                    }}>
                        Welcome back
                    </h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
                        Sign in to your account to continue
                    </p>
                </motion.div>

                {/* Form */}
                <motion.form
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    {/* Username */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block', marginBottom: '0.4rem',
                            fontSize: '0.72rem', fontWeight: 600,
                            color: '#475569',
                            textTransform: 'uppercase', letterSpacing: '0.07em',
                        }}>
                            Username
                        </label>
                        <div className="login-input-group">
                            <span className="login-input-icon"><User size={14} /></span>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className="login-input"
                                autoComplete="username"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'block', marginBottom: '0.4rem',
                            fontSize: '0.72rem', fontWeight: 600,
                            color: '#475569',
                            textTransform: 'uppercase', letterSpacing: '0.07em',
                        }}>
                            Password
                        </label>
                        <div className="login-input-group">
                            <span className="login-input-icon"><Shield size={14} /></span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="login-input"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="login-eye-btn"
                                onClick={() => setShowPassword(v => !v)}
                                tabIndex={-1}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="login-error"
                            style={{ marginBottom: '1.25rem' }}
                        >
                            <AlertCircle size={14} />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    {/* Sign In */}
                    <motion.button
                        type="submit"
                        className="login-submit-btn"
                        disabled={loading}
                        whileHover={!loading ? { scale: 1.01 } : {}}
                        whileTap={!loading ? { scale: 0.99 } : {}}
                        style={{ opacity: loading ? 0.75 : 1 }}
                    >
                        {loading ? (
                            <><InlineLoader size={15} /> Signing in…</>
                        ) : (
                            <>Sign In <ChevronRight size={15} /></>
                        )}
                    </motion.button>

                    {/* Divider */}
                    <div className="login-divider"><span>or</span></div>

                    {/* Guest */}
                    <motion.button
                        type="button"
                        className="login-anon-btn"
                        onClick={onAnonymous}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                    >
                        <Ghost size={14} />
                        Continue as Guest
                    </motion.button>
                </motion.form>


                {/* Footer */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    style={{
                        marginTop: '1.25rem', marginBottom: 0,
                        fontSize: '0.7rem', color: '#94a3b8',
                        textAlign: 'center', lineHeight: 1.5,
                    }}
                >
                    New accounts are provisioned by your system administrator.
                </motion.p>
            </motion.div>
        </div>
    );
};

export default LoginForm;
