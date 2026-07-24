import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createId,
  decryptText,
  deriveEncryptionKey,
  encryptText,
  hashPassword,
  randomSalt,
} from './crypto';

const META_KEY = 'local_vault_meta';
const ENTRIES_KEY = 'local_vault_entries';

export interface VaultMeta {
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

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

type StoredEntry = Omit<PasswordEntry, 'password'> & {
  password: string; // encrypted
};

const CATEGORIES = [
  'Social Media',
  'Email',
  'Banca',
  'Acquisti',
  'Lavoro',
  'Intrattenimento',
  'Videogiochi',
  'Viaggi',
  'Istruzione',
  'Salute',
  'Altro',
];

async function readMeta(): Promise<VaultMeta | null> {
  const raw = await AsyncStorage.getItem(META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultMeta;
  } catch {
    return null;
  }
}

async function writeMeta(meta: VaultMeta): Promise<void> {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

async function readStoredEntries(): Promise<StoredEntry[]> {
  const raw = await AsyncStorage.getItem(ENTRIES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredEntry[];
  } catch {
    return [];
  }
}

async function writeStoredEntries(entries: StoredEntry[]): Promise<void> {
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

function assertMasterPassword(meta: VaultMeta, masterPassword: string) {
  const hash = hashPassword(masterPassword, meta.salt);
  if (hash !== meta.passwordHash) {
    throw new Error('Email o password non validi');
  }
}

async function decryptEntry(entry: StoredEntry, key: string): Promise<PasswordEntry> {
  return {
    ...entry,
    password: await decryptText(entry.password, key),
  };
}

export const vault = {
  async checkSetup(): Promise<{ is_setup: boolean; email: string }> {
    const meta = await readMeta();
    return {
      is_setup: meta !== null,
      email: meta?.email ?? '',
    };
  },

  async setupMasterPassword(email: string, masterPassword: string) {
    const existing = await readMeta();
    if (existing) {
      throw new Error('Master password already set up');
    }

    const salt = await randomSalt();
    const passwordHash = hashPassword(masterPassword, salt);
    const meta: VaultMeta = {
      email: email.toLowerCase(),
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    await writeMeta(meta);
    await writeStoredEntries([]);

    return {
      user_id: 'master_user',
      email: meta.email,
      created_at: meta.createdAt,
    };
  },

  async login(email: string, masterPassword: string) {
    const meta = await readMeta();
    if (!meta) {
      throw new Error('Nessun account registrato');
    }
    if (meta.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error('Email o password non validi');
    }
    assertMasterPassword(meta, masterPassword);
    return { success: true, message: 'Login successful' };
  },

  async resetAllData() {
    await AsyncStorage.multiRemove([META_KEY, ENTRIES_KEY]);
    return { success: true, message: 'All data has been reset' };
  },

  async getAllPasswords(masterPassword: string): Promise<PasswordEntry[]> {
    const meta = await readMeta();
    if (!meta) throw new Error('Invalid master password');
    assertMasterPassword(meta, masterPassword);

    const key = deriveEncryptionKey(masterPassword, meta.salt);
    const entries = await readStoredEntries();
    return Promise.all(entries.map((entry) => decryptEntry(entry, key)));
  },

  async createPassword(data: {
    account_name: string;
    username: string;
    password: string;
    url?: string;
    notes?: string;
    category: string;
    tags?: string[];
    master_password: string;
  }): Promise<PasswordEntry> {
    const meta = await readMeta();
    if (!meta) throw new Error('Invalid master password');
    assertMasterPassword(meta, data.master_password);

    const key = deriveEncryptionKey(data.master_password, meta.salt);
    const now = new Date().toISOString();
    const entry: PasswordEntry = {
      id: createId(),
      account_name: data.account_name,
      username: data.username,
      password: data.password,
      url: data.url || '',
      notes: data.notes || '',
      category: data.category,
      tags: data.tags || [],
      created_at: now,
      updated_at: now,
    };

    const stored: StoredEntry = {
      ...entry,
      password: await encryptText(entry.password, key),
    };

    const entries = await readStoredEntries();
    entries.push(stored);
    await writeStoredEntries(entries);
    return entry;
  },

  async updatePassword(
    id: string,
    data: {
      account_name?: string;
      username?: string;
      password?: string;
      url?: string;
      notes?: string;
      category?: string;
      tags?: string[];
      master_password: string;
    },
  ): Promise<PasswordEntry> {
    const meta = await readMeta();
    if (!meta) throw new Error('Invalid master password');
    assertMasterPassword(meta, data.master_password);

    const key = deriveEncryptionKey(data.master_password, meta.salt);
    const entries = await readStoredEntries();
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) throw new Error('Password entry not found');

    const current = entries[index];
    const updated: StoredEntry = {
      ...current,
      account_name: data.account_name ?? current.account_name,
      username: data.username ?? current.username,
      url: data.url ?? current.url,
      notes: data.notes ?? current.notes,
      category: data.category ?? current.category,
      tags: data.tags ?? current.tags,
      updated_at: new Date().toISOString(),
      password:
        data.password !== undefined
          ? await encryptText(data.password, key)
          : current.password,
    };

    entries[index] = updated;
    await writeStoredEntries(entries);
    return decryptEntry(updated, key);
  },

  async deletePassword(id: string, masterPassword: string) {
    const meta = await readMeta();
    if (!meta) throw new Error('Invalid master password');
    assertMasterPassword(meta, masterPassword);

    const entries = await readStoredEntries();
    const next = entries.filter((e) => e.id !== id);
    if (next.length === entries.length) {
      throw new Error('Password entry not found');
    }
    await writeStoredEntries(next);
    return { success: true, message: 'Password entry deleted' };
  },

  async searchPasswords(query: string, masterPassword: string): Promise<PasswordEntry[]> {
    const all = await this.getAllPasswords(masterPassword);
    const q = query.toLowerCase();
    return all.filter((p) => p.account_name.toLowerCase().includes(q));
  },

  async getCategories() {
    return { categories: CATEGORIES };
  },
};
