import { useEffect, useMemo, useState, useCallback } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Contract } from 'ethers';
import { useAccount, usePublicClient } from 'wagmi';
import { sepolia } from 'wagmi/chains';

import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { GameBoard } from './GameBoard';
import './GameApp.css';

type Position = {
  x: number;
  y: number;
};

type EncryptedPosition = {
  x: string;
  y: string;
};

const DIRECTIONS: Record<string, { label: string; value: number }> = {
  up: { label: 'Up', value: 0 },
  right: { label: 'Right', value: 3 },
  down: { label: 'Down', value: 1 },
  left: { label: 'Left', value: 2 },
};

export function GameApp() {
  const { address, isConnecting, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { instance, isLoading: isZamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [gridSize, setGridSize] = useState<number>(10);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [encryptedPosition, setEncryptedPosition] = useState<EncryptedPosition | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const contractConfigured = useMemo(() => CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000', []);

  useEffect(() => {
    let ignore = false;
    const loadGridSize = async () => {
      if (!publicClient) {
        return;
      }
      try {
        const raw = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'gridSize',
        });

        if (!ignore && Array.isArray(raw)) {
          const [maxX] = raw as Array<number | bigint>;
          setGridSize(Number(maxX));
        }
      } catch (error) {
        console.error('Failed to fetch grid size', error);
      }
    };

    loadGridSize();

    return () => {
      ignore = true;
    };
  }, [publicClient]);

  useEffect(() => {
    let cancelled = false;

    const loadPlayerState = async () => {
      if (!publicClient || !address) {
        if (!cancelled) {
          setIsJoined(false);
          setEncryptedPosition(null);
          setPosition(null);
        }
        return;
      }

      try {
        const joined = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'hasJoined',
          args: [address],
        })) as boolean;

        if (cancelled) {
          return;
        }

        setIsJoined(Boolean(joined));
        if (!joined) {
          setEncryptedPosition(null);
          setPosition(null);
          return;
        }

        const [encX, encY] = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getPlayerPosition',
          args: [address],
        })) as readonly [string, string];

        if (!cancelled) {
          setEncryptedPosition({ x: encX, y: encY });
        }
      } catch (error) {
        console.error('Failed to load player state', error);
        if (!cancelled) {
          setActionError('Failed to load player state.');
        }
      }
    };

    loadPlayerState();

    return () => {
      cancelled = true;
    };
  }, [publicClient, address, refreshIndex]);

  useEffect(() => {
    let cancelled = false;

    const decryptPosition = async () => {
      if (!encryptedPosition || !instance || !address || !signerPromise) {
        return;
      }

      try {
        setIsDecrypting(true);
        setActionError(null);

        const keypair = instance.generateKeypair();
        const contractAddresses = [CONTRACT_ADDRESS];
        const startTimestamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = '7';

        const eip712 = instance.createEIP712(
          keypair.publicKey,
          contractAddresses,
          startTimestamp,
          durationDays
        );

        const signer = await signerPromise;
        if (!signer) {
          throw new Error('Wallet signer is unavailable');
        }

        const signature = await signer.signTypedData(
          eip712.domain,
          { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
          eip712.message
        );

        const result = await instance.userDecrypt(
          [
            { handle: encryptedPosition.x, contractAddress: CONTRACT_ADDRESS },
            { handle: encryptedPosition.y, contractAddress: CONTRACT_ADDRESS },
          ],
          keypair.privateKey,
          keypair.publicKey,
          signature.replace('0x', ''),
          contractAddresses,
          address,
          startTimestamp,
          durationDays
        );

        if (cancelled) {
          return;
        }

        const parsedX = Number(result[encryptedPosition.x]);
        const parsedY = Number(result[encryptedPosition.y]);

        if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY)) {
          throw new Error('Decryption did not return numeric coordinates');
        }

        setPosition({ x: parsedX, y: parsedY });
      } catch (error) {
        console.error('Failed to decrypt position', error);
        if (!cancelled) {
          setActionError('Failed to decrypt player position.');
        }
      } finally {
        if (!cancelled) {
          setIsDecrypting(false);
        }
      }
    };

    decryptPosition();

    return () => {
      cancelled = true;
    };
  }, [encryptedPosition, instance, address, signerPromise]);

  const handleJoin = useCallback(async () => {
    if (!instance || !address || !signerPromise) {
      setActionError('Wallet connection and encryption service are required.');
      return;
    }

    try {
      setStatusMessage('Joining encrypted arena...');
      setActionError(null);

      const spawnX = Math.floor(Math.random() * gridSize) + 1;
      const spawnY = Math.floor(Math.random() * gridSize) + 1;

      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .add32(spawnX)
        .add32(spawnY)
        .encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer is unavailable');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.joinGame(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.inputProof
      );
      await tx.wait();

      setRefreshIndex((index: number) => index + 1);
    } catch (error) {
      console.error('Failed to join game', error);
      setActionError('Joining the game failed. Please retry.');
    } finally {
      setStatusMessage(null);
    }
  }, [instance, address, signerPromise, gridSize]);

  const handleMove = useCallback(
    async (directionKey: keyof typeof DIRECTIONS) => {
      if (!instance || !address || !signerPromise) {
        setActionError('Wallet connection and encryption service are required.');
        return;
      }

      try {
        const { value, label } = DIRECTIONS[directionKey];
        setStatusMessage(`Moving ${label.toLowerCase()}...`);
        setActionError(null);

        const encryptedInput = await instance
          .createEncryptedInput(CONTRACT_ADDRESS, address)
          .add32(value)
          .encrypt();

        const signer = await signerPromise;
        if (!signer) {
          throw new Error('Wallet signer is unavailable');
        }

        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const tx = await contract.move(encryptedInput.handles[0], encryptedInput.inputProof);
        await tx.wait();

        setRefreshIndex((index: number) => index + 1);
      } catch (error) {
        console.error('Failed to move player', error);
        setActionError('Movement failed. Please retry.');
      } finally {
        setStatusMessage(null);
      }
    },
    [instance, address, signerPromise]
  );

  const canInteract =
    isConnected && !isConnecting && !isZamaLoading && contractConfigured && !statusMessage;

  return (
    <div className="game-app">
      <header className="game-header">
        <div>
          <h1 className="game-title">Encrypted Empire</h1>
          <p className="game-subtitle">Explore a 10 × 10 grid where every move stays encrypted.</p>
        </div>
        <ConnectButton showBalance={false} />
      </header>

      {!contractConfigured && (
        <div className="alert alert-warning">
          Configure the deployed contract address inside <code>config/contracts.ts</code> to begin.
        </div>
      )}

      {zamaError && <div className="alert alert-error">{zamaError}</div>}

      {actionError && <div className="alert alert-error">{actionError}</div>}

      {statusMessage && <div className="alert alert-info">{statusMessage}</div>}

      <div className="game-content">
        <section className="board-section">
          <GameBoard gridSize={gridSize} playerPosition={position} />
          <div className="position-card">
            <h2>Current Position</h2>
            {isJoined && position ? (
              <div className="position-values">
                <div>
                  <span className="position-label">X</span>
                  <span className="position-number">{position.x}</span>
                </div>
                <div>
                  <span className="position-label">Y</span>
                  <span className="position-number">{position.y}</span>
                </div>
              </div>
            ) : (
              <p className="position-placeholder">
                {isConnecting && 'Connecting wallet...'}
                {!isConnecting && !isConnected && 'Connect your wallet to reveal coordinates.'}
                {isConnected && !isJoined && 'Join the game to receive encrypted coordinates.'}
              </p>
            )}
            {isDecrypting && <p className="position-hint">Decrypting coordinates...</p>}
          </div>
        </section>

        <section className="controls-section">
          <div className="panel-card">
            <h2>Actions</h2>
            <p className="panel-description">
              {isJoined
                ? 'Use encrypted moves to explore the battlefield.'
                : 'Spawn onto the encrypted battlefield with a randomized coordinate.'}
            </p>

            <div className="actions-stack">
              <button
                type="button"
                className="primary-button"
                onClick={handleJoin}
                disabled={!canInteract || isJoined}
              >
                {isJoined ? 'Already in game' : 'Join Game'}
              </button>

              <div className="move-grid">
                {(Object.keys(DIRECTIONS) as Array<keyof typeof DIRECTIONS>).map(directionKey => (
                  <button
                    key={directionKey}
                    type="button"
                    className="secondary-button"
                    disabled={!canInteract || !isJoined}
                    onClick={() => handleMove(directionKey)}
                  >
                    {DIRECTIONS[directionKey].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="panel-card info-card">
            <h2>How it Works</h2>
            <ul>
              <li>Coordinates live inside the contract as encrypted values.</li>
              <li>Only your wallet can decrypt your personal location.</li>
              <li>Each move sends an encrypted direction for private traversal.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
