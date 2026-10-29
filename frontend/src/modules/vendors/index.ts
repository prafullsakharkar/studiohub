// Public boundary for the vendors module.
// External code imports from '@/modules/vendors', never deep paths.
export { VendorsPage } from './pages/VendorsPage';
export { VendorCreatePage } from './pages/VendorCreatePage';
export { VendorEditPage } from './pages/VendorEditPage';
export { VendorWorkspacePage } from './pages/VendorWorkspacePage';
export {
  useVendors,
  useVendor,
  useVendorMutations,
  VENDORS_QUERY_KEYS,
} from './hooks/useVendorsData';
export { VendorSelect } from './components/VendorSelect';
