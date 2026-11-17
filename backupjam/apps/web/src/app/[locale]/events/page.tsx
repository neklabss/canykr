import { directoryPage } from '@/lib/directory-page';

const { generateMetadata, Page } = directoryPage('nav.events', '/events');
export { generateMetadata };
export default Page;
