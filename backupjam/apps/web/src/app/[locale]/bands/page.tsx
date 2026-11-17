import { directoryPage } from '@/lib/directory-page';

const { generateMetadata, Page } = directoryPage('nav.bands', '/bands');
export { generateMetadata };
export default Page;
