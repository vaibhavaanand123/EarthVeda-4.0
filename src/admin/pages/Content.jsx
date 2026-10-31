import { useState } from 'react';
import { adminApi } from '../adminApi';
import { ErrorNote, PageHead, useAction, useLoad } from '../ui';

/** Brand story shown on the home page and on "Our story". */
export default function Content() {
  const { data, error } = useLoad(() => adminApi.settings(), []);
  if (error) return <ErrorNote message={error} />;
  if (!data) return <p>Loading…</p>;
  return <StoryEditor initialStory={data.settings.story} />;
}

function StoryEditor({ initialStory }) {
  const action = useAction();
  const [story, setStory] = useState(initialStory);
  const [saved, setSaved] = useState(false);

  const set = (lang, key, value) => {
    setSaved(false);
    setStory((s) => ({ ...s, [lang]: { ...s[lang], [key]: value } }));
  };
  const save = async (e) => {
    e.preventDefault();
    const clean = {
      ...story,
      de: { ...story.de, paragraphs: story.de.paragraphs.map((p) => p.trim()).filter(Boolean) },
      en: { ...story.en, paragraphs: story.en.paragraphs.map((p) => p.trim()).filter(Boolean) },
    };
    if (await action.run(() => adminApi.saveSetting('story', clean))) {
      setStory(clean);
      setSaved(true);
    }
  };

  return (
    <form onSubmit={save}>
      <PageHead title="Our story">
        <button className="adm-btn" type="submit" disabled={action.busy}>
          Save story
        </button>
      </PageHead>
      <ErrorNote message={action.error} />
      {saved && <p className="adm-ok">Saved. The story is live.</p>}
      {story.isPlaceholder && (
        <p className="adm-warnbox">
          This is placeholder text. Replace it with the story from your brand PDF, then untick
          "placeholder" below.
        </p>
      )}
      <label className="adm-check">
        <input
          type="checkbox"
          checked={story.isPlaceholder}
          onChange={(e) => setStory((s) => ({ ...s, isPlaceholder: e.target.checked }))}
        />{' '}
        Still placeholder text
      </label>
      <div className="adm-two">
        {['de', 'en'].map((lang) => (
          <section key={lang} className="adm-card adm-form">
            <h2>{lang === 'de' ? 'Deutsch' : 'English'}</h2>
            <label>
              Small heading
              <input
                value={story[lang].eyebrow}
                onChange={(e) => set(lang, 'eyebrow', e.target.value)}
                required
              />
            </label>
            <label>
              Title
              <input
                value={story[lang].title}
                onChange={(e) => set(lang, 'title', e.target.value)}
                required
              />
            </label>
            <label>
              Story (blank line between paragraphs; the first two show on the home page)
              <textarea
                rows={14}
                value={story[lang].paragraphs.join('\n\n')}
                onChange={(e) => set(lang, 'paragraphs', e.target.value.split(/\n\s*\n/))}
                required
              />
            </label>
            <label>
              Signature
              <input
                value={story[lang].signature}
                onChange={(e) => set(lang, 'signature', e.target.value)}
              />
            </label>
          </section>
        ))}
      </div>
    </form>
  );
}
