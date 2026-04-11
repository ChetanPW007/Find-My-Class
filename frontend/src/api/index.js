import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (username, password) =>
  api.post('/auth/login', { username, password });

// Classrooms
export const getClassrooms = (params) => api.get('/classrooms', { params });
export const searchClassrooms = (q) => api.get('/classrooms/search', { params: { q } });
export const addClassroom = (data) => api.post('/classrooms', data);
export const updateClassroom = (id, data) => api.put(`/classrooms/${id}`, data);
export const deleteClassroom = (id) => api.delete(`/classrooms/${id}`);
export const updateClassroomStatus = (id, data) => api.put(`/classrooms/${id}/status`, data);
export const getUpcomingClasses = (id) => api.get(`/classrooms/${id}/upcoming`);

// Departments
export const getDepartments = () => api.get('/departments');
export const addDepartment = (data) => api.post('/departments', data);
export const deleteDepartment = (id) => api.delete(`/departments/${id}`);

// Teachers
export const getTeachers = (params) => api.get('/teachers', { params });
export const addTeacher = (data) => api.post('/teachers', data);
export const updateTeacher = (id, data) => api.put(`/teachers/${id}`, data);
export const deleteTeacher = (id) => api.delete(`/teachers/${id}`);

// Timetable
export const getTimetable = (params) => api.get('/timetable', { params });
export const getTimetableSlots = () => api.get('/timetable/slots');
export const uploadTimetable = (formData) =>
  api.post('/timetable/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const addTimetableEntry = (data) => api.post('/timetable', data);
export const addBatchTimetable = (data) => api.post('/timetable/batch', data);
export const updateTimetableEntry = (id, data) => api.put(`/timetable/${id}`, data);
export const deleteTimetableEntry = (id) => api.delete(`/timetable/${id}`);
export const saveTimetableGrid = (data) => api.post('/timetable/save-grid', data);
export const getScheduleCheck = () => api.get('/timetable/schedule-check');

// Notifications
export const getNotifications = () => api.get('/notifications');
export const createNotification = (data) => api.post('/notifications', data);
export const markNotificationsSeen = () => api.put('/notifications/mark-seen');
export const deleteNotification = (id) => api.delete(`/notifications/${id}`);

// Chatbot
export const sendChatMessage = (query) => api.post('/chatbot', { query });
export const sendAdminChatMessage = (formData) => 
  api.post('/admin/chatbot', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const rebuildChatIndex = () => api.post('/chatbot/rebuild');

// Predictions
export const predictOccupancy = (data) => api.post('/predict', data);
export const trainModel = () => api.post('/predict/train');
export const getPredictStats = () => api.get('/predict/stats');

// Plagiarism
export const analyzePlagiarism = (formData) =>
  api.post('/plagiarism/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getPlagiarismHistory = (teacherId) =>
  api.get(`/plagiarism/history`, { params: { teacher_id: teacherId } });
export const savePlagiarismReport = (data) =>
  api.post('/plagiarism/save', data);
export const getForensicStatus = () =>
  api.get('/plagiarism/forensic-status');

export default api;
