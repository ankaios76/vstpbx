import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import axios from 'axios';
import { useI18n } from '../context/I18nContext';

interface GreetingInfo {
  label: string;
  exists: boolean;
  size: number;
}

type Greetings = Record<string, GreetingInfo>;

export default function MailboxGreetings({ extension }: { extension: string }) {
  const { tr } = useI18n();
  const [greetings, setGreetings] = useState<Greetings>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: string; text: string; ok: boolean } | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const KIND_ORDER: { kind: string; title: string; desc: string }[] = [
    { kind: 'unavail', title: tr('Nicht erreichbar', 'Unavailable'), desc: tr('Wird abgespielt, wenn die Nebenstelle nicht abnimmt.', 'Played when the extension does not answer.') },
    { kind: 'busy', title: tr('Besetzt', 'Busy'), desc: tr('Wird abgespielt, wenn besetzt ist.', 'Played when the line is busy.') },
    { kind: 'temp', title: tr('Temporäre Ansage', 'Temporary greeting'), desc: tr('Überschreibt vorübergehend die obigen Ansagen (z. B. Urlaub).', 'Temporarily overrides the greetings above (e.g. vacation).') },
    { kind: 'greet', title: tr('Name', 'Name'), desc: tr('Name für die Standard-Ansage ("Sie haben … erreicht").', 'Name for the default greeting ("You have reached …").') },
  ];

  const load = async () => {
    try {
      const r = await axios.get(`/api/voicemail/mailbox/${extension}/greetings`);
      setGreetings(r.data || {});
    } catch {
      setGreetings({});
    }
  };

  useEffect(() => {
    if (extension && extension !== 'all') load();
    setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extension]);

  const upload = async (kind: string, file: File) => {
    setBusy(kind);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await axios.post(`/api/voicemail/mailbox/${extension}/greeting/${kind}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMsg({ kind, text: tr('Ansage gespeichert.', 'Greeting saved.'), ok: true });
      await load();
    } catch (e: any) {
      setMsg({ kind, text: e?.response?.data?.detail || tr('Upload fehlgeschlagen.', 'Upload failed.'), ok: false });
    } finally {
      setBusy(null);
      if (fileRefs.current[kind]) fileRefs.current[kind]!.value = '';
    }
  };

  const remove = async (kind: string) => {
    setBusy(kind);
    setMsg(null);
    try {
      await axios.delete(`/api/voicemail/mailbox/${extension}/greeting/${kind}`);
      setMsg({ kind, text: tr('Ansage gelöscht.', 'Greeting deleted.'), ok: true });
      await load();
    } catch (e: any) {
      setMsg({ kind, text: e?.response?.data?.detail || tr('Löschen fehlgeschlagen.', 'Delete failed.'), ok: false });
    } finally {
      setBusy(null);
    }
  };

  const card: CSSProperties = {
    border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: '14px 16px',
    marginBottom: 12, background: 'var(--card-bg, #fff)',
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 4px' }}>{tr('Ansagen für Mailbox', 'Greetings for mailbox')} {extension}</h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, opacity: 0.7 }}>
        {tr('Eigene Ansage als Audiodatei hochladen (WAV oder MP3; wird automatisch ins passende Format gewandelt).',
            'Upload your own greeting as an audio file (WAV or MP3; converted to the right format automatically).')}
        {' '}
        {tr('Alternativ per Telefon:', 'Alternatively by phone:')} <code>*98</code> → <code>0</code>.
      </p>

      {KIND_ORDER.map(({ kind, title, desc }) => {
        const g = greetings[kind];
        const exists = !!g?.exists;
        const isBusy = busy === kind;
        return (
          <div key={kind} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong>{title}</strong>
                <span style={{ marginLeft: 8, fontSize: 12, color: exists ? '#2e7d32' : '#9e9e9e' }}>
                  {exists ? tr('● hinterlegt', '● set') : tr('○ keine eigene Ansage', '○ no custom greeting')}
                </span>
                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  ref={(el) => { fileRefs.current[kind] = el; }}
                  type="file"
                  accept="audio/*,.wav,.mp3"
                  style={{ fontSize: 13, maxWidth: 190 }}
                  disabled={isBusy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(kind, f); }}
                />
                {exists && (
                  <button
                    onClick={() => remove(kind)}
                    disabled={isBusy}
                    style={{ fontSize: 13, padding: '5px 10px', borderRadius: 6, border: '1px solid #d33', color: '#d33', background: 'transparent', cursor: 'pointer' }}
                  >
                    {tr('Löschen', 'Delete')}
                  </button>
                )}
              </div>
            </div>
            {isBusy && <div style={{ fontSize: 12, marginTop: 8 }}>{tr('… wird verarbeitet', '… processing')}</div>}
            {msg && msg.kind === kind && (
              <div style={{ fontSize: 12, marginTop: 8, color: msg.ok ? '#2e7d32' : '#d33' }}>{msg.text}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
