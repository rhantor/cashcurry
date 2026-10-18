"use client";
// The bell in the top bar (and the staff portal): unread count, the latest
// notifications, "mark all read", turning push on for this device, and the
// kinds this person has muted. A panel on computers, a sheet on phones.
import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell, BellOff, BellRing, CheckCheck, Settings2, Smartphone } from "lucide-react";
import { Button, EmptyState, Popover, Sheet, cn, useIsPhone } from "@/app/components/ui";
import { useNotifications } from "./NotificationsProvider";
import MyNotificationSettings from "./MyNotificationSettings";

const PUSH_COPY = {
  off: { text: "Get these on this phone or computer, even when the app is closed.", action: "Turn on" },
  blocked: { text: "Notifications are blocked for this site. Allow them in the browser's site settings, then reload." },
  homescreen: { text: "On iPhone, add Cash Curry to the home screen (Share → Add to Home Screen) and open it from there to get notifications." },
};

function PushCard() {
  const { push, turnOnPush } = useNotifications();
  const [busy, setBusy] = useState(false);
  const c = PUSH_COPY[push];
  if (!c) return null;
  return (
    <div className="mx-3 mb-2 flex items-start gap-3 rounded-xl border border-brand/20 bg-brand-soft/60 p-3 text-xs text-fg">
      <Smartphone className="mt-0.5 size-4 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p>{c.text}</p>
        {c.action && (
          <Button
            size="sm"
            className="mt-2"
            icon={BellRing}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await turnOnPush();
              setBusy(false);
            }}
          >
            {c.action}
          </Button>
        )}
      </div>
    </div>
  );
}

function Panel({ close }) {
  const { items, unread, open, markAllRead, ready } = useNotifications();
  const [settings, setSettings] = useState(false);
  if (settings) return <MyNotificationSettings onBack={() => setSettings(false)} />;
  return (
    <div className="flex max-h-[min(70vh,560px)] flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <p className="flex-1 text-sm font-bold text-fg">Notifications</p>
        {unread > 0 && (
          <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft">
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        )}
        <button type="button" aria-label="Notification settings" onClick={() => setSettings(true)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
          <Settings2 className="size-4" />
        </button>
      </div>
      <PushCard />
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {ready && !items.length ? (
          <EmptyState icon={BellOff} title="Nothing yet" description="Requests, decisions and the daily summary show up here." className="py-8" />
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    open(n);
                    close?.();
                  }}
                  className={cn("flex w-full gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2", !n.readAt && "bg-brand-soft/30")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-muted">{n.body}</span>
                    {n.at && <span className="mt-0.5 block text-[11px] text-subtle">{formatDistanceToNowStrict(n.at, { addSuffix: true })}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function NotificationBell({ className }) {
  const { unread } = useNotifications();
  const phone = useIsPhone();
  const [sheet, setSheet] = useState(false);
  const button = (props) => (
    <button
      type="button"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className={cn("relative inline-flex size-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg", className)}
      {...props}
    >
      <Bell className="size-[18px]" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white tabular-nums">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );

  if (phone)
    return (
      <>
        {button({ onClick: () => setSheet(true) })}
        <Sheet open={sheet} onClose={() => setSheet(false)} title="Notifications">
          <div className="-mx-4 -mt-2">
            <Panel close={() => setSheet(false)} />
          </div>
        </Sheet>
      </>
    );

  return (
    <Popover align="end" width={380} className="p-0" trigger={({ toggle, ref }) => button({ ref, onClick: toggle })}>
      {({ close }) => <Panel close={close} />}
    </Popover>
  );
}
