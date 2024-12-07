"use client";

import { useState, useEffect } from 'react';
import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface Transaction {
  to: string;
  hash?: string;
  amount: number;
  count: number;
  firstDate: Date;
  lastDate: Date;
}

interface TransactionSummary {
  [address: string]: Transaction;
}

interface DailyTotal {
  date: string;
  amount: number;
  cumulative: number;
}

const TARGET_ADDRESS = '0xDEC9f2793e3c17cd26eeFb21C4762fA5128E0399'.toLowerCase();

const abbreviateNumber = (value: number): string => {
  if (value >= 1000000) {
    return (value / 1000000).toLocaleString(undefined, { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }) + 'M';
  }
  if (value >= 1000) {
    return Math.round(value / 1000).toLocaleString() + 'K';
  }
  return value.toLocaleString();
};

const abbreviateAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function FlushTransactions() {
  const [summary, setSummary] = useState<TransactionSummary>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'amount' | 'count' | 'date'>('amount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [transactionType, setTransactionType] = useState<'send' | 'receive' | 'internal'>('send');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const csvFile = transactionType === 'internal' ? '/internal-trans.csv' : '/all-trans.csv';
    
    fetch(csvFile)
      .then(response => response.text())
      .then(csv => {
        const lines = csv.split('\n').slice(1);
        const transactionSummary: TransactionSummary = {};
        const dailyAmounts: { [key: string]: number } = {};

        lines.forEach((line) => {
          if (!line.trim()) return;
          
          if (transactionType === 'internal') {
            const cleanLine = line.replace(/^\d+\|/, '');
            const columns = cleanLine.split(',');
            if (columns.length < 11) return;
            
            const hash = columns[0].replace(/"/g, '');
            const amount = parseFloat(columns[10].replace(/"/g, '')) || 0;
            const timestamp = new Date(columns[3].replace(/"/g, ''));
            
            const transactionKey = hash;
            transactionSummary[transactionKey] = {
              to: '',
              hash,
              amount,
              count: 1,
              firstDate: timestamp,
              lastDate: timestamp
            };
            
            const dateKey = timestamp.toISOString().split('T')[0];
            dailyAmounts[dateKey] = (dailyAmounts[dateKey] || 0) + amount;
          } else {
            const cleanLine = line.replace(/^\d+\|/, '');
            const columns = cleanLine.split(',');
            if (columns.length < 15) return;
            
            const from = columns[4].replace(/"/g, '').toLowerCase();
            const to = columns[5].replace(/"/g, '').toLowerCase();
            const amount = parseFloat(columns[7].replace(/"/g, '')) || parseFloat(columns[8].replace(/"/g, '')) || 0;
            const timestamp = new Date(columns[3].replace(/"/g, ''));
            
            if (transactionType === 'send' && from === TARGET_ADDRESS && amount > 0) {
              processTransaction(from, to, amount, timestamp, transactionSummary, dailyAmounts);
            } else if (transactionType === 'receive' && to === TARGET_ADDRESS && amount > 0) {
              processTransaction(from, to, amount, timestamp, transactionSummary, dailyAmounts);
            }
          }
        });

        // Sort daily amounts and calculate cumulative
        const sortedDates = Object.keys(dailyAmounts).sort();
        let cumulative = 0;
        const dailyTotals: DailyTotal[] = sortedDates.map(date => {
          cumulative += dailyAmounts[date];
          return {
            date,
            amount: dailyAmounts[date],
            cumulative
          };
        });

        setSummary(transactionSummary);
        setDailyTotals(dailyTotals);
        if (isInitialLoading) {
          setIsInitialLoading(false);
        }
      })
      .catch(error => {
        console.error('Error loading transaction data:', error);
        if (isInitialLoading) {
          setIsInitialLoading(false);
        }
      });
  }, [transactionType, isInitialLoading]);

  // Helper function to process transactions
  function processTransaction(
    from: string,
    to: string,
    amount: number,
    timestamp: Date,
    transactionSummary: TransactionSummary,
    dailyAmounts: { [key: string]: number }
  ) {
    const addressKey = from === TARGET_ADDRESS ? to : from;
    
    if (!transactionSummary[addressKey]) {
      transactionSummary[addressKey] = {
        to: addressKey,
        amount: 0,
        count: 0,
        firstDate: timestamp,
        lastDate: timestamp
      };
    }

    transactionSummary[addressKey].amount += amount;
    transactionSummary[addressKey].count += 1;
    transactionSummary[addressKey].firstDate = new Date(Math.min(
      transactionSummary[addressKey].firstDate.getTime(),
      timestamp.getTime()
    ));
    transactionSummary[addressKey].lastDate = new Date(Math.max(
      transactionSummary[addressKey].lastDate.getTime(),
      timestamp.getTime()
    ));

    const dateKey = timestamp.toISOString().split('T')[0];
    dailyAmounts[dateKey] = (dailyAmounts[dateKey] || 0) + amount;
  }

  const toggleSort = (field: 'amount' | 'count' | 'date') => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const sortedTransactions = Object.values(summary).sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    if (sortBy === 'date') {
      return (a.lastDate.getTime() - b.lastDate.getTime()) * multiplier;
    }
    return (a[sortBy] - b[sortBy]) * multiplier;
  });

  const totalStats = {
    addresses: sortedTransactions.length,
    eth: sortedTransactions.reduce((sum, tx) => sum + tx.amount, 0)
  };

  // Only show skeleton on initial load
  if (isInitialLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full p-6 bg-white dark:bg-black/20 rounded-xl shadow-sm"
      >
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <motion.div 
          layout
          className="p-6 bg-white dark:bg-black/20 rounded-xl shadow-sm space-y-6"
        >
          <div className="relative">
            <div 
              className="cursor-pointer"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <h2 className="text-2xl font-bold">Flush Address</h2>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mt-1">
                {transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} Transactions
                <svg 
                  className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {isDropdownOpen && (
              <div className="absolute z-10 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  {(['send', 'receive', 'internal'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setTransactionType(type);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm ${
                        transactionType === type
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      role="menuitem"
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)} Transactions
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={transactionType}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Addresses</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {totalStats.addresses.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total ETH</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 font-mono">
                    {totalStats.eth.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="px-4 py-2 text-left">
                        {transactionType === 'internal' ? 'Hash' : 'Address'}
                      </th>
                      <th 
                        className="px-4 py-2 text-left cursor-pointer hover:text-blue-500" 
                        onClick={() => toggleSort('amount')}
                      >
                        Total ETH {sortBy === 'amount' && (sortDirection === 'desc' ? '↓' : '↑')}
                      </th>
                      {transactionType !== 'internal' && (
                        <th 
                          className="px-4 py-2 text-left cursor-pointer hover:text-blue-500" 
                          onClick={() => toggleSort('count')}
                        >
                          Count {sortBy === 'count' && (sortDirection === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      <th 
                        className="px-4 py-2 text-left cursor-pointer hover:text-blue-500" 
                        onClick={() => toggleSort('date')}
                      >
                        Date {sortBy === 'date' && (sortDirection === 'desc' ? '↓' : '↑')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="wait">
                      {!isInitialLoading && sortedTransactions.map((transaction, index) => (
                        <motion.tr
                          key={transactionType === 'internal' 
                            ? `internal-${transaction.hash}-${index}`
                            : `${transactionType}-${transaction.to}-${index}`
                          }
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ 
                            duration: 0.2, 
                            delay: index * 0.03,
                            ease: "easeOut"
                          }}
                          className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <td className="px-4 py-2 font-mono">
                            {transactionType === 'internal' ? (
                              <a
                                href={`https://etherscan.io/tx/${transaction.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-600 transition-colors"
                              >
                                {transaction.hash?.slice(0, 16)}...
                              </a>
                            ) : (
                              <a
                                href={`https://etherscan.io/address/${transaction.to}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-600 transition-colors"
                                title={transaction.to}
                              >
                                {abbreviateAddress(transaction.to)}
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-2 font-mono">
                            {transaction.amount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </td>
                          {transactionType !== 'internal' && (
                            <td className="px-4 py-2">{transaction.count.toLocaleString()}</td>
                          )}
                          <td className="px-4 py-2">
                            {transaction.firstDate.toLocaleDateString() === transaction.lastDate.toLocaleDateString()
                              ? transaction.firstDate.toLocaleDateString()
                              : `${transaction.firstDate.toLocaleDateString()} - ${transaction.lastDate.toLocaleDateString()}`
                            }
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div 
          className="p-6 bg-white dark:bg-black/20 rounded-xl shadow-sm"
        >
          <AnimatePresence mode="wait">
            <motion.div 
              key={transactionType}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ height: '600px' }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyTotals}>
                  <XAxis 
                    dataKey="date" 
                    angle={-45}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    tickFormatter={(value) => abbreviateNumber(value)}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    tickFormatter={(value) => abbreviateNumber(value)}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} ETH`,
                      name === 'Daily Total' ? 'Daily Total' : 'Cumulative Total'
                    ]}
                    labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="amount" 
                    fill="#3b82f6"
                    name="Daily Total"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#10b981"
                    name="Cumulative Total"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
} 