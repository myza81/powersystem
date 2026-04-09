import React, { useMemo, useState } from 'react';

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const describeArc = (cx, cy, radius, startAngle, endAngle) => {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

    return [
        'M', start.x, start.y,
        'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(' ');
};

const polarToCartesian = (cx, cy, radius, angleInDegrees) => {
    const angleInRadians = toRadians(angleInDegrees - 90);
    return {
        x: cx + (radius * Math.cos(angleInRadians)),
        y: cy + (radius * Math.sin(angleInRadians)),
    };
};

const gradients = [
    ['#7dd3fc', '#2563eb'],
    ['#fbcfe8', '#ec4899'],
    ['#c4b5fd', '#7c3aed'],
    ['#bbf7d0', '#16a34a'],
    ['#fed7aa', '#f97316'],
    ['#ffedd5', '#ea580c'],
];

const AuroraRingChart = ({ data = [], labelKey = 'label', valueKey = 'value', fuiMode = false }) => {
    const [hovered, setHovered] = useState(null);

    const segments = useMemo(() => {
        const cleaned = data
            .map((item) => ({
                label: item[labelKey] || 'Unknown',
                value: Number(item[valueKey]) || 0,
            }))
            .filter((item) => item.value > 0);
        const total = cleaned.reduce((sum, item) => sum + item.value, 0);

        let startAngle = 0;
        const mapped = cleaned.map((item, idx) => {
            const percent = total > 0 ? item.value / total : 0;
            const sweep = percent * 360;
            const segment = {
                ...item,
                percent,
                start: startAngle,
                end: startAngle + sweep,
                gradient: gradients[idx % gradients.length],
            };
            startAngle += sweep;
            return segment;
        });

        return { total, mapped };
    }, [data, labelKey, valueKey]);

    const size = 320;
    const center = size / 2;
    const radius = 110;
    const strokeWidth = 26;

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: fuiMode ? '1fr' : '200px 1fr',
            gap: '1.5rem',
            alignItems: 'center',
            width: '100%',
        }}>
            <div style={{
                position: 'relative',
                background: fuiMode ? 'transparent' : 'radial-gradient(circle at top, rgba(255,255,255,0.25), rgba(15,23,42,0.9))',
                borderRadius: '28px',
                padding: fuiMode ? '0' : '1.25rem',
                boxShadow: fuiMode ? 'none' : '0 20px 45px rgba(15,23,42,0.25)',
            }}>
                <svg width="200" height="200" viewBox={`0 0 ${size} ${size}`}>
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth={strokeWidth}
                    />
                    <defs>
                        {segments.mapped.map((segment, idx) => (
                            <linearGradient
                                key={idx}
                                id={`aurora-grad-${idx}`}
                                gradientTransform="rotate(25)"
                            >
                                <stop offset="0%" stopColor={segment.gradient[0]} />
                                <stop offset="100%" stopColor={segment.gradient[1]} />
                            </linearGradient>
                        ))}
                    </defs>
                    {segments.mapped.map((segment, idx) => (
                        <path
                            key={idx}
                            d={describeArc(center, center, radius, segment.start, segment.end)}
                            fill="none"
                            stroke={`url(#aurora-grad-${idx})`}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            opacity={hovered === null || hovered === idx ? 1 : 0.25}
                            style={{
                                filter: hovered === idx ? `drop-shadow(0 0 12px ${segment.gradient[1]})` : 'none',
                                transition: 'opacity 0.2s ease, filter 0.2s ease',
                            }}
                            onMouseEnter={() => setHovered(idx)}
                            onMouseLeave={() => setHovered(null)}
                        />
                    ))}
                    <g>
                        <text
                            x={center}
                            y={center - 6}
                            textAnchor="middle"
                            style={{ fill: '#e2e8f0', fontSize: '0.75rem', letterSpacing: '0.2em' }}
                        >
                            TOTAL
                        </text>
                        <text
                            x={center}
                            y={center + 22}
                            textAnchor="middle"
                            style={{ fill: fuiMode ? '#fff' : '#fff', fontSize: '1.6rem', fontWeight: 600, textShadow: fuiMode ? '0 0 10px rgba(255,255,255,0.3)' : 'none' }}
                        >
                            {segments.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW
                        </text>
                    </g>
                </svg>
            </div>
            {!fuiMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {segments.mapped.map((segment, idx) => (
                        <button
                            key={segment.label + idx}
                            onMouseEnter={() => setHovered(idx)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.85rem 1rem',
                                borderRadius: '18px',
                                border: '1px solid rgba(15,23,42,0.08)',
                                background: hovered === idx ? 'rgba(15,23,42,0.04)' : '#fff',
                                cursor: 'pointer',
                                textAlign: 'left'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: segment.gradient[1] }} />
                                <div>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{segment.label}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>{(segment.percent * 100).toFixed(1)}%</div>
                                </div>
                            </div>
                            <div style={{ fontWeight: 600, fontFamily: 'monospace', color: '#0f172a' }}>
                                {segment.value.toFixed(1)} MW
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AuroraRingChart;
