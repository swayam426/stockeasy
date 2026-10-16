import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Inventory search with a live results dropdown.
 *
 * The table below still filters as you type, but with 400+ products the
 * matches were often off-screen — you had to scroll down to find out
 * whether anything matched. This shows them immediately under the box,
 * the same way the Inflow/Outflow product picker does.
 *
 * Picking a result narrows the table to that one product, so Edit and
 * delete are one click away.
 */
export default function InventorySearch({ products, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [listening, setListening] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const recognitionRef = useRef(null);

  // Close when clicking away so the list doesn't sit over the form below.
  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const query = String(value || '').trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return [];
    const list = products.filter(p =>
      (p.name || '').toLowerCase().includes(query) ||
      (p.sku || '').toLowerCase().includes(query) ||
      (p.hsn_code || '').toLowerCase().includes(query)
    );
    // Capped for responsiveness; narrowing the query reveals the rest.
    return list.slice(0, 50);
  }, [products, query]);

  useEffect(() => { setHighlight(0); }, [query]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlight];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  function choose(p) {
    // Setting the exact name leaves the table showing just this product.
    onChange(p.name);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter') && matches.length) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matches[highlight]) choose(matches[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Speech recognition not supported. Use Chrome.'); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.start();
    setListening(true);
    recognition.onresult = (e) => {
      onChange(e.results[0][0].transcript);
      setListening(false);
      setOpen(true);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); alert('Could not hear you. Try again.'); };
  }

  return (
    <div className="search-bar inv-search" ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        placeholder={listening ? 'Listening... speak now' : 'Search by name, SKU or HSN — or tap the mic'}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (query) setOpen(true); }}
        onKeyDown={onKeyDown}
        style={{ paddingRight: 76, border: listening ? '2px solid #cc0000' : undefined }}
      />

      {value && (
        <button
          type="button"
          className="inv-search-clear"
          title="Clear search"
          onClick={() => { onChange(''); setOpen(false); inputRef.current?.focus(); }}
        >×</button>
      )}

      <button
        type="button"
        onClick={startListening}
        className="inv-search-mic"
        style={{
          background: listening ? '#cc0000' : 'transparent',
          animation: listening ? 'pulse 1s infinite' : 'none',
        }}
        title="Search by voice"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={listening ? '#fff' : 'currentColor'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>

      {listening && (
        <div className="inv-search-listening">
          <div className="inv-search-listening-dot">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Listening…</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            Speak the product name clearly
          </div>
          <button type="button" className="btn btn-sm"
            onClick={() => { recognitionRef.current?.stop(); setListening(false); }}>
            Cancel
          </button>
        </div>
      )}

      {open && !listening && query && (
        <div className="pp-menu" ref={listRef} role="listbox">
          {matches.length === 0 ? (
            <div className="pp-empty">No products match “{value}”</div>
          ) : (
            matches.map((p, i) => {
              const stock = Number(p.qty);
              const low = stock > 0 && stock <= Number(p.threshold);
              return (
                <div
                  key={p.id}
                  role="option"
                  aria-selected={i === highlight}
                  className={`pp-option${i === highlight ? ' is-active' : ''}`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                >
                  <div className="pp-option-main">
                    <div className="pp-option-name">{p.name}</div>
                    <div className="pp-option-sub">
                      {p.sku ? `${p.sku} · ` : ''}
                      {p.hsn_code ? `HSN ${p.hsn_code} · ` : ''}
                      ₹{Number(p.price).toFixed(2)} / {p.unit}
                    </div>
                  </div>
                  <div className={`pp-stock${stock === 0 ? ' is-out' : low ? ' is-low' : ''}`}>
                    {stock} {p.unit}
                  </div>
                </div>
              );
            })
          )}
          {matches.length === 50 && (
            <div className="pp-more">Showing first 50 — keep typing to narrow</div>
          )}
        </div>
      )}
    </div>
  );
}
