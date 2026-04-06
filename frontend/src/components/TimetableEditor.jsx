import { useState, useEffect, useCallback } from 'react';
import {
  getTimetable, uploadTimetable, addTimetableEntry, addBatchTimetable,
  updateTimetableEntry, deleteTimetableEntry, saveTimetableGrid,
  getDepartments, getClassrooms, getTeachers,
} from '../api';
import TimetableGrid, { DEFAULT_SLOTS, DAYS } from './TimetableGrid';
import './TimetableEditor.css';

/* ────────────────────────────────────────────────────────────────────
   Helper: convert flat DB entries array → cellData map for TimetableGrid
   cellData key: "Monday-1" → { subject, teacher, span, _id, ... }
──────────────────────────────────────────────────────────────────── */
function entriesToCellData(entries) {
  const map = {};
  entries.forEach(e => {
    const key = `${e.day}-${e.slot}`;
    map[key] = {
      subject: e.subject,
      teacher: e.teacher,
      span: e.span || 1,
      classroom: e.classroom,
      _id: e._id,
    };
  });
  return map;
}

/* ────────────────────────────────────────────────────────────────────
   Helper: convert cellData map → flat array of entries for save-grid
──────────────────────────────────────────────────────────────────── */
function cellDataToEntries(cellData, department, section) {
  return Object.entries(cellData)
    .filter(([, v]) => v && v.subject?.trim())
    .map(([key, v]) => {
      const [day, slotStr] = key.split('-');
      const slot = parseInt(slotStr);
      const slotMeta = DEFAULT_SLOTS.find(s => s.slot === slot);
      return {
        day,
        slot,
        time_slot: slotMeta ? slotMeta.label : '',
        subject: v.subject.trim(),
        teacher: v.teacher?.trim() || '',
        classroom: v.classroom?.trim() || '',
        span: v.span || 1,
        department,
        section,
      };
    });
}

/* ────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
──────────────────────────────────────────────────────────────────── */
function TimetableEditor({ showToast }) {
  // View mode
  const [mode, setMode] = useState('grid'); // 'grid' | 'list' | 'upload'

  // Section/Dept selector
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [sectionInput, setSectionInput] = useState('');
  const [knownSections, setKnownSections] = useState([]); // sections found in DB

  // Grid data
  const [cellData, setCellData] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Reference data
  const [allDepts, setAllDepts] = useState([]);
  const [allClassrooms, setAllClassrooms] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);

  // List-view state
  const [entries, setEntries] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [filterDay, setFilterDay] = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm] = useState({
    day: '', slot: '', time_slot: '', subject: '', teacher: '',
    classroom: '', department: '', section: '', span: 1,
  });

  // OCR upload state
  const [uploading, setUploading] = useState(false);
  const [stagedEntries, setStagedEntries] = useState([]);
  const [showReview, setShowReview] = useState(false);

  // ── Load reference data on mount
  useEffect(() => {
    Promise.all([getDepartments(), getClassrooms(), getTeachers()])
      .then(([dRes, cRes, tRes]) => {
        setAllDepts(dRes.data);
        setAllClassrooms(cRes.data);
        setAllTeachers(tRes.data);
      })
      .catch(console.error);

    // Load all existing sections from DB
    getTimetable({}).then(res => {
      const sections = [...new Set(res.data.map(e => e.section).filter(Boolean))].sort();
      setKnownSections(sections);
      if (!selectedDept && res.data.length > 0) {
        const firstDept = res.data[0].department;
        setSelectedDept(firstDept);
      }
    }).catch(console.error);
  }, []);

  // ── Load grid when dept+section changes
  useEffect(() => {
    if (mode === 'grid' && selectedDept && selectedSection) {
      loadGrid();
    }
  }, [selectedDept, selectedSection, mode]);

  // ── Load list when filterDay changes (list mode)
  useEffect(() => {
    if (mode === 'list') loadList();
  }, [filterDay, mode]);

  const loadGrid = async () => {
    setLoadingGrid(true);
    setIsDirty(false);
    try {
      const params = { department: selectedDept, section: selectedSection };
      const res = await getTimetable(params);
      setCellData(entriesToCellData(res.data));
    } catch (e) { console.error(e); }
    setLoadingGrid(false);
  };

  const loadList = async () => {
    setLoadingList(true);
    try {
      const params = filterDay ? { day: filterDay } : {};
      const res = await getTimetable(params);
      setEntries(res.data);
    } catch (e) { console.error(e); }
    setLoadingList(false);
  };

  // ── Cell change handler for grid
  const handleCellChange = useCallback((day, slot, data) => {
    const key = `${day}-${slot}`;
    setCellData(prev => {
      const updated = { ...prev };
      if (data === null || !data?.subject?.trim()) {
        delete updated[key];
        // Also clear any spanned keys
        for (let s = 1; s <= 2; s++) {
          delete updated[`${day}-${slot + s}`];
        }
      } else {
        updated[key] = data;
        // Remove consumed span slots from previous entry if span changed
      }
      return updated;
    });
    setIsDirty(true);
  }, []);

  // ── Save grid
  const handleSaveGrid = async () => {
    if (!selectedDept || !selectedSection) {
      return showToast('Please select Department and Section first', 'error');
    }
    const sectionCode = selectedSection.toUpperCase().trim();
    if (!/^[A-Z0-9]{2,6}$/.test(sectionCode)) {
      return showToast('Section must be 2–6 alphanumeric characters (e.g. CY2A, CS1B)', 'error');
    }
    setSaving(true);
    try {
      const entriesToSave = cellDataToEntries(cellData, selectedDept, sectionCode);
      const res = await saveTimetableGrid({ department: selectedDept, section: sectionCode, entries: entriesToSave });
      showToast(res.data.message || '✅ Timetable saved!');
      setIsDirty(false);
      // Update known sections
      setKnownSections(prev => [...new Set([...prev, sectionCode])].sort());
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed', 'error');
    }
    setSaving(false);
  };

  // ── Apply section
  const applySection = () => {
    const code = sectionInput.trim().toUpperCase();
    if (!code) return;
    if (!/^[A-Z0-9]{2,6}$/.test(code)) {
      showToast('Section format: 2–6 chars like CY2A, CS1B, IY2A', 'error');
      return;
    }
    setSelectedSection(code);
    setSectionInput('');
  };

  /* ── List/OCR handlers ────────────────────────────────────────── */
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await uploadTimetable(formData);
      const extracted = res.data.entries || [];
      if (extracted.length > 0) {
        setStagedEntries(extracted);
        setShowReview(true);
        showToast(`✅ Extracted ${extracted.length} entries! Review and save.`);
      } else {
        showToast('⚠️ No entries extracted. Try a clearer image.', 'warning');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Upload failed', 'error');
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleSaveBatch = async () => {
    setUploading(true);
    try {
      const res = await addBatchTimetable(stagedEntries);
      showToast(res.data.message || 'Saved!');
      setStagedEntries([]);
      setShowReview(false);
      loadList();
    } catch (err) {
      showToast(err.response?.data?.error || 'Batch save failed', 'error');
    }
    setUploading(false);
  };

  const updateStagedEntry = (index, field, value) => {
    const updated = [...stagedEntries];
    updated[index] = { ...updated[index], [field]: value };
    setStagedEntries(updated);
  };

  const handleListSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, section: form.section.trim().toUpperCase(), span: parseInt(form.span) || 1 };
      if (editId) {
        await updateTimetableEntry(editId, payload);
        showToast('Entry updated!');
      } else {
        await addTimetableEntry(payload);
        showToast('Entry added!');
      }
      setShowModal(false);
      resetForm();
      loadList();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error', 'error');
    }
  };

  const handleListEdit = (entry) => {
    setForm({
      day: entry.day, slot: entry.slot || '', time_slot: entry.time_slot,
      subject: entry.subject, teacher: entry.teacher, classroom: entry.classroom,
      department: entry.department, section: entry.section || '', span: entry.span || 1,
    });
    setEditId(entry._id);
    setShowModal(true);
  };

  const handleListDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await deleteTimetableEntry(id); showToast('Deleted!'); loadList(); }
    catch (e) { showToast('Delete failed', 'error'); }
  };

  const resetForm = () => {
    setForm({ day: '', slot: '', time_slot: '', subject: '', teacher: '', classroom: '', department: '', section: '', span: 1 });
    setEditId(null);
  };

  /* ── Build subject legend colors from cellData ──────────────── */
  const subjectColors = {};
  const COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899','#84CC16','#F97316','#6366F1'];
  Object.values(cellData).forEach(v => {
    if (v?.subject && !subjectColors[v.subject]) {
      subjectColors[v.subject] = COLORS[Object.keys(subjectColors).length % COLORS.length];
    }
  });

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="timetable-editor">
      {/* Top bar */}
      <div className="section-header">
        <h2>📅 Timetable Manager</h2>
        <div className="te-mode-tabs">
          {[
            { key: 'grid',   label: '📊 Grid Editor' },
            { key: 'list',   label: '📋 List View' },
            { key: 'upload', label: '📸 OCR Upload' },
          ].map(m => (
            <button
              key={m.key}
              className={`tab ${mode === m.key ? 'active' : ''}`}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── GRID MODE ──────────────────────────────────────────── */}
      {mode === 'grid' && (
        <div className="animate-fade-in">
          {/* Section/Dept selector bar */}
          <div className="tt-section-bar">
            <label>Department:</label>
            <select className="select" style={{ width: 200 }} value={selectedDept} onChange={e => { setSelectedDept(e.target.value); setSelectedSection(''); setCellData({}); }}>
              <option value="">— Select Department —</option>
              {allDepts.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
            </select>

            <label style={{ marginLeft: 8 }}>Section:</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
              {/* Known sections as chips */}
              {knownSections.length > 0 && (
                <div className="tt-section-chips">
                  {knownSections.map(s => (
                    <button
                      key={s}
                      className={`tt-chip ${selectedSection === s ? 'active' : ''}`}
                      onClick={() => setSelectedSection(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {/* Manual section input */}
              <input
                className="input tt-section-input"
                placeholder="e.g. CY2A"
                maxLength={6}
                value={sectionInput}
                onChange={e => setSectionInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && applySection()}
              />
              <button className="btn btn-ghost btn-sm" onClick={applySection}>Go</button>
            </div>

            {/* Actions */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8. }}>
              {isDirty && (
                <span className="te-dirty-badge">Unsaved changes</span>
              )}
              <button
                className="btn btn-primary"
                onClick={handleSaveGrid}
                disabled={saving || !selectedDept || !selectedSection}
              >
                {saving ? '⏳ Saving...' : '💾 Save Timetable'}
              </button>
            </div>
          </div>

          {/* Grid info */}
          {selectedDept && selectedSection && (
            <div className="te-grid-info">
              <span className="te-info-pill">🏢 {selectedDept}</span>
              <span className="te-info-pill te-section-pill">🎓 Section: {selectedSection}</span>
              {Object.values(cellData).filter(v => v?.subject).length > 0 && (
                <span className="te-info-pill">
                  📚 {Object.values(cellData).filter(v => v?.subject).length} periods filled
                </span>
              )}
            </div>
          )}

          {/* Prompt if no selection */}
          {(!selectedDept || !selectedSection) && (
            <div className="empty-state">
              <div className="icon">📊</div>
              <h3>Select Department & Section</h3>
              <p>Choose a department and enter a section code (e.g. CY2A) to view or edit the timetable grid.</p>
            </div>
          )}

          {/* Grid */}
          {selectedDept && selectedSection && (
            loadingGrid ? (
              <div className="loading"><div className="spinner"></div></div>
            ) : (
              <>
                <TimetableGrid
                  cellData={cellData}
                  onCellChange={handleCellChange}
                  teachers={allTeachers}
                />

                {/* Legend */}
                {Object.keys(subjectColors).length > 0 && (
                  <div className="tt-legend">
                    {Object.entries(subjectColors).map(([subj, color]) => (
                      <div key={subj} className="tt-legend-item">
                        <div className="tt-legend-dot" style={{ background: color }} />
                        <span>{subj}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          )}
        </div>
      )}

      {/* ── LIST MODE ──────────────────────────────────────────── */}
      {mode === 'list' && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="day-filter" style={{ flex: 1 }}>
              <button className={`tab ${filterDay === '' ? 'active' : ''}`} onClick={() => setFilterDay('')}>All Days</button>
              {DAYS.map(d => (
                <button key={d} className={`tab ${filterDay === d ? 'active' : ''}`} onClick={() => setFilterDay(d)}>{d}</button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>+ Add Entry</button>
          </div>

          {loadingList ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📅</div>
              <h3>No timetable entries</h3>
              <p>Use the Grid Editor to fill in a timetable or add entries manually.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th>
                    <th>Section</th><th>Dept</th><th>Span</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e._id}>
                      <td><strong>{e.day}</strong></td>
                      <td>{e.time_slot}</td>
                      <td>{e.subject}</td>
                      <td>{e.teacher}</td>
                      <td><span className="badge badge-info">{e.section || '—'}</span></td>
                      <td>{e.department}</td>
                      <td>
                        {e.span > 1
                          ? <span className="badge badge-info">🧪 {e.span}hr Lab</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>1hr</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleListEdit(e)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleListDelete(e._id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add/Edit Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h2>{editId ? 'Edit Entry' : 'Add Timetable Entry'}</h2>
                <form onSubmit={handleListSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Day</label>
                      <select className="select" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} required>
                        <option value="">Select day</option>
                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Time Slot</label>
                      <select className="select" value={form.time_slot} onChange={e => {
                        const s = DEFAULT_SLOTS.find(sl => sl.label === e.target.value);
                        setForm({ ...form, time_slot: e.target.value, slot: s?.slot || 0 });
                      }}>
                        <option value="">Select slot</option>
                        {DEFAULT_SLOTS.filter(s => !s.isBreak).map(s => (
                          <option key={s.slot} value={s.label}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Subject</label>
                    <input className="input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Teacher</label>
                    <select className="select" value={form.teacher} onChange={e => setForm({ ...form, teacher: e.target.value })}>
                      <option value="">Select teacher</option>
                      {allTeachers.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Department</label>
                      <select className="select" value={form.department} onChange={e => setForm({ ...form, department: e.target.value, classroom: '' })} required>
                        <option value="">Select Dept</option>
                        {allDepts.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Section (e.g. CY2A)</label>
                      <input
                        className="input"
                        placeholder="CY2A"
                        maxLength={6}
                        value={form.section}
                        onChange={e => setForm({ ...form, section: e.target.value.toUpperCase() })}
                        style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}
                      />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Classroom</label>
                      <select className="select" value={form.classroom} onChange={e => setForm({ ...form, classroom: e.target.value })} disabled={!form.department}>
                        <option value="">Select Room</option>
                        {allClassrooms.filter(c => c.department === form.department).map(c => (
                          <option key={c._id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Duration</label>
                      <select className="select" value={form.span} onChange={e => setForm({ ...form, span: parseInt(e.target.value) })}>
                        <option value={1}>1 Hour (Normal)</option>
                        <option value={2}>2 Hours (Lab)</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Add Entry'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD/OCR MODE ───────────────────────────────────── */}
      {mode === 'upload' && (
        <div className="animate-fade-in">
          {!showReview ? (
            <div className="te-upload-zone">
              <div className="te-upload-icon">📸</div>
              <h3>Upload Timetable Image</h3>
              <p>Take a clear photo of your printed timetable. The AI will extract all entries automatically.</p>
              <label className="btn btn-accent" style={{ marginTop: 16 }}>
                {uploading ? '⏳ Processing...' : '📁 Choose File (Image / PDF / Doc)'}
                <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleUpload} hidden disabled={uploading} />
              </label>
              <div className="te-upload-tips">
                <span>💡 Tips: Ensure good lighting, full table visible, text is sharp</span>
              </div>
            </div>
          ) : (
            <div className="review-section animate-fade-in">
              <div className="review-header">
                <h3>🔍 Review Extracted Entries ({stagedEntries.length})</h3>
                <div className="review-actions">
                  <div className="bulk-edit">
                    <span>Bulk Set:</span>
                    <select className="select select-sm" onChange={e => {
                      const dept = e.target.value;
                      setStagedEntries(stagedEntries.map(entry => ({ ...entry, department: dept })));
                    }}>
                      <option value="">Dept</option>
                      {allDepts.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                    </select>
                    <input
                      className="input"
                      style={{ width: 80, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}
                      placeholder="Section"
                      maxLength={6}
                      onChange={e => {
                        const section = e.target.value.toUpperCase();
                        setStagedEntries(stagedEntries.map(entry => ({ ...entry, section })));
                      }}
                    />
                  </div>
                  <button className="btn btn-ghost" onClick={() => setShowReview(false)}>Cancel</button>
                  <button className="btn btn-success" onClick={handleSaveBatch} disabled={uploading || stagedEntries.length === 0}>
                    {uploading ? '⏳ Saving...' : `💾 Save All (${stagedEntries.length})`}
                  </button>
                </div>
              </div>
              <div className="table-wrapper staged-table">
                <table>
                  <thead>
                    <tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Section</th><th>Dept</th><th>Del</th></tr>
                  </thead>
                  <tbody>
                    {stagedEntries.map((e, idx) => (
                      <tr key={idx}>
                        <td>
                          <select className="select select-sm" value={e.day} onChange={ev => updateStagedEntry(idx, 'day', ev.target.value)}>
                            <option value="">--</option>
                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>
                        <td><input className="input input-sm" value={e.time_slot} onChange={ev => updateStagedEntry(idx, 'time_slot', ev.target.value)} /></td>
                        <td><input className="input input-sm" value={e.subject} onChange={ev => updateStagedEntry(idx, 'subject', ev.target.value)} /></td>
                        <td><input className="input input-sm" value={e.teacher} onChange={ev => updateStagedEntry(idx, 'teacher', ev.target.value)} /></td>
                        <td>
                          <input
                            className="input input-sm"
                            value={e.section || ''}
                            maxLength={6}
                            style={{ textTransform: 'uppercase', fontWeight: 700, width: 70 }}
                            onChange={ev => updateStagedEntry(idx, 'section', ev.target.value.toUpperCase())}
                          />
                        </td>
                        <td>
                          <select className="select select-sm" value={e.department} onChange={ev => updateStagedEntry(idx, 'department', ev.target.value)}>
                            <option value="">Dept</option>
                            {allDepts.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                          </select>
                        </td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => setStagedEntries(stagedEntries.filter((_, i) => i !== idx))}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TimetableEditor;
