import React, { useEffect } from 'react';

export default function AdBanner({ 
  adClient, 
  adSlot, 
  sponsorImage, 
  sponsorTitle, 
  sponsorLink, 
  type = 'sponsor' // 'sponsor' | 'adsense' 
}) {

  useEffect(() => {
    if (type === 'adsense') {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error("AdSense error:", e);
      }
    }
  }, [type]);

  if (type === 'adsense') {
    return (
      <div className="w-full my-3 flex justify-center items-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-2 min-h-[90px]">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', textAlign: 'center' }}
          data-ad-client={adClient || "ca-pub-4089447801006214"}
          data-ad-slot={adSlot || "XXXXXXXXXX"}
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </div>
    );
  }

  // Sponsor / Custom Partner Promo Banner
  return (
    <a
      href={sponsorLink || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full my-3 p-3 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl hover:border-amber-400 transition shadow-lg group"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shrink-0 overflow-hidden">
          {sponsorImage ? (
            <img src={sponsorImage} alt="Sponsor" className="w-full h-full object-cover" />
          ) : (
            '📢'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md mb-0.5">
            Χορηγός / Διαφήμιση
          </span>
          <h4 className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition">
            {sponsorTitle || "Διαφημιστείτε εδώ στο Mpriki Winners!"}
          </h4>
        </div>
        <span className="text-xs font-bold text-amber-400 px-2.5 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20 shrink-0">
          Δείτε περισσότερα &rarr;
        </span>
      </div>
    </a>
  );
}
