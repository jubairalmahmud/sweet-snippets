// @ts-nocheck
import React from "react";
import { Database, Code, Check, Copy, Terminal } from "lucide-react";
import { SK_LOVE_SQL_SCHEMA, laravelControllerCode } from "../data/laravelData";

interface DbSchemaPanelProps {
  copiedText: string | null;
  handleCopyText: (text: string, id: string) => void;
}

export default function DbSchemaPanel({ copiedText, handleCopyText }: DbSchemaPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Database Visualizer */}
      <div className="lg:col-span-5 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-[500px]">
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
            <Database className="w-4 h-4 text-emerald-400" />
            Laravel MySQL Schema Dumper
          </div>
          <button
            id="btn_copy_schema"
            onClick={() => handleCopyText(SK_LOVE_SQL_SCHEMA, "schema")}
            className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedText === "schema" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy SQL Schema
              </>
            )}
          </button>
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <label htmlFor="schema_textarea" className="sr-only">
            Laravel MySQL Schema
          </label>
          <textarea
            id="schema_textarea"
            value={SK_LOVE_SQL_SCHEMA}
            readOnly
            className="w-full flex-1 min-h-[460px] bg-slate-950 rounded-xl p-4 font-mono text-[10.5px] text-teal-300 border border-slate-800/80 leading-relaxed resize-none focus:outline-none"
          />
        </div>

        <div className="p-3 bg-slate-950/65 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-500" />
          <span>
            Model migration file ready to paste in <code>database/migrations/</code>
          </span>
        </div>
      </div>

      {/* Right Column: Laravel Eloquent Controller */}
      <div className="lg:col-span-7 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-[500px]">
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
            <Code className="w-4 h-4 text-purple-400" />
            Laravel Backend Logic (RechargeController.php)
          </div>
          <button
            id="btn_copy_laravel"
            onClick={() => handleCopyText(laravelControllerCode, "laravel")}
            className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedText === "laravel" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Code
              </>
            )}
          </button>
        </div>

        <div className="p-5 flex-1 overflow-auto max-h-[500px]">
          <pre className="text-[11px] font-mono text-purple-200 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-850/80">
            <code>{laravelControllerCode}</code>
          </pre>
        </div>

        <div className="p-4 bg-slate-950/65 border-t border-slate-800 text-[10.5px] text-slate-400 leading-relaxed">
          <span className="font-bold text-indigo-400">🔥 Pro Recommendation:</span> Define API
          routes in your Laravel project like this:{" "}
          <code className="bg-slate-900 px-1 py-0.5 rounded text-white text-[10px]">
            Route::post(&apos;/recharge&apos;, [RechargeController::class,
            &apos;submitRechargeRequest&apos;]);
          </code>
        </div>
      </div>
    </div>
  );
}
