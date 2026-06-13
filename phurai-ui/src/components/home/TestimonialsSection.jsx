import SectionHeader from '@/components/common/SectionHeader';
import TestimonialCard from '@/components/common/TestimonialCard';
import { homeImages } from '@/data/homeAssets';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const testimonials = [
  {
    quote:
      '"Phūrai delivers an unforgettable dining experience. The atmosphere, service, and cuisine feel truly premium."',
    name: 'Gordon Ramsay',
    role: 'British chef',
    title: 'VIP Guest',
    avatarSrc: homeImages.avatarGordon,
  },
  {
    quote:
      '"Every dish is beautifully presented, with refined flavors and exceptional attention to detail."',
    name: 'Lee Sang-hyeok',
    role: 'Esport Player',
    title: 'Customer',
    avatarSrc: homeImages.avatarFaker,
  },
  {
    quote:
      '"The reservation process was seamless, the VIP area was elegant, and the staff were extremely professional."',
    name: 'Cristiano Ronaldo',
    role: 'Football Player',
    title: 'Customer',
    avatarSrc: homeImages.avatarRonaldo,
  },
];

function TestimonialsSection() {
  const revealRef = useScrollReveal();

  return (
    <section className="phurai-testimonials home-reveal-parent" aria-labelledby="testimonials-heading" ref={revealRef}>
      <div className="home-reveal-child">
        <SectionHeader title="WHAT OUR GUESTS SAY" />
      </div>
      <div className="phurai-testimonials__grid">
        {testimonials.map((item, index) => (
          <div key={item.name} className={`home-reveal-child home-reveal-child--delay-${index + 1}`}>
            <TestimonialCard {...item} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default TestimonialsSection;
