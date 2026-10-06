import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Share2,
  Send,
  Crown,
  MoreHorizontal,
  Pause,
  Play,
  Flag,
  Copy,
  Check,
  Trophy,
  MapPin,
} from 'lucide-react';
import { tennisLabel, type Match as MatchType, type Member } from '@matchplay/shared/game';
import { api, json, useAction, useMatch, useMe } from '../lib/api';
import { useStream } from '../lib/useStream';
import { Avatar, Button, Dialog, Failure, PageTitle, Skeleton } from '../components/ui';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Clock } from '../components/Clock';
import { schedule, shortName } from '../lib/format';
import { useToast } from '../lib/toast-context';

function MatchRoom({ match, meId }: { match: MatchType; meId: string }) {
  const [text, setText] = useState('');
  const [managing, setManaging] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<'finish' | 'cancel' | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const self = match.members.find((m) => m.userId === meId);
  const host = match.hostId === meId;
  const toast = useToast();
  const stream = useStream(match.id, !!self || host);
  const action = useAction(({ path, body }: { path: string; body: unknown }) =>
    api<MatchType>(`/matches/${match.id}/${path}`, json(body)),
  );
  const send = (path: string, body: unknown) => action.mutate({ path, body });
  const offset = match.serverOffset ?? 0;
  async function chat(event: FormEvent) {
    event.preventDefault();
    const result = await action.mutateAsync({ path: 'chat', body: { text } }).catch(() => null);
    if (result) setText('');
  }
  async function share() {
    const url = `${location.origin}/games/${match.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: match.title,
          text: `Join ${match.title}. Game code: ${match.code}`,
          url,
        });
        return;
      } catch {
        /* Copy remains available when sharing is dismissed. */
      }
    }
    setSharing(true);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/games/${match.id}`);
      setCopied(true);
      toast('Game link copied.');
    } catch {
      toast('Copy the link shown below.', 'error');
    }
  }
  const result =
    match.orangeScore === match.blueScore
      ? 'A game well played.'
      : `${match.orangeScore > match.blueScore ? match.orangeName : match.blueName} wins!`;
  return (
    <div className="page match-page">
      <PageTitle
        title={
          match.status === 'lobby'
            ? 'MATCH LOBBY'
            : match.status === 'live'
              ? 'LIVE MATCH'
              : match.status === 'cancelled'
                ? 'GAME CANCELLED'
                : 'FINAL SCORE'
        }
        back="/games"
        action={
          <button className="icon-button" aria-label="Share game" onClick={() => void share()}>
            <Share2 />
          </button>
        }
      />
      <div className={`match-content ${match.status !== 'lobby' ? 'scoring-layout' : ''}`}>
        <section className="match-main">
          {match.status === 'lobby' ? (
            <div className="countdown-panel">
              <p>GAME STARTS IN</p>
              <Clock match={match} countdown offset={offset} />
              <span>{match.venueName}</span>
            </div>
          ) : (
            <div className={`scoreboard ${match.status === 'completed' ? 'finished' : ''}`}>
              <div className="scoreboard-meta">
                <span className={match.status === 'live' ? 'live-label' : 'orange'}>
                  {match.status === 'live'
                    ? `LIVE ${match.sport.toUpperCase()}`
                    : match.status.toUpperCase()}
                </span>
                <span>
                  {match.period}
                  {match.period === 1
                    ? 'ST'
                    : match.period === 2
                      ? 'ND'
                      : match.period === 3
                        ? 'RD'
                        : 'TH'}{' '}
                  {match.sport === 'Basketball' ? 'QUARTER' : 'PERIOD'}
                </span>
              </div>
              <div className="big-scores">
                {(['orange', 'blue'] as const).map((side) => (
                  <div key={side}>
                    <span className={side}>
                      {side === 'orange' ? match.orangeName : match.blueName}
                    </span>
                    <strong data-testid={`${side}-score`}>
                      <AnimatedNumber
                        value={
                          match.sport === 'Tennis' && match.status !== 'completed'
                            ? tennisLabel(match.tennis, side)
                            : side === 'orange'
                              ? match.orangeScore
                              : match.blueScore
                        }
                      />
                    </strong>
                    {match.sport === 'Tennis' && (
                      <p>
                        {match.tennis.games[side === 'orange' ? 0 : 1]} games ·{' '}
                        {match.tennis.sets[side === 'orange' ? 0 : 1]} sets
                      </p>
                    )}
                    {match.status === 'live' && (host || (self?.captain && self.side === side)) && (
                      <div className="scoring-buttons">
                        {(match.sport === 'Basketball' ? [1, 2, 3] : [1]).map((delta) => (
                          <button
                            disabled={action.isPending}
                            aria-label={`Add ${delta} ${delta === 1 ? 'point' : 'points'} to ${side}`}
                            key={delta}
                            onClick={() =>
                              send('score', { side, delta, requestId: crypto.randomUUID() })
                            }
                          >
                            +{delta}
                          </button>
                        ))}
                        {host && (
                          <button
                            className="subtract"
                            disabled={action.isPending}
                            aria-label={`Remove point from ${side}`}
                            onClick={() =>
                              send('score', { side, delta: -1, requestId: crypto.randomUUID() })
                            }
                          >
                            −1
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <span className="big-score-colon">:</span>
              </div>
              {match.status === 'live' ? (
                <div className="game-clock">
                  <Clock match={match} offset={offset} />
                  <span>{match.clockStartedAt ? 'CLOCK RUNNING' : 'PAUSED'}</span>
                </div>
              ) : (
                match.status === 'completed' && (
                  <div className="result-message">
                    <Trophy size={21} />
                    {result}
                  </div>
                )
              )}
              <p className="scoreboard-venue">
                <MapPin size={14} />
                {match.venueName}
              </p>
            </div>
          )}
          {match.status === 'live' && host && (
            <div className="host-controls">
              <Button
                variant="outline"
                busy={action.isPending}
                onClick={() =>
                  send('control', { action: match.clockStartedAt ? 'pause' : 'resume' })
                }
              >
                {match.clockStartedAt ? <Pause size={17} /> : <Play size={17} />}{' '}
                {match.clockStartedAt ? 'Pause clock' : 'Resume clock'}
              </Button>
              <Button
                variant="quiet"
                busy={action.isPending}
                onClick={() => send('control', { action: 'period' })}
              >
                Next period
              </Button>
              <Button onClick={() => setConfirm('finish')}>
                <Flag size={17} />
                Finish game
              </Button>
            </div>
          )}
          <div className="team-columns">
            {(['orange', 'blue'] as const).map((side) => {
              const members = match.members.filter((m) => m.side === side);
              const name = side === 'orange' ? match.orangeName : match.blueName;
              return (
                <section className={`team-column ${side}`} key={side}>
                  <div className="team-heading">
                    <h2>{name.toUpperCase()}</h2>
                    <span>
                      {members.length}/{match.capacity}
                    </span>
                  </div>
                  <div className="team-members">
                    {members.map((member) => (
                      <div className="member-row" key={member.userId}>
                        <Avatar name={member.name} />
                        <span>
                          {shortName(member.name)}
                          {member.userId === match.hostId && <small> (Host)</small>}
                          {member.captain && <Crown size={13} aria-label="Captain" />}
                        </span>
                        {host && match.status !== 'completed' && match.status !== 'cancelled' && (
                          <button
                            aria-label={`Manage ${member.name}`}
                            onClick={() => setManaging(member)}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                    {!members.length && <p className="team-empty">First spot is yours.</p>}
                  </div>
                  {match.status === 'lobby' &&
                    (!self ? (
                      <Button
                        variant="outline"
                        className="full"
                        busy={action.isPending}
                        disabled={members.length >= match.capacity}
                        onClick={() => send('join', { side })}
                      >
                        {members.length >= match.capacity
                          ? 'TEAM FULL'
                          : `JOIN ${side.toUpperCase()}`}
                      </Button>
                    ) : (
                      self.side === side && (
                        <div className="joined-row">
                          <span>
                            <Check size={15} />
                            You're in
                          </span>
                          {!host && (
                            <button disabled={action.isPending} onClick={() => send('leave', {})}>
                              Leave team
                            </button>
                          )}
                        </div>
                      )
                    ))}
                </section>
              );
            })}
          </div>
          {match.status === 'lobby' && host && (
            <>
              <Button
                className="full start-game"
                busy={action.isPending}
                onClick={() => send('control', { action: 'start' })}
              >
                START GAME
              </Button>
              <button className="cancel-link" onClick={() => setConfirm('cancel')}>
                Cancel game
              </button>
            </>
          )}
        </section>
        <aside className="match-aside">
          <div className="match-chat">
            <h2 className="section-label">MATCH CHAT</h2>
            <div className="chat-messages" aria-live="polite">
              {match.messages.length ? (
                match.messages.map((message) => (
                  <div className="chat-message" key={message.id}>
                    <Avatar name={message.name} />
                    <p>
                      <strong>{message.name.split(' ')[0]}:</strong> {message.text}
                    </p>
                  </div>
                ))
              ) : (
                <p className="muted">Say hello to your team.</p>
              )}
            </div>
            {self || host ? (
              <form className="chat-form" onSubmit={(e) => void chat(e)}>
                <input
                  aria-label="Chat message"
                  placeholder="Message your team…"
                  value={text}
                  maxLength={500}
                  onChange={(e) => setText(e.target.value)}
                  required
                />
                <button aria-label="Send message" disabled={!text.trim() || action.isPending}>
                  <Send size={18} />
                </button>
              </form>
            ) : (
              <p className="chat-join-note">Join a team to chat.</p>
            )}
          </div>
          <div className="game-info">
            <h2 className="section-label">GAME DETAILS</h2>
            <h3>{match.title}</h3>
            <p>{schedule(match.startsAt)} · Riga time</p>
            <p>
              {match.sport} · {match.durationMinutes} minute clock
            </p>
            <button className="game-code" onClick={() => setSharing(true)}>
              <span>GAME CODE</span>
              <strong>{match.code}</strong>
              <Copy size={16} />
            </button>
            <span className="connection-status">
              <i className={stream === 'Live updates' ? 'connected' : ''} />
              {stream}
            </span>
          </div>
        </aside>
      </div>
      {managing && (
        <Dialog title={managing.name} onClose={() => setManaging(null)}>
          <p className="muted">
            {managing.captain ? 'Team captain' : 'Team player'} ·{' '}
            {managing.side === 'orange' ? match.orangeName : match.blueName}
          </p>
          <div className="dialog-actions">
            {!managing.captain && (
              <Button
                variant="outline"
                busy={action.isPending}
                onClick={async () => {
                  const result = await action
                    .mutateAsync({ path: 'captain', body: { userId: managing.userId } })
                    .catch(() => null);
                  if (result) setManaging(null);
                }}
              >
                <Crown size={18} />
                Make captain
              </Button>
            )}
            {match.status === 'lobby' && (
              <Button
                busy={action.isPending}
                onClick={async () => {
                  const result = await action
                    .mutateAsync({
                      path: 'member',
                      body: {
                        userId: managing.userId,
                        side: managing.side === 'orange' ? 'blue' : 'orange',
                      },
                    })
                    .catch(() => null);
                  if (result) setManaging(null);
                }}
              >
                Move to {managing.side === 'orange' ? match.blueName : match.orangeName}
              </Button>
            )}
          </div>
        </Dialog>
      )}
      {confirm && (
        <Dialog
          title={confirm === 'finish' ? 'Finish this game?' : 'Cancel this game?'}
          onClose={() => setConfirm(null)}
        >
          <p className="muted">
            {confirm === 'finish'
              ? 'The final score will be saved to your history. Scoring will close.'
              : 'The game will close and players will no longer be able to join.'}
          </p>
          <div className="dialog-actions">
            <Button variant="quiet" onClick={() => setConfirm(null)}>
              Keep playing
            </Button>
            <Button
              busy={action.isPending}
              onClick={async () => {
                const result = await action
                  .mutateAsync({ path: 'control', body: { action: confirm } })
                  .catch(() => null);
                if (result) setConfirm(null);
              }}
            >
              {confirm === 'finish' ? 'Save final score' : 'Cancel game'}
            </Button>
          </div>
        </Dialog>
      )}
      {sharing && (
        <Dialog title="Bring your team" onClose={() => setSharing(false)}>
          <p className="muted">Share the link or this game code.</p>
          <div className="share-code">{match.code}</div>
          <input
            className="share-url"
            readOnly
            aria-label="Game invitation link"
            value={`${location.origin}/games/${match.id}`}
            onFocus={(e) => e.target.select()}
          />
          <Button className="full" onClick={() => void copy()}>
            {copied ? <Check size={18} /> : <Copy size={18} />}{' '}
            {copied ? 'Copied' : 'Copy game link'}
          </Button>
        </Dialog>
      )}
    </div>
  );
}
export default function Match() {
  const { id = '' } = useParams();
  const query = useMatch(id);
  const me = useMe();
  if (query.isPending || me.isPending)
    return (
      <div className="page">
        <Skeleton />
      </div>
    );
  if (query.error)
    return (
      <div className="page">
        <Failure error={query.error} retry={() => void query.refetch()} />
      </div>
    );
  return <MatchRoom match={query.data} meId={me.data?.id ?? ''} />;
}
