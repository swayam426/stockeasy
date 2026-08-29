import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Type-to-search product selector.
 *
 * A plain <select> is unusable past a few dozen products — you can't scan
 * a 368-item list, and the native type-ahead only matches from the start
 * of the name. This matches anywhere in the name or SKU, shows stock and
 * price inline, and supports keyboard navigation.
 */
export default function ProductPicker({
  products,
  value,
  productName,
  onPick,
  onCustom,
  placeholder = 'Search products…',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = products.find(p => String(p.id) === String(value));

  // Close when clicking away, so the dropdown doesn't linger over the form.
  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? products
      : products.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
        );
    // Cap the rendered list — 368 DOM rows per line item, across several
    // lines, makes typing feel sluggish. Narrowing the query reveals the rest.
    return list.slice(0, 50);
  }, [products, query]);

  useEffect(() => { setHighlight(0); }, [query]);

  // Keep the highlighted row scrolled into view during keyboard nav.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlight];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const trimmed = query.trim();

  // Offer a free-text product whenever the typed name isn't already an
  // exact catalogue match — you often quote items you buy in to order,
  // which have no inventory record and shouldn't need one.
  const showCustom = trimmed.length > 0 &&
    !products.some(p => (p.name || '').toLowerCase() === trimmed.toLowerCase());

  // The custom entry sits at the end of the list for keyboard purposes.
  const optionCount = matches.length + (showCustom ? 1 : 0);
  const customIndex = matches.length;

  function choose(p) {
    onPick(p ? p.id : '');
    setOpen(false);
    setQuery('');
  }

  function chooseCustom() {
    if (!trimmed || !onCustom) return;
    onCustom(trimmed);
    setOpen(false);
    setQuery('');
  }

  function commitHighlight() {
    if (showCustom && highlight === customIndex) chooseCustom();
    else if (matches[highlight]) choose(matches[highlight]);
  }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, optionCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitHighlight();
    } else if (e.key === 'Tab') {
      // Tabbing away with text typed and nothing matched keeps what you
      // wrote, rather than silently discarding it.
      if (showCustom && matches.length === 0) chooseCustom();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  // Shown when closed: the chosen product, or the free-typed name if the
  // line was filled in without picking from inventory.
  const display = selected ? selected.name : (productName || '');

  return (
    <div className="pp-wrap" ref={wrapRef}>
      <div className="pp-control" onClick={() => { setOpen(true); inputRef.current?.focus(); }}>
        <input
          ref={inputRef}
          className="pp-input"
          value={open ? query : display}
          placeholder={display ? display : placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {selected && !open && (
          <button
            type="button"
            className="pp-clear"
            title="Clear"
            onClick={(e) => { e.stopPropagation(); choose(null); }}
          >×</button>
        )}
        <span className="pp-caret">⌄</span>
      </div>

      {open && (
        <div className="pp-menu" ref={listRef} role="listbox">
          {matches.length === 0 && !showCustom ? (
            <div className="pp-empty">Type to search your inventory</div>
          ) : (
            matches.map((p, i) => {
              const stock = Number(p.qty);
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
                      {p.sku ? `${p.sku} · ` : ''}₹{Number(p.price).toFixed(2)} / {p.unit}
                    </div>
                  </div>
                  <div className={`pp-stock${stock === 0 ? ' is-out' : stock <= Number(p.threshold) ? ' is-low' : ''}`}>
                    {stock} {p.unit}
                  </div>
                </div>
              );
            })
          )}
          {showCustom && (
            <div
              role="option"
              aria-selected={highlight === customIndex}
              className={`pp-option pp-custom${highlight === customIndex ? ' is-active' : ''}`}
              onMouseEnter={() => setHighlight(customIndex)}
              onMouseDown={(e) => { e.preventDefault(); chooseCustom(); }}
            >
              <div className="pp-option-main">
                <div className="pp-option-name">
                  <span className="pp-custom-plus">+</span> Use “{trimmed}”
                </div>
                <div className="pp-option-sub">
                  One-off item — not added to inventory
                </div>
              </div>
            </div>
          )}

          {matches.length === 50 && (
            <div className="pp-more">Showing first 50 — keep typing to narrow</div>
          )}
        </div>
      )}
    </div>
  );
}
