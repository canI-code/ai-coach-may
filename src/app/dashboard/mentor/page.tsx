'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import LogoutButton from '@/app/components/LogoutButton';

export default function MentorDashboard() {
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, stuRes] = await Promise.all([
        fetch('/api/mentor/requests'),
        fetch('/api/mentor/students')
      ]);
      const reqData = await reqRes.json();
      const stuData = await stuRes.json();
      if (reqRes.ok) setRequests(reqData);
      if (stuRes.ok) setStudents(stuData);
    } catch (err) {
      console.error('Failed to fetch mentor data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id: string, action: string) => {
    setMessage('Processing...');
    try {
      const res = await fetch('/api/mentor/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(action === 'approve' ? `Approved! Temp Password: ${data.tempPassword}` : 'Rejected');
        fetchData();
      } else {
        setMessage('Error: ' + data.error);
      }
    } catch (err) {
      setMessage('Operation failed');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setMessage('Updating status...');
    try {
      const res = await fetch('/api/mentor/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setMessage(`Account ${newStatus}`);
        fetchData();
      }
    } catch (err) {
      setMessage('Update failed');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Mentor Dashboard</h1>
      <p>Manage your students and review performance metrics.</p>

      {message && <p style={{ padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>{message}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '30px' }}>
        {/* Pending Requests */}
        <div>
          <h3>Pending Student Requests</h3>
          {loading ? <p>Loading...</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {requests.length === 0 ? <p>No pending requests.</p> : requests.map((req: any) => (
                <div key={req._id} style={cardStyle}>
                  <strong>{req.fullName}</strong>
                  <div style={{ fontSize: '14px' }}>{req.email} | {req.phone}</div>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
                    <button onClick={() => handleApprove(req._id, 'approve')} style={{ backgroundColor: 'green', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Approve</button>
                    <button onClick={() => handleApprove(req._id, 'reject')} style={{ backgroundColor: 'red', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approved Students */}
        <div>
          <h3>Registered Students</h3>
          {loading ? <p>Loading...</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {students.length === 0 ? <p>No registered students.</p> : students.map((stu: any) => (
                <div key={stu._id} style={{ ...cardStyle, opacity: stu.status === 'disabled' ? 0.6 : 1 }}>
                  <strong>{stu.fullName}</strong>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Logins: {stu.loginCount || 0} | Last: {stu.lastLogin ? new Date(stu.lastLogin).toLocaleString() : 'Never'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Device: {stu.lastDevice || 'N/A'}
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    {stu.status === 'approved' ? (
                      <button onClick={() => handleStatusChange(stu._id, 'disabled')} style={smallBtnStyle}>Disable Account</button>
                    ) : (
                      <button onClick={() => handleStatusChange(stu._id, 'approved')} style={{ ...smallBtnStyle, backgroundColor: 'blue' }}>Enable Account</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '40px' }}>
        <LogoutButton />
        <Link href="/" style={{ marginLeft: '15px' }}>Home</Link>
      </div>
    </div>
  );
}

const cardStyle = {
  padding: '15px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  backgroundColor: '#fff'
};

const smallBtnStyle = {
  backgroundColor: '#666',
  color: 'white',
  border: 'none',
  padding: '4px 8px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px'
};
