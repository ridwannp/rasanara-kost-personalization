import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Columns3, Home, Bookmark, ArrowLeft, BotMessageSquare } from 'lucide-react';
import SEO from '../../components/common/SEO';
import ComparisonHeader from '../../components/comparison/ComparisonHeader';
import ComparisonTable from '../../components/comparison/ComparisonTable';
import ComparisonSummary from '../../components/comparison/ComparisonSummary';
import ComparisonEmptyState from '../../components/comparison/ComparisonEmptyState';
import KosAssistantPanel from '../../components/ai/KosAssistantPanel';
import { usePropertyComparison } from '../../hooks/usePropertyComparison';
import { useSavedKost } from '../../context/SavedKostContext';
import { useStudentProfile } from '../../context/StudentProfileContext';
import { propertyService } from '../../services/propertyService';
import {
  COMPARISON_CATEGORIES,
  getFilteredComparisonCategories,
  generateDecisionSummary
} from '../../utils/propertyComparison';
import { matchPropertyToProfile, getMatchLabel } from '../../utils/matching';

export default function ComparePage() {
  const {
    comparisonIds,
    removeFromComparison,
    reconcileWithProperties
  } = usePropertyComparison();

  const { isSaved, removeSaved } = useSavedKost();
  const { profile } = useStudentProfile();

  const [comparedProperties, setComparedProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Load properties based on comparison IDs
  useEffect(() => {
    async function loadCompared() {
      setLoading(true);
      try {
        const allProps = await propertyService.getProperties({});
        reconcileWithProperties(allProps);

        const idMap = new Map(allProps.map((p) => [String(p.id), p]));
        const props = comparisonIds
          .map((id) => idMap.get(String(id)))
          .filter(Boolean);

        setComparedProperties(props);
      } catch (err) {
        console.error('Failed loading properties for comparison:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCompared();
  }, [comparisonIds, reconcileWithProperties]);

  // Compute actual match scores using existing matching engine
  const matchScores = useMemo(() => {
    if (!profile || (!profile.budgetMax && !profile.environmentPref && !profile.facilities?.length)) {
      return {};
    }
    const prefs = profile.preferences || profile;
    const scores = {};
    comparedProperties.forEach((p) => {
      const res = matchPropertyToProfile(p, prefs);
      scores[p.id] = {
        score: res.score,
        label: getMatchLabel(res.score),
        reasons: res.reasons,
        tradeoffs: res.tradeoffs
      };
    });
    return scores;
  }, [profile, comparedProperties]);

  // Filtered categories based on difference toggle
  const visibleCategories = useMemo(() => {
    return getFilteredComparisonCategories(
      COMPARISON_CATEGORIES,
      comparedProperties,
      showDifferencesOnly
    );
  }, [comparedProperties, showDifferencesOnly]);

  // Decision summary output
  const decisionData = useMemo(() => {
    return generateDecisionSummary(comparedProperties, profile);
  }, [comparedProperties, profile]);

  // Priority fields to highlight
  const priorityFields = useMemo(() => {
    const list = [];
    if (!profile) return list;
    const prefs = profile.preferences || profile;
    if (prefs.budgetMax) list.push('price_monthly');
    if (prefs.maxDistance) list.push('distance');
    if (prefs.environmentPref) list.push('env_quiet');
    if (prefs.facilities?.includes('bathroom_inside')) list.push('fac_bathroom_inside');
    if (prefs.facilities?.includes('wifi')) list.push('fac_wifi');
    if (prefs.facilities?.includes('ac')) list.push('fac_ac');
    return list;
  }, [profile]);

  // Build assistant context from first two compared properties
  const assistantPrimaryKos = useMemo(() => {
    const p = comparedProperties[0];
    if (!p) return null;
    const s = matchScores[p.id];
    return { property: p, matchScore: s?.score ?? null, matchReasons: s?.reasons ?? [], matchTradeoffs: s?.tradeoffs ?? [] };
  }, [comparedProperties, matchScores]);

  const assistantCompareKos = useMemo(() => {
    const p = comparedProperties[1];
    if (!p) return null;
    const s = matchScores[p.id];
    return { property: p, matchScore: s?.score ?? null, matchReasons: s?.reasons ?? [], matchTradeoffs: s?.tradeoffs ?? [] };
  }, [comparedProperties, matchScores]);

  return (
    <>
      <SEO
        title="Bandingkan Pilihan Kos - Ngekost IPB"
        description="Bandingkan beberapa kos di sekitar IPB Dramaga secara berdampingan. Lihat perbedaan harga, fasilitas, suasana, dan jarak."
      />

      <div className="bg-[#FAF9F6] min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Home className="w-3.5 h-3.5 text-[#2D5A47]" />
          <Link to="/" className="hover:underline">Beranda</Link>
          <span>/</span>
          <Link to="/saved" className="hover:underline">Kos Tersimpan</Link>
          <span>/</span>
          <span className="text-[#2D5A47] font-bold">Bandingkan</span>
        </div>

        {/* Section Header (Specifications Section 7) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Bandingkan pilihanmu
              </h1>
              {comparedProperties.length >= 2 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#EAF4EF] text-[#2D5A47] text-xs font-extrabold border border-[#2D5A47]/15">
                  {comparedProperties.length} Kos
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              Setiap kos punya kelebihan yang berbeda. Lihat mana yang paling sesuai dengan kebutuhanmu.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/saved"
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Kembali ke Kos Tersimpan</span>
            </Link>
            {comparedProperties.length >= 2 && (
              <button
                id="btn-compare-ai-assistant"
                onClick={() => setAssistantOpen(true)}
                className="px-4 py-2 bg-[#EAF4EF] hover:bg-[#2D5A47] border border-[#2D5A47]/30 text-[#2D5A47] hover:text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
              >
                <BotMessageSquare className="w-3.5 h-3.5" />
                <span>Tanya AI</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="h-96 bg-white rounded-3xl border border-slate-200 animate-pulse p-8" />
        ) : comparedProperties.length < 2 ? (
          <ComparisonEmptyState />
        ) : (
          <div className="space-y-8">
            {/* Top Properties Row Cards Header */}
            <ComparisonHeader
              properties={comparedProperties}
              onRemoveFromComparison={removeFromComparison}
              onRemoveFromSaved={removeSaved}
              isPropertySaved={isSaved}
              matchScores={matchScores}
            />

            {/* Categorized Detailed Specifications Table */}
            <ComparisonTable
              categories={visibleCategories}
              properties={comparedProperties}
              showDifferencesOnly={showDifferencesOnly}
              onToggleDifferencesOnly={setShowDifferencesOnly}
              priorityFields={priorityFields}
            />

            {/* Decision Support Summary Section (Section 11 & 12) */}
            <ComparisonSummary
              decisionData={decisionData}
              properties={comparedProperties}
            />
          </div>
        )}
      </div>

      {/* AI Kos Decision Assistant — comparison context */}
      {assistantPrimaryKos && (
        <KosAssistantPanel
          isOpen={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          primaryKos={assistantPrimaryKos}
          compareKos={assistantCompareKos}
          profile={profile}
        />
      )}
    </>
  );
}
