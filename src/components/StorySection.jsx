import { ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { L, useI18n } from '../i18n/LanguageContext';

/** Brand story, edited in Admin → Content. `full` shows every paragraph. */
export default function StorySection({ full = false, headingLevel = 2 }) {
  const { t } = useI18n();
  const { story } = useStore();
  if (!story) return null;
  const H = `h${headingLevel}`;
  const paragraphs = full ? story.paragraphs : story.paragraphs.slice(0, 2);
  return (
    <section className={`story${full ? ' story--full' : ''}`} aria-labelledby="story-title">
      <div className="container story__grid">
        <div className="story__mark" aria-hidden="true">
          <span className="story__seed" />
          <span className="story__seed" />
          <span className="story__seed" />
        </div>
        <div className="story__copy">
          <p className="eyebrow">{story.eyebrow}</p>
          <H id="story-title" className="story__title">
            {story.title}
          </H>
          {paragraphs.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
          {full && story.signature && <p className="story__signature">{story.signature}</p>}
          {!full && story.paragraphs.length > 2 && (
            <L to="story" className="link link--arrow">
              {t('home.storyCta')} <ArrowRight size={16} aria-hidden="true" />
            </L>
          )}
        </div>
      </div>
    </section>
  );
}
