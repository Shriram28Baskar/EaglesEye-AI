import { useAuditLogs } from "../lib/store";

export function AuditLogsPanel() {
  const logs = useAuditLogs();

  return (
    <div className="card" style={{ marginTop: '20px', overflowX: 'auto' }}>
      <div className="card-header">
        <h2 className="card-title">Audit Ledger</h2>
      </div>
      
      {logs.length === 0 ? (
        <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>
          No audit logs recorded yet. Waiting for anomaly detection...
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>call_sid</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>call_status</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>answered</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>person_contacted</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>phone</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>patient</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>timestamp</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>bed</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>condition</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>risk_score</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>call_time</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>response_time</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>log</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px', fontFamily: 'monospace' }}>{log.call_sid}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    backgroundColor: log.call_status === 'completed' ? 'var(--success-bg)' : 'var(--warning-bg)',
                    color: log.call_status === 'completed' ? 'var(--success-text)' : 'var(--warning-text)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase'
                  }}>
                    {log.call_status}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>{log.answered ? 'YES' : 'NO'}</td>
                <td style={{ padding: '10px', fontWeight: 'bold' }}>{log.person_contacted}</td>
                <td style={{ padding: '10px' }}>{log.phone}</td>
                <td style={{ padding: '10px' }}>{log.patient}</td>
                <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                <td style={{ padding: '10px' }}>{log.bed}</td>
                <td style={{ padding: '10px' }}>{log.condition}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{log.risk_score}</td>
                <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{log.call_time}</td>
                <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{log.response_time}</td>
                <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.log}>
                  {log.log}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
