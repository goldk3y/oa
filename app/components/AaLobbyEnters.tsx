"use client";

import { gql, useQuery } from '@apollo/client';
import { XfLobbyEntersQuery } from '../types/hex';
import { useState, useEffect, useRef, useMemo } from 'react';

const GET_XF_LOBBY_ENTERS_BASE = gql`
  query GetXfLobbyEnters($first: Int!, $orderBy: String!, $orderDirection: String!, $minAmount: String!, $skip: Int!) {
    xfLobbyEnters(
      first: $first
      orderBy: $orderBy
      orderDirection: $orderDirection
      skip: $skip
      where: {
        rawAmount_gt: $minAmount
      }
    ) {
      id
      enterDay
      entryId
      memberAddr
      rawAmount
      timestamp
      transactionHash
      referrerAddr
    }
  }
`;

const GET_XF_LOBBY_ENTERS_WITH_ADDRESSES = gql`
  query GetXfLobbyEntersWithAddresses($first: Int!, $orderBy: String!, $orderDirection: String!, $minAmount: String!, $skip: Int!, $memberAddresses: [String!]!) {
    xfLobbyEnters(
      first: $first
      orderBy: $orderBy
      orderDirection: $orderDirection
      skip: $skip
      where: {
        rawAmount_gt: $minAmount
        memberAddr_in: $memberAddresses
      }
    ) {
      id
      enterDay
      entryId
      memberAddr
      rawAmount
      timestamp
      transactionHash
      referrerAddr
    }
  }
`;

export default function XfLobbyEnters() {
  const [limit, setLimit] = useState(10);
  const [minAmount, setMinAmount] = useState("500");
  const [orderBy, setOrderBy] = useState("rawAmount");
  const [orderDirection, setOrderDirection] = useState("desc");
  const [skip, setSkip] = useState(0);
  const [memberAddresses, setMemberAddresses] = useState<string>("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setSelectedAddressId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const addresses = useMemo(() => {
    if (!memberAddresses) return [];
    return memberAddresses
      .split(',')
      .map(addr => addr.trim().toLowerCase())
      .filter(addr => addr.length === 42 && addr.startsWith('0x'));
  }, [memberAddresses]);

  const queryVariables = {
    first: limit,
    orderBy,
    orderDirection,
    minAmount,
    skip,
    ...(addresses.length > 0 && { memberAddresses: addresses })
  };

  useEffect(() => {
    if (memberAddresses && !addresses.length) {
      console.warn('Invalid address format. Please enter valid Ethereum addresses.');
    }
  }, [memberAddresses, addresses]);

  const { loading, error, data } = useQuery<XfLobbyEntersQuery>(
    addresses.length > 0 ? GET_XF_LOBBY_ENTERS_WITH_ADDRESSES : GET_XF_LOBBY_ENTERS_BASE,
    {
      variables: queryVariables
    }
  );

  const handleNextPage = () => {
    setSkip(prev => prev + limit);
  };

  const handlePrevPage = () => {
    setSkip(prev => Math.max(0, prev - limit));
  };

  const formatAmount = (rawAmount: string) => {
    const ethAmount = Number(rawAmount) / Math.pow(10, 18);
    return ethAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const calculateTotalEth = () => {
    if (!data?.xfLobbyEnters) return 0;
    const totalWei = data.xfLobbyEnters.reduce((sum, enter) => {
      return sum + BigInt(enter.rawAmount);
    }, BigInt(0));
    return Number(totalWei) / Math.pow(10, 18);
  };

  const handleAddressSearch = (address: string) => {
    setMemberAddresses(address);
    setSelectedAddressId(null);
  };

  const getExternalLink = (address: string, service: 'etherscan' | 'arkham' | 'debank' | 'hexscout') => {
    const links = {
      etherscan: `https://etherscan.io/address/${address}`,
      arkham: `https://intel.arkm.com/explorer/address/${address}`,
      debank: `https://debank.com/profile/${address}`,
      hexscout: `https://hexscout.com/${address}`
    };
    return links[service];
  };

  if (error) return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
      Error: {error.message}
    </div>
  );

  return (
    <div className="w-full max-w-4xl space-y-6 p-6 bg-white dark:bg-black/20 rounded-xl shadow-sm">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">AA Lobby Enters</h2>
      </div>

      {data?.xfLobbyEnters && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="space-y-3">
            {addresses.length > 0 && (
              <div className="font-mono text-sm text-blue-700 dark:text-blue-300 truncate">
                {addresses.length === 1 
                  ? addresses[0]
                  : `${addresses.length} Addresses Selected`
                }
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Total ETH:
                </span>
                <span className="block font-mono font-bold text-blue-700 dark:text-blue-300">
                  {calculateTotalEth().toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })} ETH
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Total Transactions:
                </span>
                <span className="block font-mono font-bold text-blue-700 dark:text-blue-300">
                  {data.xfLobbyEnters.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1 lg:col-span-2">
          <label className="text-sm font-medium">Addresses (comma-separated)</label>
          <div className="relative">
            <input
              type="text"
              value={memberAddresses}
              onChange={(e) => setMemberAddresses(e.target.value)}
              placeholder="0x123..., 0x456..."
              className="w-full px-3 py-2 pr-8 border rounded-lg dark:bg-gray-800 dark:border-gray-700 font-mono text-sm"
            />
            {memberAddresses && (
              <button
                onClick={() => setMemberAddresses('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear addresses"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                    clipRule="evenodd" 
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Minimum Amount (ETH)</label>
          <input
            type="number"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Results Per Page</label>
          <input
            type="number"
            value={limit}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value < 10) {
                setLimit(10);
              } else if (value > 1000) {
                setLimit(1000);
              } else {
                setLimit(value);
              }
            }}
            min="10"
            max="1000"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Min: 10, Max: 1,000
          </p>
        </div>
        <div className="space-y-1 lg:col-span-2">
          <label className="text-sm font-medium">Order By</label>
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="rawAmount">Amount</option>
            <option value="timestamp">Timestamp</option>
            <option value="enterDay">Enter Day</option>
            <option value="entryId">Entry ID</option>
          </select>
        </div>
        <div className="space-y-1 lg:col-span-2">
          <label className="text-sm font-medium">Order Direction</label>
          <select
            value={orderDirection}
            onChange={(e) => setOrderDirection(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-lg"/>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {data?.xfLobbyEnters.map((enter) => (
                <div key={enter.id} className="p-4 border rounded-lg dark:border-gray-800 hover:border-blue-500 transition-colors">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Amount</p>
                      <p className="font-mono font-medium">{formatAmount(enter.rawAmount)} ETH</p>
                    </div>
                    <div className="relative">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Member Address</p>
                      <button
                        onClick={() => setSelectedAddressId(selectedAddressId === enter.id ? null : enter.id)}
                        className="font-mono text-sm truncate text-blue-500 hover:text-blue-600 transition-colors hover:underline w-full text-left"
                      >
                        {enter.memberAddr}
                      </button>
                      
                      {/* Tooltip Menu */}
                      {selectedAddressId === enter.id && (
                        <div 
                          ref={tooltipRef}
                          className="absolute z-10 mt-1 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5"
                        >
                          <div className="py-1" role="menu" aria-orientation="vertical">
                            <button
                              onClick={() => handleAddressSearch(enter.memberAddr)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              role="menuitem"
                            >
                              Search
                            </button>
                            <a
                              href={getExternalLink(enter.memberAddr, 'etherscan')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              role="menuitem"
                            >
                              Etherscan
                            </a>
                            <a
                              href={getExternalLink(enter.memberAddr, 'arkham')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              role="menuitem"
                            >
                              Arkham
                            </a>
                            <a
                              href={getExternalLink(enter.memberAddr, 'debank')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              role="menuitem"
                            >
                              DeBank
                            </a>
                            <a
                              href={getExternalLink(enter.memberAddr, 'hexscout')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              role="menuitem"
                            >
                              HEXScout
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Enter Day</p>
                      <p className="font-mono">{enter.enterDay}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Entry ID</p>
                      <p className="font-mono">{enter.entryId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Timestamp</p>
                      <p>{new Date(parseInt(enter.timestamp) * 1000).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t dark:border-gray-800">
                    <a 
                      href={`https://etherscan.io/tx/${enter.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
                    >
                      View Transaction →
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4">
              <button
                onClick={handlePrevPage}
                disabled={skip === 0}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous Page
              </button>
              <button
                onClick={handleNextPage}
                disabled={!data?.xfLobbyEnters.length}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Page
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 