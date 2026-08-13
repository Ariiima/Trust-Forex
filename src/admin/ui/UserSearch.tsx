/**
 * The one user search, in the shell.
 *
 * Every section used to grow its own search box, each scoped to whatever that
 * section happened to be listing — so finding a person meant first working out
 * which page they would show up on. This sits in the top-right of every page,
 * searches all accounts, and lands on the account itself.
 *
 * Cmd/Ctrl-K opens it, typing filters, Enter takes the first hit.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../data';
import { useAsync } from '../useAsync';
import { Icon, PlanGlyph } from './index';

export function UserSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only fetched once the operator actually opens it.
  const users = useAsync(() => (open ? api.users() : Promise.resolve([])), [open]) ?? [];

  /* Name, account number and email only. The internal `id` is an opaque key in
     the same numeric shape as the account number, so including it made "1004"
     also match the accounts whose id merely contains those digits. */
  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users.slice(0, 8);
    return users
      .filter((u) => `${u.name} ${u.userNo ?? ''} ${u.email ?? ''}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [users, q]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    setQ('');
    navigate(`/users/${id}`);
  };

  return (
    <div className="a-usersearch" ref={boxRef}>
      <button
        type="button"
        className="a-usersearch__button"
        aria-label="Search users"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="search" size={16} />
        <span>Search users</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div className="a-usersearch__panel">
          <div className="a-usersearch__field">
            <Icon name="search" size={16} />
            <input
              ref={inputRef}
              value={q}
              placeholder="Name, user number or email…"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
                if (e.key === 'Enter' && hits[active]) go(hits[active].id);
              }}
            />
          </div>
          <div className="a-usersearch__list">
            {hits.length === 0 && (
              <div className="a-empty at-13">{q.trim() ? 'No account matches that.' : 'Loading accounts…'}</div>
            )}
            {hits.map((u, i) => (
              <button
                key={u.id}
                type="button"
                className={`a-usersearch__hit${i === active ? ' is-active' : ''}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => go(u.id)}
              >
                <PlanGlyph plan={u.plan} size={26} />
                <span className="a-cell2">
                  <span className="at-semibold">{u.name}</span>
                  <span>{u.userNo != null ? `#${u.userNo}` : u.id}{u.email ? ` · ${u.email}` : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
