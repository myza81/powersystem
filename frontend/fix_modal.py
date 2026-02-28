import re

with open('src/components/SubstationForm.jsx', 'r') as f:
    content = f.read()

# Find the AssetModal block
start_idx = content.find('const AssetModal = ({')
end_idx = content.find('const SubstationForm = ({')

if start_idx == -1 or end_idx == -1:
    print("Could not find blocks")
    exit(1)

new_modal = """const AssetModal = ({ type, data, onClose, onSave, assetLoading, assetStatus, assetForm, setAssetForm, substationOptions, substation, loadTransformers, autoTransformers, incomingBranches }) => {
    const isBranch = type === 'branch';
    const isLSR = type === 'lsr';
    const title = data?.id ? 'Edit' : 'Add';
    const typeLabel = isLSR ? 'Load Shedding Relay' : type === 'load' ? 'Load Transformer' : type === 'auto' ? 'Auto Transformer' : 'Incoming Branch';

    return (
        <AnimatePresence>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '1rem', width: '100%', maxWidth: '500px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', margin: 0 }}>{title} {typeLabel}</h3>
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '0.25rem' }}>Substation: {substation?.name} ({substation?.substation_id})</div>
                        </div>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}>
                            <X size={18} />
                        </button>
                    </div>

                    <AnimatePresence>
                        {assetStatus?.type === 'error' && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <AlertTriangle size={16} color="#ef4444" />
                                <span style={{ fontSize: '0.8rem', color: '#ef4444', lineHeight: 1.4 }}>{assetStatus.msg}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isLSR ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Relay Status</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Is this relay currently active?</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', height: '32px', gap: '10px' }}>
                                    <div
                                        onClick={() => setAssetForm(f => ({ ...f, is_active: !f.is_active }))}
                                        style={{
                                            width: '40px', height: '20px',
                                            background: assetForm.is_active !== false ? 'rgba(76, 175, 80, 0.4)' : 'rgba(255,255,255,0.1)',
                                            borderRadius: '20px', padding: '2px', cursor: 'pointer', position: 'relative',
                                            border: `1px solid ${assetForm.is_active !== false ? 'rgba(76, 175, 80, 0.5)' : 'rgba(255,255,255,0.2)'}`,
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        <motion.div animate={{ x: assetForm.is_active !== false ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            style={{ width: '14px', height: '14px', background: '#fff', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: assetForm.is_active !== false ? '#fff' : 'var(--text-secondary)', fontWeight: 500 }}>
                                        {assetForm.is_active !== false ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                            
                            <div>
                                <label style={inputLabelStyle}>Connected Load Transformers</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.4rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', alignItems: 'flex-start' }}>
                                    {loadTransformers?.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', width: '100%' }}>No load transformers available.</div>}
                                    {loadTransformers?.map((lt) => {
                                        const checked = (assetForm.load_transformers || []).includes(lt.id);
                                        return (
                                            <label key={lt.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px', cursor: 'pointer', background: checked ? 'rgba(0, 191, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)', border: `1px solid ${checked ? 'rgba(0, 191, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`, color: checked ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s', userSelect: 'none' }}>
                                                <input type="checkbox" checked={checked} onChange={(e) => {
                                                    const arr = assetForm.load_transformers || [];
                                                    setAssetForm(f => ({ ...f, load_transformers: e.target.checked ? [...arr, lt.id] : arr.filter(id => id !== lt.id) }));
                                                }} style={{ display: 'none' }} />
                                                <span className="mono">{lt.bay_id}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label style={inputLabelStyle}>Connected Auto Transformers</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.4rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', alignItems: 'flex-start' }}>
                                    {autoTransformers?.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', width: '100%' }}>No auto transformers available.</div>}
                                    {autoTransformers?.map((at) => {
                                        const checked = (assetForm.auto_transformers || []).includes(at.id);
                                        return (
                                            <label key={at.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px', cursor: 'pointer', background: checked ? 'rgba(0, 191, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)', border: `1px solid ${checked ? 'rgba(0, 191, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`, color: checked ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s', userSelect: 'none' }}>
                                                <input type="checkbox" checked={checked} onChange={(e) => {
                                                    const arr = assetForm.auto_transformers || [];
                                                    setAssetForm(f => ({ ...f, auto_transformers: e.target.checked ? [...arr, at.id] : arr.filter(id => id !== at.id) }));
                                                }} style={{ display: 'none' }} />
                                                <span className="mono">{at.bay_id}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label style={inputLabelStyle}>Connected Incoming Branches</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.4rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', alignItems: 'flex-start' }}>
                                    {incomingBranches?.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', width: '100%' }}>No branches available.</div>}
                                    {incomingBranches?.map((ib) => {
                                        const checked = (assetForm.incoming_branches || []).includes(ib.id);
                                        return (
                                            <label key={ib.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px', cursor: 'pointer', background: checked ? 'rgba(0, 191, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)', border: `1px solid ${checked ? 'rgba(0, 191, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`, color: checked ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s', userSelect: 'none' }}>
                                                <input type="checkbox" checked={checked} onChange={(e) => {
                                                    const arr = assetForm.incoming_branches || [];
                                                    setAssetForm(f => ({ ...f, incoming_branches: e.target.checked ? [...arr, ib.id] : arr.filter(id => id !== ib.id) }));
                                                }} style={{ display: 'none' }} />
                                                <span className="mono">{ib.bay_id}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label style={inputLabelStyle}>Relay Notes</label>
                                <textarea className="input-field" value={assetForm.notes || ''} onChange={(e) => setAssetForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any details..." rows={2} style={{ resize: 'vertical' }} />
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            {isBranch ? (
                                <>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={inputLabelStyle}>Target Station</label>
                                        <select className="input-field" value={assetForm.to_substation || ''} onChange={(e) => setAssetForm(f => ({ ...f, to_substation: e.target.value }))}>
                                            <option value="">-- Select Substation --</option>
                                            {substationOptions.map((s) => (
                                                <option key={s.substation_id} value={s.substation_id}>{s.name} ({s.substation_id})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={inputLabelStyle}>Circuit No</label>
                                        <input className="input-field mono" value={assetForm.ckt_id || ''} onChange={(e) => setAssetForm(f => ({ ...f, ckt_id: e.target.value }))} placeholder="1" />
                                    </div>
                                    <div>
                                        <label style={inputLabelStyle}>Breaker ID</label>
                                        <input className="input-field mono" value={assetForm.breaker_number || ''} onChange={(e) => setAssetForm(f => ({ ...f, breaker_number: e.target.value }))} placeholder="e.g., 105" />
                                    </div>
                                    <div>
                                        <label style={inputLabelStyle}>Commissioning Date <span style={{ color: 'var(--text-secondary)', fontSize: '0.6rem' }}>(Optional)</span></label>
                                        <input className="input-field mono" type="date" value={assetForm.commissioning_date || ''} onChange={(e) => setAssetForm(f => ({ ...f, commissioning_date: e.target.value }))} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label style={inputLabelStyle}>Unit Number</label>
                                        <input className="input-field mono" type="number" value={assetForm.transformer_no || ''} onChange={(e) => setAssetForm(f => ({ ...f, transformer_no: e.target.value }))} placeholder="e.g., 1" />
                                    </div>
                                    <div>
                                        <label style={inputLabelStyle}>LV (kV)</label>
                                        <select className="input-field mono" value={assetForm.lv_voltage || ''} onChange={(e) => setAssetForm(f => ({ ...f, lv_voltage: e.target.value }))}>
                                            <option value="">-- Select --</option>
                                            {(type === 'load' ? LOAD_LV : AUTO_LV).map(v => <option key={v} value={v}>{v} kV</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={inputLabelStyle}>Capacity (MVA)</label>
                                        <input className="input-field mono" type="number" value={assetForm.capacity_mva || ''} onChange={(e) => setAssetForm(f => ({ ...f, capacity_mva: e.target.value }))} placeholder="e.g., 30" />
                                    </div>
                                    <div>
                                        <label style={inputLabelStyle}>Commissioning Date <span style={{ color: 'var(--text-secondary)', fontSize: '0.6rem' }}>(Optional)</span></label>
                                        <input className="input-field mono" type="date" value={assetForm.commissioning_date || ''} onChange={(e) => setAssetForm(f => ({ ...f, commissioning_date: e.target.value }))} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button onClick={onClose}
                            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(type)}
                            className="btn-primary"
                            style={{ flex: 2, padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                            disabled={assetLoading}
                        >
                            {assetLoading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                            {assetLoading ? 'Saving...' : 'Save Asset'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
"""

new_content = content[:start_idx] + new_modal + content[end_idx:]

with open('src/components/SubstationForm.jsx', 'w') as f:
    f.write(new_content)

print("Modal patched successfully!")
