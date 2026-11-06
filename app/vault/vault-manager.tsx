"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type Entry = {
  id: string;
  accountName: string;
  username: string;
  password: string;
  backupCodes: string;
  createdAt: string;
  updatedAt: string;
};

type EntryForm = Omit<Entry, "id" | "createdAt" | "updatedAt">;
const emptyForm: EntryForm = { accountName: "", username: "", password: "", backupCodes: "" };

export default function VaultManager() {
  const [items, setItems] = useState<Entry[]>([]);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showPasswords, setShowPasswords] = useState<string[]>([]);
  const [showCodes, setShowCodes] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadItems() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/vault/items", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load the Vault.");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the Vault.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadItems(); }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter(item =>
      item.accountName.toLowerCase().includes(query) ||
      item.username.toLowerCase().includes(query)
    );
  }, [items, search]);

  function startNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function startEdit(item: Entry) {
    setEditingId(item.id);
    setForm({
      accountName: item.accountName,
      username: item.username,
      password: item.password,
      backupCodes: item.backupCodes,
    });
    setShowForm(true);
    setError("");
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(editingId ? `/api/vault/items/${editingId}` : "/api/vault/items", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save this account.");
      if (editingId) {
        setItems(current => current.map(item => item.id === editingId ? data.item : item));
      } else {
        setItems(current => [data.item, ...current]);
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this account.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("Delete this saved account?")) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/vault/items/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete this account.");
      setItems(current => current.filter(item => item.id !== id));
      setMessage("Deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this account.");
    }
  }

  async function copyValue(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setError("Copy is not available in this browser. Select the text and copy it manually.");
    }
  }

  function toggle(id: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
  }

  return (
    <section className="vault-manager">
      <div className="vault-toolbar">
        <input
          className="search-input"
          aria-label="Search accounts"
          placeholder="Search accounts"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        <button className="primary-button add-button" type="button" onClick={startNew}>+ Add account</button>
      </div>

      {error && <p className="feedback error" role="alert">{error}</p>}
      {message && <p className="feedback success" role="status">{message}</p>}

      {showForm && (
        <form className="entry-form" onSubmit={save}>
          <h2>{editingId ? "Edit account" : "Add account"}</h2>
          <label htmlFor="account-name">Account name</label>
          <input id="account-name" autoComplete="off" maxLength={100} required value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} placeholder="e.g. Google, Facebook, Bank" />
          <label htmlFor="account-username">Email or username</label>
          <input id="account-username" autoComplete="off" maxLength={254} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          <label htmlFor="account-password">Password</label>
          <input id="account-password" type="password" autoComplete="new-password" maxLength={4096} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <label htmlFor="account-codes">Backup codes</label>
          <textarea id="account-codes" rows={3} autoComplete="off" maxLength={12000} value={form.backupCodes} onChange={e => setForm({ ...form, backupCodes: e.target.value })} placeholder="One code per line" />
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            <button className="secondary-button" type="button" disabled={saving} onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="empty-state">Loading…</p> : filteredItems.length === 0 ? (
        <p className="empty-state">{items.length ? "No matching accounts." : "No accounts saved yet. Add your first account."}</p>
      ) : (
        <div className="entry-list">
          {filteredItems.map(item => {
            const passwordVisible = showPasswords.includes(item.id);
            const codesVisible = showCodes.includes(item.id);
            return (
              <article className="entry-card" key={item.id}>
                <div className="entry-heading">
                  <div>
                    <h2>{item.accountName}</h2>
                    {item.username && <p className="entry-username">{item.username}</p>}
                  </div>
                  <div className="entry-actions">
                    <button type="button" className="text-button" onClick={() => startEdit(item)}>Edit</button>
                    <button type="button" className="text-button danger-text" onClick={() => void removeItem(item.id)}>Delete</button>
                  </div>
                </div>
                {item.password && <div className="secret-row">
                  <span className="field-name">Password</span>
                  <code>{passwordVisible ? item.password : "••••••••••••"}</code>
                  <button type="button" className="text-button" onClick={() => toggle(item.id, showPasswords, setShowPasswords)}>{passwordVisible ? "Hide" : "Show"}</button>
                  <button type="button" className="text-button" onClick={() => void copyValue(item.password, "Password")}>Copy</button>
                </div>}
                {item.backupCodes && <div className="secret-block">
                  <div className="secret-row">
                    <span className="field-name">Backup codes</span>
                    <button type="button" className="text-button" onClick={() => toggle(item.id, showCodes, setShowCodes)}>{codesVisible ? "Hide" : "Show"}</button>
                    <button type="button" className="text-button" onClick={() => void copyValue(item.backupCodes, "Backup codes")}>Copy</button>
                  </div>
                  {codesVisible && <pre>{item.backupCodes}</pre>}
                </div>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
