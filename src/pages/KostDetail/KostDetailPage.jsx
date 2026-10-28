import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Star,
  Heart,
  ArrowLeft,
  ShieldCheck,
  Building,
  BedDouble,
  MessageCircle,
  Share2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  BotMessageSquare
} from 'lucide-react';
import SEO from '../../components/common/SEO';
import Badge from '../../components/common/Badge';
import PropertyGallery from '../../components/property/PropertyGallery';
import FacilityList from '../../components/property/FacilityList';
import LocationMap from '../../components/property/LocationMap';
import PropertyCard from '../../components/property/PropertyCard';
import PropertyPersonalityGauge from '../../components/property/PropertyPersonalityGauge';
import MatchReasonBadge from '../../components/property/MatchReasonBadge';
import Modal from '../../components/common/Modal';
import KosAssistantPanel from '../../components/ai/KosAssistantPanel';
import { propertyService } from '../../services/propertyService';
import { useSavedKost } from '../../context/SavedKostContext';
import { useStudentProfile } from '../../context/StudentProfileContext';
import { formatRupiah, formatDistance } from '../../utils/formatters';
import { matchPropertyToProfile } from '../../utils/matching';

export default function KostDetailPage() {
  const { slug } = useParams();

  const [property, setProperty] = useState(null);
  const [similarProperties, setSimilarProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedShare, setCopiedShare] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [allProperties, setAllProperties] = useState([]);

  const { isSaved, toggleSave, savedIds } = useSavedKost();
  const { profile, getMatchForProperty } = useStudentProfile();

  useEffect(() => {
    async function loadPropertyData() {
      setLoading(true);
      window.scrollTo(0, 0);

      try {
        const data = await propertyService.getPropertyBySlug(slug);
        if (!data) {
          setLoading(false);
          return;
        }
        setProperty(data);

        const [similars, allProps] = await Promise.all([
          propertyService.getSimilarProperties(data.id, 3),
          propertyService.getProperties({}),
        ]);
        setSimilarProperties(similars);
        setAllProperties(allProps);
      } catch (err) {
        console.error('Failed loading detail page:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPropertyData();
  }, [slug]);

  // ── Derived state (all hooks must precede early returns) ──
  const saved = isSaved(property?.id);

  const matchInfo = useMemo(() => {
    if (!profile || !property) return null;
    return getMatchForProperty(property);
  }, [profile, property, getMatchForProperty]);

  const primaryKos = useMemo(() => {
    if (!property) return null;
    return {
      property,
      matchScore: matchInfo?.score ?? null,
      matchReasons: matchInfo?.reasons ?? [],
      matchTradeoffs: matchInfo?.tradeoffs ?? [],
    };
  }, [property, matchInfo]);

  const compareKos = useMemo(() => {
    if (!savedIds?.length || !allProperties.length || !property) return null;
    const otherId = savedIds.find((id) => String(id) !== String(property.id));
    if (!otherId) return null;
    const otherProp = allProperties.find((p) => String(p.id) === String(otherId));
    if (!otherProp) return null;
    const prefs = profile?.preferences || profile || {};
    const otherMatch = matchPropertyToProfile(otherProp, prefs);
    return {
      property: otherProp,
      matchScore: otherMatch.score,
      matchReasons: otherMatch.reasons,
      matchTradeoffs: otherMatch.tradeoffs,
    };
  }, [savedIds, allProperties, property, profile]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 w-40 bg-slate-200 animate-pulse rounded-lg" />
        <div className="h-96 w-full bg-slate-200 animate-pulse rounded-3xl" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4 animate-slide-up">
        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Kos Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500">Tempat kos yang kamu cari tidak ditemukan atau sudah tidak aktif.</p>
        <Link
          to="/kost"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2D5A47] text-white text-xs font-bold rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Kos
        </Link>
      </div>
    );
  }

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleWhatsAppContact = () => {
    if (!property.owner?.whatsapp) return;
    const msg = encodeURIComponent(
      `Halo ${property.owner.name}, saya berminat dengan ${property.name} (${property.location?.areaName || property.location}) di Ngekost. Apakah kamar masih tersedia?`
    );
    window.open(`https://wa.me/${property.owner.whatsapp}?text=${msg}`, '_blank');
  };

  return (
    <>
      <SEO
        title={`${property.name} - Ngekost IPB`}
        description={`${property.name} (${property.location?.areaName}). ${property.description?.slice(0, 150)}...`}
      />

      <div className="bg-slate-50/60 min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            to="/kost"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#2D5A47] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Pencarian Kos</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-3.5 py-2 bg-white border border-slate-200/90 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedShare ? 'Tautan Disalin!' : 'Bagikan'}</span>
            </button>

            <button
              onClick={() => toggleSave(property.id)}
              className={`px-3.5 py-2 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                saved
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-rose-300'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${saved ? 'fill-rose-600 text-rose-600' : ''}`} />
              <span>{saved ? 'Tersimpan' : 'Simpan kos'}</span>
            </button>
          </div>
        </div>

        {/* Gallery Component */}
        <PropertyGallery images={property.images} title={property.name} />

        {/* Title, Overview & Primary CTAs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Info Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Key Specs */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {property.gender === 'putra' && <Badge variant="putra">Kamar Putra</Badge>}
                {property.gender === 'putri' && <Badge variant="putri">Kamar Putri</Badge>}
                {property.gender === 'campur' && <Badge variant="campur">Kamar Campur</Badge>}
                {property.verified && (
                  <Badge variant="verified">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2D5A47] mr-1" /> Terverifikasi
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {property.name}
              </h1>

              <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-600 flex-wrap">
                <div className="flex items-center gap-1 font-semibold text-slate-800">
                  <MapPin className="w-4 h-4 text-[#2D5A47] shrink-0" />
                  <span>{property.location?.address || property.location?.areaName}</span>
                </div>
                <div className="px-2.5 py-1 bg-[#EAF4EF] text-[#2D5A47] font-bold rounded-lg">
                  {formatDistance(property.distanceFromIPB)}
                </div>
                <div className="flex items-center gap-1 font-bold text-amber-600">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{property.rating}</span>
                  <span className="text-slate-400 font-normal">({property.reviewCount} ulasan)</span>
                </div>
              </div>

              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed pt-2 border-t border-slate-100">
                {property.description}
              </p>
            </div>

            {/* Personalized "Kenapa kos ini cocok buat kamu?" Section */}
            {matchInfo && (
              <MatchReasonBadge
                reasons={matchInfo.reasons}
                matchScore={matchInfo.score}
              />
            )}

            {/* "Suasananya" Environment & Personality Gauge Section */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#2D5A47]" />
                <span>Suasananya</span>
              </h3>
              <PropertyPersonalityGauge
                personality={property.personality}
                environment={property.environment}
              />
            </div>

            {/* "Cocok untuk kamu kalau..." Section */}
            {property.suitableFor && property.suitableFor.length > 0 && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
                <h3 className="text-lg font-extrabold text-slate-900">Cocok untuk kamu kalau...</h3>
                <div className="space-y-2.5">
                  {property.suitableFor.map((trait, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-[#2D5A47] shrink-0" />
                      <span>{trait}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Facilities Section */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-[#2D5A47]" />
                <span>Fasilitas Properti</span>
              </h3>
              <FacilityList facilities={property.facilities} />
            </div>

            {/* Room Options Section */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-[#2D5A47]" />
                  <span>Pilihan Tipe Kamar</span>
                </h3>
                <span className="text-xs font-semibold text-[#2D5A47]">
                  Status: {property.availability?.status}
                </span>
              </div>

              <div className="space-y-3">
                {property.rooms?.map((room) => (
                  <div
                    key={room.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-base">{room.name}</h4>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-md">
                          {room.size}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {room.facilities.map((fac, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-medium rounded-md"
                          >
                            {fac}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-base font-extrabold text-[#2D5A47]">
                        {formatRupiah(room.price)}
                        <span className="text-xs font-normal text-slate-500"> / bulan</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Tersedia {room.available} kamar
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rules Section */}
            {property.rules && property.rules.length > 0 && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
                <h3 className="text-lg font-extrabold text-slate-900">Peraturan Kos</h3>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700 list-disc list-inside">
                  {property.rules.map((rule, idx) => (
                    <li key={idx} className="font-medium">{rule}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Location Map Section */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <h3 className="text-lg font-extrabold text-slate-900">Lokasi & Akses Kampus IPB</h3>
              <LocationMap
                location={property.location?.address || property.location?.areaName}
                latitude={property.location?.latitude}
                longitude={property.location?.longitude}
                distanceFromIPB={property.distanceFromIPB}
                propertyName={property.name}
              />
            </div>
          </div>

          {/* Sticky Booking & Owner Card Right Column */}
          <div className="lg:col-span-1 sticky top-24 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-md space-y-6">
              <div>
                <span className="text-xs font-medium text-slate-500">Harga Sewa Bulanan</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#2D5A47] mt-0.5">
                  {formatRupiah(property.pricing?.min || property.priceMin)}
                  <span className="text-xs font-normal text-slate-500"> / bulan</span>
                </div>
              </div>

              {/* Owner Specs Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Pengelola / Pemilik Kos
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  {property.owner?.name}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Respon: {property.owner?.responseRate}</span>
                  <span>Waktu: {property.owner?.responseTime}</span>
                </div>
              </div>

              {/* Contact Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleWhatsAppContact}
                  className="w-full py-3.5 bg-[#2D5A47] hover:bg-[#234939] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-[#2D5A47]/20 flex items-center justify-center gap-2 transition-all"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>Hubungi pemilik</span>
                </button>

                {/* AI Assistant entry point */}
                <button
                  id="btn-ai-assistant"
                  onClick={() => setAssistantOpen(true)}
                  className="w-full py-3 border border-[#2D5A47]/40 bg-[#EAF4EF] hover:bg-[#2D5A47] hover:text-white font-bold text-xs text-[#2D5A47] rounded-xl flex items-center justify-center gap-2 transition-all group"
                >
                  <BotMessageSquare className="w-4 h-4 group-hover:text-white" />
                  <span>Bantu saya memilih kos ini</span>
                </button>

                <button
                  onClick={() => toggleSave(property.id)}
                  className={`w-full py-3 border font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all ${
                    saved
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${saved ? 'fill-rose-600 text-rose-600' : ''}`} />
                  <span>{saved ? 'Kos Tersimpan' : 'Simpan kos'}</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed text-center border-t border-slate-100 pt-3">
                Tanpa biaya perantara. Kamu akan terhubung langsung dengan pihak pemilik kos.
              </div>
            </div>
          </div>
        </div>

        {/* Similar Properties Section */}
        {similarProperties.length > 0 && (
          <section className="pt-8 border-t border-slate-200 space-y-6">
            <h3 className="text-xl font-extrabold text-slate-900">Kos Serupa Di Area Sekitar</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similarProperties.map((sim) => (
                <PropertyCard key={sim.id} property={sim} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* AI Kos Decision Assistant panel */}
      <KosAssistantPanel
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        primaryKos={primaryKos}
        compareKos={compareKos}
        profile={profile}
      />
    </>
  );
}
