import { useEffect, useState } from 'react';
import { Quote, Star } from 'lucide-react';
import { homeImages } from '../data/homeAssets.js';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import '@/features/home/styles/animated-testimonials.css';

const testimonials = [
  {
    quote:
      '"Phūrai delivers an unforgettable dining experience that redefines culinary excellence. The Wagyu Charcoal was perfectly seared, and the atmosphere strikes an exquisite balance between intimacy and grandeur. Every detail is meticulously crafted to perfection, making it a truly premium journey."',
    name: 'Gordon Ramsay',
    role: 'British Chef & Restaurateur',
    title: 'VIP Guest',
    avatarSrc: homeImages.avatarGordon,
    rating: 5,
  },
  {
    quote:
      '"Every dish is beautifully presented, with refined flavors and exceptional attention to detail. The omakase course was a revelation—each piece of sushi telling a unique story of tradition elevated by brilliant contemporary techniques. It is an absolute masterclass in Japanese-Peruvian cuisine."',
    name: 'Lee Sang-hyeok',
    role: 'Professional Esport Player',
    title: 'Customer',
    avatarSrc: homeImages.avatarFaker,
    rating: 5,
  },
  {
    quote:
      '"The reservation process was seamless, the VIP area was extraordinarily elegant, and the staff were extremely professional. Celebrating my evening here was the best decision. The attentive yet unobtrusive service, combined with the phenomenal sake pairing, elevated the entire meal to another level."',
    name: 'Cristiano Ronaldo',
    role: 'Professional Football Player',
    title: 'Customer',
    avatarSrc: homeImages.avatarRonaldo,
    rating: 5,
  },
];

const trustedCompanies = ["Michelin Guide", "Gault & Millau", "The World's 50 Best", "James Beard", "Zagat"];

function TestimonialsSection() {
  const revealRef = useScrollReveal();
  const [activeIndex, setActiveIndex] = useState(0);
  const autoRotateInterval = 6000;

  useEffect(() => {
    if (autoRotateInterval <= 0 || testimonials.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % testimonials.length);
    }, autoRotateInterval);

    return () => clearInterval(interval);
  }, [autoRotateInterval]);

  return (
    <section className="anim-testimonials home-reveal-parent" ref={revealRef}>
      <h2 className="anim-testimonials__title" style={{ textAlign: 'center', marginBottom: '3rem', width: '100%' }}>WHAT OUR GUESTS SAY</h2>
      <div className="anim-testimonials__container home-reveal-child">
        <div className="anim-testimonials__grid">
          {/* Left side: Heading and navigation */}
          <div className="anim-testimonials__left">
            <div className="anim-testimonials__badge">
              <Star className="anim-testimonials__badge-icon" />
              <span>Trusted by Phūrai</span>
            </div>

            <p className="anim-testimonials__subtitle">
              Don't just take our word for it. Discover what our patrons have experienced at Phūrai.
            </p>

            <div className="anim-testimonials__nav">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`anim-testimonials__dot ${activeIndex === index ? 'anim-testimonials__dot--active' : 'anim-testimonials__dot--inactive'
                    }`}
                  aria-label={`View testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Right side: Testimonial cards */}
          <div className="anim-testimonials__right">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.name}
                className={`anim-testimonials__card-wrapper ${activeIndex === index
                  ? 'anim-testimonials__card-wrapper--active'
                  : 'anim-testimonials__card-wrapper--inactive'
                  }`}
              >
                <div className="anim-testimonials__card">
                  <div className="anim-testimonials__stars">
                    {Array(testimonial.rating || 5)
                      .fill(0)
                      .map((_, i) => (
                        <Star key={i} className="anim-testimonials__star" />
                      ))}
                  </div>

                  <div className="anim-testimonials__quote-container">
                    <Quote className="anim-testimonials__quote-icon" />
                    <p className="anim-testimonials__quote-text">{testimonial.quote}</p>
                  </div>

                  <div className="anim-testimonials__separator" />

                  <div className="anim-testimonials__author">
                    <div className="anim-testimonials__avatar">
                      <img
                        src={testimonial.avatarSrc}
                        alt={testimonial.name}
                        className="anim-testimonials__avatar-img"
                      />
                    </div>
                    <div>
                      <h3 className="anim-testimonials__author-name">{testimonial.name}</h3>
                      <p className="anim-testimonials__author-role">
                        {testimonial.role}, {testimonial.title}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Decorative elements */}
            <div className="anim-testimonials__deco-bottom" />
            <div className="anim-testimonials__deco-top" />
          </div>
        </div>

        {/* Logo cloud */}
        <div className="anim-testimonials__companies home-reveal-child home-reveal-child--delay-2">
          <h3 className="anim-testimonials__companies-title">Recognized by global culinary standards</h3>
          <div className="anim-testimonials__companies-list">
            {trustedCompanies.map((company) => (
              <div key={company} className="anim-testimonials__company">
                {company}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
