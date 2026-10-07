import { useEffect, useMemo, useRef, useState } from "react";

export function ReadingCalendar({ value, markedDates, open, onOpen, onClose, onChange }: { value: string; markedDates: string[]; open: boolean; onOpen: () => void; onClose: () => void; onChange: (value: string) => void }) {
  const [month, setMonth] = useState(() => value.slice(0, 7));
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => setMonth(value.slice(0, 7)), [value]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (open && !root.current?.contains(event.target as Node)) onClose(); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [open, onClose]);
  const days = useMemo(() => calendarDays(month), [month]);
  const marked = new Set(markedDates);
  const move = (delta: number) => { const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta); setMonth(date.toISOString().slice(0, 7)); };
  return <div className="date-picker" ref={root}>
    <button type="button" className="date-picker-trigger" aria-expanded={open} onClick={() => open ? onClose() : onOpen()}><span>{formatDate(value)}</span><b aria-hidden="true">▦</b></button>
    {open && <div className="calendar-popover"><header><button type="button" aria-label="Mes anterior" onClick={() => move(-1)}>‹</button><strong>{formatMonth(month)}</strong><button type="button" aria-label="Mes siguiente" onClick={() => move(1)}>›</button></header><div className="calendar-grid calendar-weekdays">{["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((day) => <button type="button" key={day.date} className={`${day.current ? "" : "outside"} ${day.date === value ? "selected" : ""} ${marked.has(day.date) ? "has-reading" : ""}`} onClick={() => { onChange(day.date); onClose(); }}><span>{day.day}</span>{marked.has(day.date) && <i aria-label="Tiene lecturas" />}</button>)}</div><footer><span><i /> Día con lecturas</span><button type="button" onClick={() => { const today = new Date().toISOString().slice(0, 10); onChange(today); onClose(); }}>Hoy</button></footer></div>}
  </div>;
}

function calendarDays(month: string) {
  const first = new Date(`${month}-01T00:00:00Z`); const start = new Date(first); start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); return { date: date.toISOString().slice(0, 10), day: date.getUTCDate(), current: date.toISOString().slice(0, 7) === month }; });
}
function formatMonth(value: string) { return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`)); }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
