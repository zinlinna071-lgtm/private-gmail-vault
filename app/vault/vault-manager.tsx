"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

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
type SortOrder = "recent" | "oldest" | "name";

const emptyForm: EntryForm = {
  accountName: "",
  username: "",
  password: "",
  backupCodes: ""
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function recordNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

export default function VaultManager() {
  const [items, setItems] = useState<Entry[]>([]);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");
  const [showIdentity, setShowIdentity] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inspectorRef = useRef<HTMLDialogElement>(null);
  const firstAccountInputRef = useRef<HTMLInputElement>(null);
  const addAccountButtonRef = useRef<HTMLButtonElement>(null);
  const wasFormOpenRef = useRef(false);
  const deleteRecordButtonRef = useRef<HTMLButtonElement>(null);
  const keepRecordButtonRef = useRef<HTMLButtonElement>(null);
  const wasDeleteConfirmOpenRef = useRef(false);

  const loadItems = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = query
      ? items.filter(item =>
          item.accountName.toLowerCase().includes(query) ||
          item.username.toLowerCase().includes(query)
        )
      : [...items];

    return matches.sort((a, b) => {
      if (sortOrder === "name") return a.accountName.localeCompare(b.accountName);
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return sortOrder === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [items, search, sortOrder]);

  const activeItem = useMemo(
    () => items.find(item => item.id === activeItemId) ?? null,
    [items, activeItemId]
  );

  useEffect(() => {
    if (showForm) {
      firstAccountInputRef.current?.focus();
    } else if (wasFormOpenRef.current) {
      addAccountButtonRef.current?.focus();
    }
    wasFormOpenRef.current = showForm;
  }, [showForm]);

  useEffect(() => {
    if (confirmDelete) {
      keepRecordButtonRef.current?.focus();
    } else if (wasDeleteConfirmOpenRef.current) {
      deleteRecordButtonRef.current?.focus();
    }
    wasDeleteConfirmOpenRef.current = confirmDelete;
  }, [confirmDelete]);

  useEffect(() => {
    const dialog = inspectorRef.current;
    if (!dialog) return;
    if (activeItem && !dialog.open) dialog.showModal();
    if (!activeItem && dialog.open) dialog.close();
  }, [activeItem]);

  useEffect(() => {
    setShowIdentity(false);
    setShowPassword(false);
    setShowCodes(false);
    setConfirmDelete(false);
  }, [activeItemId]);

  function startNew() {
    setActiveItemId(null);
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
      backupCodes: item.backupCodes
    });
    setActiveItemId(null);
    inspectorRef.current?.close();
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        editingId ? "/api/vault/items/" + editingId : "/api/vault/items",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save this account.");

      if (editingId) {
        setItems(current => current.map(item => item.id === editingId ? data.item : item));
      } else {
        setItems(current => [data.item, ...current]);
      }
      closeForm();
      setMessage(editingId ? "Record updated." : "Record added to your collection.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this account.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/vault/items/" + id, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not delete this account.");
      setItems(current => current.filter(item => item.id !== id));
      setActiveItemId(null);
      inspectorRef.current?.close();
      setConfirmDelete(false);
      setMessage("Record removed from your collection.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this account.");
    } finally {
      setDeleting(false);
    }
  }

  async function copyValue(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage(label + " copied to clipboard.");
    } catch {
      setError("Clipboard access is unavailable. Please copy the value manually.");
    }
  }

  function openItem(id: string) {
    setMessage("");
    setError("");
    setActiveItemId(id);
  }

  function closeInspector() {
    setActiveItemId(null);
    setConfirmDelete(false);
    inspectorRef.current?.close();
  }

  return (
    <section className="museum-collection" aria-labelledby="collection-title">
      <div className="museum-collection-heading">
        <div>
          <span className="museum-section-kicker">THE ARCHIVE / YOUR PRIVATE COLLECTION</span>
          <h2 id="collection-title">The collection<span>.</span></h2>
          <p>Every saved record, kept together in one quiet place.</p>
        </div>
        <div className="museum-collection-count" aria-live="polite">
          <strong>{loading ? "—" : String(items.length).padStart(2, "0")}</strong>
          <span>{items.length === 1 ? "COLLECTED RECORD" : "COLLECTED RECORDS"}</span>
        </div>
      </div>

      <div className="museum-gallery-toolbar">
        <label className="museum-search">
          <span className="museum-visually-hidden">Search your collection</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
          <input
            type="search"
            placeholder="Find something in your collection"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search">×</button>}
        </label>
        <label className="museum-sort">
          <span className="museum-visually-hidden">Sort collection</span>
          <select value={sortOrder} onChange={event => setSortOrder(event.target.value as SortOrder)}>
            <option value="recent">Recently updated</option>
            <option value="oldest">Oldest updated</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
        <button ref={addAccountButtonRef} className="museum-add-button" type="button" onClick={startNew}>
          <span aria-hidden="true">＋</span> Add account
        </button>
      </div>

      {error && <p className="museum-feedback is-error" role="alert">{error}</p>}
      {message && <p className="museum-feedback is-success" role="status">{message}</p>}

      {showForm && (
        <form className="museum-record-form" onSubmit={save} aria-labelledby="museum-form-title">
          <div className="museum-form-heading">
            <div>
              <span className="museum-section-kicker">{editingId ? "REFINE AN ARCHIVE RECORD" : "ADD TO YOUR COLLECTION"}</span>
              <h3 id="museum-form-title">{editingId ? "Edit account record" : "A new account record"}</h3>
              <p>Details are protected and only shown when you open this record.</p>
            </div>
            <button className="museum-close-button" type="button" onClick={closeForm} aria-label="Close form">×</button>
          </div>

          <div className="museum-form-grid">
            <label>
              <span>Account name</span>
              <input
                ref={firstAccountInputRef}
                autoComplete="off"
                maxLength={100}
                required
                value={form.accountName}
                onChange={event => setForm({ ...form, accountName: event.target.value })}
                placeholder="e.g. Google, Facebook, Bank"
              />
            </label>
            <label>
              <span>Email or username</span>
              <input
                autoComplete="off"
                maxLength={254}
                value={form.username}
                onChange={event => setForm({ ...form, username: event.target.value })}
                placeholder="Account identifier"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                maxLength={4096}
                value={form.password}
                onChange={event => setForm({ ...form, password: event.target.value })}
                placeholder="Optional"
              />
            </label>
            <label className="museum-form-wide">
              <span>Backup codes</span>
              <textarea
                rows={3}
                autoComplete="off"
                maxLength={12000}
                value={form.backupCodes}
                onChange={event => setForm({ ...form, backupCodes: event.target.value })}
                placeholder="One code per line"
              />
            </label>
          </div>
          <div className="museum-form-actions">
            <button className="museum-add-button" type="submit" disabled={saving}>
              {saving ? "Saving securely…" : editingId ? "Save changes" : "Add to collection"}
            </button>
            <button className="museum-cancel-button" type="button" disabled={saving} onClick={closeForm}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="museum-empty-state" role="status">
          <span className="museum-loading-orbit" aria-hidden="true" />
          <h3>Opening your collection</h3>
          <p>Your private records are being retrieved.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="museum-empty-state">
          <span className="museum-empty-symbol" aria-hidden="true">✧</span>
          <span className="museum-section-kicker">{items.length ? "NO MATCHING WORKS" : "A SPACE READY FOR YOU"}</span>
          <h3>{items.length ? "Nothing found this time." : "Your collection begins here."}</h3>
          <p>{items.length ? "Try another name or clear your search." : "Add your first account record. It will appear here as part of your private collection."}</p>
          {items.length === 0 && <button className="museum-add-button" type="button" onClick={startNew}>＋ Add your first account</button>}
          {items.length > 0 && <button className="museum-cancel-button" type="button" onClick={() => setSearch("")}>Clear search</button>}
        </div>
      ) : (
        <div className="museum-asset-grid" aria-label="Saved account records">
          {filteredItems.map((item, index) => (
            <button
              className={"museum-asset-card museum-tone-" + (index % 4)}
              type="button"
              key={item.id}
              onClick={() => openItem(item.id)}
              aria-label={"Open private account record: " + item.accountName}
            >
              <div className="museum-artwork">
                <div className="museum-artwork-topline">
                  <span>ARCHIVE No. {recordNumber(index)}</span>
                  <span className="museum-artwork-lock" aria-hidden="true">◇</span>
                </div>
                <div className="museum-artwork-orbit museum-orbit-one" aria-hidden="true" />
                <div className="museum-artwork-orbit museum-orbit-two" aria-hidden="true" />
                <div className="museum-artwork-mark" aria-hidden="true">
                  <span>{item.accountName.trim().charAt(0).toUpperCase() || "A"}</span>
                </div>
                <div className="museum-artwork-bottomline">
                  <span>PRIVATE ACCOUNT</span>
                  <span>VAULT COLLECTION</span>
                </div>
              </div>
              <div className="museum-asset-caption">
                <div className="museum-asset-title-row">
                  <h3>{item.accountName}</h3>
                  <span aria-hidden="true">↗</span>
                </div>
                <p>{item.username ? "IDENTIFIER PROTECTED" : "PRIVATE ACCESS RECORD"}</p>
                <div className="museum-asset-meta">
                  <span>UPDATED {formatDate(item.updatedAt).toUpperCase()}</span>
                  <span>OPEN RECORD</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <dialog
        className="museum-inspector"
        ref={inspectorRef}
        aria-labelledby="museum-inspector-title"
        onClose={() => {
          setActiveItemId(null);
          setConfirmDelete(false);
        }}
        onClick={event => {
          if (event.target === inspectorRef.current) closeInspector();
        }}
      >
        {activeItem && (
          <div className="museum-inspector-content">
            <div className="museum-inspector-topline">
              <span>PRIVATE ARCHIVE / RECORD DETAILS</span>
              <button className="museum-close-button" type="button" autoFocus onClick={closeInspector} aria-label="Close record">×</button>
            </div>
            <div className="museum-inspector-art">
              <span className="museum-section-kicker">COLLECTION OBJECT</span>
              <div aria-hidden="true">{activeItem.accountName.trim().charAt(0).toUpperCase() || "A"}</div>
              <span>PRIVATE ACCOUNT RECORD</span>
            </div>
            <div className="museum-inspector-heading">
              <span className="museum-section-kicker">ARCHIVE ENTRY</span>
              <h2 id="museum-inspector-title">{activeItem.accountName}</h2>
              <p>Created {formatDate(activeItem.createdAt)} · Updated {formatDate(activeItem.updatedAt)}</p>
            </div>

            <div className="museum-detail-fields">
              <section>
                <div className="museum-detail-label"><span>EMAIL / USERNAME</span><button type="button" onClick={() => setShowIdentity(value => !value)}>{showIdentity ? "HIDE" : "REVEAL"}</button></div>
                <p className="museum-sensitive-value">{showIdentity ? activeItem.username || "No identifier saved" : activeItem.username ? "••••••••••••" : "Not saved"}</p>
                {showIdentity && activeItem.username && <button className="museum-inline-action" type="button" onClick={() => void copyValue(activeItem.username, "Identifier")}>Copy identifier</button>}
              </section>
              <section>
                <div className="museum-detail-label"><span>PASSWORD</span><button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? "HIDE" : "REVEAL"}</button></div>
                <p className="museum-sensitive-value">{showPassword ? activeItem.password || "No password saved" : activeItem.password ? "••••••••••••" : "Not saved"}</p>
                {showPassword && activeItem.password && <button className="museum-inline-action" type="button" onClick={() => void copyValue(activeItem.password, "Password")}>Copy password</button>}
              </section>
              <section>
                <div className="museum-detail-label"><span>BACKUP CODES</span><button type="button" onClick={() => setShowCodes(value => !value)}>{showCodes ? "HIDE" : "REVEAL"}</button></div>
                <pre className="museum-sensitive-value">{showCodes ? activeItem.backupCodes || "No backup codes saved" : activeItem.backupCodes ? "••••••••••••••••" : "Not saved"}</pre>
                {showCodes && activeItem.backupCodes && <button className="museum-inline-action" type="button" onClick={() => void copyValue(activeItem.backupCodes, "Backup codes")}>Copy backup codes</button>}
              </section>
            </div>

            {confirmDelete ? (
              <div className="museum-delete-confirm" role="alert">
                <strong>Remove this record?</strong>
                <p>This permanently deletes the saved account record from your Vault.</p>
                <div>
                  <button className="museum-delete-button" type="button" disabled={deleting} onClick={() => void removeItem(activeItem.id)}>{deleting ? "Removing…" : "Confirm delete"}</button>
                  <button ref={keepRecordButtonRef} className="museum-cancel-button" type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep record</button>
                </div>
              </div>
            ) : (
              <div className="museum-inspector-actions">
                <button className="museum-add-button" type="button" onClick={() => startEdit(activeItem)}>Edit record</button>
                <button ref={deleteRecordButtonRef} className="museum-delete-link" type="button" onClick={() => setConfirmDelete(true)}>Delete record</button>
              </div>
            )}
            <p className="museum-inspector-note">Private details stay concealed until you choose to reveal them. Close this panel when finished.</p>
          </div>
        )}
      </dialog>
    </section>
  );
}
