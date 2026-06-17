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
  created_at: string;
  updated_at: string;
};

export type EventAudience = 'mine' | 'partner' | 'shared';
