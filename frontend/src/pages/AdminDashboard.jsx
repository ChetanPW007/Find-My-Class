import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getClassrooms, addClassroom, updateClassroom, deleteClassroom,
  getTeachers, addTeacher, updateTeacher, deleteTeacher,
  getDepartments, addDepartment, deleteDepartment,
} from '../api';
import Navbar from '../components/Navbar';
import TimetableEditor from '../components/TimetableEditor';
import PredictionPanel from '../components/PredictionPanel';
import AdminChatBot from '../components/AdminChatBot';
import './AdminDashboard.css';

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('classrooms');
  const [waveTrigger, setWaveTrigger] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('token') || localStorage.getItem('role') !== 'admin') {
      navigate('/admin/login');
    }
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const tabs = [
    { key: 'classrooms', label: '🏫 Classrooms' },
    { key: 'teachers', label: '👨‍🏫 Teachers' },
    { key: 'departments', label: '🏢 Departments' },
    { key: 'timetable', label: '📅 Timetable' },
    { key: 'predictions', label: '🧠 ML Predictions' },
  ];

  return (
    <div className="admin-page">
      <Navbar role="admin" name="Administrator" />
      <div className="page">
        <div className="page-header animate-fade-in" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1>⚙️ Admin Dashboard <span key={waveTrigger} className="waving-hand">👋</span></h1>
          <p>Manage classrooms, teachers, departments, timetables, and ML models</p>
        </div>

        {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

        <div className="tabs admin-tabs" style={{ margin: '0 auto 24px', width: 'fit-content' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(t.key);
                setWaveTrigger(prev => prev + 1);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="admin-content animate-fade-in">
          {activeTab === 'classrooms' && <ClassroomsManager showToast={showToast} />}
          {activeTab === 'teachers' && <TeachersManager showToast={showToast} />}
          {activeTab === 'departments' && <DepartmentsManager showToast={showToast} />}
          {activeTab === 'timetable' && <TimetableEditor showToast={showToast} />}
        </div>
      </div>
      <AdminChatBot />
    </div>
  );
}


/* ===== CLASSROOMS MANAGER ===== */
function ClassroomsManager({ showToast }) {
  const [classrooms, setClassrooms] = useState([]);
  const [allDepts, setAllDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', building: '', floor: '', room_number: '', type: 'classroom', capacity: '', has_smartboard: false, landmark: '' });
  const [editId, setEditId] = useState(null);

  // Search, Filter, Sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { 
      const res = await getClassrooms(); 
      setClassrooms(res.data); 
      const dRes = await getDepartments();
      setAllDepts(dRes.data);
    }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, capacity: parseInt(form.capacity) || 0 };
      if (editId) {
        await updateClassroom(editId, data);
        showToast('Classroom updated!');
      } else {
        await addClassroom(data);
        showToast('Classroom added!');
      }
      setShowModal(false);
      resetForm();
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this classroom?')) return;
    try {
      await deleteClassroom(id);
      showToast('Classroom deleted!');
      load();
    } catch (err) { showToast('Delete failed', 'error'); }
  };

  const handleEdit = (c) => {
    setForm({ 
      name: c.name, 
      department: c.department, 
      building: c.building, 
      floor: c.floor, 
      room_number: c.room_number, 
      type: c.type, 
      capacity: c.capacity?.toString() || '',
      has_smartboard: !!c.has_smartboard,
      landmark: c.landmark || ''
    });
    setEditId(c._id);
    setShowModal(true);
  };

  const resetForm = () => {
    setForm({ name: '', department: '', building: '', floor: '', room_number: '', type: 'classroom', capacity: '', has_smartboard: false, landmark: '' });
    setEditId(null);
  };

  // Logic for filtering and sorting
  const dynamicDepts = [...new Set(classrooms.map(c => c.department))].sort();
  const types = [...new Set(classrooms.map(c => c.type))].sort();

  const filteredClassrooms = classrooms
    .filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.building.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.room_number.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDept = !filterDept || c.department === filterDept;
      const matchesType = !filterType || c.type === filterType;

      return matchesSearch && matchesDept && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'capacity') return (b.capacity || 0) - (a.capacity || 0); // Descending capacity
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="section-header">
        <h2>Classrooms ({filteredClassrooms.length})</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + Add Classroom
        </button>
      </div>

      <div className="admin-controls">
        <div className="search-box">
          <input 
            type="text" 
            className="input" 
            placeholder="🔍 Search name, dept, building..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select className="select" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {dynamicDepts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Sort by Name</option>
            <option value="capacity">Sort by Capacity</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Name</th><th>Department</th><th>Location</th><th>Type</th><th>Capacity</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filteredClassrooms.map((c) => (
              <tr key={c._id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.department}</td>
                <td>
                  <div>{c.building}, {c.floor}</div>
                  <div style={{fontSize: '0.85em', color: '#666'}}>Room {c.room_number} {c.landmark && `(${c.landmark})`}</div>
                </td>
                <td><span className="badge badge-info">{c.type}</span></td>
                <td>{c.capacity}</td>
                <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(c)}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c._id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'Edit Classroom' : 'Add Classroom'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group"><label>Name</label><input className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required /></div>
              <div className="form-group">
                <label>Department</label>
                <select 
                  className="select" 
                  value={form.department} 
                  onChange={(e) => setForm({...form, department: e.target.value})} 
                  required
                >
                  <option value="">Select Department</option>
                  {allDepts.map(d => (
                    <option key={d._id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group"><label>Building</label><input className="input" value={form.building} onChange={(e) => setForm({...form, building: e.target.value})} required /></div>
                <div className="form-group"><label>Floor</label><input className="input" value={form.floor} onChange={(e) => setForm({...form, floor: e.target.value})} required /></div>
              </div>
              <div className="grid-2">
                <div className="form-group"><label>Room Number</label><input className="input" value={form.room_number} onChange={(e) => setForm({...form, room_number: e.target.value})} required /></div>
                <div className="form-group"><label>Capacity</label><input className="input" type="number" value={form.capacity} onChange={(e) => setForm({...form, capacity: e.target.value})} /></div>
              </div>
              <div className="form-group"><label>Landmark / Near Location</label><input className="input" placeholder="e.g. Near Library" value={form.landmark} onChange={(e) => setForm({...form, landmark: e.target.value})} /></div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="checkbox" 
                    checked={form.has_smartboard} 
                    onChange={(e) => setForm({...form, has_smartboard: e.target.checked})} 
                  />
                  SmartBoard Available
                </label>
              </div>
              <div className="form-group">
                <label>Type</label>
                <select className="select" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
                  <option value="classroom">Classroom</option>
                  <option value="laboratory">Laboratory</option>
                  <option value="hall">Hall</option>
                  <option value="chamber">Chamber</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== TEACHERS MANAGER ===== */
function TeachersManager({ showToast }) {
  const [teachers, setTeachers] = useState([]);
  const [allDepts, setAllDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', department: '', username: '', password: '', subjects: '' });
  const [editId, setEditId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { 
      const res = await getTeachers(); 
      setTeachers(res.data); 
      const dRes = await getDepartments();
      setAllDepts(dRes.data);
    }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        subjects: form.subjects.split(',').map((s) => s.trim()).filter(Boolean),
      };
      if (editId) {
        await updateTeacher(editId, payload);
        showToast('Teacher updated!');
      } else {
        await addTeacher(payload);
        showToast('Teacher added!');
      }
      setShowModal(false);
      resetForm();
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error', 'error');
    }
  };

  const handleEdit = (t) => {
    setForm({
      name: t.name || '',
      department: t.department || '',
      username: t.username || '',
      password: '',
      subjects: (t.subjects || []).join(', ')
    });
    setEditId(t._id);
    setShowModal(true);
  };

  const resetForm = () => {
    setForm({ name: '', department: '', username: '', password: '', subjects: '' });
    setEditId(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this teacher?')) return;
    try { await deleteTeacher(id); showToast('Teacher deleted!'); load(); }
    catch (err) { showToast('Delete failed', 'error'); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="section-header">
        <h2>Teachers ({teachers.length})</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + Add Teacher
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Name</th><th>Department</th><th>Username</th><th>Subjects</th><th>Actions</th></tr></thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t._id}>
                <td><strong>{t.name}</strong></td>
                <td>{t.department}</td>
                <td><code>{t.username}</code></td>
                <td>{(t.subjects || []).join(', ')}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(t)}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t._id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'Edit Teacher' : 'Add Teacher'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group"><label>Name</label><input className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required /></div>
              <div className="form-group">
                <label>Department</label>
                <select 
                  className="select" 
                  value={form.department} 
                  onChange={(e) => setForm({...form, department: e.target.value})} 
                  required
                >
                  <option value="">Select Department</option>
                  {allDepts.map(d => (
                    <option key={d._id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              {!editId && (
                <div className="grid-2">
                  <div className="form-group"><label>Username</label><input className="input" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} required={!editId} disabled={!!editId} /></div>
                  <div className="form-group"><label>Password</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} required={!editId} disabled={!!editId} /></div>
                </div>
              )}
              {editId && (
                <div className="form-group">
                  <label>Username</label>
                  <input className="input" value={form.username} disabled style={{ backgroundColor: '#f0f0f0', color: '#888' }} />
                  <small style={{ color: '#888', marginTop: '4px' }}>Username and password cannot be edited here.</small>
                </div>
              )}
              <div className="form-group"><label>Subjects (comma separated)</label><input className="input" value={form.subjects} onChange={(e) => setForm({...form, subjects: e.target.value})} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Add Teacher'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== DEPARTMENTS MANAGER ===== */
function DepartmentsManager({ showToast }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', building: '', hod: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { const res = await getDepartments(); setDepartments(res.data); }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDepartment(form);
      showToast('Department added!');
      setShowModal(false);
      setForm({ name: '', building: '', hod: '' });
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department?')) return;
    try { await deleteDepartment(id); showToast('Department deleted!'); load(); }
    catch (err) { showToast('Delete failed', 'error'); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="section-header">
        <h2>Departments ({departments.length})</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Department</button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Name</th><th>Building</th><th>HOD</th><th>Actions</th></tr></thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d._id}>
                <td><strong>{d.name}</strong></td>
                <td>{d.building}</td>
                <td>{d.hod}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(d._id)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Department</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group"><label>Name</label><input className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required /></div>
              <div className="form-group"><label>Building</label><input className="input" value={form.building} onChange={(e) => setForm({...form, building: e.target.value})} /></div>
              <div className="form-group"><label>HOD</label><input className="input" value={form.hod} onChange={(e) => setForm({...form, hod: e.target.value})} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Department</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
