import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './VoicemailStats.css';
import { useI18n } from '../context/I18nContext';

interface VoicemailStats {
  total: number;
  unread: number;
  by_mailbox: Record<string, number>;
}

const VoicemailStats: React.FC = () => {
  const { t } = useI18n();
  const [stats, setStats] = useState<VoicemailStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/voicemail/stats');
      setStats(response.data);
    } catch (error) {
      console.error(t('voicemailPage.error.fetchStats'), error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="voicemail-stats-card">
        <div className="card-header">
          <h3>{t('voicemailPage.title')}</h3>
        </div>
        <div className="card-content loading">
          <div className="spinner-small"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="voicemail-stats-card">
        <div className="card-header">
          <h3>{t('voicemailPage.title')}</h3>
        </div>
        <div className="card-content error">
          <p>{t('voicemailStats.noData')}</p>
        </div>
      </div>
    );
  }

  const topMailboxes = Object.entries(stats.by_mailbox)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="voicemail-stats-card">
      <div className="card-header">
        <h3>{t('voicemailPage.title')}</h3>
      </div>
      
      <div className="card-content">
        <div className="stats-grid">
          <div className="stat-item primary">
            <div className="stat-icon">📭</div>
            <div className="stat-details">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">{t('voicemailPage.total')}</div>
            </div>
          </div>

          <div className="stat-item highlight">
            <div className="stat-icon">🔔</div>
            <div className="stat-details">
              <div className="stat-value">{stats.unread}</div>
              <div className="stat-label">{t('voicemailPage.unread')}</div>
            </div>
          </div>
        </div>

        {topMailboxes.length > 0 && (
          <div className="mailboxes-section">
            <h4 className="section-title">{t('voicemailStats.topMailboxes')}</h4>
            <div className="mailbox-bars">
              {topMailboxes.map(([mailbox, count]) => {
                const percentage = (count / stats.total) * 100;
                return (
                  <div key={mailbox} className="mailbox-bar">
                    <div className="mailbox-bar-header">
                      <span className="mailbox-label">{t('voicemailStats.mailboxLabel', { mailbox })}</span>
                      <span className="mailbox-count">{count}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {stats.unread > 0 && (
          <div className="alert-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{t('voicemailStats.unreadCount', { count: stats.unread })}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoicemailStats;
