"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, LoaderCircle, Trash2, X } from "lucide-react";

type ProfileKind = "dog" | "puppy";
type ProfileRow = { id: number; name?: string; photo_url?: string | null };
type DataSet = { dogs?: ProfileRow[]; puppies?: ProfileRow[] };
type Target = { kind: ProfileKind; id: number; name: string; photoUrl: string | null };

export function ProfilePhotoEnhancer() {
  const [data, setData] = useState<DataSet>({});
  const [target, setTarget] = useState<Target | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const payload = await response.json() as DataSet;
      if (response.ok) setData(payload);
    } catch {
      // The normal page will surface connection errors.
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const index = useMemo(() => ({
    dog: new Map((data.dogs || []).map((row) => [row.id, row])),
    puppy: new Map((data.puppies || []).map((row) => [row.id, row])),
  }), [data]);

  useEffect(() => {
    const decorated = new WeakSet<Element>();
    const decorate = () => {
      document.querySelectorAll<HTMLElement>("article.record-card").forEach((card) => {
        const link = card.querySelector<HTMLAnchorElement>('a.record-card-profile[href^="/dogs/"], a.record-card-profile[href^="/puppies/"]');
        if (!link) return;
        const dogMatch = link.getAttribute("href")?.match(/^\/dogs\/(\d+)/);
        const puppyMatch = link.getAttribute("href")?.match(/^\/puppies\/(\d+)/);
        const kind: ProfileKind | null = dogMatch ? "dog" : puppyMatch ? "puppy" : null;
        const id = Number(dogMatch?.[1] || puppyMatch?.[1] || 0);
        if (!kind || !id) return;
        const row = index[kind].get(id);
        const avatar = link.querySelector<HTMLElement>(".avatar");
        if (avatar && row?.photo_url && avatar.dataset.profilePhotoUrl !== row.photo_url) {
          avatar.dataset.profilePhotoUrl = row.photo_url;
          avatar.classList.add("profile-photo-avatar");
          avatar.replaceChildren();
          const image = document.createElement("img");
          image.src = row.photo_url;
          image.alt = `${row.name || kind} profile`;
          avatar.append(image);
        }
        if (decorated.has(card)) return;
        const footer = card.querySelector<HTMLElement>("footer");
        if (!footer) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "profile-photo-card-button";
        button.innerHTML = '<span aria-hidden="true">◉</span> Photo';
        button.addEventListener("click", () => {
          const latest = index[kind].get(id);
          setError("");
          setTarget({ kind, id, name: latest?.name || `${kind} #${id}`, photoUrl: latest?.photo_url || null });
        });
        footer.append(button);
        decorated.add(card);
      });

      const detailMatch = window.location.pathname.match(/^\/(dogs|puppies)\/(\d+)/);
      if (!detailMatch) return;
      const kind: ProfileKind = detailMatch[1] === "dogs" ? "dog" : "puppy";
      const id = Number(detailMatch[2]);
      const row = index[kind].get(id);
      const page = document.querySelector<HTMLElement>(kind === "dog" ? ".dog-profile-page" : ".puppy-record-page");
      if (!page || page.querySelector(".profile-photo-detail-card")) return;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "profile-photo-detail-card";
      card.innerHTML = row?.photo_url
        ? `<img src="${row.photo_url}" alt="${row.name || kind} profile"><span><b>Profile picture</b><small>Change or remove</small></span>`
        : '<span class="profile-photo-placeholder">+</span><span><b>Add profile picture</b><small>Optional</small></span>';
      card.addEventListener("click", () => setTarget({ kind, id, name: row?.name || `${kind} #${id}`, photoUrl: row?.photo_url || null }));
      const firstHeader = page.querySelector("header") || page.firstElementChild;
      if (firstHeader?.parentElement) firstHeader.parentElement.insertBefore(card, firstHeader.nextSibling);
      else page.prepend(card);
    };

    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", decorate);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", decorate);
    };
  }, [index]);

  async function upload(file: File) {
    if (!target) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.set("kind", target.kind);
      form.set("recordId", String(target.id));
      form.set("file", file);
      const response = await fetch("/api/profile-image", { method: "POST", body: form });
      const payload = await response.json() as { error?: string; url?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to upload the profile image.");
      setTarget({ ...target, photoUrl: payload.url || null });
      await load();
      window.setTimeout(() => window.location.reload(), 250);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to upload the profile image.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!target || !target.photoUrl) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profile-image", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: target.kind, recordId: target.id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Unable to remove the profile image.");
      }
      setTarget({ ...target, photoUrl: null });
      await load();
      window.setTimeout(() => window.location.reload(), 250);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to remove the profile image.");
    } finally {
      setSaving(false);
    }
  }

  if (!target) return null;

  return createPortal(<div className="profile-photo-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setTarget(null); }}>
    <section className="profile-photo-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-photo-title">
      <header><div><span>OPTIONAL PROFILE IMAGE</span><h2 id="profile-photo-title">{target.name}</h2><p>Add a clear photo that will appear throughout the dog or puppy profile.</p></div><button type="button" onClick={() => setTarget(null)} disabled={saving} aria-label="Close"><X size={19}/></button></header>
      <div className="profile-photo-preview">{target.photoUrl ? <img src={target.photoUrl} alt={`${target.name} profile`} /> : <div><Camera size={42}/><span>No profile picture selected</span></div>}</div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} />
      {error && <div className="profile-photo-error">{error}</div>}
      <footer><button type="button" className="profile-photo-secondary" onClick={() => setTarget(null)} disabled={saving}>Close</button>{target.photoUrl && <button type="button" className="profile-photo-remove" onClick={() => void remove()} disabled={saving}><Trash2 size={16}/> Remove</button>}<button type="button" className="profile-photo-primary" onClick={() => fileRef.current?.click()} disabled={saving}>{saving ? <LoaderCircle className="profile-photo-spin" size={17}/> : <ImagePlus size={17}/>} {saving ? "Saving…" : target.photoUrl ? "Choose a Different Photo" : "Choose Photo"}</button></footer>
    </section>
  </div>, document.body);
}
