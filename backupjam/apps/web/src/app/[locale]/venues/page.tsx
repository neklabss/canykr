import { directoryPage } from '@/lib/directory-page';

const { generateMetadata, Page } = directoryPage('nav.venues', '/venues');
export { generateMetadata };
export default Page;
