import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ArrowLeft, LoaderCircle, X, MapPin, CircleAlert } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { initials } from '../lib/format';

export function Button({
  children,
  busy,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: 'primary' | 'outline' | 'quiet';
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${className}`}
      aria-busy={busy || undefined}
    >
      {busy && <LoaderCircle size={19} className="spin" />}
      {children}
    </button>
  );
}
export function Avatar({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`avatar ${className}`}>{initials(name)}</span>;
}
export function Skeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="skeletons" aria-label="Loading" aria-busy="true">
      {Array.from({ length: cards }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-photo" />
          <div className="skeleton-copy">
            <div />
            <div />
            <div />
          </div>
        </div>
      ))}
    </div>
  );
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <MapPin size={30} />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Failure({ error, retry }: { error: Error; retry?: () => void }) {
  const location = useLocation();
  if (error instanceof ApiError && error.status === 401)
    return (
      <Empty
        title="Your next game starts here"
        text="Sign in to join a team, organise a game and keep your results."
      >
        <Link
          className="button primary"
          to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        >
          Sign in
        </Link>
      </Empty>
    );
  return (
    <div className="empty" role="alert">
      <CircleAlert size={30} />
      <h2>Couldn't load this page</h2>
      <p>{error.message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function PageTitle({
  title,
  back = '/',
  action,
}: {
  title: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <Link to={back} className="icon-button" aria-label="Go back">
        <ArrowLeft />
      </Link>
      <h1>{title}</h1>
      <div>{action}</div>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
