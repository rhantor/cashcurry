"use client";

import React from "react";
import { Check } from "lucide-react";
import { useLetter } from "./LetterContext";

export default function SignaturePad() {
  const { canvasRef, signatureModal, setSignatureModal, startDrawing, draw, stopDrawing, clearCanvas, saveSignature } = useLetter();
  return (
    <>
      {/* 3. HTML5 Canvas Signature Pad Drawing Modal */}
      {signatureModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-surface p-6 rounded-2xl border border-line shadow-xl w-full max-w-[480px] text-center space-y-4">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-line text-left">
              <div>
                <h3 className="text-sm font-bold text-fg">
                  Draw Digital Signature
                </h3>
                <p className="text-[10px] text-subtle font-medium mt-0.5">
                  Sign using your mouse, trackpad, or touch-screen device
                </p>
              </div>
              <span className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-full font-bold capitalize">
                {signatureModal.target === "signatory" ? "Employer" : "Candidate"}
              </span>
            </div>

            {/* Ink Settings */}
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-muted">Ink Color:</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSignatureModal({ ...signatureModal, inkColor: "#0000ff" })}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    signatureModal.inkColor === "#0000ff" 
                      ? "border-blue-600 bg-info-soft text-info" 
                      : "border-line text-muted hover:bg-surface-2"
                  }`}
                >
                  🔵 Professional Blue
                </button>
                <button 
                  onClick={() => setSignatureModal({ ...signatureModal, inkColor: "#000000" })}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    signatureModal.inkColor === "#000000" 
                      ? "border-black bg-surface-2/60 text-fg" 
                      : "border-line text-muted hover:bg-surface-2"
                  }`}
                >
                  ⚫ Official Black
                </button>
              </div>
            </div>

            {/* Canvas Drawing Area */}
            <div className="border border-line rounded-xl bg-surface-2/60/50 overflow-hidden relative group">
              <canvas
                ref={canvasRef}
                width={432}
                height={200}
                className="bg-surface cursor-crosshair block w-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <div className="absolute top-2 right-2 pointer-events-none select-none font-mono text-[9px] font-bold text-subtle uppercase border border-line px-1.5 py-0.5 rounded bg-surface/60 backdrop-blur-sm group-hover:opacity-0 transition-opacity">
                Signature Pad
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-line">
              <button
                onClick={clearCanvas}
                className="w-1/4 py-2 border border-line text-muted text-xs font-bold rounded-xl hover:bg-surface-2 transition-colors cursor-pointer"
              >
                Clear Pad
              </button>
              <button
                onClick={() => setSignatureModal({ ...signatureModal, isOpen: false })}
                className="w-1/4 py-2 border border-line text-muted text-xs font-bold rounded-xl hover:bg-surface-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveSignature}
                className="w-2/4 py-2 bg-brand hover:brightness-105 text-brand-fg text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" /> Apply Signature
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
