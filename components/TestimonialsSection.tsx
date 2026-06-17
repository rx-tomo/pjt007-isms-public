'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function TestimonialsSection() {
  const t = useTranslations();
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  const testimonials = [
    {
      key: 'testimonial1',
      logo: '🏢',
      bgColor: 'from-blue-50 to-blue-100'
    },
    {
      key: 'testimonial2',
      logo: '💻',
      bgColor: 'from-purple-50 to-purple-100'
    }
  ];

  return (
    <section id="testimonials" className="py-20 bg-surface overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            {t('landing.testimonials.title')}
          </h2>
          <p className="text-xl text-text-secondary">
            {t('landing.testimonials.subtitle')}
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Testimonials carousel */}
          <div className="relative">
            <div className="flex transition-transform duration-500 ease-in-out"
                 style={{ transform: `translateX(-${activeTestimonial * 100}%)` }}>
              {testimonials.map((testimonial, index) => (
                <div key={testimonial.key} className="w-full flex-shrink-0 px-4">
                  <div className={`bg-gradient-to-br ${testimonial.bgColor} rounded-2xl p-12 relative`}>
                    {/* Quote icon */}
                    <div className="absolute top-8 left-8 text-6xl text-text-muted opacity-50">
                      &ldquo;
                    </div>

                    {/* Testimonial content */}
                    <div className="relative z-10">
                      <p className="text-2xl font-medium text-text-primary mb-8 leading-relaxed">
                        {t(`landing.testimonials.${testimonial.key}.quote`)}
                      </p>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-text-primary text-lg">
                            {t(`landing.testimonials.${testimonial.key}.author`)}
                          </div>
                          <div className="text-text-secondary">
                            {t(`landing.testimonials.${testimonial.key}.role`)}
                          </div>
                          <div className="text-text-muted text-sm mt-1">
                            {t(`landing.testimonials.${testimonial.key}.company`)}
                          </div>
                        </div>

                        <div className="text-5xl opacity-20">
                          {testimonial.logo}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation dots */}
            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === activeTestimonial
                      ? 'bg-blue-600 w-8'
                      : 'bg-border hover:bg-text-muted'
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Company logos */}
          <div className="mt-16">
            <p className="text-center text-text-muted mb-8">
              {t('landing.testimonials.companies')}
            </p>
            <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
              {['Tech Corp', 'Soft Solutions', 'Data Systems', 'Cloud Works', 'Security Plus'].map((company, index) => (
                <div key={index} className="text-text-muted font-semibold text-lg">
                  {company}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}