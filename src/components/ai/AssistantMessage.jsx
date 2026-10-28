import React from 'react';
import { CheckCircle2, XCircle, HelpCircle, ArrowRight, Info, Sparkles } from 'lucide-react';

/**
 * Renders one section of a structured assistant response.
 * Handles: summary, reasons, pros, cons, unknowns, nextSteps, disclaimer
 */

function SectionHeading({ icon: Icon, label, color = 'text-slate-700' }) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-2 ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function BulletList({ items, icon: Icon, iconClass, textClass = 'text-slate-700' }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className={`flex items-start gap-2 text-xs leading-relaxed ${textClass}`}>
          <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${iconClass}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AssistantMessage({ response }) {
  if (!response) return null;

  const { summary, reasons, pros, cons, unknowns, nextSteps, disclaimer } = response;

  const hasSections = reasons?.length || pros?.length || cons?.length || unknowns?.length || nextSteps?.length;

  return (
    <div className="space-y-4 text-sm">
      {/* Summary */}
      {summary && (
        <div className="flex items-start gap-2.5 p-3.5 bg-[#EAF4EF] border border-[#2D5A47]/20 rounded-xl">
          <Sparkles className="w-4 h-4 text-[#2D5A47] shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-slate-800 leading-relaxed">{summary}</p>
        </div>
      )}

      {hasSections && (
        <div className="space-y-4">
          {/* Reasons (why match) */}
          {reasons?.length > 0 && (
            <div>
              <SectionHeading icon={CheckCircle2} label="Alasan kecocokan" color="text-emerald-700" />
              <BulletList
                items={reasons}
                icon={CheckCircle2}
                iconClass="text-emerald-500"
              />
            </div>
          )}

          {/* Pros */}
          {pros?.length > 0 && (
            <div>
              <SectionHeading icon={CheckCircle2} label="Kelebihan" color="text-emerald-700" />
              <BulletList
                items={pros}
                icon={CheckCircle2}
                iconClass="text-emerald-500"
              />
            </div>
          )}

          {/* Cons */}
          {cons?.length > 0 && (
            <div>
              <SectionHeading icon={XCircle} label="Kekurangan / Kompromi" color="text-amber-700" />
              <BulletList
                items={cons}
                icon={XCircle}
                iconClass="text-amber-500"
                textClass="text-slate-600"
              />
            </div>
          )}

          {/* Unknowns — marked explicitly as unverified */}
          {unknowns?.length > 0 && (
            <div>
              <SectionHeading icon={HelpCircle} label="Belum diketahui / perlu dikonfirmasi" color="text-slate-500" />
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                {unknowns.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
                    <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next steps */}
          {nextSteps?.length > 0 && (
            <div>
              <SectionHeading icon={ArrowRight} label="Langkah berikutnya" color="text-[#2D5A47]" />
              <ul className="space-y-1.5">
                {nextSteps.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed"
                  >
                    <span className="mt-0.5 text-[#2D5A47] font-bold shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer / context note */}
      {disclaimer && (
        <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">{disclaimer}</p>
        </div>
      )}

      {/* AI Provider attribution */}
      {(response.provider === '9router' || response.provider === 'deepseek') && (
        <div className="flex items-center justify-end gap-1.5 pt-1 text-[10px] text-violet-700 font-medium">
          <Sparkles className="w-3 h-3 text-violet-500" />
          <span>Dianalisis melalui 9Router AI Gateway</span>
        </div>
      )}
    </div>
  );
}
