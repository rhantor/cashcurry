"use client";

import React from "react";
import { Trash2, Palette, Save } from "lucide-react";
import { TEMPLATES } from "../templates";
import { useLetter } from "../LetterContext";

export default function StylePanel() {
  const { activeTab, draftName, setDraftName, savedDrafts, selectedDraft, templateType, letterMeta, setLetterMeta, stylingOptions, setStylingOptions, handleTemplateChange, handleSaveDraft, handleLoadDraft, handleDeleteDraft } = useLetter();
  return (
    <>
          {/* TAB: STYLE & DRAFT */}
          {activeTab === "style" && (
            <div className="space-y-5">
              {/* Template Selection */}
              <div>
                <label className="block text-[10px] font-bold text-subtle uppercase tracking-wider mb-2">Contract Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(TEMPLATES).map((key) => (
                    <button
                      key={key}
                      onClick={() => handleTemplateChange(key)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                        templateType === key
                          ? "border-brand bg-brand-soft/20 text-brand shadow-sm"
                          : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-fg"
                      }`}
                    >
                      {TEMPLATES[key].title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography & Layout styling */}
              <div className="border-t border-line pt-4 space-y-3">
                <h3 className="text-xs font-bold text-fg mb-2 flex items-center gap-1.5"><Palette className="w-4 h-4 text-brand" /> Document Typography & Margin</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-subtle uppercase mb-1">Font Family</label>
                    <select 
                      value={stylingOptions.fontFamily}
                      onChange={(e) => setStylingOptions({...stylingOptions, fontFamily: e.target.value})}
                      className="w-full text-xs font-semibold border border-line p-2 rounded-lg bg-surface outline-none focus:border-brand"
                    >
                      <option value="serif">Elegant Serif (Times)</option>
                      <option value="sans">Modern Sans (Inter)</option>
                      <option value="mono">Clean Monospace (Courier)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-subtle uppercase mb-1">Font Size</label>
                    <select 
                      value={stylingOptions.fontSize}
                      onChange={(e) => setStylingOptions({...stylingOptions, fontSize: e.target.value})}
                      className="w-full text-xs font-semibold border border-line p-2 rounded-lg bg-surface outline-none focus:border-brand"
                    >
                      <option value="12px">Small (12px)</option>
                      <option value="13px">Medium (13px)</option>
                      <option value="14px">Large (14px)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-subtle uppercase mb-1">Page Margin</label>
                    <select 
                      value={stylingOptions.marginSize}
                      onChange={(e) => setStylingOptions({...stylingOptions, marginSize: e.target.value})}
                      className="w-full text-xs font-semibold border border-line p-2 rounded-lg bg-surface outline-none focus:border-brand"
                    >
                      <option value="15mm">Compact (15mm)</option>
                      <option value="20mm">Standard (20mm)</option>
                      <option value="25mm">Wide (25mm)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-subtle uppercase mb-1">Accent Line Color</label>
                    <select 
                      value={stylingOptions.accentColor}
                      onChange={(e) => setStylingOptions({...stylingOptions, accentColor: e.target.value})}
                      className="w-full text-xs font-semibold border border-line p-2 rounded-lg bg-surface outline-none focus:border-brand"
                    >
                      <option value="#059669">Mint Green</option>
                      <option value="#1e293b">Dark Slate</option>
                      <option value="#1e3a8a">Royal Navy</option>
                      <option value="#000000">Deep Black</option>
                      <option value="transparent">None (Invisible)</option>
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-muted cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={stylingOptions.showWatermark}
                      onChange={(e) => setStylingOptions({...stylingOptions, showWatermark: e.target.checked})}
                      className="rounded text-brand focus:ring-[var(--cc-ring)] w-4 h-4 cursor-pointer"
                    />
                    Enable Slanted Background Watermark
                  </label>
                  
                  {stylingOptions.showWatermark && (
                    <input 
                      type="text" 
                      className="ml-6 text-xs font-medium border border-line p-2 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                      placeholder="Watermark Text" 
                      value={letterMeta.watermarkText} 
                      onChange={(e) => setLetterMeta({...letterMeta, watermarkText: e.target.value})} 
                    />
                  )}

                  <label className="flex items-center gap-2 text-xs font-semibold text-muted cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={stylingOptions.showLetterheadBorder}
                      onChange={(e) => setStylingOptions({...stylingOptions, showLetterheadBorder: e.target.checked})}
                      className="rounded text-brand focus:ring-[var(--cc-ring)] w-4 h-4 cursor-pointer"
                    />
                    Show Divider Line on Letterhead
                  </label>
                </div>
              </div>

              {/* Draft Save & Load panel */}
              <div className="border-t border-line pt-4 space-y-3">
                <h3 className="text-xs font-bold text-fg mb-1.5 flex items-center gap-1.5"><Save className="w-4 h-4 text-brand" /> Save / Load Contract Drafts</h3>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 text-xs font-semibold border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                    placeholder="Enter Draft Name (e.g. Faiz PM)" 
                    value={draftName} 
                    onChange={(e) => setDraftName(e.target.value)} 
                  />
                  <button 
                    onClick={handleSaveDraft}
                    className="bg-brand hover:brightness-105 text-brand-fg text-xs font-bold px-4 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                </div>

                {savedDrafts.length > 0 ? (
                  <div className="border border-line rounded-xl max-h-36 overflow-y-auto divide-y divide-line styled-scrollbar">
                    {savedDrafts.map((draft) => (
                      <div 
                        key={draft.id}
                        onClick={() => handleLoadDraft(draft.id)}
                        className={`p-2.5 flex justify-between items-center hover:bg-surface-2 cursor-pointer transition-colors ${
                          selectedDraft === draft.id ? "bg-brand-soft/30" : ""
                        }`}
                      >
                        <div className="text-left">
                          <p className="text-xs font-semibold text-fg">{draft.name}</p>
                          <p className="text-[9px] text-subtle font-medium">Saved: {draft.savedAt}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] bg-surface-2 text-muted px-1.5 py-0.5 rounded uppercase font-bold">
                            {draft.templateType}
                          </span>
                          <button
                            onClick={(e) => handleDeleteDraft(draft.id, e)}
                            className="text-subtle hover:text-danger p-1 rounded transition-colors cursor-pointer"
                            title="Delete draft"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-subtle font-medium italic text-center py-2 bg-surface-2/60/50 rounded-lg border border-dashed border-line">
                    No saved drafts found in your browser
                  </p>
                )}
              </div>
            </div>
          )}
    </>
  );
}
