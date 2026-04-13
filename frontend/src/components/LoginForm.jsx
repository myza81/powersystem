import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Eye, EyeOff, User, Ghost, AlertCircle, ChevronRight, Unplug, Activity, Building2, Shield } from 'lucide-react';
import { InlineLoader } from './Loader';

const LoginForm = ({ onLogin, onAnonymous, error, loading }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(username, password);
    };

    const features = [
        { icon: Activity, label: 'Live Network Monitoring', desc: 'Real-time substation data and analytics' },
        { icon: Unplug, label: 'Load Shedding Operations', desc: 'Design and manage shedding schemes' },
        { icon: Building2, label: 'Asset Intelligence', desc: 'Comprehensive substation asset registry' },
    ];

    return (
        <div style={{
            display: 'flex',
            width: '100vw',
            height: '100vh',
            background: 'var(--bg-deep)',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* ── Left Panel: Branding ── */}
            <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{
                    flex: '1 1 55%',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '4rem',
                    overflow: 'hidden',
                }}
            >
                {/* Animated background glows */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(ellipse 80% 60% at 30% 50%, rgba(22, 192, 152, 0.05) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(ellipse 50% 40% at 70% 80%, rgba(2, 64, 49, 0.03) 0%, transparent 60%)',
                    pointerEvents: 'none',
                }} />

                {/* Grid overlay */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'linear-gradient(rgba(2, 64, 49, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(2, 64, 49, 0.03) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    pointerEvents: 'none',
                }} />

                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '3rem' }}
                >
                    {/* Icon removed per request */}
                    <div>
                        <div className="logo-text">
                            <span className="logo-text-bold">Grid</span> Defence
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                            Power System Intelligence
                        </div>
                    </div>
                </motion.div>

                {/* Headline */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.6 }}
                    style={{ marginBottom: '3rem' }}
                >
                    <h1 style={{
                        fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                        fontWeight: 700,
                        lineHeight: 1.15,
                        color: 'var(--text-primary)',
                        marginBottom: '1rem',
                        letterSpacing: '-0.02em',
                    }}>
                        Operate your grid<br />
                        <span className="text-gradient">with precision.</span>
                    </h1>
                    <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 420 }}>
                        A unified platform for substation asset management, load shedding operations, and real-time network intelligence.
                    </p>
                </motion.div>

                {/* Feature list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {features.map((f, i) => (
                        <motion.div
                            key={f.label}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: '14px',
                            }}
                        >
                            <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <f.icon size={16} color="var(--accent-blue)" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 2 }}>{f.label}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{f.desc}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Decorative bottom tag */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    style={{
                        position: 'absolute', bottom: '2rem', left: '4rem',
                        fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)',
                        letterSpacing: '0.05em',
                    }}
                >
                    GRID DEFENSE OPS © 2026
                </motion.div>
            </motion.div>

            {/* ── Divider ── */}
            <div style={{
                width: 1,
                background: 'linear-gradient(to bottom, transparent, rgba(2, 64, 49, 0.1) 30%, rgba(2, 64, 49, 0.1) 70%, transparent)',
                flexShrink: 0,
            }} />

            {/* ── Right Panel: Login Form ── */}
            <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{
                    flex: '0 0 420px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3rem 2.5rem',
                    position: 'relative',
                    background: 'var(--bg-card)',
                    borderLeft: '1px solid var(--border-color)',
                }}
            >
                <div style={{ width: '100%', maxWidth: 360 }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                    >
                        <h2 style={{
                            fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)',
                            marginBottom: '0.5rem', letterSpacing: '-0.02em',
                        }}>
                            Welcome back
                        </h2>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                            Sign in to your account to continue
                        </p>
                    </motion.div>

                    <motion.form
                        onSubmit={handleSubmit}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.45 }}
                    >
                        {/* Username */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{
                                display: 'block', marginBottom: '0.5rem',
                                fontSize: '0.8rem', fontWeight: 500,
                                color: 'var(--text-secondary)', letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                            }}>
                                Username
                            </label>
                            <div className="login-input-group">
                                <span className="login-input-icon">
                                    <User size={15} />
                                </span>
                                <input
                                    type="text"
                                    id="login-username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    className="login-input"
                                    autoComplete="username"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: '1.75rem' }}>
                            <label style={{
                                display: 'block', marginBottom: '0.5rem',
                                fontSize: '0.8rem', fontWeight: 500,
                                color: 'var(--text-secondary)', letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                            }}>
                                Password
                            </label>
                            <div className="login-input-group">
                                <span className="login-input-icon">
                                    <Shield size={15} />
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="login-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="login-input"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="login-eye-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* Error message */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="login-error"
                                style={{ marginBottom: '1.25rem' }}
                            >
                                <AlertCircle size={15} />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        {/* Sign In button */}
                        <motion.button
                            type="submit"
                            id="login-submit-btn"
                            className="login-submit-btn"
                            disabled={loading}
                            whileHover={!loading ? { scale: 1.01 } : {}}
                            whileTap={!loading ? { scale: 0.99 } : {}}
                            style={{ opacity: loading ? 0.75 : 1 }}
                        >
                            {loading ? (
                                <>
                                    <InlineLoader size={16} />
                                    Signing in…
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ChevronRight size={16} />
                                </>
                            )}
                        </motion.button>

                        {/* Divider */}
                        <div className="login-divider">
                            <span>or</span>
                        </div>

                        {/* Anonymous access */}
                        <motion.button
                            type="button"
                            id="login-anonymous-btn"
                            className="login-anon-btn"
                            onClick={onAnonymous}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                        >
                            <Ghost size={15} />
                            Continue as Guest
                        </motion.button>
                    </motion.form>

                    {/* Footer note */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        style={{
                            marginTop: '2rem',
                            fontSize: '0.75rem',
                            color: 'rgba(255,255,255,0.25)',
                            textAlign: 'center',
                            lineHeight: 1.5,
                        }}
                    >
                        New accounts are provisioned by your system administrator.
                    </motion.p>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginForm;
