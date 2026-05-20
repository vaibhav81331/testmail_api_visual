import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Mail, 
  Search, 
  RefreshCw, 
  Trash2, 
  Download, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  Tag, 
  Database, 
  Sun,
  Moon,
  Clock,
  Sparkles,
  Inbox,
  AlertTriangle,
  Settings,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Email, ApiResponse } from './types';
import { playNewEmailSound } from './emailSound';

// Pure relative time helper outside component to satisfy rules
const formatRelativeTime = (timestamp: number, currentNow: number) => {
  const diff = currentNow - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function App() {
  // --- STATE ---
  // User Credentials / Mode Settings
  // User Credentials
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('tm_apikey') || '');
  const [namespace, setNamespace] = useState(() => localStorage.getItem('tm_namespace') || '15ey7');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tm_theme') as 'dark' | 'light') || 'dark';
  });
  
  // Customization for copy format
  const [emailFormatTag, setEmailFormatTag] = useState('test');
  
  // Pure state initialization for emails and selection
  const [emails, setEmails] = useState<Email[]>(() => {
    try {
      const savedNamespace = localStorage.getItem('tm_namespace') || '15ey7';
      const saved = localStorage.getItem(`tm_saved_emails_${savedNamespace}`);
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.warn('Failed to parse cached emails:', err);
      return [];
    }
  });
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(() => {
    try {
      const savedNamespace = localStorage.getItem('tm_namespace') || '15ey7';
      const saved = localStorage.getItem(`tm_saved_emails_${savedNamespace}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.length > 0 ? parsed[0].id : null;
      }
    } catch (err) {
      console.warn('Failed to restore selected email ID:', err);
    }
    return null;
  });
  
  // View controls
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [activeViewerTab, setActiveViewerTab] = useState<'html' | 'text' | 'json'>('html');
  
  // Polling settings
  const [refreshInterval, setRefreshInterval] = useState<number>(10); // in seconds, 0 = manual
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // App UI States
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isCopiedAddress, setIsCopiedAddress] = useState(false);
  const [isCopiedBodyCode, setIsCopiedBodyCode] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Settings modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempNamespace, setTempNamespace] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  
  // Current time state to avoid impurity in render
  const [now, setNow] = useState(() => Date.now());

  // Refs
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitialMount = useRef(true);

  // --- EFFECT: UPDATE NOW TIME TIMER ---
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20000); // Update every 20 seconds
    return () => clearInterval(timer);
  }, []);

  // --- EFFECT: PERSIST API KEY & THEME ---
  useEffect(() => {
    localStorage.setItem('tm_apikey', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('tm_theme', theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
    }
  }, [theme]);

  // --- TOAST SERVICE ---
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  // --- AUDIO & CONFETTI TRIGGERS ---
  const handleNewEmailArrival = useCallback((newEmailsCount: number, matchingEmails: Email[]) => {
    if (newEmailsCount <= 0) return;
    
    // Play chime sound
    if (soundEnabled) {
      playNewEmailSound();
    }
    
    // Show Toast
    showToast(`Received ${newEmailsCount} new email${newEmailsCount > 1 ? 's' : ''}!`, 'success');
    
    // Check if any new email contains verification codes/OTP to show confetti
    const hasOtp = matchingEmails.some(email => {
      const content = `${email.subject} ${email.text || ''} ${email.html || ''}`.toLowerCase();
      return content.includes('otp') || 
             content.includes('verification code') || 
             content.includes('magic link') || 
             /\b\d{4,8}\b/.test(content);
    });

    if (hasOtp) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#6366f1', '#a855f7', '#10b981']
      });
    }
  }, [soundEnabled, showToast]);

  // --- API FETCH FUNCTION ---
  const fetchEmails = useCallback(async () => {
    if (!apiKey) {
      setErrorMessage('API Key is required to fetch emails. Click the settings gear in the top right to configure it.');
      setStatus('error');
      return;
    }
    if (!namespace) {
      setErrorMessage('Namespace is required. Click the settings gear in the top right to configure it.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const url = `https://api.testmail.app/api/json?apikey=${apiKey}&namespace=${namespace}&pretty=true`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const data: ApiResponse = await response.json();

      if (data.result === 'fail') {
        throw new Error(data.message || 'API request failed');
      }

      const fetchedEmails = data.emails || [];
      // Sort: newest first
      fetchedEmails.sort((a, b) => b.timestamp - a.timestamp);

      setEmails(prev => {
        // Merge: combine previous local emails and newly fetched emails
        const emailMap = new Map<string, Email>();
        prev.forEach(e => emailMap.set(e.id, e));
        fetchedEmails.forEach(e => emailMap.set(e.id, e));
        
        const merged = Array.from(emailMap.values());
        // Sort: newest first
        merged.sort((a, b) => b.timestamp - a.timestamp);
        
        const trimmed = merged.slice(0, 1000);
        try {
          localStorage.setItem(`tm_saved_emails_${namespace}`, JSON.stringify(trimmed));
        } catch (err) {
          console.warn('Failed to write emails to localStorage:', err);
        }
        
        // Detect new emails
        const prevIds = new Set(prev.map(e => e.id));
        const newEmails = fetchedEmails.filter(e => !prevIds.has(e.id));
        
        if (newEmails.length > 0 && !isInitialMount.current) {
          handleNewEmailArrival(newEmails.length, newEmails);
        }
        
        // Auto select first email if nothing selected or if selection is missing
        if (trimmed.length > 0 && (!selectedEmailId || !trimmed.some(e => e.id === selectedEmailId))) {
          setSelectedEmailId(trimmed[0].id);
        }
        
        return trimmed;
      });

      setLastRefreshed(new Date());
      setStatus('success');
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(errMsg || 'Failed to fetch emails. Check CORS restrictions or API credentials.');
      setStatus('error');
      showToast('Fetch failed. See error panel.', 'error');
    } finally {
      isInitialMount.current = false;
    }
  }, [apiKey, namespace, selectedEmailId, handleNewEmailArrival, showToast]);

  // --- TRIGGER LOAD ON MOUNT OR CREDENTIAL UPDATE ---
  useEffect(() => {
    if (apiKey && namespace) {
      const timer = setTimeout(() => {
        fetchEmails();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [apiKey, namespace, fetchEmails]);


  // --- AUTO REFRESH POLLING EFFECT ---
  useEffect(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    if (refreshInterval > 0 && apiKey && namespace) {
      pollingTimerRef.current = setInterval(() => {
        // Real Polling
        const url = `https://api.testmail.app/api/json?apikey=${apiKey}&namespace=${namespace}`;
        fetch(url)
          .then(res => res.json())
          .then((data: ApiResponse) => {
            if (data.result === 'success') {
              const fetched = data.emails || [];
              fetched.sort((a, b) => b.timestamp - a.timestamp);
              setEmails(prev => {
                const emailMap = new Map<string, Email>();
                prev.forEach(e => emailMap.set(e.id, e));
                fetched.forEach(e => emailMap.set(e.id, e));
                
                const merged = Array.from(emailMap.values());
                merged.sort((a, b) => b.timestamp - a.timestamp);
                const trimmed = merged.slice(0, 1000);
                
                try {
                  localStorage.setItem(`tm_saved_emails_${namespace}`, JSON.stringify(trimmed));
                } catch (err) {
                  console.warn('LocalStorage write failed:', err);
                }
                
                const prevIds = new Set(prev.map(e => e.id));
                const newEmails = fetched.filter(e => !prevIds.has(e.id));
                if (newEmails.length > 0) {
                  handleNewEmailArrival(newEmails.length, newEmails);
                }
                return trimmed;
              });
              setLastRefreshed(new Date());
            }
          })
          .catch(err => console.warn('Background poll failed:', err));
      }, refreshInterval * 1000);
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [refreshInterval, apiKey, namespace, handleNewEmailArrival]);

  // --- ACTION HANDLERS ---
  const handleCopyEmailAddress = () => {
    const address = `${namespace}.${emailFormatTag}@inbox.testmail.app`;
    navigator.clipboard.writeText(address);
    setIsCopiedAddress(true);
    showToast('Email address copied!');
    
    // Nice confetti pop on copy
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0.4, y: 0.1 }
    });
    
    setTimeout(() => {
      setIsCopiedAddress(false);
    }, 2000);
  };

  const handleOpenSettings = () => {
    setTempApiKey(apiKey);
    setTempNamespace(namespace);
    setTestStatus('idle');
    setTestError(null);
    setIsSettingsOpen(true);
  };

  const testConnection = async () => {
    if (!tempNamespace) {
      setTestStatus('error');
      setTestError('Namespace is required.');
      return;
    }
    if (!tempApiKey) {
      setTestStatus('error');
      setTestError('API Key is required.');
      return;
    }

    setTestStatus('testing');
    setTestError(null);

    try {
      const url = `https://api.testmail.app/api/json?apikey=${tempApiKey}&namespace=${tempNamespace}&limit=1`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const data: ApiResponse = await response.json();
      
      if (data.result === 'fail') {
        throw new Error(data.message || 'Verification failed');
      }

      setTestStatus('success');
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setTestStatus('error');
      setTestError(errMsg || 'Failed to authenticate. Verify credentials.');
    }
  };

  const handleSaveSettings = () => {
    setApiKey(tempApiKey);
    setNamespace(tempNamespace);
    localStorage.setItem('tm_apikey', tempApiKey);
    localStorage.setItem('tm_namespace', tempNamespace);
    setIsSettingsOpen(false);
    showToast('Settings saved successfully!');
    
    // Load existing emails for the new namespace if any
    try {
      const saved = localStorage.getItem(`tm_saved_emails_${tempNamespace}`);
      const loadedEmails = saved ? JSON.parse(saved) : [];
      setEmails(loadedEmails);
      setSelectedEmailId(loadedEmails.length > 0 ? loadedEmails[0].id : null);
    } catch (err) {
      console.warn('Failed to load settings namespace cached emails:', err);
      setEmails([]);
      setSelectedEmailId(null);
    }
    
    if (tempApiKey && tempNamespace) {
      setTimeout(() => {
        fetchEmails();
      }, 0);
    }
  };

  const handleClearMailbox = () => {
    if (window.confirm('Are you sure you want to clear all locally saved emails for this namespace? (This will not delete emails from the active testmail.app server)')) {
      setEmails([]);
      setSelectedEmailId(null);
      localStorage.removeItem(`tm_saved_emails_${namespace}`);
      showToast('Inbox cleared successfully.');
    }
  };

  const handleExportEmails = () => {
    if (emails.length === 0) {
      showToast('No emails to export', 'error');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(emails, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `testmail-export-${namespace}-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('JSON export downloaded!');
  };

  // --- FILTERED EMAILS COMPLETED ---
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      // 1. Tag Filter
      const tagMatch = selectedTag === 'all' || email.tag === selectedTag;
      
      // 2. Search Query Filter
      const search = searchQuery.toLowerCase().trim();
      if (!search) return tagMatch;

      const subjectMatch = email.subject.toLowerCase().includes(search);
      const senderMatch = email.from.toLowerCase().includes(search);
      const textMatch = email.text?.toLowerCase().includes(search) || false;
      const htmlMatch = email.html?.toLowerCase().includes(search) || false;
      const tagTextMatch = email.tag.toLowerCase().includes(search);

      return tagMatch && (subjectMatch || senderMatch || textMatch || htmlMatch || tagTextMatch);
    });
  }, [emails, selectedTag, searchQuery]);

  // Selected Email Details
  const selectedEmail = useMemo(() => {
    return emails.find(e => e.id === selectedEmailId) || null;
  }, [emails, selectedEmailId]);

  // Extract tags and count frequencies
  const tagsList = useMemo(() => {
    const tagsMap: Record<string, number> = {};
    emails.forEach(email => {
      tagsMap[email.tag] = (tagsMap[email.tag] || 0) + 1;
    });
    return Object.entries(tagsMap).map(([name, count]) => ({ name, count }));
  }, [emails]);

  // Extract potential Verification Code / OTP from email body for instant copy
  const extractedVerificationCode = useMemo(() => {
    if (!selectedEmail) return null;
    const bodyText = `${selectedEmail.subject} ${selectedEmail.text || ''}`;
    
    const codeRegexes = [
      /(?:code|otp|verification|confirm|passcode|pin)\D*(\b\d{4,8}\b)/i,
      /\b(\d{6})\b/ // standard 6 digit code
    ];

    for (const regex of codeRegexes) {
      const match = bodyText.match(regex);
      if (match && match[1]) {
        const codeVal = match[1];
        if (codeVal !== '2025' && codeVal !== '2026' && codeVal !== '2027') {
          return codeVal;
        }
      }
    }
    return null;
  }, [selectedEmail]);

  const handleCopyBodyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setIsCopiedBodyCode(true);
    showToast(`Code ${code} copied!`);
    
    // Celebrate code extraction!
    confetti({
      particleCount: 50,
      spread: 40,
      origin: { y: 0.7 }
    });

    setTimeout(() => {
      setIsCopiedBodyCode(false);
    }, 2000);
  };

  // Safe HTML Iframe Source Doc Generation
  const iframeSrcDoc = useMemo(() => {
    if (!selectedEmail || !selectedEmail.html) return '';
    
    const injectStyles = `
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 16px;
          color: #333333;
          background-color: #ffffff;
        }
        img { max-width: 100%; height: auto; }
        a { color: #6366f1; }
      </style>
      <base target="_blank">
    `;
    
    return selectedEmail.html.includes('<head>') 
      ? selectedEmail.html.replace('<head>', `<head>${injectStyles}`) 
      : `${injectStyles}${selectedEmail.html}`;
  }, [selectedEmail]);

  return (
    <div className="app-container">
      {/* --- TOP BAR HEADER --- */}
      <header className="header-bar">
        <div className="logo-section">
          <Mail className="logo-icon" size={24} />
          <span className="logo-text">InboxFlow</span>
        </div>

        {/* Copy Address Widget */}
        <div 
          className={`copy-widget ${isCopiedAddress ? 'copied' : ''}`}
          onClick={handleCopyEmailAddress}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          title="Click anywhere to copy email address"
        >
          <span className="copy-widget-label">Test Email:</span>
          <span className="copy-widget-address" style={{ 
            color: isCopiedAddress ? 'var(--color-success)' : 'var(--color-primary)',
            transition: 'color 0.2s ease'
          }}>
            {namespace}.{emailFormatTag}@inbox.testmail.app
          </span>
          {isCopiedAddress ? (
            <Check size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
          ) : (
            <Copy size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          )}
        </div>

        {/* Header Actions */}
        <div className="header-actions">
          <div className="status-badge">
            <span className={`status-dot ${apiKey && namespace ? 'active' : 'idle'}`}></span>
            <span>{apiKey && namespace ? 'Connected' : 'Credentials Required'}</span>
          </div>

          <button 
            className="icon-btn" 
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button 
            className="icon-btn" 
            onClick={handleOpenSettings}
            title="Open Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* --- WORKSPACE LAYOUT --- */}
      <div className="workspace-grid">
        
        {/* --- PANEL 1: SIDEBAR (Controls) --- */}
        <aside className="sidebar-pane">
          {/* Inbox settings */}
          <div className="sidebar-section">
            <div className="sidebar-title">Inbox Configuration</div>

            <div className="form-group">
              <label className="form-label">Active Tag format</label>
              <input 
                type="text" 
                className="form-input" 
                value={emailFormatTag} 
                onChange={(e) => setEmailFormatTag(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} 
                placeholder="e.g. test"
              />
            </div>
          </div>

          {/* Preferences */}
          <div className="sidebar-section">
            <div className="sidebar-title">Preferences</div>
            
            <div className="toggle-row">
              <span className="switch-label-wrap" onClick={() => setSoundEnabled(!soundEnabled)}>
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span className="form-label">Sound Notification</span>
              </span>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={soundEnabled} 
                  onChange={(e) => setSoundEnabled(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Auto Refresh</label>
              <select 
                className="form-input" 
                value={refreshInterval} 
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                <option value={5}>Every 5 seconds</option>
                <option value={10}>Every 10 seconds</option>
                <option value={30}>Every 30 seconds</option>
                <option value={60}>Every 1 minute</option>
                <option value={0}>Manual Only</option>
              </select>
            </div>
          </div>

          {/* Filter Tags */}
          <div className="sidebar-section" style={{ flexGrow: 1 }}>
            <div className="sidebar-title">Tags</div>
            <div className="tags-list scrollable">
              <button 
                className={`tag-btn ${selectedTag === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedTag('all')}
              >
                <span>All Inbox</span>
                <span className="tag-badge">{emails.length}</span>
              </button>

              {tagsList.map(tag => (
                <button 
                  key={tag.name}
                  className={`tag-btn ${selectedTag === tag.name ? 'active' : ''}`}
                  onClick={() => setSelectedTag(tag.name)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={12} />
                    {tag.name}
                  </span>
                  <span className="tag-badge">{tag.count}</span>
                </button>
              ))}
              
              {tagsList.length === 0 && (
                <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No tags detected yet.
                </div>
              )}
            </div>
          </div>
          
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
            © testmail.app Web Client Dashboard
          </div>
        </aside>

        {/* --- PANEL 2: EMAIL LIST --- */}
        <section className="list-pane">
          <div className="list-header">
            {/* Search */}
            <div className="search-bar">
              <Search size={16} className="empty-state-icon" />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search by sender, subject, body..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* List Header controls */}
            <div className="list-controls">
              <div className="inbox-title-wrap">
                <span className="inbox-title">Inbox</span>
                <span className="tag-badge">{filteredEmails.length}</span>
              </div>

              <div className="btn-icon-group">
                <button 
                  className="icon-btn primary" 
                  onClick={fetchEmails} 
                  disabled={status === 'loading'}
                  title="Manual Sync"
                >
                  <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
                </button>
                <button 
                  className="icon-btn" 
                  onClick={handleExportEmails}
                  title="Export Inbox to JSON"
                >
                  <Download size={14} />
                </button>
                <button 
                  className="icon-btn" 
                  onClick={handleClearMailbox}
                  title="Clear Inbox view"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            
            {/* Refresh timestamp info */}
            {lastRefreshed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                <Clock size={10} />
                <span>Synced: {lastRefreshed.toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* Cards List container */}
          <div className="emails-list-container scrollable">
            {status === 'loading' && emails.length === 0 && (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="skeleton-card">
                  <div className="skeleton-shimmer"></div>
                  <div className="skeleton-bar" style={{ width: '40%' }}></div>
                  <div className="skeleton-bar" style={{ width: '80%' }}></div>
                  <div className="skeleton-bar" style={{ width: '20%', height: '8px' }}></div>
                </div>
              ))
            )}

            {filteredEmails.map(email => (
              <article 
                key={email.id} 
                className={`email-card ${selectedEmailId === email.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedEmailId(email.id);
                  // Default to HTML tab if email has html, else text
                  setActiveViewerTab(email.html ? 'html' : 'text');
                }}
              >
                <div className="card-top">
                  <span className="card-sender" title={email.from}>
                    {email.from.split('<')[0].trim()}
                  </span>
                  <span className="card-time">{formatRelativeTime(email.timestamp, now)}</span>
                </div>
                
                <h3 className="card-subject">{email.subject || '(No Subject)'}</h3>
                
                <div className="card-tags">
                  <span className="inline-tag">{email.tag}</span>
                  {email.attachments && email.attachments.length > 0 && (
                    <span className="inline-tag" style={{ borderStyle: 'dashed' }}>
                      📎 {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </article>
            ))}

            {status !== 'loading' && filteredEmails.length === 0 && (
              <div className="empty-state">
                <Inbox size={40} className="empty-state-icon" />
                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No emails found</p>
                <p style={{ fontSize: '12px' }}>
                  {searchQuery || selectedTag !== 'all' 
                    ? 'Try clearing filters or search queries.' 
                    : `Send a test mail to: ${namespace}.[tag]@inbox.testmail.app`}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* --- PANEL 3: EMAIL VIEW --- */}
        <main className="view-pane">
          {selectedEmail ? (
            <>
              {/* Header details */}
              <div className="view-header">
                <div className="view-subject-row">
                  <h1 className="view-subject">{selectedEmail.subject}</h1>
                </div>

                <div className="view-meta-grid">
                  <span className="meta-label">From:</span>
                  <div className="meta-value">
                    {selectedEmail.from}
                  </div>
                  
                  <span className="meta-label">To:</span>
                  <div className="meta-value">{selectedEmail.to}</div>

                  <span className="meta-label">Date:</span>
                  <div className="meta-value">
                    {new Date(selectedEmail.timestamp).toLocaleString()}
                  </div>

                  <span className="meta-label">Tag:</span>
                  <div className="meta-value">
                    <span className="inline-tag" style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary-glow)' }}>
                      {selectedEmail.tag}
                    </span>
                  </div>
                </div>

                {/* Developer Integration: Extracted verification code popover */}
                {extractedVerificationCode && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    padding: '12px 16px',
                    backgroundColor: 'var(--color-success-glow)',
                    border: '1px solid var(--color-success)',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px',
                    color: 'var(--text-primary)',
                    animation: 'slideIn 0.3s ease-out'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Sparkles style={{ color: 'var(--color-success)' }} size={20} />
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-success)' }}>
                          Verification Code Found!
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                          {extractedVerificationCode}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      className={`copy-btn ${isCopiedBodyCode ? 'copied' : ''}`}
                      onClick={() => handleCopyBodyCode(extractedVerificationCode)}
                      style={{ marginLeft: 'auto', background: 'var(--bg-card)' }}
                    >
                      {isCopiedBodyCode ? <Check size={14} /> : <Copy size={14} />}
                      <span>{isCopiedBodyCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* View options and render body */}
              <div className="view-body">
                <div className="view-tabs-bar">
                  <div className="tabs-group">
                    {selectedEmail.html && (
                      <button 
                        className={`tab-btn ${activeViewerTab === 'html' ? 'active' : ''}`}
                        onClick={() => setActiveViewerTab('html')}
                      >
                        HTML Preview
                      </button>
                    )}
                    <button 
                      className={`tab-btn ${activeViewerTab === 'text' ? 'active' : ''}`}
                      onClick={() => setActiveViewerTab('text')}
                    >
                      Plain Text
                    </button>
                    <button 
                      className={`tab-btn ${activeViewerTab === 'json' ? 'active' : ''}`}
                      onClick={() => setActiveViewerTab('json')}
                    >
                      Raw JSON
                    </button>
                  </div>
                  
                  <div className="tab-actions">
                    <button 
                      className="copy-btn"
                      onClick={() => {
                        const content = activeViewerTab === 'html' 
                          ? selectedEmail.html 
                          : activeViewerTab === 'text' 
                            ? selectedEmail.text 
                            : JSON.stringify(selectedEmail, null, 2);
                        navigator.clipboard.writeText(content || '');
                        showToast(`Copied ${activeViewerTab.toUpperCase()} to clipboard!`);
                      }}
                    >
                      <Copy size={13} />
                      <span>Copy View</span>
                    </button>
                  </div>
                </div>

                <div className="content-display">
                  {activeViewerTab === 'html' && selectedEmail.html && (
                    <div className="iframe-container">
                      <iframe 
                        className="html-viewer"
                        srcDoc={iframeSrcDoc}
                        title="HTML email content"
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                      />
                    </div>
                  )}

                  {activeViewerTab === 'text' && (
                    <div className="text-viewer">
                      {selectedEmail.text || '(No text body)'}
                    </div>
                  )}

                  {activeViewerTab === 'json' && (
                    <div className="json-viewer">
                      {JSON.stringify(selectedEmail, null, 2)}
                    </div>
                  )}
                </div>

                {/* Attachments rendering */}
                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className="attachments-panel">
                    <div className="attachments-title">
                      <span>Attachments ({selectedEmail.attachments.length})</span>
                    </div>
                    <div className="attachments-grid">
                      {selectedEmail.attachments.map((file, idx) => (
                        <a 
                          key={idx}
                          href={file.downloadUrl}
                          download={file.filename}
                          className="attachment-card"
                          onClick={(e) => {
                            if (file.downloadUrl === '#') {
                              e.preventDefault();
                              showToast('Attachment download is not available.', 'error');
                            }
                          }}
                        >
                          <Database size={16} />
                          <div className="attachment-info">
                            <span className="attachment-name" title={file.filename}>{file.filename}</span>
                            <span className="attachment-size">{(file.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ height: '100%' }}>
              <Mail size={56} className="empty-state-icon" style={{ animation: 'bounce 3s infinite' }} />
              <h2 style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 700 }}>Select an email</h2>
              <p style={{ fontSize: '13px', maxWidth: '300px' }}>
                Select an email from the list to view its contents, attachments, text, or headers.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* --- ERROR DISPLAY FALLBACK MODAL --- */}
      {status === 'error' && errorMessage && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '24px',
          right: '24px',
          backgroundColor: 'var(--color-danger-glow)',
          border: '1px solid var(--color-danger)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 999
        }}>
          <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
          <div style={{ flexGrow: 1 }}>
            <strong style={{ fontSize: '13px', display: 'block', color: 'var(--color-danger)' }}>Sync Error</strong>
            <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{errorMessage}</span>
          </div>
          <button 
            className="copy-btn" 
            style={{ backgroundColor: 'var(--bg-card)' }}
            onClick={handleOpenSettings}
          >
            Fix Connection Settings
          </button>
        </div>
      )}

      {/* --- TOAST NOTIFICATIONS --- */}
      {toast && (
        <div className={`toast-msg ${toast.type}`}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'
          }}></div>
          <span>{toast.message}</span>
        </div>
      )}

      {/* --- SETTINGS MODAL --- */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Settings size={18} />
                <span>API Credentials Settings</span>
              </h2>
              <button className="icon-btn" onClick={() => setIsSettingsOpen(false)}>
                <X size={16} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Namespace</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={tempNamespace} 
                  onChange={(e) => setTempNamespace(e.target.value)} 
                  placeholder="e.g. 15ey7"
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  The unique prefix of your testmail.app inbox.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">API Key</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={tempApiKey} 
                  onChange={(e) => setTempApiKey(e.target.value)} 
                  placeholder="e.g. Bearer b7a3c..."
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Your secure testmail.app developer API token.
                </span>
              </div>

              <div style={{ marginTop: '8px' }}>
                <button 
                  className="test-connection-btn" 
                  type="button"
                  disabled={testStatus === 'testing'}
                  onClick={testConnection}
                >
                  <RefreshCw size={12} className={testStatus === 'testing' ? 'animate-spin' : ''} />
                  {testStatus === 'testing' ? 'Testing Connection...' : 'Test API Connection'}
                </button>

                {testStatus === 'success' && (
                  <div className="test-feedback success">
                    <Check size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>Connection successful! Credentials verified with Testmail.app.</span>
                  </div>
                )}

                {testStatus === 'error' && (
                  <div className="test-feedback error">
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>{testError || 'Verification failed. Please check credentials.'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsSettingsOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveSettings}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
