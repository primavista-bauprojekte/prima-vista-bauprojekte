import { businessContact } from '../../shared/contact';
import ContactNumbers from './ContactNumbers';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from '../i18n/Link';
import { useLocale } from '../i18n/useLocale';
import { ChatIcon, CloseIcon, MailIcon, PhoneIcon, PinIcon } from './icons';
import { useAnyVideoPlaying } from '../hooks/useVideoPlayback';
import { escapeRegExp } from '../utils/contentSecurity';

const INTERNAL_PATHS = [
  '/komplett-pakete',
  '/gewerke',
  '/projekte',
  '/kalkulator',
  '/blitz-angebot',
  '/kontakt',
  '/impressum',
  '/datenschutz',
] as const;

const ESCAPED_PATHS = INTERNAL_PATHS.map(escapeRegExp).join('|');
const PATH_RE = new RegExp(
  `(\\*\\*[^*]+\\*\\*|\\((${ESCAPED_PATHS})\\)|(?<![\\w/])(${ESCAPED_PATHS})(?![\\w]))`,
  'g',
);

type IconName =
  | 'calendar'
  | 'calendar-plus'
  | 'check'
  | 'clock'
  | 'lock'
  | 'paperclip'
  | 'send'
  | 'shield'
  | 'user';

type Message = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
};

const GREETING_ID = 0;

const CHAT_SCROLL_IDLE_MS = 5000;

const CALCULATOR_PATHS = [
  '/kalkulator',
  '/haus-sanierung',
  '/wohnung-sanierung',
  '/gastronomie-ausbau',
  '/buero-ausbau',
  '/badsanierung',
  '/badsanierung-gaeste-wc',
  '/kuechen-moebelbau',
  '/boeden-belaege',
  '/elektroinstallation',
  '/trockenbau',
  '/maler-lackierer',
  '/fassadensanierung',
  '/abdichtung-keller',
  '/dachsanierung',
  '/treppen-gelaender',
  '/garten-aussenanlagen',
  '/barrierefreiheit',
  '/fenstertechnik',
  '/rohbau-abbruch',
  '/tueren-zargen',
  '/sanitaerinstallation',
  '/zaeune',
  '/heizkoerper',
  '/heizstraenge',
  '/fussbodenheizung',
  '/waermepumpe',
  '/gas-heizung',
  '/pelletofen',
  '/saunaofen',
] as const;

function isCalculatorPath(pathname: string) {
  return CALCULATOR_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function getRouteMain() {
  const mains = Array.from(document.querySelectorAll('main'));
  return mains[0] ?? null;
}

function getTopContentBlock() {
  const main = getRouteMain();
  const firstChild = main?.firstElementChild;
  if (firstChild instanceof HTMLElement) return firstChild;
  return null;
}

function useChatScrollWindow(open: boolean, onLeaveWindow: () => void) {
  const { pathname } = useLocation();
  const [canShowLauncher, setCanShowLauncher] = useState(false);
  const [canShowPreview, setCanShowPreview] = useState(false);
  const openRef = useRef(open);
  const onLeaveWindowRef = useRef(onLeaveWindow);

  useEffect(() => {
    openRef.current = open;
    onLeaveWindowRef.current = onLeaveWindow;
  }, [open, onLeaveWindow]);

  useEffect(() => {
    let raf = 0;
    let idleTimer = 0;

    const isEligible = () => {
      const topBlock = getTopContentBlock();
      const footer = document.querySelector<HTMLElement>('.pv-footer');
      const header = document.querySelector<HTMLElement>('.pv-header');
      const headerOffset = header?.getBoundingClientRect().height ?? 0;

      const passedTopBlock = topBlock
        ? topBlock.getBoundingClientRect().bottom <= headerOffset + 16
        : window.scrollY > Math.round(window.innerHeight * 0.7);
      const beforeFooter = footer
        ? footer.getBoundingClientRect().top > window.innerHeight - 24
        : true;

      return passedTopBlock && beforeFooter;
    };

    const clearIdleTimer = () => {
      if (!idleTimer) return;
      window.clearTimeout(idleTimer);
      idleTimer = 0;
    };

    const update = () => {
      raf = 0;
      clearIdleTimer();

      const eligible = isEligible();
      if (!eligible) {
        setCanShowLauncher(false);
        setCanShowPreview(false);
        if (openRef.current) onLeaveWindowRef.current();
        return;
      }

      setCanShowLauncher(true);
      setCanShowPreview(false);

      idleTimer = window.setTimeout(() => {
        idleTimer = 0;
        const stillEligible = isEligible();
        setCanShowLauncher(stillEligible);
        setCanShowPreview(stillEligible);
        if (!stillEligible && openRef.current) onLeaveWindowRef.current();
      }, CHAT_SCROLL_IDLE_MS);
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    const initial = window.setTimeout(update, 80);
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      window.clearTimeout(initial);
      clearIdleTimer();
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [pathname]);

  return { canShowLauncher, canShowPreview };
}

function useLauncherAvoidance(enabled: boolean) {
  const { pathname } = useLocation();
  const [shouldAvoid, setShouldAvoid] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setShouldAvoid(false);
      return;
    }

    let raf = 0;
    const interactiveSelector = 'a[href], button, input, select, textarea, [role="button"]';

    const update = () => {
      raf = 0;
      const launcherButton = document.querySelector<HTMLElement>('.pv-chat-launcher .pv-chat');
      if (!launcherButton) {
        setShouldAvoid(false);
        return;
      }

      const rect = launcherButton.getBoundingClientRect();
      const previousPointerEvents = launcherButton.style.pointerEvents;
      launcherButton.style.pointerEvents = 'none';

      const inset = 6;
      const points = [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + inset, rect.top + rect.height / 2],
        [rect.right - inset, rect.top + rect.height / 2],
        [rect.left + rect.width / 2, rect.top + inset],
        [rect.left + rect.width / 2, rect.bottom - inset],
      ];

      const hasInteractiveUnderButton = points.some(([x, y]) => {
        const target = document.elementFromPoint(x, y);
        const interactive = target?.closest(interactiveSelector);
        return Boolean(interactive && !interactive.closest('.pv-chat-launcher'));
      });

      launcherButton.style.pointerEvents = previousPointerEvents;
      setShouldAvoid(hasInteractiveUnderButton);
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    const timer = window.setInterval(schedule, 1000);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.clearInterval(timer);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, pathname]);

  return shouldAvoid;
}

function renderAssistantText(
  text: string,
  onLinkClick: () => void,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(PATH_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));
    const token = m[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={`b-${i++}`}>{token.slice(2, -2)}</strong>);
    } else {
      const path = token.startsWith('(') ? token.slice(1, -1) : token;
      nodes.push(
        <Link
          key={`l-${i++}`}
          to={path}
          className="pv-chat-link"
          onClick={onLinkClick}
        >
          {path}
        </Link>,
      );
    }
    last = idx + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function MessageIcon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'calendar') {
    return (
      <svg {...common}>
        <path d="M8 2v4M16 2v4M3.5 9.5h17" />
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
      </svg>
    );
  }
  if (name === 'calendar-plus') {
    return (
      <svg {...common}>
        <path d="M8 2v4M16 2v4M3.5 9.5h17" />
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M12 13v5M9.5 15.5h5" />
      </svg>
    );
  }
  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (name === 'lock') {
    return (
      <svg {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }
  if (name === 'paperclip') {
    return (
      <svg {...common}>
        <path d="m21.4 11.6-8.8 8.8a5 5 0 0 1-7.1-7.1l9.5-9.5a3.5 3.5 0 1 1 5 5l-9.6 9.6a2 2 0 1 1-2.8-2.8l8.8-8.8" />
      </svg>
    );
  }
  if (name === 'send') {
    return (
      <svg {...common}>
        <path d="M4 12 20 4l-6 16-2-7-8-1Z" />
      </svg>
    );
  }
  if (name === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function Avatar() {
  return (
    <span className="pv-chat-avatar" aria-hidden="true">
      <img
        src="/assets/img/logo.png"
        alt=""
        width="1085"
        height="1051"
        loading="lazy"
      />
    </span>
  );
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={`pv-chat-eyebrow${dark ? ' pv-chat-eyebrow--dark' : ''}`}>
      {children}
    </span>
  );
}

function BrandRail() {
  const { t } = useTranslation('chat');
  return (
    <aside className="pv-chat-rail" aria-label={t('rail.ariaLabel')}>
      <Link className="pv-chat-rail__brand" to="/" aria-label={t('rail.brandLabel')}>
        <img src="/assets/img/logo.png" alt="" width="1085" height="1051" />
        <span>
          <strong>Prima Vista</strong>
          <small>Bauprojekte</small>
        </span>
      </Link>

      <div className="pv-chat-rail__intro">
        <Eyebrow dark>{t('rail.eyebrow')}</Eyebrow>
        <h2><Trans i18nKey="chat:rail.heading" components={{ br: <br /> }} /></h2>
        <p>{t('rail.paragraph')}</p>
      </div>

      <div className="pv-chat-rail__proof">
        <span><MessageIcon name="clock" /> {t('rail.proofResponse')}</span>
        <span><MessageIcon name="calendar" /> {t('rail.proofMeeting')}</span>
        <span><MessageIcon name="shield" /> {t('rail.proofGuarantee')}</span>
      </div>

      <address className="pv-chat-rail__contact">
        <div className="pv-chat-rail__phones"><PhoneIcon /><ContactNumbers /></div>
        <a href="mailto:office@primavista-bauprojekte.com"><MailIcon /> office@primavista-bauprojekte.com</a>
        <span><PinIcon /> {t('rail.location')}</span>
      </address>
    </aside>
  );
}

function ChatHeader({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('chat');
  return (
    <header className="pv-chat-panel__header">
      <Avatar />
      <div className="pv-chat-panel__title">
        <strong>{t('name')}</strong>
        <small><span aria-hidden="true" /> {t('header.status')}</small>
      </div>
      <Link className="pv-chat-panel__human" to="/kontakt" onClick={onClose}>
        <MessageIcon name="user" />
        {t('header.human')}
      </Link>
      <button
        type="button"
        className="pv-chat-panel__close"
        onClick={onClose}
        aria-label={t('header.close')}
      >
        <CloseIcon />
      </button>
    </header>
  );
}

function WelcomeBlock() {
  const { t } = useTranslation('chat');
  return (
    <div className="pv-chat-welcome">
      <Eyebrow>{t('welcome.eyebrow')}</Eyebrow>
      <h2>{t('welcome.heading')}</h2>
      <p>{t('welcome.paragraph')}</p>
    </div>
  );
}

function TypingDots() {
  const { t } = useTranslation('chat');
  return (
    <span className="pv-chat-typing" aria-label={t('typingAria')}>
      <span />
      <span />
      <span />
    </span>
  );
}

function ChatWidget() {
  const { t } = useTranslation('chat');
  const locale = useLocale();
  const greeting = t('greeting');
  const suggestions = t('suggestions', { returnObjects: true }) as string[];

  const [open, setOpen] = useState(false);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: GREETING_ID, role: 'assistant', content: greeting },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const launcherButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);

  const close = useCallback(() => setOpen(false), []);
  const { canShowLauncher, canShowPreview } = useChatScrollWindow(open, close);
  const videoPlaying = useAnyVideoPlaying();
  // Hide the floating launcher while a video plays so it doesn't overlap the
  // player; an already-open conversation stays open and is not unmounted.
  const launcherVisible = canShowLauncher && !videoPlaying;
  const shouldAvoidLauncher = useLauncherAvoidance(launcherVisible && !open);

  // Keep the greeting in the active language while the conversation hasn't
  // started yet (only the greeting is present); leave a real conversation be.
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === GREETING_ID && prev[0].content !== greeting
        ? [{ ...prev[0], content: greeting }]
        : prev,
    );
  }, [greeting]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, sending]);

  useEffect(() => {
    if (open) {
      document.body.classList.add('pv-chat-open');
      const focus = window.setTimeout(() => inputRef.current?.focus(), 220);
      return () => {
        document.body.classList.remove('pv-chat-open');
        window.clearTimeout(focus);
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      // Trap Tab inside the dialog so keyboard focus can't wander to the Header
      // links and page CTAs behind the open panel.
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeEl = document.activeElement as HTMLElement | null;
        if (!panel.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && activeEl === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Return focus to the launcher when the panel closes (it unmounts while
  // open, so we refocus after it re-renders rather than on cleanup).
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      launcherButtonRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Anchor the mobile panel to the visual viewport so the iOS keyboard
  // does not push it half off-screen.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--pv-chat-vv-h', `${vv.height}px`);
      root.style.setProperty('--pv-chat-vv-top', `${vv.offsetTop}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--pv-chat-vv-h');
      root.style.removeProperty('--pv-chat-vv-top');
    };
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setError(null);

      const userMsg: Message = {
        id: Date.now(),
        role: 'user',
        content: trimmed,
      };
      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '',
      };

      setInput('');
      setSending(true);
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const history = [...messages, userMsg]
        .filter((m) => m.id !== GREETING_ID)
        .map((m) => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: history, locale }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const evt = JSON.parse(payload) as {
                text?: string;
                done?: boolean;
                error?: string;
              };
              if (evt.error) throw new Error(evt.error);
              if (evt.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content + evt.text }
                      : m,
                  ),
                );
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(t('error'));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id && m.content === ''
              ? {
                  ...m,
                  content: t('fallbackMessage', { phone: businessContact.primary.display }),
                }
              : m,
          ),
        );
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [messages, sending, locale, t],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {!open && (
        <div className={`pv-chat-launcher${launcherVisible ? ' is-visible' : ''}${shouldAvoidLauncher ? ' is-avoiding' : ''}`} aria-hidden={!launcherVisible}>
          {canShowPreview && !previewDismissed && !videoPlaying && (
            <div
              role="button"
              tabIndex={0}
              className="pv-chat-preview"
              aria-label={t('launcher.open')}
              onClick={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                setOpen(true);
              }}
            >
              <button
                type="button"
                className="pv-chat-preview__close"
                aria-label={t('launcher.dismiss')}
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewDismissed(true);
                }}
              >
                <CloseIcon />
              </button>
              <Avatar />
              <span>
                <strong>{t('name')}</strong>
                <small>{t('launcher.previewText')}</small>
              </span>
            </div>
          )}
          <button
            ref={launcherButtonRef}
            className="pv-chat"
            type="button"
            aria-label={t('launcher.start')}
            aria-expanded={open}
            onClick={() => setOpen(true)}
            disabled={!launcherVisible}
          >
            <ChatIcon />
            <span>{t('name')}</span>
            <b aria-hidden="true">1</b>
          </button>
        </div>
      )}

      {open && canShowLauncher && (
        <div className="pv-chat-panel" role="dialog" aria-modal="true" aria-label={t('panelAria')} ref={panelRef}>
          <BrandRail />
          <section className="pv-chat-panel__main">
            <ChatHeader onClose={close} />

            <div className="pv-chat-panel__messages" ref={scrollRef}>
              {messages.length === 1 && <WelcomeBlock />}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`pv-chat-msg pv-chat-msg--${m.role}`}
                >
                  {m.role === 'assistant' && <Avatar />}
                  <div className="pv-chat-msg__bubble">
                    {m.content ? (
                      m.role === 'assistant'
                        ? renderAssistantText(m.content, close)
                        : m.content
                    ) : (
                      <TypingDots />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {messages.length === 1 && (
              <div className="pv-chat-panel__suggestions" aria-label={t('suggestionsAria')}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    disabled={sending}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form className="pv-chat-panel__form" onSubmit={onSubmit}>
              <div className="pv-chat-panel__composer">
                <button
                  className="pv-chat-panel__attach"
                  type="button"
                  aria-label={t('composer.attach')}
                  title={t('composer.attach')}
                  disabled={sending}
                >
                  <MessageIcon name="paperclip" />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t('composer.placeholder')}
                  rows={1}
                  disabled={sending}
                  aria-label={t('composer.messageAria')}
                />
                <button
                  className="pv-chat-panel__send"
                  type="submit"
                  disabled={sending || !input.trim()}
                  aria-label={t('composer.send')}
                >
                  <span>{t('composer.send')}</span>
                  <MessageIcon name="send" />
                </button>
              </div>
            </form>
            {error && <div className="pv-chat-panel__error">{error}</div>}
            <p className="pv-chat-panel__footnote">
              <MessageIcon name="lock" /> {t('footnote')}
            </p>
          </section>
        </div>
      )}
    </>
  );
}

export default function Chat() {
  const { pathname } = useLocation();

  if (isCalculatorPath(pathname)) return null;

  return <ChatWidget />;
}
