import SectionHeader from '@/components/common/SectionHeader';
import TestimonialCard from '@/components/common/TestimonialCard';
import { homeImages } from '@/data/homeAssets';

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
    name: 'Faker',
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
  return (
    <section className="phurai-testimonials" aria-labelledby="testimonials-heading">
      <SectionHeader title="WHAT OUR GUESTS SAY" />
      <div className="phurai-testimonials__grid">
        {testimonials.map((item) => (
          <TestimonialCard key={item.name} {...item} />
        ))}
      </div>
    </section>
  );
}

export default TestimonialsSection;
