import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  Settings, 
  Terminal, 
  Layers, 
  Compass, 
  Activity,
  Cpu,
  HelpCircle,
  Eye,
  EyeOff,
  ChevronRight,
  Sparkles,
  Link2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7860';

export default function App() {
  // Input fields state
  const [task, setTask] = useState('Navigate to the Shadcn form page, identify the form elements (Name/Bug Title and Description fields), fill them out, and click reset (In less than 100 characters).');
  const [startUrl, setStartUrl] = useState('https://ui.shadcn.com/docs/forms/react-hook-form');
  const [provider] = useState('gemini');
  const [model] = useState('gemini-2.5-flash');
  const [headed, setHeaded] = useState(false);

  // Agent runner state
  const [status, setStatus] = useState('idle'); // idle | planning | executing | completed | failed | timeout
  const [screenshot, setScreenshot] = useState('');
  const [elements, setElements] = useState([]);
  const [logs, setLogs] = useState(['System: Agent initialized. Ready to execute tasks.']);
  const [currentStep, setCurrentStep] = useState(0);
  const [thought, setThought] = useState('');
  const [currentAction, setCurrentAction] = useState(null);
  
  // UI toggles
  const [overlayElements, setOverlayElements] = useState(true);
  const [hoveredElementId, setHoveredElementId] = useState(null);
  const [clickIndicator, setClickIndicator] = useState(null);

  const terminalRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Auto-scroll logs inside terminal container
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);



  // Click flashing indicator on screenshot
  useEffect(() => {
    if (currentAction && (currentAction.action === 'click_on_screen' || currentAction.action === 'double_click')) {
      const { x, y } = currentAction.args;
      setClickIndicator({ x, y });
      
      const timer = setTimeout(() => {
        setClickIndicator(null);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentAction]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startAgent = async () => {

    setStatus('planning');
    setScreenshot('');
    setElements([]);
    setCurrentStep(1);
    setThought('Launching browser session and starting agent automation loop...');
    setCurrentAction(null);
    setLogs(['System: Command sent. Connecting to real-time update stream...']);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // 1. Hook up the real-time Event Stream (SSE)
    const sseUrl = `${API_BASE}/api/agent/stream`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Update Event:', data);

        if (data.status) setStatus(data.status);
        if (data.step) setCurrentStep(data.step);
        if (data.screenshot) {
          setScreenshot(`data:image/jpeg;base64,${data.screenshot}`);
        }
        if (data.elements) setElements(data.elements);
        if (data.logs) setLogs(data.logs);
        if (data.thought) setThought(data.thought);
        if (data.currentAction) setCurrentAction(data.currentAction);

        if (['completed', 'failed', 'timeout'].includes(data.status)) {
          es.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        console.error('Failed to parse SSE event data:', err);
      }
    };

    es.onerror = (err) => {
      console.error('SSE failure:', err);
      setLogs(prev => [...prev, 'System Error: Connection to update stream closed.']);
      es.close();
      eventSourceRef.current = null;
    };

    // 2. Launch run session on backend
    try {
      const response = await fetch(`${API_BASE}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          startUrl,
          provider,
          model,
          headed
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server rejected run request');
      }

      setLogs(prev => [...prev, 'System: Agent execution started. Processing steps...']);
    } catch (err) {
      setStatus('failed');
      setThought('');
      setLogs(prev => [...prev, `System Error: ${err.message}`]);
      if (es) {
        es.close();
        eventSourceRef.current = null;
      }
    }
  };

  const stopAgent = async () => {
    setLogs(prev => [...prev, 'System: Sending termination request...']);
    try {
      const response = await fetch(`${API_BASE}/api/agent/stop`, {
        method: 'POST'
      });
      const data = await response.json();
      setLogs(prev => [...prev, `System: ${data.message}`]);
      setStatus('idle');
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    } catch (err) {
      setLogs(prev => [...prev, `System Error: Stop trigger failed (${err.message})`]);
    }
  };

  return (
    <div className="dashboard-container">
      {/* HEADER BAR */}
      <header className="dashboard-header">
        <div className="header-title-area">
          <span className="header-icon-wrapper">
            <Cpu className="w-6 h-6 animate-pulse" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold" style={{ color: 'var(--color-secondary)' }}>
              Browser Use Web Agent
            </h1>
            <p className="header-text-subtitle">
              Autonomous browser control using coordinate visual-DOM alignment.
            </p>
          </div>
        </div>
        
        {/* Real-time Status indicator */}
        <div className="status-widget">
          <span className={`status-dot ${status === 'idle' ? 'status-dot-idle' : status === 'completed' ? 'status-dot-active' : 'status-dot-busy'}`}></span>
          <div className="status-info">
            <p className="status-title">
              {status === 'idle' ? 'System Idle' : status === 'planning' ? 'Planning Action' : status === 'executing' ? 'Executing Step' : status}
            </p>
            {status !== 'idle' && (
              <p className="status-subtitle">Step: {currentStep}/15</p>
            )}
          </div>
        </div>
      </header>

      {/* WORKSPACE AREA */}
      <main className="dashboard-layout">
        
        {/* LEFT COLUMN: SETTINGS PANEL */}
        <section className="sidebar">
          
          {/* CONFIGURATION PANEL */}
          <div className="glass-panel">
            <div className="panel-header">
              <Settings className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
              <h2>Control Center</h2>
            </div>

            {/* Task Prompt */}
            <div className="form-group">
              <label htmlFor="task-prompt" className="form-group-label">
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} /> Task Prompt / Goal
              </label>
              <textarea 
                id="task-prompt"
                rows="5"
                className="form-textarea" 
                value={task} 
                onChange={(e) => setTask(e.target.value)}
                disabled={status !== 'idle' && status !== 'completed' && status !== 'failed'}
                placeholder="Enter automation instructions..."
              />
            </div>

            {/* Start URL */}
            <div className="form-group">
              <label htmlFor="url-input" className="form-group-label">
                <Link2 className="w-3.5 h-3.5" /> Start URL
              </label>
              <input 
                id="url-input"
                type="text" 
                className="form-input" 
                value={startUrl} 
                onChange={(e) => setStartUrl(e.target.value)}
                disabled={status !== 'idle' && status !== 'completed' && status !== 'failed'}
                placeholder="https://example.com"
              />
            </div>


            {/* Headed toggle */}
            <div className="form-toggle-row">
              <div className="toggle-details">
                <label htmlFor="headed-toggle" className="toggle-title">Headed Browser Mode</label>
                <p className="toggle-desc">Opens a visible browser on host display</p>
              </div>
              <input 
                id="headed-toggle"
                type="checkbox" 
                className="checkbox-input"
                checked={headed}
                onChange={(e) => setHeaded(e.target.checked)}
                disabled={status !== 'idle' && status !== 'completed' && status !== 'failed'}
              />
            </div>

            {/* Action Buttons */}
            <div className="btn-group">
              {status === 'idle' || status === 'completed' || status === 'failed' || status === 'timeout' ? (
                <button 
                  id="run-agent-btn"
                  onClick={startAgent} 
                  className="btn btn-primary"
                >
                  <Play className="w-4 h-4 fill-current" /> Run Task
                </button>
              ) : (
                <button 
                  id="stop-agent-btn"
                  onClick={stopAgent} 
                  className="btn btn-danger"
                >
                  <Square className="w-4 h-4 fill-current" /> Stop Agent
                </button>
              )}
            </div>
          </div>

          {/* HELP DOCUMENTATION CARD */}
          <div className="glass-panel" style={{ background: 'var(--bg-card)', borderColor: 'var(--color-primary)' }}>
            <div className="panel-header" style={{ borderBottomColor: 'var(--color-primary)' }}>
              <HelpCircle className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ color: 'var(--color-primary)' }}>Task Guidelines</h3>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', lineHeight: '1.5' }}>
              <p style={{ marginBottom: '0.5rem' }}>
                To execute the target task, run with <strong>Demo Mode</strong>.
              </p>
              <ul className="docs-list">
                <li className="docs-item"><span className="docs-bullet">&bull;</span> Navigates directly to the Shadcn Hook Form API documentation.</li>
                <li className="docs-item"><span className="docs-bullet">&bull;</span> Dynamically locates fields (Username & Bio inputs).</li>
                <li className="docs-item"><span className="docs-bullet">&bull;</span> Computes center coordinates and triggers atomic mouse clicks.</li>
                <li className="docs-item"><span className="docs-bullet">&bull;</span> Inputs sample field keys and hits the Submit button.</li>
              </ul>
            </div>
          </div>

        </section>

        {/* RIGHT COLUMN: SCREEN FEED, TIMELINE & logs */}
        <section className="main-content">

          {/* LIVE SIMULATOR FEED */}
          <div className="glass-panel">
            <div className="browser-view-header">
              <div className="flex-row-center" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Compass className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
                <h3>Live Agent Browser Feed</h3>
              </div>
              
              {/* Overlay elements toggle */}
              <div className="flex-row-center" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="overlay-toggle" style={{ fontSize: '0.75rem', color: 'var(--color-subtext)', cursor: 'pointer' }}>Overlay Interactive Targets</label>
                <input 
                  id="overlay-toggle"
                  type="checkbox" 
                  checked={overlayElements} 
                  onChange={(e) => setOverlayElements(e.target.checked)}
                  className="checkbox-input"
                />
              </div>
            </div>

            {/* Current thought */}
            {thought && (
              <div className="thought-box">
                <Cpu className="w-4 h-4 thought-icon" />
                <div>
                  <span style={{ fontWeight: '600', color: '#fff' }}>Agent Thought: </span>
                  {thought}
                </div>
              </div>
            )}

            {/* Bounding box wrapper and overlay logic */}
            <div className="browser-view-wrapper">
              {screenshot ? (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <img 
                    src={screenshot} 
                    alt="Current Page Screenshot" 
                    className="browser-screenshot" 
                  />
                  
                  {/* Overlay elements boxes */}
                  {overlayElements && elements.map((el) => {
                    const isHovered = hoveredElementId === el.id;
                    const isTargetAction = currentAction && 
                      (currentAction.action === 'click_on_screen' || currentAction.action === 'double_click') &&
                      Math.abs(currentAction.args.x - el.x) < 20 && 
                      Math.abs(currentAction.args.y - el.y) < 20;

                    return (
                      <div
                        key={el.id}
                        className="element-marker"
                        style={{
                          left: `${(el.x - el.width / 2) / 12.8}%`,
                          top: `${(el.y - el.height / 2) / 8}%`,
                          width: `${el.width / 12.8}%`,
                          height: `${el.height / 8}%`,
                          borderColor: isHovered ? '#10b981' : isTargetAction ? '#ef4444' : 'var(--color-secondary)',
                          background: isHovered ? 'rgba(16, 185, 129, 0.15)' : isTargetAction ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.04)',
                          zIndex: isHovered || isTargetAction ? 20 : 10
                        }}
                        onMouseEnter={() => setHoveredElementId(el.id)}
                        onMouseLeave={() => setHoveredElementId(null)}
                      >
                        {(isHovered || el.width > 35) && (
                          <span className="element-marker-label" style={{ background: isHovered ? '#10b981' : isTargetAction ? '#ef4444' : 'var(--color-secondary)' }}>
                            [{el.id}] {el.tagName.toLowerCase()}:{el.label.slice(0, 10)}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Red Click ripple indicator */}
                  {clickIndicator && (
                    <div 
                      className="click-indicator"
                      style={{
                        left: `${clickIndicator.x / 12.8}%`,
                        top: `${clickIndicator.y / 8}%`
                      }}
                    />
                  )}
                </div>
              ) : (
                <div className="browser-placeholder">
                  <Activity className="w-12 h-12 stroke-[1] animate-pulse" />
                  <p>
                    {status === 'idle' 
                      ? 'No Browser Session Active' 
                      : 'Waiting for first screenshot...'}
                  </p>
                </div>
              )}
            </div>

            {/* Currently Executing command */}
            {currentAction && (
              <div className="browser-action-indicator">
                <span style={{ color: 'var(--color-subtext)' }}>Executing Command:</span>
                <span className="action-mono">
                  {currentAction.action}({JSON.stringify(currentAction.args)})
                </span>
              </div>
            )}
          </div>

          {/* EXTRACTED DOM ELEMENT DATA LIST */}
          {elements.length > 0 && (
            <div className="glass-panel">
              <div className="panel-header">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h3>Interactive DOM Elements ({elements.length})</h3>
              </div>
              <div className="table-wrapper">
                <table className="elements-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '50px' }}>ID</th>
                      <th>Tag</th>
                      <th>Label / Placeholder</th>
                      <th style={{ textAlign: 'center' }}>Center Coordinates</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elements.map((el) => (
                      <tr 
                        key={el.id} 
                        className={hoveredElementId === el.id ? 'highlighted' : ''}
                        onMouseEnter={() => setHoveredElementId(el.id)}
                        onMouseLeave={() => setHoveredElementId(null)}
                      >
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-primary-light)', fontFamily: 'var(--font-mono)' }}>{el.id}</td>
                        <td><span className="tag-badge">{el.tagName}</span></td>
                        <td style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={el.label}>{el.label}</td>
                        <td style={{ textAlign: 'center' }} className="coord-text">({el.x}, {el.y})</td>
                        <td style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '120px' }}>{el.value || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REAL TIME CONSOLE LOGGER */}
          <div className="glass-panel">
            <div className="panel-header">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <h3>Execution Logs</h3>
            </div>
            <div className="terminal-window" ref={terminalRef}>
              {logs.map((log, index) => {
                let logClass = 'log-line-info';
                if (log.includes('Successfully') || log.includes('completed')) {
                  logClass = 'log-line-success';
                } else if (log.includes('Executing') || log.includes('Clicking') || log.includes('Sending') || log.includes('Scrolling')) {
                  logClass = 'log-line-action';
                } else if (log.includes('Error') || log.includes('failed')) {
                  logClass = 'log-line-error';
                } else if (log.includes('System:') || log.includes('Starting')) {
                  logClass = 'log-line-system';
                }

                return (
                  <div key={index} className={`log-line ${logClass}`}>
                    {log}
                  </div>
                );
              })}
            </div>
          </div>

        </section>
      </main>
      
      {/* FOOTER AREA */}
      <footer className="dashboard-footer">
        <p>Built with Playwright, Express, and React</p>
        <p>&copy; 2026 Antigravity Web Agent. All rights reserved.</p>
      </footer>
    </div>
  );
}
