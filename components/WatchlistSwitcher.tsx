"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, ChevronDown } from "lucide-react";

interface WatchlistEntry { id: string; name: string; tickers: string[]; }
interface WatchlistState  { lists: WatchlistEntry[]; activeId: string; }

/* ── WatchlistSwitcher ───────────────────────────────────────
   Compact horizontal pill row showing all named watchlists.
   Click a pill to switch active list. Hover the active pill
   to reveal rename / delete affordances. "+" button at the end
   to create a new list.

   Used in three places:
     - Sidebar (markets-tab right rail)
     - Markets-tab Watchlist card
     - WatchlistAlerts tab header

   All consumers pass the same handlers from the page-level
   state in app/page.tsx. */

interface Props {
  state: WatchlistState;
  onSetActive: (id: string) => void;
  onAdd:    (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** Compact mode reduces font / padding for tight spaces */
  compact?: boolean;
}

export default function WatchlistSwitcher({ state, onSetActive, onAdd, onRename, onDelete, compact = false }: Props) {
  const [adding, setAdding]       = useState(false);
  const [newName, setNewName]     = useState("");
  const [renamingId, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding || renamingId) inputRef.current?.focus();
  }, [adding, renamingId]);

  const submitAdd = () => {
    const v = newName.trim();
    if (!v) { setAdding(false); return; }
    onAdd(v);
    setNewName("");
    setAdding(false);
  };
  const submitRename = () => {
    if (!renamingId) return;
    const v = renameVal.trim();
    if (v) onRename(renamingId, v);
    setRenaming(null);
  };
  const cancelEdit = () => { setAdding(false); setRenaming(null); setNewName(""); setRenameVal(""); };

  const fontSize = compact ? 10 : 11;
  const pillPadding = compact ? "4px 9px" : "5px 11px";
  const onlyOne = state.lists.length <= 1;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      {state.lists.map(list => {
        const active = list.id === state.activeId;
        const editing = renamingId === list.id;
        const askingDelete = confirmDelete === list.id;

        if (editing) {
          return (
            <div key={list.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 4px", borderRadius: 99, background: "rgba(240,165,0,0.10)", border: "1px solid rgba(240,165,0,0.40)" }}>
              <input ref={inputRef} value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") submitRename();
                  if (e.key === "Escape") cancelEdit();
                }}
                maxLength={40}
                style={{ background: "transparent", border: "none", outline: "none", color: "var(--ink0,#f4f0ff)", fontFamily: "'DM Mono',monospace", fontSize, padding: "3px 6px", width: Math.max(80, renameVal.length * 7) }}/>
              <button onClick={submitRename} title="Save"
                style={{ background: "rgba(0,229,160,0.16)", border: "1px solid rgba(0,229,160,0.32)", color: "var(--gain,#00e5a0)", borderRadius: 99, padding: 4, display: "flex", cursor: "pointer" }}>
                <Check size={10} />
              </button>
              <button onClick={cancelEdit} title="Cancel"
                style={{ background: "none", border: "1px solid var(--border,rgba(60,48,100,0.5))", color: "var(--ink3,#3D5A7A)", borderRadius: 99, padding: 4, display: "flex", cursor: "pointer" }}>
                <X size={10} />
              </button>
            </div>
          );
        }

        if (askingDelete) {
          return (
            <div key={list.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 4px 2px 10px", borderRadius: 99, background: "rgba(232,68,90,0.10)", border: "1px solid rgba(232,68,90,0.40)" }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: fontSize - 1, color: "var(--loss,#ff4560)", whiteSpace: "nowrap" }}>
                Delete &ldquo;{list.name}&rdquo;?
              </span>
              <button onClick={() => { onDelete(list.id); setConfirmDelete(null); }} title="Confirm delete"
                style={{ background: "rgba(232,68,90,0.18)", border: "1px solid rgba(232,68,90,0.40)", color: "var(--loss,#ff4560)", borderRadius: 99, padding: 4, display: "flex", cursor: "pointer" }}>
                <Check size={10} />
              </button>
              <button onClick={() => setConfirmDelete(null)} title="Cancel"
                style={{ background: "none", border: "1px solid var(--border,rgba(60,48,100,0.5))", color: "var(--ink3,#3D5A7A)", borderRadius: 99, padding: 4, display: "flex", cursor: "pointer" }}>
                <X size={10} />
              </button>
            </div>
          );
        }

        return (
          <div key={list.id} style={{ position: "relative", display: "inline-flex" }}>
            <button onClick={() => onSetActive(list.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: pillPadding, borderRadius: 99,
                background: active ? "rgba(240,165,0,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? "rgba(240,165,0,0.36)" : "var(--border,rgba(60,48,100,0.5))"}`,
                color: active ? "var(--gold,#f0a500)" : "var(--ink2,#7A9CBF)",
                fontFamily: "'DM Mono',monospace", fontSize, fontWeight: active ? 600 : 500,
                cursor: "pointer", whiteSpace: "nowrap",
              }}>
              {list.name}
              <span style={{ fontSize: fontSize - 2, color: active ? "var(--gold,#f0a500)" : "var(--ink4,#1F3550)", opacity: 0.7 }}>
                {list.tickers.length}
              </span>
              {active && <ChevronDown size={9} style={{ opacity: 0.55 }} />}
            </button>
            {/* Inline edit/delete affordances appear only on the active pill */}
            {active && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, display: "flex", gap: 4, zIndex: 5 }}>
                <button onClick={() => { setRenameVal(list.name); setRenaming(list.id); }}
                  title={`Rename "${list.name}"`}
                  style={{ background: "rgba(8,6,16,0.96)", border: "1px solid var(--border,rgba(60,48,100,0.5))", color: "var(--ink3,#3D5A7A)", borderRadius: 6, padding: "3px 6px", display: "flex", alignItems: "center", gap: 3, fontFamily: "'DM Mono',monospace", fontSize: 9, cursor: "pointer" }}>
                  <Pencil size={9} /> Rename
                </button>
                {!onlyOne && (
                  <button onClick={() => setConfirmDelete(list.id)}
                    title={`Delete "${list.name}"`}
                    style={{ background: "rgba(8,6,16,0.96)", border: "1px solid rgba(232,68,90,0.30)", color: "var(--loss,#ff4560)", borderRadius: 6, padding: "3px 6px", display: "flex", alignItems: "center", gap: 3, fontFamily: "'DM Mono',monospace", fontSize: 9, cursor: "pointer" }}>
                    <Trash2 size={9} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add new list */}
      {adding ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 4px", borderRadius: 99, background: "rgba(0,200,150,0.10)", border: "1px solid rgba(0,200,150,0.40)" }}>
          <input ref={inputRef} placeholder="List name…"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") submitAdd();
              if (e.key === "Escape") cancelEdit();
            }}
            maxLength={40}
            style={{ background: "transparent", border: "none", outline: "none", color: "var(--ink0,#f4f0ff)", fontFamily: "'DM Mono',monospace", fontSize, padding: "3px 6px", width: 130 }}/>
          <button onClick={submitAdd} title="Create list"
            style={{ background: "rgba(0,229,160,0.16)", border: "1px solid rgba(0,229,160,0.32)", color: "var(--gain,#00e5a0)", borderRadius: 99, padding: 4, display: "flex", cursor: "pointer" }}>
            <Check size={10} />
          </button>
          <button onClick={cancelEdit} title="Cancel"
            style={{ background: "none", border: "1px solid var(--border,rgba(60,48,100,0.5))", color: "var(--ink3,#3D5A7A)", borderRadius: 99, padding: 4, display: "flex", cursor: "pointer" }}>
            <X size={10} />
          </button>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setNewName(""); }}
          title="New list"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: pillPadding, borderRadius: 99,
            background: "transparent",
            border: "1px dashed var(--border,rgba(60,48,100,0.5))",
            color: "var(--ink3,#3D5A7A)",
            fontFamily: "'DM Mono',monospace", fontSize, cursor: "pointer", whiteSpace: "nowrap",
          }}>
          <Plus size={11} /> New list
        </button>
      )}
    </div>
  );
}
