export type Space = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type SpaceMember = {
  space_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profiles?: {
    display_name: string | null;
  } | null;
};

export type DailyRecurrenceRule = {
  version: 1;
  frequency: 'daily';
  interval: number;
  time_zone: string;
};

export type WeeklyRecurrenceRule = {
  version: 1;
  frequency: 'weekly';
  interval: number;
  days_of_week: number[];
  time_zone: string;
};

export type MonthlyRecurrenceRule = {
  version: 1;
  frequency: 'monthly';
  interval: number;
  day_of_month: number | 'last_day';
  time_zone: string;
};

export type YearlyRecurrenceRule = {
  version: 1;
  frequency: 'yearly';
  interval: number;
  month: number;
  day: number;
  time_zone: string;
};

export type RecurrenceRule = DailyRecurrenceRule | WeeklyRecurrenceRule | MonthlyRecurrenceRule | YearlyRecurrenceRule;

export type CalendarEvent = {
  id: string;
  space_id: string;
  created_by: string;
  scope: 'personal' | 'shared';
  owner_user_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  recurrence_rule: RecurrenceRule | null;
  series_id: string | null;
  parent_event_id: string | null;
  recurrence_until: string | null;
  created_at: string;
  updated_at: string;
};

export type EventOccurrenceException = {
  id: string;
  event_id: string;
  occurrence_date: string;
  exception_type: 'deleted' | 'override';
  override_data: unknown;
  created_at: string;
  updated_at: string;
};

export type CalendarOccurrence = {
  occurrence_id: string;
  occurrence_date: string;
  source_event_id: string;
  occurrence_starts_at: string;
  occurrence_ends_at: string | null;
  title: string;
  description: string | null;
  all_day: boolean;
  source_event: CalendarEvent;
};

export type CalendarOccurrenceRange = {
  start: Date;
  end: Date;
};

export type EventAudience = 'mine' | 'partner' | 'shared';
