import Seo from '../components/Seo';
import StorySection from '../components/StorySection';
import { useStore } from '../context/StoreContext';
import StoreStatus from './StoreStatus';

export default function Story() {
  const store = useStore();
  if (store.loading || store.error) return <StoreStatus />;
  return (
    <main className="page">
      <Seo title={store.story?.title} description={store.story?.paragraphs?.[0]} />
      <StorySection full headingLevel={1} />
    </main>
  );
}
