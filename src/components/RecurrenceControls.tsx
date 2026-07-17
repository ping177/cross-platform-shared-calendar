import type { RecurrenceDraft } from '../lib/recurrence';

const recurrenceFrequencyLabels: Record<RecurrenceDraft['frequency'], string> = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
};

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

export function RecurrenceControls({
  recurrence,
  onChange,
  onFrequencyChange,
}: {
  recurrence: RecurrenceDraft;
  onChange: (recurrence: RecurrenceDraft) => void;
  onFrequencyChange: (frequency: RecurrenceDraft['frequency']) => void;
}) {
  function toggleWeeklyDay(day: number) {
    const nextDays = recurrence.days_of_week.includes(day)
      ? recurrence.days_of_week.filter((selectedDay) => selectedDay !== day)
      : [...recurrence.days_of_week, day].sort((left, right) => left - right);
    onChange({ ...recurrence, days_of_week: nextDays });
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(recurrenceFrequencyLabels) as RecurrenceDraft['frequency'][]).map((frequency) => (
        <button
          key={frequency}
          type="button"
          className={`h-11 rounded-lg text-sm font-semibold ${recurrence.frequency === frequency ? 'bg-teal text-white' : 'bg-mist text-ink/70'}`}
          onClick={() => onFrequencyChange(frequency)}
        >
          {recurrenceFrequencyLabels[frequency]}
        </button>
      ))}

      {recurrence.frequency !== 'none' && (
        <div className="col-span-3 mt-1 space-y-3 rounded-lg bg-mist p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
            每
            <input
              className="w-20 rounded-lg border border-ink/15 bg-white px-3 py-2 text-center outline-none focus:border-teal"
              type="number"
              min="1"
              max="365"
              required
              value={recurrence.interval}
              onChange={(inputEvent) => onChange({ ...recurrence, interval: Number(inputEvent.target.value) })}
            />
            {recurrence.frequency === 'daily' ? '天' : recurrence.frequency === 'weekly' ? '周' : recurrence.frequency === 'monthly' ? '月' : '年'}
          </label>

          {recurrence.frequency === 'weekly' && (
            <div>
              <p className="text-sm font-semibold text-ink/70">重复日期</p>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {weekdayLabels.map((label, index) => {
                  const day = index + 1;
                  const selected = recurrence.days_of_week.includes(day);
                  return (
                    <button key={day} type="button" className={`h-9 rounded-md text-sm font-semibold ${selected ? 'bg-teal text-white' : 'bg-white text-ink/70'}`} onClick={() => toggleWeeklyDay(day)}>
                      周{label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {recurrence.frequency === 'monthly' && (
            <label className="block text-sm font-semibold text-ink/70">
              日期
              <select className="mt-2 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 outline-none focus:border-teal" value={recurrence.day_of_month} onChange={(inputEvent) => onChange({ ...recurrence, day_of_month: inputEvent.target.value === 'last_day' ? 'last_day' : Number(inputEvent.target.value) })}>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day} 日</option>)}
                <option value="last_day">每月最后一天</option>
              </select>
            </label>
          )}

          {recurrence.frequency === 'yearly' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-semibold text-ink/70">
                月份
                <select className="mt-2 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 outline-none focus:border-teal" value={recurrence.month} onChange={(inputEvent) => onChange({ ...recurrence, month: Number(inputEvent.target.value) })}>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month} 月</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-ink/70">
                日期
                <select className="mt-2 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 outline-none focus:border-teal" value={recurrence.day} onChange={(inputEvent) => onChange({ ...recurrence, day: Number(inputEvent.target.value) })}>
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day} 日</option>)}
                </select>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
