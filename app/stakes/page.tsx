'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { gql, useQuery } from '@apollo/client';
import { StakeStartsQuery, StakeStart } from '../types/hex';

const GET_STAKES_DATA = gql`
  query GetStakesData(
    $first: Int!
    $skip: Int!
    $timestampFrom: BigInt!
    $orderBy: String!
    $orderDirection: String!
  ) {
    stakeStarts(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { timestamp_gt: $timestampFrom }
    ) {
      id
      stakerAddr
      stakeId
      stakedHearts
      stakeShares
      stakeTShares
      stakedDays
      startDay
      endDay
      timestamp
      isAutoStake
      transactionHash
      stakeEnd {
        id
        payout
        penalty
        servedDays
        daysLate
        daysEarly
        timestamp
        transactionHash
      }
    }
  }
`;

type SortField = 'start' | 'expEnd' | 'days' | 'hexStaked' | 'tShares' | 'stakeEnded' | 
                 'yield' | 'minted' | 'roi' | 'daysServed' | 'earlyLate' | 'penalty';
type SortDirection = 'asc' | 'desc';

const HEX_LAUNCH_TIMESTAMP = 1575331200; // December 3, 2019 UTC
const SECONDS_PER_DAY = 86400;

export default function StakesPage() {
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [searchAddress, setSearchAddress] = useState("");

  // Date range states
  const [startDateRange, setStartDateRange] = useState({
    from: '2019-12-03',
    to: new Date().toISOString().split('T')[0]
  });

  const [endDateRange, setEndDateRange] = useState({
    from: '2019-12-03',
    to: '2050-01-01'
  });

  // Add new state for status filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all');

  // Add these states
  const [sortField, setSortField] = useState<SortField>('start');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Add this state near the top of the component with other state declarations
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Add this effect to handle clicking outside the tooltip
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

  // Add sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // First define the mapping between our UI sort fields and GraphQL fields
  const sortFieldMapping: Record<SortField, string> = {
    start: 'timestamp',
    expEnd: 'endDay',
    days: 'stakedDays',
    hexStaked: 'stakedHearts',
    tShares: 'stakeTShares',
    stakeEnded: 'stakeEnd__timestamp', // Using double underscore for nested field
    yield: 'stakeEnd__payout',
    minted: 'stakedHearts', // We'll handle this in client-side sorting
    roi: 'stakeEnd__payout', // We'll handle this in client-side sorting
    daysServed: 'stakeEnd__servedDays',
    earlyLate: 'stakeEnd__daysLate', // We'll use daysLate as primary sort
    penalty: 'stakeEnd__penalty'
  };

  // Update query variables to use the mapped field
  const queryVariables = {
    first: limit,
    skip,
    timestampFrom: Math.floor(new Date(startDateRange.from).getTime() / 1000),
    orderBy: sortFieldMapping[sortField] || 'timestamp', // Fallback to timestamp if mapping not found
    orderDirection: sortDirection
  };

  // Execute the query with error logging
  const { loading, error, data } = useQuery<StakeStartsQuery>(GET_STAKES_DATA, {
    variables: queryVariables,
    onError: (error) => {
      console.error('GraphQL Error Details:', error);
    },
    onCompleted: (data) => {
      // Log detailed raw data
      console.log('Raw Stake Data:', {
        totalStakes: data?.stakeStarts?.length,
        firstStake: data?.stakeStarts?.[0] && {
          // Basic stake info
          id: data.stakeStarts[0].id,
          stakerAddr: data.stakeStarts[0].stakerAddr,
          timestamp: data.stakeStarts[0].timestamp,
          stakedHearts: data.stakeStarts[0].stakedHearts,
          stakeTShares: data.stakeStarts[0].stakeTShares,
          stakedDays: data.stakeStarts[0].stakedDays,
          
          // End stake info if exists
          stakeEnd: data.stakeStarts[0].stakeEnd && {
            payout: data.stakeStarts[0].stakeEnd.payout,
            penalty: data.stakeStarts[0].stakeEnd.penalty,
            servedDays: data.stakeStarts[0].stakeEnd.servedDays,
            daysEarly: data.stakeStarts[0].stakeEnd.daysEarly,
            daysLate: data.stakeStarts[0].stakeEnd.daysLate,
            timestamp: data.stakeStarts[0].stakeEnd.timestamp
          }
        },
        // Log all stakes in raw form
        allStakes: data?.stakeStarts?.map(stake => ({
          raw: stake,
          formatted: {
            stakedHEX: parseFloat(stake.stakedHearts) / 100000000,
            tShares: parseFloat(stake.stakeTShares) / 1e12,
            startDate: new Date(parseInt(stake.timestamp) * 1000).toISOString(),
            endDate: new Date(parseInt(stake.endDay) * 1000).toISOString()
          }
        }))
      });
    }
  });

  // First filter the stakes based on all criteria
  const filteredStakes = useMemo(() => {
    if (!data?.stakeStarts) return [];
    
    return data.stakeStarts.filter(stake => {
      // Status filter
      if (statusFilter === 'active' && stake.stakeEnd) return false;
      if (statusFilter === 'ended' && !stake.stakeEnd) return false;

      // Address filter
      if (searchAddress.trim() && !stake.stakerAddr.toLowerCase().includes(searchAddress.toLowerCase())) {
        return false;
      }

      // Start date filter
      const startTimestamp = parseInt(stake.timestamp);
      const startFrom = Math.floor(new Date(startDateRange.from).getTime() / 1000);
      const startTo = Math.floor(new Date(startDateRange.to).getTime() / 1000);
      if (startTimestamp < startFrom || startTimestamp > startTo) return false;

      // End date filter
      const endTimestamp = HEX_LAUNCH_TIMESTAMP + (parseInt(stake.endDay) * SECONDS_PER_DAY);
      const endFrom = Math.floor(new Date(endDateRange.from).getTime() / 1000);
      const endTo = Math.floor(new Date(endDateRange.to).getTime() / 1000);
      if (endTimestamp < endFrom || endTimestamp > endTo) return false;

      return true;
    });
  }, [data?.stakeStarts, statusFilter, searchAddress, startDateRange, endDateRange]);

  // Add sorted stakes
  const sortedStakes = useMemo(() => {
    return [...filteredStakes].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      switch (sortField) {
        case 'start':
          return (parseInt(a.timestamp) - parseInt(b.timestamp)) * direction;
        case 'expEnd':
          const getEndTimestamp = (stake: StakeStart) => 
            HEX_LAUNCH_TIMESTAMP + (parseInt(stake.endDay) * SECONDS_PER_DAY);
          return (getEndTimestamp(a) - getEndTimestamp(b)) * direction;
        case 'days':
          return (parseInt(a.stakedDays) - parseInt(b.stakedDays)) * direction;
        case 'hexStaked':
          return (parseFloat(a.stakedHearts) - parseFloat(b.stakedHearts)) * direction;
        case 'tShares':
          return (parseFloat(a.stakeTShares) - parseFloat(b.stakeTShares)) * direction;
        case 'stakeEnded':
          return ((a.stakeEnd?.timestamp || '0').localeCompare(b.stakeEnd?.timestamp || '0')) * direction;
        case 'yield':
          return ((parseFloat(a.stakeEnd?.payout || '0') - parseFloat(b.stakeEnd?.payout || '0'))) * direction;
        case 'minted':
          const mintedA = parseFloat(a.stakeEnd?.payout || '0') + parseFloat(a.stakedHearts);
          const mintedB = parseFloat(b.stakeEnd?.payout || '0') + parseFloat(b.stakedHearts);
          return (mintedA - mintedB) * direction;
        case 'roi':
          const aStaked = parseFloat(a.stakedHearts);
          const bStaked = parseFloat(b.stakedHearts);
          const roiMintedA = a.stakeEnd ? parseFloat(a.stakeEnd.payout) + aStaked : 0;
          const roiMintedB = b.stakeEnd ? parseFloat(b.stakeEnd.payout) + bStaked : 0;
          const aRoi = a.stakeEnd ? ((roiMintedA - aStaked) / aStaked) : 0;
          const bRoi = b.stakeEnd ? ((roiMintedB - bStaked) / bStaked) : 0;
          return (aRoi - bRoi) * direction;
        case 'daysServed':
          return (parseInt(a.stakeEnd?.servedDays || '0') - parseInt(b.stakeEnd?.servedDays || '0')) * direction;
        case 'earlyLate':
          const aEL = parseInt(a.stakeEnd?.daysLate || '0') - parseInt(a.stakeEnd?.daysEarly || '0');
          const bEL = parseInt(b.stakeEnd?.daysLate || '0') - parseInt(b.stakeEnd?.daysEarly || '0');
          return (aEL - bEL) * direction;
        case 'penalty':
          return (parseFloat(a.stakeEnd?.penalty || '0') - parseFloat(b.stakeEnd?.penalty || '0')) * direction;
        default:
          return 0;
      }
    });
  }, [filteredStakes, sortField, sortDirection]);

  return (
    <main className="px-4 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-black/20 rounded-xl shadow-sm p-6">
          <h1 className="text-3xl font-bold mb-6">Stakes Analysis</h1>
          
          {/* Filters Section */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Filters</h2>
            
            {/* Date Filters Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Start Date Range */}
              <div className="bg-white dark:bg-black/20 rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Start Date Range</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">From</label>
                    <input
                      type="date"
                      min="2019-12-03"
                      max={new Date().toISOString().split('T')[0]}
                      value={startDateRange.from}
                      onChange={(e) => setStartDateRange(prev => ({ ...prev, from: e.target.value }))}
                      className="w-full p-2 border dark:border-gray-600 rounded bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input
                      type="date"
                      min="2019-12-03"
                      max={new Date().toISOString().split('T')[0]}
                      value={startDateRange.to}
                      onChange={(e) => setStartDateRange(prev => ({ ...prev, to: e.target.value }))}
                      className="w-full p-2 border dark:border-gray-600 rounded bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Expected End Date Range */}
              <div className="bg-white dark:bg-black/20 rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Expected End Date Range</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">From</label>
                    <input
                      type="date"
                      min="2019-12-03"
                      value={endDateRange.from}
                      onChange={(e) => setEndDateRange(prev => ({ ...prev, from: e.target.value }))}
                      className="w-full p-2 border dark:border-gray-600 rounded bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input
                      type="date"
                      min="2019-12-03"
                      value={endDateRange.to}
                      onChange={(e) => setEndDateRange(prev => ({ ...prev, to: e.target.value }))}
                      className="w-full p-2 border dark:border-gray-600 rounded bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Address Search */}
              <div className="bg-white dark:bg-black/20 rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Search Address</h3>
                <input
                  type="text"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  placeholder="Enter address..."
                  className="w-full p-2 border dark:border-gray-600 rounded bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Status Filter */}
              <div className="bg-white dark:bg-black/20 rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Status</h3>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'ended')}
                  className="w-full p-2 border dark:border-gray-600 rounded bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="all">All Stakes</option>
                  <option value="active">Active Only</option>
                  <option value="ended">Ended Only</option>
                </select>
              </div>

              {/* Results Per Page */}
              <div className="bg-white dark:bg-black/20 rounded-lg p-4 shadow-sm">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Results Per Page</h3>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  step="10"
                  value={limit}
                  onChange={(e) => {
                    const value = Math.min(1000, Math.max(10, parseInt(e.target.value) || 10));
                    setLimit(value);
                    setSkip(0);
                  }}
                  className="w-full p-2 border dark:border-gray-600 rounded bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          {/* Loading and Error States */}
          {loading && <div className="text-center py-4">Loading...</div>}
          {error && <div className="text-center py-4 text-red-500">Error: {error.message}</div>}

          {/* Table */}
          {data?.stakeStarts && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="px-3 py-1.5 text-left whitespace-nowrap">Address</th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('start')}>
                      Start {sortField === 'start' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('expEnd')}>
                      Exp. End {sortField === 'expEnd' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('days')}>
                      Days {sortField === 'days' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('hexStaked')}>
                      HEX Staked {sortField === 'hexStaked' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('tShares')}>
                      T-Shares {sortField === 'tShares' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('stakeEnded')}>
                      Stake Ended {sortField === 'stakeEnded' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('yield')}>
                      Yield {sortField === 'yield' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('minted')}>
                      Minted {sortField === 'minted' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('roi')}>
                      ROI {sortField === 'roi' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('daysServed')}>
                      Days Served {sortField === 'daysServed' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('earlyLate')}>
                      Early/Late {sortField === 'earlyLate' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap cursor-pointer hover:text-blue-500" onClick={() => handleSort('penalty')}>
                      Penalty {sortField === 'penalty' && (sortDirection === 'desc' ? '↓' : '↑')}
                    </th>
                    <th className="px-3 py-1.5 text-left whitespace-nowrap">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStakes.map((stake) => (
                    <tr key={stake.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-1.5 font-mono relative">
                        <button
                          onClick={() => setSelectedAddressId(selectedAddressId === stake.id ? null : stake.id)}
                          className="font-mono text-sm text-blue-500 hover:text-blue-600 transition-colors hover:underline"
                        >
                          {`${stake.stakerAddr.slice(0, 6)}...${stake.stakerAddr.slice(-4)}`}
                        </button>
                        
                        {/* Tooltip Menu */}
                        {selectedAddressId === stake.id && (
                          <div 
                            ref={tooltipRef}
                            className="absolute z-10 mt-1 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5"
                          >
                            <div className="py-1" role="menu" aria-orientation="vertical">
                              <button
                                onClick={() => {
                                  setSearchAddress(stake.stakerAddr);
                                  setSelectedAddressId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                role="menuitem"
                              >
                                Search
                              </button>
                              <a
                                href={`https://scan.pulsechain.com/address/${stake.stakerAddr}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                role="menuitem"
                              >
                                PulseScan
                              </a>
                              <a
                                href={`https://hexscout.com/${stake.stakerAddr}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                role="menuitem"
                              >
                                HexScout
                              </a>
                              <a
                                href={`https://arkham.intelligence/address/${stake.stakerAddr}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                role="menuitem"
                              >
                                Arkham
                              </a>
                              <a
                                href={`https://debank.com/profile/${stake.stakerAddr}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                role="menuitem"
                              >
                                DeBank
                              </a>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5">{new Date(parseInt(stake.timestamp) * 1000).toLocaleDateString()}</td>
                      <td className="px-3 py-1.5">
                        {new Date((HEX_LAUNCH_TIMESTAMP + (parseInt(stake.endDay) * SECONDS_PER_DAY)) * 1000).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-1.5">{stake.stakedDays}</td>
                      <td className="px-3 py-1.5">{(parseFloat(stake.stakedHearts) / 100000000).toLocaleString()}</td>
                      <td className="px-3 py-1.5">{parseFloat(stake.stakeTShares).toFixed(2)}</td>
                      <td className="px-3 py-1.5">{stake.stakeEnd ? new Date(parseInt(stake.stakeEnd.timestamp) * 1000).toLocaleDateString() : '-'}</td>
                      <td className="px-3 py-1.5">
                        {stake.stakeEnd ? 
                          (parseFloat(stake.stakeEnd.payout) / 100000000).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }) 
                          : '-'}
                      </td>
                      <td className="px-3 py-1.5">
                        {stake.stakeEnd ? 
                          ((parseFloat(stake.stakeEnd.payout) + parseFloat(stake.stakedHearts)) / 100000000).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }) 
                          : '-'}
                      </td>
                      <td className="px-3 py-1.5">
                        {stake.stakeEnd ? 
                          `${(((parseFloat(stake.stakeEnd.payout) + parseFloat(stake.stakedHearts) - parseFloat(stake.stakedHearts)) / parseFloat(stake.stakedHearts)) * 100).toFixed(2)}%` 
                          : '-'}
                      </td>
                      <td className="px-3 py-1.5">{stake.stakeEnd ? stake.stakeEnd.servedDays : '-'}</td>
                      <td className="px-3 py-1.5">
                        {stake.stakeEnd ? 
                          parseFloat(stake.stakeEnd.daysEarly) > 0 ? 
                            <span className="text-red-500">-{stake.stakeEnd.daysEarly}d</span> : 
                            parseFloat(stake.stakeEnd.daysLate) > 0 ? 
                              <span className="text-yellow-500">+{stake.stakeEnd.daysLate}d</span> : 
                              <span className="text-green-500">On time</span>
                          : '-'}
                      </td>
                      <td className="px-3 py-1.5">
                        {stake.stakeEnd ? 
                          (parseFloat(stake.stakeEnd.penalty) / 100000000).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }) 
                          : '-'}
                      </td>
                      <td className="px-3 py-1.5">{stake.stakeEnd ? new Date(parseInt(stake.stakeEnd.timestamp) * 1000).toLocaleDateString() : '-'}</td>
                      <td className="px-3 py-1.5">
                        <a 
                          href={`https://scan.pulsechain.com/tx/${stake.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 font-mono text-xs"
                        >
                          {`${stake.transactionHash.slice(0, 6)}...${stake.transactionHash.slice(-4)}`}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}