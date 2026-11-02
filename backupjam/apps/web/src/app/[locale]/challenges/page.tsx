import { directoryPage } from '@/lib/directory-page';

const { generateMetadata, Page } = directoryPage('nav.challenges', '/challenges');
export { generateMetadata };
export default Page;
