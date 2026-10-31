import { lazy } from 'react';
import { config } from '../config';
import PreviewCheckout from './PreviewCheckout';

const ConnectedCheckout = lazy(() => import('./ConnectedCheckout'));

export default function Checkout() {
  return config.preview ? <PreviewCheckout /> : <ConnectedCheckout />;
}
