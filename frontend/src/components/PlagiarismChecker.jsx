import { useState, useRef, useEffect } from 'react';
import { analyzePlagiarism, getPlagiarismHistory, savePlagiarismReport } from '../api';
import './PlagiarismChecker.css';

function PlagiarismChecker() {
  const [activeSubTab, setActiveSubTab] = useState('new'); // 'new' or 'history'
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveMetadata, setSaveMetadata] = useState({ department: '', section: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewHistoryItem, setViewHistoryItem] = useState(null);
  
  const fileInputRef = useRef(null);
  const teacherId = localStorage.getItem('user_id');

  useEffect(() => {
    if (activeSubTab === 'history') {
      loadHistory();
    }
  }, [activeSubTab]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getPlagiarismHistory(teacherId);
      setHistory(res.data || []);
    } catch (err) {
      console.error('History load error:', err);
    }
    setHistoryLoading(false);
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => { setIsDragging(false); };
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const res = await analyzePlagiarism(formData);
      setResults(res.data.results);
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed. Make sure documents have readable text.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToHistory = async () => {
    setSaving(true);
    try {
      await savePlagiarismReport({
        ...saveMetadata,
        results,
        teacher_id: teacherId
      });
      setShowSaveModal(false);
      alert('Analysis saved to history successfully!');
    } catch (err) {
      alert('Failed to save report');
    }
    setSaving(false);
  };

  const reset = () => {
    setFiles([]);
    setResults(null);
    setError(null);
    setViewHistoryItem(null);
  };

  const renderResults = (data) => {
    const avgAI = Math.round(data.reduce((acc, r) => acc + r.ai_analysis.ai_percentage, 0) / data.length);
    const maxSim = Math.max(...data.flatMap(r => r.similarity.map(s => s.percentage) || [0]), 0);

    return (
      <>
        <div className="pc-total-stats animate-fade-in">
          <div className="pc-total-card">
            <span className="pc-total-val">{data.length}</span>
            <span className="pc-total-label">Documents</span>
          </div>
          <div className="pc-total-card" style={{ borderColor: avgAI > 40 ? 'var(--danger)' : 'var(--border)' }}>
            <span className="pc-total-val" style={{ color: avgAI > 40 ? 'var(--danger)' : 'var(--accent)' }}>{avgAI}%</span>
            <span className="pc-total-label">Avg AI Content</span>
          </div>
          <div className="pc-total-card" style={{ borderColor: maxSim > 50 ? 'var(--danger)' : 'var(--border)' }}>
            <span className="pc-total-val" style={{ color: maxSim > 50 ? 'var(--danger)' : 'var(--accent)' }}>{maxSim}%</span>
            <span className="pc-total-label">Max Similarity</span>
          </div>
        </div>

        <div className="pc-results-grid">
          {data.map((res, idx) => (
            <div key={idx} className="pc-result-card animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div className="pc-filename">📄 {res.filename}</div>
              
              <div className="pc-stats">
                <div className="pc-donut" style={{ '--val': `${res.ai_analysis.ai_percentage}%` }}>
                  <div className="pc-donut-text">
                    {res.ai_analysis.ai_percentage}%
                    <span className="pc-donut-label">AI</span>
                  </div>
                </div>
                
                <div className="pc-stat-info">
                  <div className="pc-stat-row">
                    <span>Human Writing</span>
                    <span>{res.ai_analysis.human_percentage}%</span>
                  </div>
                  <div className="pc-bar-container">
                    <div className="pc-bar" style={{ 
                        width: `${res.ai_analysis.human_percentage}%`, 
                        background: 'var(--success)' 
                    }}></div>
                  </div>
                </div>
              </div>

              <div className="pc-analysis-text">
                <div style={{ marginBottom: '8px', color: 'var(--text-primary)', fontWeight: '700' }}>
                  🤖 Prediction: {res.ai_analysis.ai_model_prediction || 'Unknown'}
                </div>
                <strong>Forensic Insight:</strong> {res.ai_analysis.analysis}
              </div>

              {res.ai_analysis.web_sources?.length > 0 && (
                <div className="pc-sources">
                  <h4>Potential Sources</h4>
                  {res.ai_analysis.web_sources.map((s, i) => (
                    <span key={i} className="pc-source-tag">{s}</span>
                  ))}
                </div>
              )}

              {res.similarity?.length > 0 && (
                <div className="pc-similarity-list">
                  <h4>Topical Overlap</h4>
                  {res.similarity.map((sim, i) => (
                    <div key={i} className="pc-sim-item">
                      <div className="pc-sim-header">
                        <span>Similar to {sim.filename}</span>
                        <span>{sim.percentage}%</span>
                      </div>
                      <div className="pc-bar-container">
                        <div className="pc-bar" style={{ 
                            width: `${sim.percentage}%`, 
                            background: sim.percentage > 50 ? 'var(--danger)' : 'var(--warning)' 
                        }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="pc-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>
          Deep Analysis Engine Running... (Checking Forensic Patterns)
        </p>
      </div>
    );
  }

  return (
    <div className="pc-container">
      <div className="tabs" style={{ marginBottom: '24px', background: 'var(--bg-surface-light)' }}>
        <button className={`tab ${activeSubTab === 'new' ? 'active' : ''}`} onClick={() => setActiveSubTab('new')}>🔍 New Analysis</button>
        <button className={`tab ${activeSubTab === 'history' ? 'active' : ''}`} onClick={() => setActiveSubTab('history')}>📚 Scan History</button>
      </div>

      {activeSubTab === 'new' && (
        <>
          {results ? (
            <>
              <div className="section-header">
                <h2>Analysis Result</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowSaveModal(true)}>💾 Save to History</button>
                  <button className="btn btn-ghost btn-sm" onClick={reset}>← New Scan</button>
                </div>
              </div>
              {renderResults(results)}
            </>
          ) : (
            <>
              {error && <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>}
              <div 
                className={`pc-upload-card ${isDragging ? 'dragging' : ''}`}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="pc-icon">📤</span>
                <h3>Deep Forensic Analysis</h3>
                <p>Upload PDFs, Word Docs, or TXT for AI % & Similarity checking</p>
                <input type="file" multiple hidden ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.doc,.txt" />
                {files.length > 0 && (
                  <div className="pc-file-list" onClick={e => e.stopPropagation()}>
                    {files.map((file, i) => (
                      <div key={i} className="pc-file-chip"><span>{file.name}</span><button onClick={() => removeFile(i)}>×</button></div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button className="btn btn-primary btn-lg" disabled={files.length === 0} onClick={handleAnalyze} style={{ width: '100%', maxWidth: '400px' }}>
                  Analyze {files.length} Documents
                </button>
              </div>
            </>
          )}
        </>
      )}

      {activeSubTab === 'history' && (
        <div className="pc-history-view">
          {viewHistoryItem ? (
            <>
              <div className="section-header">
                <div>
                  <h2>{viewHistoryItem.department} - {viewHistoryItem.section}</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{viewHistoryItem.description}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewHistoryItem(null)}>← Back to List</button>
              </div>
              {renderResults(viewHistoryItem.results)}
            </>
          ) : (
            <>
              <h2>Recent Scans</h2>
              {historyLoading ? (
                <div className="loading"><div className="spinner"></div></div>
              ) : history.length === 0 ? (
                <div className="empty-state">No saved scans found.</div>
              ) : (
                <div className="pc-history-list">
                  {history.map(item => (
                    <div key={item._id} className="pc-history-item card" onClick={() => setViewHistoryItem(item)}>
                      <div className="pc-item-meta">
                        <strong>{item.department} | Sec: {item.section}</strong>
                        <span>{new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="pc-item-stats">
                        <span className="badge badge-info">{item.total_docs} Docs</span>
                        <p>{item.description || 'No description provided'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal animate-pop-in" onClick={e => e.stopPropagation()}>
            <h2>💾 Save Analysis Report</h2>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Department Name</label>
              <input className="input" placeholder="e.g. Computer Science" value={saveMetadata.department} onChange={e => setSaveMetadata({...saveMetadata, department: e.target.value})} />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Section</label>
              <input className="input" placeholder="e.g. CY2A" maxLength={4} value={saveMetadata.section} onChange={e => setSaveMetadata({...saveMetadata, section: e.target.value.toUpperCase()})} />
            </div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>Description (Optional)</label>
              <textarea className="textarea" rows="3" placeholder="Notes about this analysis..." value={saveMetadata.description} onChange={e => setSaveMetadata({...saveMetadata, description: e.target.value})} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving || !saveMetadata.department || !saveMetadata.section} onClick={handleSaveToHistory}>
                {saving ? 'Saving...' : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlagiarismChecker;
