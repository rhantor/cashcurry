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
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Contract Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(TEMPLATES).map((key) => (
                    <button
                      key={key}
                      onClick={() => handleTemplateChange(key)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                        templateType === key
                          ? "border-mint-600 bg-mint-50/20 text-mint-800 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      {TEMPLATES[key].title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography & Layout styling */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5"><Palette className="w-4 h-4 text-mint-600" /> Document Typography & Margin</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Font Family</label>
                    <select 
                      value={stylingOptions.fontFamily}
                      onChange={(e) => setStylingOptions({...stylingOptions, fontFamily: e.target.value})}
                      className="w-full text-xs font-semibold border border-slate-200 p-2 rounded-lg bg-white outline-none focus:border-mint-500"
                    >
                      <option value="serif">Elegant Serif (Times)</option>
                      <option value="sans">Modern Sans (Inter)</option>
                      <option value="mono">Clean Monospace (Courier)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Font Size</label>
                    <select 
                      value={stylingOptions.fontSize}
                      onChange={(e) => setStylingOptions({...stylingOptions, fontSize: e.target.value})}
                      className="w-full text-xs font-semibold border border-slate-200 p-2 rounded-lg bg-white outline-none focus:border-mint-500"
                    >
                      <option value="12px">Small (12px)</option>
                      <option value="13px">Medium (13px)</option>
                      <option value="14px">Large (14px)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Page Margin</label>
                    <select 
                      value={stylingOptions.marginSize}
                      onChange={(e) => setStylingOptions({...stylingOptions, marginSize: e.target.value})}
                      className="w-full text-xs font-semibold border border-slate-200 p-2 rounded-lg bg-white outline-none focus:border-mint-500"
                    >
                      <option value="15mm">Compact (15mm)</option>
                      <option value="20mm">Standard (20mm)</option>
                      <option value="25mm">Wide (25mm)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Accent Line Color</label>
                    <select 
                      value={stylingOptions.accentColor}
                      onChange={(e) => setStylingOptions({...stylingOptions, accentColor: e.target.value})}
                      className="w-full text-xs font-semibold border border-slate-200 p-2 rounded-lg bg-white outline-none focus:border-mint-500"
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
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={stylingOptions.showWatermark}
                      onChange={(e) => setStylingOptions({...stylingOptions, showWatermark: e.target.checked})}
                      className="rounded text-mint-600 focus:ring-mint-500 w-4 h-4 cursor-pointer"
                    />
                    Enable Slanted Background Watermark
                  </label>
                  
                  {stylingOptions.showWatermark && (
                    <input 
                      type="text" 
                      className="ml-6 text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                      placeholder="Watermark Text" 
                      value={letterMeta.watermarkText} 
                      onChange={(e) => setLetterMeta({...letterMeta, watermarkText: e.target.value})} 
                    />
                  )}

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={stylingOptions.showLetterheadBorder}
                      onChange={(e) => setStylingOptions({...stylingOptions, showLetterheadBorder: e.target.checked})}
                      className="rounded text-mint-600 focus:ring-mint-500 w-4 h-4 cursor-pointer"
                    />
                    Show Divider Line on Letterhead
                  </label>
                </div>
              </div>

              {/* Draft Save & Load panel */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5"><Save className="w-4 h-4 text-mint-600" /> Save / Load Contract Drafts</h3>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 text-xs font-semibold border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                    placeholder="Enter Draft Name (e.g. Faiz PM)" 
                    value={draftName} 
                    onChange={(e) => setDraftName(e.target.value)} 
                  />
                  <button 
                    onClick={handleSaveDraft}
                    className="bg-mint-600 hover:bg-mint-700 text-white text-xs font-bold px-4 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                </div>

                {savedDrafts.length > 0 ? (
                  <div className="border border-slate-100 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-100 styled-scrollbar">
                    {savedDrafts.map((draft) => (
                      <div 
                        key={draft.id}
                        onClick={() => handleLoadDraft(draft.id)}
                        className={`p-2.5 flex justify-between items-center hover:bg-slate-50 cursor-pointer transition-colors ${
                          selectedDraft === draft.id ? "bg-mint-50/30" : ""
                        }`}
                      >
                        <div className="text-left">
                          <p className="text-xs font-semibold text-slate-800">{draft.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">Saved: {draft.savedAt}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold">
                            {draft.templateType}
                          </span>
                          <button
                            onClick={(e) => handleDeleteDraft(draft.id, e)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                            title="Delete draft"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 font-medium italic text-center py-2 bg-slate-50/50 rounded-lg border border-dashed border-slate-100">
                    No saved drafts found in your browser
                  </p>
                )}
              </div>
            </div>
          )}
    </>
  );
}
