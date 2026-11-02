import { directoryPage } from '@/lib/directory-page';

const { generateMetadata, Page } = directoryPage('nav.musicians', '/musicians');
export { generateMetadata };
export default Page;
