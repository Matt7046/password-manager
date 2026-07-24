export interface PasswordEntry {
  id: string;
  account_name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface User {
  user_id: string;
  created_at: string;
}
