import { useState, useEffect } from "react";

export default function AdminPanel({ token }) {
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [newUser, setNewUser] = useState({ email: "", password: "", role: "Student" });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resUsers, resClasses, resSubjects] = await Promise.all([
        fetch("http://localhost:5000/api/admin/users", { headers }),
        fetch("http://localhost:5000/api/admin/classes", { headers }),
        fetch("http://localhost:5000/api/admin/subjects", { headers })
      ]);

      if (resUsers.ok) setUsers(await resUsers.json());
      if (resClasses.ok) setClasses(await resClasses.json());
      if (resSubjects.ok) setSubjects(await resSubjects.json());
    } catch (err) {
      console.error("Failed to load admin data", err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const res = await fetch("http://localhost:5000/api/admin/users", {
      method: "POST",
      headers,
      body: JSON.stringify(newUser)
    });

    if (res.ok) {
      setNewUser({ email: "", password: "", role: "Student" });
      fetchData();
    }
  };

  const handleDeleteUser = async (id) => {
    const res = await fetch(`http://localhost:5000/api/admin/users/${id}`, {
      method: "DELETE",
      headers
    });
    if (res.ok) fetchData();
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Admin Control Panel</h2>
      
      <div style={{ marginBottom: "30px", background: "#f8f9fa", padding: "15px", borderRadius: "8px" }}>
        <h3>Create New User</h3>
        <form onSubmit={handleCreateUser} style={{ display: "flex", gap: "10px" }}>
          <input
            type="email"
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            required
          />
          <select
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
          >
            <option value="Student">Student</option>
            <option value="Teacher">Teacher</option>
            <option value="Admin">Admin</option>
          </select>
          <button type="submit">Add User</button>
        </form>
      </div>

      <div>
        <h3>Registered Users</h3>
        <ul>
          {Array.isArray(users) && users.map((u) => (
            <li key={u.id} style={{ marginBottom: "8px" }}>
              <strong>{u.email}</strong> ({u.role}) 
              <button onClick={() => handleDeleteUser(u.id)} style={{ marginLeft: "10px", color: "red" }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}