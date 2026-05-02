"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X, ChevronDown } from "lucide-react";

/* ── PortfolioSwitcher ────────────────────────────────────────
   Compact horizontal pill row showing all named portfolios,
   modelled on WatchlistSwitcher. Click a pill to switch active
   portfolio. The active pill reveals rename / delete affordances
   below it; "+ New" creates an empty portfolio. */

export interface PortfolioMeta {
  id:        string;
  name:      string;
  positions: number;
}

interface Props {
  portfolios:    PortfolioMeta[];
  activeId:      string;
  onSetActive:   (id: string) => void;
  onAdd:         (name: string) => void;
  onRename:      (id: string, name: string) => void;
  onDelete:      (id: string) => void;
}

export default function PortfolioSwitcher({ portfolios, activeId, onSetActive, onAdd, onRename, onDelete }: Props) {
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

  const fontSize = 11;
  const pillPadding = "5px 11px";
  const onlyOne = portfolios.length <= 1;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", paddingBottom: 24 }}>
      {portfolios.map(p => {
        const active = p.id === activeId;
        const editing = renamingId === p.id;
        const askingDelete = confirmDelete === p.id;

        if (editing) {
          return (
            <div key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 4px", borderRadius: 99, background: "rgba(155,114,245,0.12)", border: "1px solid rgba(155,114,245,0.40)" }}>
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
            <div key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 4px 2px 10px", borderRadius: 99, background: "rgba(232,68,90,0.10)", border: "1px solid rgba(232,68,90,0.40)" }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: fontSize - 1, color: "var(--loss,#ff4560)", whiteSpace: "nowrap" }}>
                Delete &ldquo;{p.name}&rdquo;?
              </span>
              <button onClick={() => { onDelete(p.id); setConfirmDelete(null); }} title="Confirm delete"
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
          <div key={p.id} style={{ position: "relative", display: "inline-flex" }}>
            <button onClick={() => onSetActive(p.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: pillPadding, borderRadius: 99,
                background: active ? "rgba(155,114,245,0.14)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? "rgba(155,114,245,0.40)" : "var(--border,rgba(60,48,100,0.5))"}`,
                color: active ? "#9B72F5" : "var(--ink2,#7A9CBF)",
                fontFamily: "'DM Mono',monospace", fontSize, fontWeight: active ? 600 : 500,
                cursor: "pointer", whiteSpace: "nowrap",
              }}>
              {p.name}
              <span style={{ fontSize: fontSize - 2, color: active ? "#9B72F5" : "var(--ink4,#1F3550)", opacity: 0.7 }}>
                {p.positions}
              </span>
              {active && <ChevronDown size={9} style={{ opacity: 0.55 }} />}
            </button>
            {active && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, display: "flex", gap: 4, zIndex: 5 }}>
                <button onClick={() => { setRenameVal(p.name); setRenaming(p.id); }}
                  title={`Rename "${p.name}"`}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border,rgba(60,48,100,0.5))", color: "var(--ink2,#7A9CBF)", borderRadius: 6, padding: "3px 6px", display: "flex", alignItems: "center", gap: 3, fontFamily: "'DM Mono',monospace", fontSize: 9, cursor: "pointer" }}>
                  <Pencil size={9} /> Rename
                </button>
                {!onlyOne && (
                  <button onClick={() => setConfirmDelete(p.id)}
                    title={`Delete "${p.name}"`}
                    style={{ background: "rgba(232,68,90,0.06)", borderColor: "rgba(232,68,90,0.30)", border: "1px solid rgba(232,68,90,0.30)", color: "var(--loss,#ff4560)", borderRadius: 6, padding: "3px 6px", display: "flex", alignItems: "center", gap: 3, fontFamily: "'DM Mono',monospace", fontSize: 9, cursor: "pointer" }}>
                    <Trash2 size={9} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add new portfolio */}
      {adding ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 4px", borderRadius: 99, background: "rgba(0,200,150,0.10)", border: "1px solid rgba(0,200,150,0.40)" }}>
          <input ref={inputRef} placeholder="Portfolio name…"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") submitAdd();
              if (e.key === "Escape") cancelEdit();
            }}
            maxLength={40}
            style={{ background: "transparent", border: "none", outline: "none", color: "var(--ink0,#f4f0ff)", fontFamily: "'DM Mono',monospace", fontSize, padding: "3px 6px", width: 140 }}/>
          <button onClick={submitAdd} title="Create portfolio"
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
          title="New portfolio"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: pillPadding, borderRadius: 99,
            background: "transparent",
            border: "1px dashed var(--border,rgba(60,48,100,0.5))",
            color: "var(--ink3,#3D5A7A)",
            fontFamily: "'DM Mono',monospace", fontSize, cursor: "pointer", whiteSpace: "nowrap",
          }}>
          <Plus size={11} /> New portfolio
        </button>
      )}
    </div>
  );
}
