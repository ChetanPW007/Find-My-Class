import { useState, useMemo } from 'react';
import './TimetableGrid.css';

// GM University time slots (matching backend DEFAULT_SLOTS)
const DEFAULT_SLOTS = [
  { slot: 1, label: '8:00–9:00',   start: '08:00', end: '09:00',  isBreak: false },
  { slot: 2, label: '9:00–10:00',  start: '09:00', end: '10:00',  isBreak: false },
  { slot: 3, label: '10:00–10:30', start: '10:00', end: '10:30',  isBreak: true,  breakLabel: 'Break' },
  { slot: 4, label: '10:30–11:30', start: '10:30', end: '11:30',  isBreak: false },
  { slot: 5, label: '11:30–12:30', start: '11:30', end: '12:30',  isBreak: false },
  { slot: 6, label: '12:30–1:30',  start: '12:30', end: '13:30',  isBreak: true,  breakLabel: 'Lunch Break' },
  { slot: 7, label: '1:30–2:30',   start: '13:30', end: '14:30',  isBreak: false },
  { slot: 8, label: '2:30–3:30',   start: '14:30', end: '15:30',  isBreak: false },
  { slot: 9, label: '3:30–5:00',   start: '15:30', end: '17:00',  isBreak: false },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Vivid colors for different subjects
const SUBJECT_COLORS = [
  '#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444',
  '#06B6D4','#EC4899','#84CC16','#F97316','#6366F1',
];

function getSubjectColor(subject, colorMap) {
  if (!subject) return null;
  if (!colorMap[subject]) {
    const idx = Object.keys(colorMap).length % SUBJECT_COLORS.length;
    colorMap[subject] = SUBJECT_COLORS[idx];
  }
  return colorMap[subject];
}

/**
 * TimetableGrid
 * Props:
 *  - cellData: { "Monday-1": { subject, teacher, span }, ... }
 *  - onCellChange(day, slot, data): called when a cell is edited
 *  - teachers: [{ _id, name }] list for dropdown
 *  - readOnly: boolean (student/teacher view mode)
 */
export default function TimetableGrid({ cellData = {}, onCellChange, teachers = [], readOnly = false }) {
  const [editing, setEditing] = useState(null); // { day, slot }
  const [editValues, setEditValues] = useState({ subject: '', teacher: '', span: 1 });
  const colorMap = useMemo(() => ({}), []);

  const getCellKey = (day, slot) => `${day}-${slot}`;

  const getCell = (day, slot) => cellData[getCellKey(day, slot)] || null;

  const openEdit = (day, slot) => {
    if (readOnly) return;
    const slotMeta = DEFAULT_SLOTS.find(s => s.slot === slot);
    if (slotMeta?.isBreak) return;
    const existing = getCell(day, slot);
    setEditValues({
      subject: existing?.subject || '',
      teacher: existing?.teacher || '',
      span: existing?.span || 1,
    });
    setEditing({ day, slot });
  };

  const saveEdit = () => {
    if (!editing) return;
    onCellChange && onCellChange(editing.day, editing.slot, editValues);
    setEditing(null);
  };

  const clearCell = () => {
    if (!editing) return;
    onCellChange && onCellChange(editing.day, editing.slot, null);
    setEditing(null);
  };

  // Check if a slot is "consumed" by a spanning cell in an earlier slot
  const isConsumedBySpan = (day, slot) => {
    for (let s = 1; s < slot; s++) {
      const cell = getCell(day, s);
      if (cell && cell.span > 1) {
        if (slot >= s + 1 && slot < s + cell.span) return true;
      }
    }
    return false;
  };

  return (
    <div className="tt-grid-wrapper">
      <div className="tt-grid-scroll">
        <table className="tt-grid-table">
          <thead>
            <tr>
              <th className="tt-day-header">Day / Time</th>
              {DEFAULT_SLOTS.map(s => (
                <th
                  key={s.slot}
                  className={`tt-slot-header ${s.isBreak ? 'tt-break-header' : ''}`}
                  title={s.label}
                >
                  <span className="tt-slot-num">Slot {s.slot}</span>
                  <span className="tt-slot-time">{s.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => (
              <tr key={day}>
                <td className="tt-day-label">
                  <span>{day.slice(0, 3).toUpperCase()}</span>
                </td>
                {DEFAULT_SLOTS.map(slotMeta => {
                  if (slotMeta.isBreak) {
                    return (
                      <td key={slotMeta.slot} className="tt-break-cell">
                        <span>{slotMeta.breakLabel}</span>
                      </td>
                    );
                  }

                  if (isConsumedBySpan(day, slotMeta.slot)) {
                    return null; // consumed by a 2-hour lab
                  }

                  const cell = getCell(day, slotMeta.slot);
                  const color = cell?.subject ? getSubjectColor(cell.subject, colorMap) : null;
                  const span = cell?.span || 1;
                  const isActive =
                    editing && editing.day === day && editing.slot === slotMeta.slot;

                  return (
                    <td
                      key={slotMeta.slot}
                      colSpan={span}
                      className={`tt-cell ${cell ? 'tt-cell-filled' : 'tt-cell-empty'} ${isActive ? 'tt-cell-active' : ''} ${readOnly ? '' : 'tt-cell-editable'}`}
                      style={color ? { '--cell-color': color } : {}}
                      onClick={() => openEdit(day, slotMeta.slot)}
                    >
                      {cell ? (
                        <>
                          <div className="tt-subject">{cell.subject}</div>
                          <div className="tt-teacher">👤 {cell.teacher || '—'}</div>
                          {span > 1 && <div className="tt-span-badge">2hr Lab</div>}
                        </>
                      ) : (
                        !readOnly && <div className="tt-empty-hint">+ Add</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inline Edit Panel */}
      {editing && (
        <div className="tt-edit-overlay" onClick={() => setEditing(null)}>
          <div className="tt-edit-panel" onClick={e => e.stopPropagation()}>
            <div className="tt-edit-header">
              <h3>✏️ Edit Cell</h3>
              <span className="tt-edit-meta">
                {editing.day} — {DEFAULT_SLOTS.find(s => s.slot === editing.slot)?.label}
              </span>
            </div>

            <div className="tt-edit-body">
              <div className="form-group">
                <label>Subject / Course Code</label>
                <input
                  className="input"
                  placeholder="e.g. AIML, DSC, ATC"
                  value={editValues.subject}
                  onChange={e => setEditValues(v => ({ ...v, subject: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Teacher</label>
                <select
                  className="select"
                  value={editValues.teacher}
                  onChange={e => setEditValues(v => ({ ...v, teacher: e.target.value }))}
                >
                  <option value="">— Select Teacher —</option>
                  {teachers.map(t => (
                    <option key={t._id} value={t.name}>{t.name}</option>
                  ))}
                  <option value="__custom__">✏️ Type manually</option>
                </select>
                {editValues.teacher === '__custom__' && (
                  <input
                    className="input"
                    style={{ marginTop: 8 }}
                    placeholder="Enter teacher name"
                    onChange={e => setEditValues(v => ({ ...v, teacher: e.target.value }))}
                  />
                )}
              </div>

              <div className="form-group">
                <label>Duration</label>
                <div className="tt-span-toggle">
                  <button
                    type="button"
                    className={`tt-span-btn ${editValues.span === 1 ? 'active' : ''}`}
                    onClick={() => setEditValues(v => ({ ...v, span: 1 }))}
                  >
                    ⏱ 1 Hour (Normal)
                  </button>
                  <button
                    type="button"
                    className={`tt-span-btn ${editValues.span === 2 ? 'active' : ''}`}
                    onClick={() => setEditValues(v => ({ ...v, span: 2 }))}
                  >
                    🧪 2 Hours (Lab)
                  </button>
                </div>
              </div>
            </div>

            <div className="tt-edit-actions">
              <button className="btn btn-danger btn-sm" onClick={clearCell}>🗑 Clear</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveEdit}>✓ Save Cell</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_SLOTS, DAYS };
