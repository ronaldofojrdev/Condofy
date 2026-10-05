"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type NotificationType = "AVISO" | "ENTREGA" | "COBRANCA" | "OCORRENCIA";

type NotificationRow = {
  id: string;
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

const TYPE_LABELS: Record<NotificationType, string> = {
  AVISO: "Aviso",
  ENTREGA: "Entrega",
  COBRANCA: "Cobrança",
  OCORRENCIA: "Ocorrência"
};

const TYPE_STYLES: Record<NotificationType, string> = {
  AVISO: "bg-blue-100 text-blue-800",
  ENTREGA: "bg-emerald-100 text-emerald-800",
  COBRANCA: "bg-amber-100 text-amber-800",
  OCORRENCIA: "bg-rose-100 text-rose-800"
};

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(diffInSeconds);

  if (absoluteSeconds < 60) {
    return "agora mesmo";
  }

  const format = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

  if (absoluteSeconds < 60 * 60) {
    return format.format(Math.round(diffInSeconds / 60), "minute");
  }

  if (absoluteSeconds < 60 * 60 * 24) {
    return format.format(Math.round(diffInSeconds / (60 * 60)), "hour");
  }

  if (absoluteSeconds < 60 * 60 * 24 * 7) {
    return format.format(Math.round(diffInSeconds / (60 * 60 * 24)), "day");
  }

  if (absoluteSeconds < 60 * 60 * 24 * 30) {
    return format.format(Math.round(diffInSeconds / (60 * 60 * 24 * 7)), "week");
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

export default function NotificationBell({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  async function loadNotifications() {
    setLoading(true);
    setError("");

    const { data: sessionData, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !sessionData.user) {
      setUnreadCount(0);
      setNotifications([]);
      setLoading(false);
      return;
    }

    const userId = sessionData.user.id;

    const [unreadResponse, notificationsResponse] = await Promise.all([
      supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("usuario_id", userId).eq("lida", false),
      supabase
        .from("notificacoes")
        .select("id, tipo, titulo, mensagem, lida, created_at")
        .eq("usuario_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)
    ]);

    if (unreadResponse.error) {
      setError(unreadResponse.error.message);
      setLoading(false);
      return;
    }

    if (notificationsResponse.error) {
      setError(notificationsResponse.error.message);
      setLoading(false);
      return;
    }

    setUnreadCount(unreadResponse.count ?? 0);
    setNotifications((notificationsResponse.data ?? []) as NotificationRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAsRead(notificationId: string) {
    const { error: updateError } = await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("id", notificationId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotifications((current) =>
      current.map((notification) => (notification.id === notificationId ? { ...notification, lida: true } : notification))
    );
    setUnreadCount((current) => Math.max(0, current - 1));
  }

  const unreadLabel = useMemo(() => (unreadCount > 99 ? "99+" : String(unreadCount)), [unreadCount]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Abrir notificações"
        onClick={() => setOpen((current) => !current)}
        className={`relative inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 ${
          compact ? "h-10 w-10" : "h-11 w-11"
        }`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
          <path
            fill="currentColor"
            d="M12 2a7 7 0 0 0-7 7v3.17l-1.41 1.42A1 1 0 0 0 4.3 15h15.4a1 1 0 0 0 .71-1.71L19 11.17V9a7 7 0 0 0-7-7Zm0 20a3 3 0 0 0 2.83-2H9.17A3 3 0 0 0 12 22Z"
          />
        </svg>

        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            {unreadLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-full top-0 ml-2 w-80 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notificações</p>
              <p className="text-xs text-slate-500">{unreadCount} não lida(s)</p>
            </div>
            <button type="button" onClick={() => void loadNotifications()} className="text-xs font-medium text-[#1A3A5C] hover:underline">
              Atualizar
            </button>
          </div>

          {error ? <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</p> : null}

          <div className="max-h-[28rem] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-sm text-slate-500">Carregando notificações...</div>
            ) : notifications.length ? (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={async () => {
                    if (!notification.lida) {
                      await markAsRead(notification.id);
                    }
                  }}
                  className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 ${
                    notification.lida ? "bg-white" : "bg-[#1A3A5C]/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${TYPE_STYLES[notification.tipo]}`}>
                          {TYPE_LABELS[notification.tipo]}
                        </span>
                        {!notification.lida ? <span className="h-2 w-2 rounded-full bg-[#1A3A5C]" /> : null}
                      </div>
                      <p className="mt-2 truncate text-sm font-medium text-slate-900">{notification.titulo}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{notification.mensagem}</p>
                    </div>
                    <span className="whitespace-nowrap text-[11px] text-slate-400">{formatRelativeTime(notification.created_at)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-slate-500">Sem notificações no momento.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}