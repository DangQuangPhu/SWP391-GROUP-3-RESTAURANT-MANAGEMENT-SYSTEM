import { homeIcons } from '@/data/homeAssets';

function TestimonialCard({ quote, name, role, title, avatarSrc }) {
  return (
    <article className="phurai-testimonial-card">
      <div className="phurai-testimonial-card__stars" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <img key={i} src={homeIcons.star} alt="" className="icon" />
        ))}
      </div>
      <blockquote className="phurai-testimonial-card__quote">{quote}</blockquote>
      <div className="phurai-testimonial-card__author">
        <img src={avatarSrc} alt="" className="phurai-testimonial-card__avatar" />
        <div>
          <p className="phurai-testimonial-card__name">{name}</p>
          <p className="phurai-testimonial-card__meta">
            {role}
            <br />
            {title}
          </p>
        </div>
      </div>
    </article>
  );
}

export default TestimonialCard;
