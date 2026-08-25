import React, { useEffect } from 'react';
import { Autoplay, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Advertisement, AdvertisementService } from '../../services/advertisementService';
import { UserRole } from '../../types';
import { MembersOnlyOverlay } from '../ui/MembersOnlyOverlay';
import { Skeleton } from '../ui/Common';
import 'swiper/css';
import 'swiper/css/pagination';

interface DashboardPartnersCarouselProps {
  adsLoading: boolean;
  homepageAds: Advertisement[];
  member: any;
  onSelectAd: (ad: Advertisement) => void;
}

export const DashboardPartnersCarousel: React.FC<DashboardPartnersCarouselProps> = ({
  adsLoading,
  homepageAds,
  member,
  onSelectAd,
}) => {
  useEffect(() => {
    if (homepageAds.length > 0 && homepageAds[0]?.id) {
      AdvertisementService.recordImpression(homepageAds[0].id);
    }
  }, [homepageAds.length]);

  if (!adsLoading && homepageAds.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Partners</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      {adsLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map(index => <Skeleton key={index} className="flex-none w-[58%] sm:w-[30%] lg:w-[23%] h-36 sm:h-40" rounded="2xl" />)}
        </div>
      ) : (
        <div className="w-full relative rounded-2xl overflow-hidden">
          {member?.role === UserRole.GUEST && (
            <MembersOnlyOverlay compact description="Join JCI KL to unlock partner privileges." member={member} />
          )}
          <Swiper
            modules={[Autoplay, Pagination]}
            spaceBetween={16}
            slidesPerView={1.65}
            breakpoints={{
              640: { slidesPerView: 3.15 },
              1024: { slidesPerView: 4.15 },
            }}
            autoplay={{ delay: 3000, disableOnInteraction: false }}
            pagination={{ clickable: true, dynamicBullets: true }}
            loop={false}
            rewind={homepageAds.length > 1}
            className="w-full"
            onSlideChange={(swiper) => {
              if (homepageAds.length > 0) {
                const currentAd = homepageAds[swiper.realIndex];
                if (currentAd?.id) {
                  AdvertisementService.recordImpression(currentAd.id);
                }
              }
            }}
          >
            {homepageAds.map((ad, index) => (
              <SwiperSlide key={ad.id || index}>
                <div
                  className="h-36 sm:h-40 w-full rounded-2xl overflow-hidden relative shadow-md cursor-pointer group transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  onClick={() => {
                    if (ad.id) AdvertisementService.recordClick(ad.id);
                    onSelectAd(ad);
                  }}
                >
                  <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                    <h3 className="text-white font-bold text-sm sm:text-base line-clamp-1">{ad.title}</h3>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}
    </>
  );
};
