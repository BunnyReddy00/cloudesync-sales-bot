'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [activeTab, setActiveTab] = useState('history');
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCalls() {
      try {
        const { data, error } = await supabase
          .from('calls')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching calls:', error);
        } else {
          setCalls(data || []);
        }
      } catch (err) {
        console.error('Unexpected error fetching calls:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCalls();

    const subscription = supabase
      .channel('calls-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => {
        fetchCalls();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', padding: '30px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>CloudSync AI Sales Bot</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setActiveTab('live')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'live' ? '#2563eb' : '#e2e8f0',
                color: activeTab === 'live' ? '#fff' : '#475569',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Live Call
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'history' ? '#2563eb' : '#e2e8f0',
                color: activeTab === 'history' ? '#fff' : '#475569',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Call History
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'live' ? (
          <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#1e293b' }}>Live Voice Agent Widget</h2>
            <p style={{ color: '#64748b', marginBottom: '25px' }}>Interact directly with your Vapi AI assistant below.</p>
            <div style={{ padding: '20px', border: '2px dashed #cbd5e1', borderRadius: '8px', display: 'inline-block', color: '#64748b' }}>
              Vapi Web Widget Active / Configured in Assistant
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#1e293b' }}>
              Recent Call Logs
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading call records...</div>
            ) : calls.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No calls recorded yet. Place a test call to see data here!</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px' }}>DATE</th>
                      <th style={{ padding: '12px 16px' }}>DURATION</th>
                      <th style={{ padding: '12px 16px' }}>SALES STATUS</th>
                      <th style={{ padding: '12px 16px' }}>AI SUMMARY</th>
                      <th style={{ padding: '12px 16px' }}>RECORDING</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => (
                      <tr key={call.id || call.vapi_call_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '16px', color: '#334155' }}>{formatDate(call.created_at)}</td>
                        <td style={{ padding: '16px', color: '#334155' }}>{formatDuration(call.duration)}</td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: call.sales_status === 'Completed' ? '#dcfce7' : '#fef9c3',
                            color: call.sales_status === 'Completed' ? '#166534' : '#854d0e'
                          }}>
                            {call.sales_status || 'Completed'}
                          </span>
                        </td>
                        <td style={{ padding: '16px', color: '#475569', maxWidth: '350px' }}>{call.summary || 'Call completed successfully.'}</td>
                        <td style={{ padding: '16px' }}>
                          {call.recording_url ? (
                            <audio 
                              controls 
                              preload="none" 
                              src={call.recording_url} 
                              style={{ width: '200px', height: '36px' }}
                            >
                              Your browser does not support the audio element.
                            </audio>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Recording not received</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}