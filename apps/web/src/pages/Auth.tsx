import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, Compass } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button } from '../components/ui';

export default function Auth({ register = false }: { register?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params] = useSearchParams();
  const rawNext = params.get('next');
  const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  async function signIn(demo?: string) {
    setBusy(true);
    setError('');
    try {
      await api(
        register && !demo ? '/auth/sign-up/email' : '/auth/sign-in/email',
        json({
          email: demo ? `${demo}@matchplay.local` : email,
          password: demo ? 'MatchPlay2026!' : password,
          ...(register && !demo ? { name } : {}),
          rememberMe: true,
        }),
      );
      client.clear();
      await client.invalidateQueries({ queryKey: ['me'] });
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void signIn();
  }
  return (
    <div className="auth-page">
      <div className="auth-art">
        <Compass size={54} />
        <h1>
          Find your court.
          <br />
          Find your people.
        </h1>
        <p>A game is better together.</p>
        <div className="auth-court" aria-hidden="true">
          <div />
          <span />
        </div>
      </div>
      <section className="auth-form-wrap">
        <Link to="/" className="auth-brand">
          Match<span>Play</span>
        </Link>
        <h1>{register ? 'Join the game.' : 'Good to see you.'}</h1>
        <p className="muted">
          {register ? 'Your next team is waiting.' : 'Sign in and pick up where you left off.'}
        </p>
        <form onSubmit={submit} className="form">
          {register && (
            <label>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={60}
                autoComplete="name"
                placeholder="Roberts H."
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={show ? 'text' : 'password'}
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={register ? 'new-password' : 'current-password'}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                aria-label={show ? 'Hide password' : 'Show password'}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button busy={busy} className="full" type="submit">
            {register ? 'Create account' : 'Sign in'}
            <ArrowRight size={19} />
          </Button>
        </form>
        <p className="auth-switch">
          {register ? 'Already playing?' : 'New to MatchPlay?'}{' '}
          <Link to={`${register ? '/login' : '/register'}?next=${encodeURIComponent(next)}`}>
            {register ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
        {!register && (
          <details className="demo-accounts">
            <summary>Try a demo account</summary>
            <p>
              Local test accounts. Password: <code>MatchPlay2026!</code>
            </p>
            <div className="demo-grid">
              {[
                ['roberts', 'Roberts', 'Player'],
                ['janis', 'Janis', 'Organiser'],
                ['captain', 'Roberts Z.', 'Captain'],
                ['admin', 'Admin', 'Management'],
              ].map(([key, label, role]) => (
                <button key={key} disabled={busy} onClick={() => void signIn(key)}>
                  <strong>{label}</strong>
                  <span>{role}</span>
                </button>
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
