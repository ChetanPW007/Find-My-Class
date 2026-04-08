import { useState, useRef } from 'react';
import axios from 'axios';
import './PlagiarismChecker.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function PlagiarismChecker() {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

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
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const res = await axios.post(`${API_BASE_URL}/plagiarism/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResults(res.data.results);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to analyze documents');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setResults(null);
    setError(null);
  };

  if (loading) {
    return (
      <div className="pc-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>
          Analyzing documents with AI Similarity Engine...
        </p>
      </div>
    );
  }

  if (results) {
    return (
      <div className="pc-container">
        <div className="section-header">
          <h2>📊 Plagiarism Analysis Report</h2>
          <button className="btn btn-ghost btn-sm" onClick={reset}>← New Scan</button>
        </div>

        <div className="pc-total-stats">
          <div className="pc-total-card">
            <span className="pc-total-val">{results.length}</span>
            <span className="pc-total-label">Docs Scanned</span>
          </div>
          <div className="pc-total-card">
            <span className="pc-total-val">
              {Math.max(...results.map(r => r.ai_analysis.ai_percentage))}%
            </span>
            <span className="pc-total-label">Highest AI Score</span>
          </div>
          <div className="pc-total-card">
            <span className="pc-total-val">
              {Math.max(...results.flatMap(r => r.similarity.map(s => s.percentage) || [0]))}%
            </span>
            <span className="pc-total-label">Max Similarity</span>
          </div>
        </div>

        <div className="pc-results-grid">
          {results.map((res, idx) => (
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
                    <span>Human Score</span>
                    <span>{res.ai_analysis.human_percentage}%</span>
                  </div>
                  <div className="pc-bar-container">
                    <div 
                      className="pc-bar" 
                      style={{ 
                        width: `${res.ai_analysis.human_percentage}%`, 
                        background: 'var(--success)' 
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="pc-analysis-text">
                <div style={{ marginBottom: '8px', color: 'var(--text-primary)', fontWeight: '700' }}>
                  🤖 Prediction: {res.ai_analysis.ai_model_prediction || 'Unknown'}
                </div>
                <strong>AI Insight:</strong> {res.ai_analysis.analysis}
              </div>

              {res.ai_analysis.web_sources?.length > 0 && res.ai_analysis.web_sources[0] !== 'None' && (
                <div className="pc-sources">
                  <h4>Potential Web / AI Sources</h4>
                  {res.ai_analysis.web_sources.map((s, i) => (
                    <span key={i} className="pc-source-tag">{s}</span>
                  ))}
                </div>
              )}

              {res.similarity?.length > 0 && (
                <div className="pc-similarity-list">
                  <h4>Topical & Statement Overlap</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Comparing phrases and statement structure with other uploaded files.
                  </p>
                  {res.similarity.map((sim, i) => (
                    <div key={i} className="pc-sim-item">
                      <div className="pc-sim-header">
                        <span>Similar to {sim.filename}</span>
                        <span>{sim.percentage}%</span>
                      </div>
                      <div className="pc-bar-container">
                        <div 
                          className="pc-bar" 
                          style={{ 
                            width: `${sim.percentage}%`, 
                            background: sim.percentage > 50 ? 'var(--danger)' : 'var(--warning)' 
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pc-container">
      <div className="section-header">
        <h2>🔍 AI Plagiarism & Similarity Checker</h2>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>}

      <div 
        className={`pc-upload-card ${isDragging ? 'dragging' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="pc-icon">📤</span>
        <h3>Upload Files for Analysis</h3>
        <p>Drag and drop multiple PDFs, Word documents (.docx), or Text files</p>
        <input 
          type="file" 
          multiple 
          hidden 
          ref={fileInputRef} 
          onChange={handleFileChange}
          accept=".pdf,.docx,.doc,.txt"
        />
        
        {files.length > 0 && (
          <div className="pc-file-list" onClick={e => e.stopPropagation()}>
            {files.map((file, i) => (
              <div key={i} className="pc-file-chip">
                <span>{file.name}</span>
                <button 
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem' }}
                  onClick={() => removeFile(i)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
        <button 
          className="btn btn-primary btn-lg" 
          disabled={files.length === 0 || loading}
          onClick={handleAnalyze}
          style={{ width: '300px' }}
        >
          {loading ? 'Processing...' : `Analyze ${files.length} Document${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      <div className="auth-hint" style={{ marginTop: '24px' }}>
        <p>
          AI engine checks for **AI-generated content**, **web plagiarism**, and **inter-document similarity** 
          between all uploaded files. Supporting PDF, DOCX, and TXT.
        </p>
      </div>
    </div>
  );
}

export default PlagiarismChecker;
