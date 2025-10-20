import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

const projectId = import.meta.env.VITE_WALLETCONNECT_ID ?? '';

export const config = getDefaultConfig({
  appName: 'Encrypted Empire',
  projectId,
  chains: [sepolia],
  ssr: false,
});
