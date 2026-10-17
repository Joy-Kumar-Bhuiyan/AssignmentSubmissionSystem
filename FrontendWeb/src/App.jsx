import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api';

// Helper function to safely parse arrays from standard JSON or EF Core $values wrapping
const parseArrayData = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.$values)) return data.$values;
  if (data && Array.isArray(data.data)) return data.data; // Handles paginated responses
  return [];
};

export default function App() {
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || '');
  const [email, setEmail] = useState(localStorage.getItem('email') || '');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Data States (Safely initialized as empty arrays)
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [settings, setSettings] = useState({ AcademicYear: '', AllowLateSubmissions: 'true' });

  // Form States
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'Student', classId: '' });
  const [newClass, setNewClass] = useState({ name: '', section: '' });
  const [newSubject, setNewSubject] = useState({ name: '', code: '' });
  const [newAllocation, setNewAllocation] = useState({ teacherEmail: '', classId: '', subjectId: '' });

  const [assignmentForm, setAssignmentForm] = useState({
    id: null,
    title: '',
    description: '',
    maxMarks: 100,
    dueDate: '',
    isDraft: false,
    classId: '',
    subjectId: ''
  });

  const [selectedAssignmentFilter, setSelectedAssignmentFilter] = useState('ALL');

  // Modal State for Student Submissions
  const [submitModal, setSubmitModal] = useState({ open: false, assignmentId: null, answerText: '' });

  // ---------------------------------------------------------------------------
  // API Fetch Functions
  // ---------------------------------------------------------------------------
  const fetchAssignments = async () => {
    try {
      const res = await fetch(`${API_BASE}/assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(parseArrayData(data));
      } else {
        setAssignments([]);
      }
    } catch {
      setAssignments([]);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const endpoint = role === 'Student' ? `${API_BASE}/submissions/my` : `${API_BASE}/submissions`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(parseArrayData(data));
      } else {
        setSubmissions([]);
      }
    } catch {
      setSubmissions([]);
    }
  };

  const fetchUsers = async () => {
    if (role !== 'Admin') return;
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(parseArrayData(data));
      } else {
        setUsersList([]);
      }
    } catch {
      setUsersList([]);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch(`${API_BASE}/classes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassList(parseArrayData(data));
      } else {
        setClassList([]);
      }
    } catch {
      setClassList([]);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/subjects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubjectList(parseArrayData(data));
      } else {
        setSubjectList([]);
      }
    } catch {
      setSubjectList([]);
    }
  };

  const fetchAllocations = async () => {
    if (role !== 'Admin') return;
    try {
      const res = await fetch(`${API_BASE}/allocations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllocations(parseArrayData(data));
      } else {
        setAllocations([]);
      }
    } catch {
      setAllocations([]);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const settingsObj = {};
        parseArrayData(data).forEach((item) => {
          settingsObj[item.key] = item.value;
        });
        setSettings(settingsObj);
      }
    } catch {
      // Retain defaults if fetch fails
    }
  };

  // Load portal data when token or role changes
  useEffect(() => {
    if (token) {
      fetchAssignments();
      fetchSubmissions();
      fetchClasses();
      fetchSubjects();
      fetchSettings();
      if (role === 'Admin') {
        fetchUsers();
        fetchAllocations();
      }
    }
  }, [token, role]);

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setRole(data.role);
        setEmail(data.email);
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('email', data.email);
      } else {
        setLoginError(data.message || 'Invalid login credentials');
      }
    } catch {
      setLoginError('Could not connect to server.');
    }
  };

  const handleLogout = () => {
    setToken('');
    setRole('');
    setEmail('');
    localStorage.clear();
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newUser,
          classId: newUser.classId ? parseInt(newUser.classId) : null
        })
      });
      if (res.ok) {
        alert('User created successfully!');
        setNewUser({ email: '', password: '', role: 'Student', classId: '' });
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to create user');
      }
    } catch {
      alert('Error creating user.');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert('Failed to delete user.');
      }
    } catch {
      alert('Error deleting user.');
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newClass)
      });
      if (res.ok) {
        setNewClass({ name: '', section: '' });
        fetchClasses();
      }
    } catch {
      alert('Failed to create class.');
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newSubject)
      });
      if (res.ok) {
        setNewSubject({ name: '', code: '' });
        fetchSubjects();
      }
    } catch {
      alert('Failed to create subject.');
    }
  };

  const handleCreateAllocation = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/allocations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          teacherEmail: newAllocation.teacherEmail,
          classId: parseInt(newAllocation.classId),
          subjectId: parseInt(newAllocation.subjectId)
        })
      });
      if (res.ok) {
        setNewAllocation({ teacherEmail: '', classId: '', subjectId: '' });
        fetchAllocations();
      }
    } catch {
      alert('Failed to assign teacher.');
    }
  };

  const handleSaveSetting = async (key, value) => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key, value })
      });
      if (res.ok) {
        alert(`Setting "${key}" updated successfully!`);
        fetchSettings();
      }
    } catch {
      alert('Failed to update setting.');
    }
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    const payload = {
      title: assignmentForm.title,
      description: assignmentForm.description,
      maxMarks: parseInt(assignmentForm.maxMarks),
      dueDate: assignmentForm.dueDate || null,
      isDraft: assignmentForm.isDraft,
      classId: assignmentForm.classId ? parseInt(assignmentForm.classId) : null,
      subjectId: assignmentForm.subjectId ? parseInt(assignmentForm.subjectId) : null
    };

    const isEdit = !!assignmentForm.id;
    const url = isEdit ? `${API_BASE}/assignments/${assignmentForm.id}` : `${API_BASE}/assignments`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(isEdit ? 'Assignment updated!' : 'Assignment created!');
        setAssignmentForm({
          id: null,
          title: '',
          description: '',
          maxMarks: 100,
          dueDate: '',
          isDraft: false,
          classId: '',
          subjectId: ''
        });
        fetchAssignments();
      }
    } catch {
      alert('Failed to save assignment.');
    }
  };

  const handleEditClick = (assignment) => {
    setAssignmentForm({
      id: assignment.id,
      title: assignment.title || '',
      description: assignment.description || '',
      maxMarks: assignment.maxMarks || 100,
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 16) : '',
      isDraft: assignment.isDraft || false,
      classId: assignment.classId || '',
      subjectId: assignment.subjectId || ''
    });
  };

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm('Delete this assignment?')) return;
    try {
      const res = await fetch(`${API_BASE}/assignments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAssignments();
      }
    } catch {
      alert('Failed to delete assignment.');
    }
  };

  const handleOpenSubmitModal = (assignmentId) => {
    setSubmitModal({ open: true, assignmentId, answerText: '' });
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          assignmentId: submitModal.assignmentId,
          answerText: submitModal.answerText
        })
      });

      if (res.ok) {
        alert('Assignment submitted successfully!');
        setSubmitModal({ open: false, assignmentId: null, answerText: '' });
        fetchSubmissions();
      } else {
        const err = await res.json();
        alert(err.message || 'Submission failed.');
      }
    } catch {
      alert('Error submitting assignment.');
    }
  };

  const handleGradeSubmission = async (submissionId) => {
    const marksStr = prompt('Enter assigned marks:');
    if (marksStr === null) return;
    const feedback = prompt('Enter feedback for student:') || '';

    try {
      const res = await fetch(`${API_BASE}/submissions/${submissionId}/grade`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          marks: parseInt(marksStr),
          feedback,
          status: 'Graded'
        })
      });

      if (res.ok) {
        alert('Graded successfully!');
        fetchSubmissions();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to grade submission.');
      }
    } catch {
      alert('Error grading submission.');
    }
  };

  // ---------------------------------------------------------------------------
  // Safe Array Operations & Tag Helpers
  // ---------------------------------------------------------------------------
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const safeSubmissions = Array.isArray(submissions) ? submissions : [];
  const safeUsersList = Array.isArray(usersList) ? usersList : [];
  const safeClassList = Array.isArray(classList) ? classList : [];
  const safeSubjectList = Array.isArray(subjectList) ? subjectList : [];
  const safeAllocations = Array.isArray(allocations) ? allocations : [];

  const getAssignmentTags = (a) => {
    const cls = safeClassList.find((c) => c.id === a.classId);
    const sub = safeSubjectList.find((s) => s.id === a.subjectId);
    return {
      className: cls ? `${cls.name} (${cls.section})` : null,
      subjectName: sub ? `${sub.name}` : null
    };
  };

  const filteredSubmissions = safeSubmissions.filter(
    (s) => selectedAssignmentFilter === 'ALL' || s.assignmentId === parseInt(selectedAssignmentFilter)
  );

  const pendingAssignments = safeAssignments.filter(
    (a) => !safeSubmissions.some((s) => s.assignmentId === a.id)
  );

  // ---------------------------------------------------------------------------
  // Unauthenticated Render (Login Page)
  // ---------------------------------------------------------------------------
  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-main)' }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
            School Portal Login
          </h2>
          {loginError && <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '12px' }}>{loginError}</p>}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '4px' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Authenticated Render (Portal Dashboard)
  // ---------------------------------------------------------------------------
  return (
    <div>
      {/* Top Navbar */}
      <nav className="navbar">
        <div>
          <h3 style={{ fontSize: '18px' }}>School Portal</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {email} <span className={`badge badge-${role}`}>{role}</span>
          </span>
          <button onClick={handleLogout} className="btn btn-danger btn-sm">
            Logout
          </button>
        </div>
      </nav>

      {/* Main Dashboard Layout */}
      <main className="app-container">
        {/* ADMIN VIEW */}
        {role === 'Admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
            {/* Create User Form */}
            <div className="card">
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                Admin Panel: Create New User
              </h2>
              <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <input
                  type="email"
                  placeholder="Email address"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                >
                  <option value="Student">Student</option>
                  <option value="Teacher">Teacher</option>
                  <option value="Admin">Admin</option>
                </select>

                {newUser.role === 'Student' && (
                  <select
                    value={newUser.classId}
                    onChange={(e) => setNewUser({ ...newUser, classId: e.target.value })}
                    style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                  >
                    <option value="">Select Enrolled Class</option>
                    {safeClassList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                    ))}
                  </select>
                )}

                <button type="submit" className="btn btn-primary">
                  Add User
                </button>
              </form>
            </div>

            {/* Users List Table */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>System Users</h2>
                <button onClick={fetchUsers} className="btn btn-sm" style={{ background: '#e2e8f0' }}>
                  Refresh List
                </button>
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Enrolled Class</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {safeUsersList.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    safeUsersList.map((u) => {
                      const userClass = safeClassList.find((c) => c.id === u.classId);
                      return (
                        <tr key={u.id}>
                          <td>#{u.id}</td>
                          <td style={{ fontWeight: '500' }}>{u.email}</td>
                          <td>
                            <span className={`badge badge-${u.role}`}>{u.role}</span>
                          </td>
                          <td>
                            {userClass ? `${userClass.name} (${userClass.section})` : '--'}
                          </td>
                          <td>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="btn btn-danger btn-sm"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ACADEMIC MANAGEMENT (CLASSES & SUBJECTS) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {/* Manage Classes */}
              <div className="card">
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Classes Management</h3>
                <form onSubmit={handleCreateClass} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Class Name (e.g. Class 10)"
                    value={newClass.name}
                    onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                    required
                    style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '14px' }}
                  />
                  <input
                    type="text"
                    placeholder="Section (e.g. A)"
                    value={newClass.section}
                    onChange={(e) => setNewClass({ ...newClass, section: e.target.value })}
                    required
                    style={{ width: '90px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '14px' }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm">
                    Add
                  </button>
                </form>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {safeClassList.length === 0 ? (
                    <li style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No classes created yet.</li>
                  ) : (
                    safeClassList.map((c) => (
                      <li key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span><strong>{c.name}</strong> - Section {c.section}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              {/* Manage Subjects */}
              <div className="card">
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Subjects Management</h3>
                <form onSubmit={handleCreateSubject} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Subject Name (e.g. Physics)"
                    value={newSubject.name}
                    onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                    required
                    style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '14px' }}
                  />
                  <input
                    type="text"
                    placeholder="Code (e.g. PHY101)"
                    value={newSubject.code}
                    onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })}
                    required
                    style={{ width: '110px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '14px' }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm">
                    Add
                  </button>
                </form>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {safeSubjectList.length === 0 ? (
                    <li style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No subjects created yet.</li>
                  ) : (
                    safeSubjectList.map((s) => (
                      <li key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span><strong>{s.name}</strong> ({s.code})</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            {/* TEACHER ALLOCATION & SYSTEM CONFIGURATION */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {/* Assign Teachers to Class & Subject */}
              <div className="card">
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Assign Teacher to Subject & Class</h3>
                <form onSubmit={handleCreateAllocation} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  <select
                    style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '14px', width: '100%' }}
                    value={newAllocation.teacherEmail}
                    onChange={(e) => setNewAllocation({ ...newAllocation, teacherEmail: e.target.value })}
                    required
                  >
                    <option value="">Select Teacher</option>
                    {safeUsersList.filter((u) => u.role === 'Teacher').map((t) => (
                      <option key={t.id} value={t.email}>{t.email}</option>
                    ))}
                  </select>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <select
                      style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '14px', width: '100%' }}
                      value={newAllocation.classId}
                      onChange={(e) => setNewAllocation({ ...newAllocation, classId: e.target.value })}
                      required
                    >
                      <option value="">Select Class</option>
                      {safeClassList.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                      ))}
                    </select>

                    <select
                      style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '14px', width: '100%' }}
                      value={newAllocation.subjectId}
                      onChange={(e) => setNewAllocation({ ...newAllocation, subjectId: e.target.value })}
                      required
                    >
                      <option value="">Select Subject</option>
                      {safeSubjectList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '14px' }}>
                    Assign Teacher
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {safeAllocations.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No allocations created yet.</p>
                  ) : (
                    safeAllocations.map((a) => (
                      <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <p style={{ fontWeight: '600', fontSize: '14px' }}>{a.teacherEmail}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.className} • {a.subjectName}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Application Level Settings */}
              <div className="card">
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Application Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px' }}>Academic Year</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                        value={settings.AcademicYear || ''}
                        onChange={(e) => setSettings({ ...settings, AcademicYear: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveSetting('AcademicYear', settings.AcademicYear)}
                        className="btn btn-sm"
                        style={{ background: '#334155', color: '#fff' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px' }}>Allow Late Submissions</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                        value={settings.AllowLateSubmissions || 'true'}
                        onChange={(e) => setSettings({ ...settings, AllowLateSubmissions: e.target.value })}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleSaveSetting('AllowLateSubmissions', settings.AllowLateSubmissions)}
                        className="btn btn-sm"
                        style={{ background: '#334155', color: '#fff' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TEACHER & ADMIN VIEW: CREATE / EDIT ASSIGNMENT */}
        {(role === 'Teacher' || role === 'Admin') && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
              {assignmentForm.id ? '✏️ Edit Assignment' : '➕ Create Assignment'}
            </h2>
            <form onSubmit={handleSaveAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <input
                  type="text"
                  placeholder="Title"
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  required
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                />
                <input
                  type="number"
                  placeholder="Max Marks"
                  value={assignmentForm.maxMarks}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, maxMarks: e.target.value })}
                  required
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                />
                <input
                  type="datetime-local"
                  value={assignmentForm.dueDate}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <select
                  value={assignmentForm.classId}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, classId: e.target.value })}
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                >
                  <option value="">Select Target Class (Optional)</option>
                  {safeClassList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - Section {c.section}
                    </option>
                  ))}
                </select>

                <select
                  value={assignmentForm.subjectId}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, subjectId: e.target.value })}
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                >
                  <option value="">Select Subject (Optional)</option>
                  {safeSubjectList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                placeholder="Instructions / Description..."
                rows={3}
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', resize: 'vertical' }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={assignmentForm.isDraft}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, isDraft: e.target.checked })}
                  />
                  Save as Draft (Hidden from students)
                </label>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {assignmentForm.id && (
                    <button
                      type="button"
                      onClick={() =>
                        setAssignmentForm({
                          id: null,
                          title: '',
                          description: '',
                          maxMarks: 100,
                          dueDate: '',
                          isDraft: false,
                          classId: '',
                          subjectId: ''
                        })
                      }
                      className="btn btn-sm"
                      style={{ background: '#e2e8f0', color: '#334155' }}
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary btn-sm">
                    {assignmentForm.id
                      ? 'Update Assignment'
                      : assignmentForm.isDraft
                      ? 'Save Draft'
                      : 'Publish Assignment'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TEACHER/ADMIN VIEW: SUBMISSIONS QUEUE & FILTER */}
        {(role === 'Teacher' || role === 'Admin') && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Submissions Queue</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-muted)' }}>
                  Filter by Assignment:
                </label>
                <select
                  style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px' }}
                  value={selectedAssignmentFilter}
                  onChange={(e) => setSelectedAssignmentFilter(e.target.value)}
                >
                  <option value="ALL">All Assignments</option>
                  {safeAssignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Answer</th>
                  <th>Status</th>
                  <th>Marks</th>
                  <th>Feedback</th>
                  {role === 'Teacher' && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={role === 'Teacher' ? '6' : '5'} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No submissions found.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.studentEmail}</td>
                      <td>{s.answerText}</td>
                      <td>
                        <span className={`badge badge-${s.status}`}>{s.status}</span>
                      </td>
                      <td>{s.marks !== null && s.marks !== undefined ? `${s.marks} marks` : 'Unassigned'}</td>
                      <td>{s.feedback || 'No feedback'}</td>
                      {role === 'Teacher' && (
                        <td>
                          <button onClick={() => handleGradeSubmission(s.id)} className="btn btn-primary btn-sm">
                            Grade
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TEACHER/ADMIN VIEW: ACTIVE ASSIGNMENTS LIST */}
        {(role === 'Teacher' || role === 'Admin') && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3>Active Assignments</h3>
            <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
              {safeAssignments.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No active assignments available.</p>
              ) : (
                safeAssignments.map((a) => {
                  const tags = getAssignmentTags(a);
                  return (
                    <div
                      key={a.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '16px',
                        background: 'var(--bg-main)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 style={{ fontSize: '16px' }}>{a.title}</h4>
                            {a.isDraft && (
                              <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px' }}>
                                DRAFT
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {a.description}
                          </p>

                          {/* Class & Subject Tags */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {tags.className && (
                              <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: '600', padding: '2px 8px', fontSize: '12px', borderRadius: '4px' }}>
                                📚 {tags.className}
                              </span>
                            )}
                            {tags.subjectName && (
                              <span className="badge" style={{ background: '#d1fae5', color: '#065f46', fontWeight: '600', padding: '2px 8px', fontSize: '12px', borderRadius: '4px' }}>
                                📖 {tags.subjectName}
                              </span>
                            )}
                            {a.dueDate && (
                              <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '500' }}>
                                ⏰ Due: {new Date(a.dueDate).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="badge" style={{ background: '#e2e8f0' }}>
                          Max Marks: {a.maxMarks}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button onClick={() => handleEditClick(a)} className="btn btn-sm" style={{ background: '#2563eb', color: '#fff' }}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteAssignment(a.id)} className="btn btn-danger btn-sm">
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* STUDENT VIEW: 2-SEGMENT DASHBOARD */}
        {role === 'Student' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Segment 1: Pending Class Assignments */}
            <div className="card">
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📝</span> Class Assignments
              </h2>

              {pendingAssignments.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
                  🎉 All caught up! No pending assignments for your class.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {pendingAssignments.map((assignment) => {
                    const isOverdue = assignment.dueDate && new Date() > new Date(assignment.dueDate);
                    const tags = getAssignmentTags(assignment);
                    return (
                      <div
                        key={assignment.id}
                        style={{
                          padding: '16px',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          background: 'var(--bg-main)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{assignment.title}</h3>
                            <div style={{ display: 'flex', gap: '8px', margin: '4px 0' }}>
                              {tags.className && (
                                <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: '600', padding: '2px 8px', fontSize: '12px', borderRadius: '4px' }}>
                                  📚 {tags.className}
                                </span>
                              )}
                              {tags.subjectName && (
                                <span className="badge" style={{ background: '#d1fae5', color: '#065f46', fontWeight: '600', padding: '2px 8px', fontSize: '12px', borderRadius: '4px' }}>
                                  📖 {tags.subjectName}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="badge" style={{ background: '#e2e8f0' }}>
                            Max Marks: {assignment.maxMarks}
                          </span>
                        </div>

                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>{assignment.description}</p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '12px' }}>
                          {assignment.dueDate ? (
                            <span style={{ fontWeight: '600', color: isOverdue ? '#dc2626' : 'var(--text-muted)' }}>
                              ⏰ Deadline: {new Date(assignment.dueDate).toLocaleString()}
                              {isOverdue && ' (OVERDUE)'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No deadline set</span>
                          )}

                          <button
                            onClick={() => handleOpenSubmitModal(assignment.id)}
                            className={`btn btn-sm ${isOverdue ? 'btn-danger' : 'btn-primary'}`}
                          >
                            Submit Answer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Segment 2: My Submissions & Grades */}
            <div className="card">
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                📋 My Submissions & Grades
              </h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Assignment ID</th>
                    <th>Answer</th>
                    <th>Submitted At</th>
                    <th>Status</th>
                    <th>Marks</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {safeSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        You have not submitted any assignments yet.
                      </td>
                    </tr>
                  ) : (
                    safeSubmissions.map((s) => (
                      <tr key={s.id}>
                        <td>#{s.assignmentId}</td>
                        <td>{s.answerText}</td>
                        <td>{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '--'}</td>
                        <td>
                          <span className={`badge badge-${s.status}`}>{s.status}</span>
                        </td>
                        <td>{s.marks !== null && s.marks !== undefined ? `${s.marks} marks` : 'Unassigned'}</td>
                        <td>{s.feedback || 'No feedback'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* STUDENT SUBMISSION MODAL */}
      {submitModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', background: '#fff' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>Submit Assignment Answer</h3>
            <form onSubmit={handleSubmitAssignment}>
              <textarea
                placeholder="Type your complete answer here..."
                rows={5}
                required
                value={submitModal.answerText}
                onChange={(e) => setSubmitModal({ ...submitModal, answerText: e.target.value })}
                style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', marginBottom: '16px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSubmitModal({ open: false, assignmentId: null, answerText: '' })}
                  className="btn btn-sm"
                  style={{ background: '#e2e8f0', color: '#334155' }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Submit Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}