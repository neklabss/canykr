import { directoryPage } from '@/lib/directory-page';

const { generateMetadata, Page } = directoryPage('nav.jobs', '/jobs');
export { generateMetadata };
export default Page;
