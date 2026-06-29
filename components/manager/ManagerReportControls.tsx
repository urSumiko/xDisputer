'use client';

import { useRef } from 'react';
import type { ManagerReportType } from '../../lib/manager-console/manager-reporting';

type Props = {
  reportType: ManagerReportType;
  fromDate: string;
  toDate: string;
  exportHref: string;
};

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

function phDateOnlyFromUtc(date: Date) {
  return new Date(date.getTime() + PH_OFFSET_MS).toISOString().slice(0, 10);
}

function dateFromPhParts(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day) - PH_OFFSET_MS);
}

function currentPhWeekRange(now = new Date()) {
  const phNow = new Date(now.getTime() + PH_OFFSET_MS);
  const mondayDelta = (phNow.getUTCDay() + 6) % 7;
  const mondayUtc = dateFromPhParts(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate() - mondayDelta);
  const sundayUtc = dateFromPhParts(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate() - mondayDelta + 6);
  return { fromDate: phDateOnlyFromUtc(mondayUtc), toDate: phDateOnlyFromUtc(sundayUtc) };
}

export default function ManagerReportControls({ reportType, fromDate, toDate, exportHref }: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitSoon = () => window.setTimeout(() => formRef.current?.requestSubmit(), 0);

  return <form ref={formRef} action="/admin" method="get" className="manager-report-controls">
    <input type="hidden" name="panel" value="reports" />
    <label><span>Start date</span><input type="date" name="from" defaultValue={fromDate} onChange={submitSoon} /></label>
    <label><span>End date</span><input type="date" name="to" defaultValue={toDate} onChange={submitSoon} /></label>
    <label><span>Report type</span><select name="reportType" defaultValue={reportType} onChange={(event) => { const range = currentPhWeekRange(); const form = formRef.current; if (form) { const from = form.querySelector<HTMLInputElement>('input[name="from"]'); const to = form.querySelector<HTMLInputElement>('input[name="to"]'); if (from) from.value = range.fromDate; if (to) to.value = range.toDate; } event.currentTarget.value = event.currentTarget.value || 'summary'; submitSoon(); }}><option value="summary">Summary</option><option value="salary_outputs">Salary</option><option value="users">Users</option></select></label>
    <a className="admin-action-button primary manager-report-export-button" href={exportHref}>Export Excel</a>
  </form>;
}
