import { useState, useEffect, useRef } from 'react'; 
import axios from 'axios'; 
import { useAuth } from '../context/AuthContext'; 
import { io } from 'socket.io-client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock, Activity, Users, AlertCircle, CheckCircle, Map as MapIcon, Send, Phone, MessageCircle } from 'lucide-react'; 
import DiseaseMap from '../components/DiseaseMap';
import OutbreakBanner from '../components/OutbreakBanner'; 
import '../App.css';

const DoctorDashboard = () => {
  const { token } = useAuth(); 
  const [stats, setStats] = useState([]);
  const [queue, setQueue] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(new Date());
  const [activeDoctors, setActiveDoctors] = useState(1); 
  const [outbreakAlerts, setOutbreakAlerts] = useState([]);

  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const alarmRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3')); 

  const BASE_URL = import.meta.env.VITE_API_URL || "https://afya-pulse-backend.onrender.com";
  const BACKEND_URL = `${BASE_URL}/api`;

  const sortQueue = (data) => {
    const priority = { 'RED': 0, 'YELLOW': 1, 'GREEN': 2 };
    return [...data].sort((a, b) => {
      const pA = priority[a.triage_category] ?? 99;
      const pB = priority[b.triage_category] ?? 99;
      if (pA !== pB) return pA - pB;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  };

  const checkForOutbreaks = (currentQueue) => {
    const CRITICAL_THRESHOLD = 3; 
    const TIME_WINDOW_MINS = 60; 
    const nowTime = new Date().getTime();
    const timeLimit = nowTime - (TIME_WINDOW_MINS * 60 * 1000);

    const recentCriticalCases = currentQueue.filter(p => {
        const pTime = new Date(p.created_at).getTime();
        return p.triage_category === 'RED' && pTime > timeLimit;
    });

    const locationCounts = {};
    recentCriticalCases.forEach(p => {
        const loc = p.location || 'Unknown';
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    const newAlerts = [];
    Object.keys(locationCounts).forEach(loc => {
        if (locationCounts[loc] >= CRITICAL_THRESHOLD) {
            newAlerts.push({
                location: loc,
                message: `⚠️ SURVEILLANCE ALERT: ${locationCounts[loc]} critical cases in ${loc}. Potential cluster.`
            });
        }
    });

    if (newAlerts.length > 0) {
        setOutbreakAlerts(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(newAlerts)) {
                alarmRef.current.play().catch(() => {});
                return newAlerts;
            }
            return prev;
        });
    }
  };

  const calculateAvgWait = () => {
    if (queue.length === 0) return '0m';
    const totalWaitMs = queue.reduce((acc, patient) => acc + (now - new Date(patient.created_at)), 0);
    return `${Math.floor((totalWaitMs / queue.length) / 60000)}m`;
  };

  // 1. DATA INITIALIZATION & STATS REFRESH
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      try {
        const statsRes = await axios.get(`${BACKEND_URL}/triage/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const responseData = statsRes.data;
        const rawStats = Array.isArray(responseData) ? responseData : responseData.stats;
        if (responseData.active_doctors) setActiveDoctors(responseData.active_doctors);

        const chartData = [
          { name: 'GREEN', count: 0, color: '#10B981' },
          { name: 'YELLOW', count: 0, color: '#F59E0B' },
          { name: 'RED', count: 0, color: '#EF4444' }
        ];

        if (rawStats) {
            rawStats.forEach(item => {
              const category = chartData.find(c => c.name === item.triage_category);
              if (category) category.count = parseInt(item.count);
            });
        }
        setStats(chartData);

        const queueRes = await axios.get(`${BACKEND_URL}/triage/queue`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const sortedData = sortQueue(queueRes.data);
        setQueue(sortedData);
        checkForOutbreaks(sortedData);
      } catch (err) {
        console.error("Data fetch error", err);
      }
    };
    fetchData();
  }, [refreshKey, token, BACKEND_URL]);

  // 2. REAL-TIME SOCKET UPDATES (ADD / UPDATE / REMOVE)
  useEffect(() => {
    const socket = io(BASE_URL);
    
    socket.on('queue_update', (data) => {
        console.log("🔔 Real-time Update Received:", data);
        const { type, patient, id } = data;

        setQueue((prevQueue) => {
          let newQueue;
          if (type === 'ADD') {
            // New patient submission
            newQueue = sortQueue([patient, ...prevQueue]);
            audioRef.current.play().catch(() => {});
          } else if (type === 'UPDATE') {
            // 🔄 SESSION-BASED UPDATE: Find existing patient and replace data
            newQueue = sortQueue(prevQueue.map(item => 
              item.report_id === id ? { ...item, ...patient } : item
            ));
          } else if (type === 'REMOVE') {
            // Case was resolved
            newQueue = prevQueue.filter(item => item.report_id !== id);
          } else {
            newQueue = prevQueue;
          }
          
          checkForOutbreaks(newQueue);
          return newQueue;
        });

        // Always refresh stats counts when any update happens
        setRefreshKey(prev => prev + 1);
    });

    return () => socket.disconnect();
  }, [BASE_URL]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const kpiData = [
    { label: 'Total Reports', value: queue.length, icon: Users, color: 'blue' },
    { label: 'Critical Alerts', value: queue.filter(p => p.triage_category === 'RED').length, icon: AlertCircle, color: 'red' },
    { label: 'Avg Response Time', value: calculateAvgWait(), icon: Clock, color: 'yellow' },
    { label: 'Medics Online', value: activeDoctors, icon: Activity, color: 'green' },
  ];

  const markAsTreated = async (id) => {
    if(!window.confirm("Confirm: Case reviewed and advice sent?")) return;
    try {
        await axios.put(`${BACKEND_URL}/triage/${id}/resolve`, 
            { doctor_final_category: 'TREATED' },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        // Optimistic UI update
        setQueue(prev => prev.filter(p => p.report_id !== id));
        setRefreshKey(prev => prev + 1); 
    } catch(err) {
        console.error("Error updating status", err);
    }
  };

  const getWaitingDuration = (dateString) => {
    const diffMins = Math.floor((now - new Date(dateString)) / 60000);
    return diffMins < 1 ? 'Just now' : `+${diffMins}m`;
  };

  const formatPhoneLink = (number) => `tel:${number?.replace(/\s+/g, '') || '#'}`;
  
  const formatWhatsAppLink = (number) => {
    if (!number) return '#';
    let clean = number.replace(/\s+/g, '').replace(/\+/g, ''); 
    if (clean.startsWith('0')) clean = '254' + clean.substring(1);
    const text = encodeURIComponent("Hello, this is the doctor from Afya-Pulse regarding your recent symptom report.");
    return `https://wa.me/${clean}?text=${text}`;
  };

  return (
    <div className="main-content">
      <OutbreakBanner 
        alerts={outbreakAlerts} 
        onDismiss={(i) => setOutbreakAlerts(prev => prev.filter((_, idx) => idx !== i))} 
      />

      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
        <div>
          <h2><Activity className="text-blue-600" /> Afya-Pulse Command Center</h2>
          <p className="subtitle" style={{marginBottom: 0}}>Real-time Surveillance Network</p>
        </div>
        <div className="status-badge" style={{ borderColor: '#10B981', color: '#065F46', background: '#ECFDF5' }}>
          <span className="live-dot"></span> System Live
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {kpiData.map((kpi, index) => (
          <div key={index} className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: `var(--${kpi.color}-bg)`, color: `var(--${kpi.color}-text)` }}>
              <kpi.icon size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: '500' }}>{kpi.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}> 
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section className="card" style={{ padding: '0', border: 'none', background: 'transparent' }}>
                 <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <MapIcon size={20} className="text-blue-500" /> Active Hotspots
                   <span className="badge badge-RED" style={{fontSize: '0.7rem'}}>LIVE</span>
                 </h3>
                 <DiseaseMap patients={queue} />
            </section>

            <section className="card">
                <div className="result-header">
                   <h3><Clock size={20} className="text-gray-500" /> Incoming Alerts</h3>
                   <span className="badge" style={{background: '#EFF6FF', color: '#3B82F6'}}>
                     {queue.length} Pending
                   </span>
                </div>
                
                <div className="table-container">
                    <table className="queue-table">
                        <thead>
                            <tr>
                                <th>Response Time</th>
                                <th>Severity</th>
                                <th>Origin</th>
                                <th>Symptom Report</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map(patient => (
                                <tr key={patient.report_id} className={`row-${patient.triage_category}`}
                                  style={patient.triage_category === 'RED' ? { borderLeft: '4px solid #EF4444', background: '#FEF2F2' } : {}}>
                                    <td className="time-text">
                                      {new Date(patient.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      <span className="wait-duration" style={{
                                        color: patient.triage_category === 'RED' ? '#EF4444' : '#6B7280',
                                        fontWeight: patient.triage_category === 'RED' ? 'bold' : 'normal'
                                      }}>
                                        {getWaitingDuration(patient.created_at)}
                                      </span>
                                    </td>
                                    <td><span className={`badge badge-${patient.triage_category}`}>{patient.triage_category}</span></td>
                                    <td style={{ fontSize: '0.9rem', color: '#4B5563' }}>{patient.location || 'Unknown'}</td>
                                    <td style={{ maxWidth: '200px', fontSize: '0.9rem', color: '#374151' }}>
                                      <div>{patient.ai_analysis?.interpreted_symptom || patient.symptoms}</div>
                                      {patient.patient_phone && (
                                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <a href={formatPhoneLink(patient.patient_phone)} className="btn-call"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: patient.triage_category === 'RED' ? '#FEE2E2' : '#F3F4F6', color: patient.triage_category === 'RED' ? '#DC2626' : '#4B5563', border: '1px solid #E5E7EB' }}>
                                                <Phone size={12} /> Call
                                            </a>
                                            <a href={formatWhatsAppLink(patient.patient_phone)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}>
                                                <MessageCircle size={12} /> Chat
                                            </a>
                                        </div>
                                      )}
                                    </td>
                                    <td>
                                        <button className="btn-queue btn-treated" onClick={() => markAsTreated(patient.report_id)}>
                                            <Send size={14} style={{ marginRight: '6px' }}/> Resolve Case
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {queue.length === 0 && (
                                <tr>
                                  <td colSpan="5" style={{textAlign: 'center', padding: '3rem', color: '#9CA3AF'}}>
                                    <CheckCircle size={40} style={{ marginBottom: '10px', opacity: 0.3 }} /><br/>All clear.
                                  </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section className="card stats-section">
              <h3>Case Volume</h3>
              <div className="chart-container" style={{ height: '300px', marginTop: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats}>
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={50}>
                      {stats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
        </div>
      </div>
    </div>
  );
}

export default DoctorDashboard;