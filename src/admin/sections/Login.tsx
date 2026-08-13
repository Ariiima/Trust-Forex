import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../data';
import { Button, Field } from '../ui';

export default function Login({ onSignedIn }: { onSignedIn: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    api.login(username, password)
      .then((s) => onSignedIn(s.username))
      .catch((err: unknown) => {
        // Never say which half was wrong — that turns the form into a
        // username oracle.
        setError(err instanceof ApiError && err.status === 401
          ? 'Incorrect username or password.'
          : 'Could not reach the server.');
        setBusy(false);
      });
  };

  return (
    <div className="a-login">
      <form className="a-card a-login__card" onSubmit={submit}>
        <div className="a-row" style={{ gap: 12, marginBottom: 8 }}>
          <span className="a-sidebar__mark">TF</span>
          <span className="at-20 at-bold">Trust Forex Admin</span>
        </div>
        <p className="at-13 at-muted">Sign in to manage users, brokers and payouts.</p>

        <Field label="Username">
          <input
            className="a-input"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            className="a-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error && <p className="at-13 at-neg" role="alert">{error}</p>}

        <Button
          type="submit"
          variant="primary"
          disabled={busy || !username || !password}
          style={{ width: '100%' }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
