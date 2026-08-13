'use client';

import { useState, useEffect } from 'react';
import { FileSpreadsheet, Upload, RotateCcw, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface DataSourceSettingsProps {
  onSourceChanged?: () => void;
}

export default function DataSourceSettings({ onSourceChanged }: DataSourceSettingsProps) {
  const [isUploaded, setIsUploaded] = useState<boolean>(false);
  const [sourceName, setSourceName] = useState<string>('Loading...');
  const [fileList, setFileList] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/upload');
      const data = await res.json();
      if (data.success) {
        setIsUploaded(data.isUploaded);
        setSourceName(data.source);
        setFileList(data.files || []);
        setSelectedFile(data.activeFile || '');
      }
    } catch (err) {
      console.error('Error fetching source details:', err);
      setSourceName('Error loading Excel source');
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'Excel sheet uploaded successfully!' });
        setFile(null);
        // Clear input element
        const fileInput = document.getElementById('sheet-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        await fetchStatus();
        if (onSourceChanged) onSourceChanged();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to upload sheet.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Network error uploading spreadsheet.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = async (filename: string) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename || null })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await fetchStatus();
        if (onSourceChanged) onSourceChanged();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to switch spreadsheet.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Network error switching spreadsheet.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete the file "${filename}" from the server?`)) {
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/upload?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await fetchStatus();
        if (onSourceChanged) onSourceChanged();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete file.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Network error deleting file.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to revert to the default Excel file?')) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/upload', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Successfully reset to default Excel sheet.' });
        await fetchStatus();
        if (onSourceChanged) onSourceChanged();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to reset sheet.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Network error resetting data source.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '2rem', border: '1px solid var(--border-color-glow)' }}>
      {/* Header Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: isUploaded ? 'rgba(6, 182, 212, 0.1)' : 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '8px', color: isUploaded ? 'var(--info)' : 'var(--primary)' }}>
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.25rem' }}>Active Excel Source</div>
            <select
              value={selectedFile}
              onChange={(e) => handleSelectFile(e.target.value)}
              disabled={isLoading}
              className="form-input"
              style={{ 
                fontSize: '0.85rem', 
                padding: '0.25rem 0.5rem', 
                minWidth: '240px', 
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="" style={{ background: 'var(--background-dark)' }}>Default Spreadsheet (Fallback)</option>
              {fileList.map(f => (
                <option key={f} value={f} style={{ background: 'var(--background-dark)' }}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {isUploaded && (
            <button 
              onClick={handleReset} 
              disabled={isLoading}
              className="btn btn-secondary" 
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
            >
              <RotateCcw size={14} />
              <span>Reset Default</span>
            </button>
          )}
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderColor: 'var(--border-color)' }}
          >
            <span>{isExpanded ? 'Hide Settings' : 'Manage Sheets'}</span>
          </button>
        </div>
      </div>

      {/* Expandable Section */}
      {isExpanded && (
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '2rem' }}>
            
            {/* Upload Box */}
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--primary)' }}>Upload New Spreadsheet</h4>
              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <input 
                    id="sheet-file-input"
                    type="file" 
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="form-input"
                    style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                    required
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={isLoading || !file} 
                  className={`btn btn-primary ${isLoading || !file ? 'btn-disabled' : ''}`}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', width: 'fit-content' }}
                >
                  {isLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  <span>Upload & Activate</span>
                </button>
              </form>
            </div>

            {/* Manage Files Box */}
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--info)' }}>Stored Spreadsheets ({fileList.length})</h4>
              {fileList.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                  No custom spreadsheets uploaded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {fileList.map(f => (
                    <div 
                      key={f} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0.4rem 0.6rem', 
                        background: 'rgba(255,255,255,0.03)', 
                        border: f === selectedFile ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        fontSize: '0.8rem'
                      }}
                    >
                      <span style={{ 
                        fontWeight: f === selectedFile ? 700 : 400, 
                        color: f === selectedFile ? 'var(--info)' : 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginRight: '0.5rem'
                      }} title={f}>
                        {f}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        {f !== selectedFile && (
                          <button 
                            onClick={() => handleSelectFile(f)} 
                            disabled={isLoading}
                            className="btn btn-secondary"
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', height: 'auto' }}
                          >
                            Use
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteFile(f)} 
                          disabled={isLoading}
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)', height: 'auto' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {message && (
            <div style={{ 
              marginTop: '1.25rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontSize: '0.85rem',
              color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
              padding: '0.5rem 0.75rem',
              background: message.type === 'success' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
              borderRadius: '6px',
              border: message.type === 'success' ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(239,68,68,0.15)'
            }}>
              {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              <span>{message.text}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
