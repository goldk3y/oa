export interface XfLobbyEnter {
  id: string;
  enterDay: string;
  entryId: string;
  memberAddr: string;
  rawAmount: string;
  timestamp: string;
  transactionHash: string;
  referrerAddr: string;
}

export interface XfLobbyEntersQuery {
  xfLobbyEnters: XfLobbyEnter[];
}

export interface StakeEnd {
  id: string;
  stakerAddr: string;
  stakeId: string;
  payout: string;
  stakedHearts: string;
  stakedShares: string;
  timestamp: string;
  penalty: string;
  servedDays: string;
  daysLate: string;
  daysEarly: string;
  transactionHash: string;
}

export interface StakeEndsQuery {
  stakeEnds: StakeEnd[];
}

export interface StakeStart {
  id: string;
  stakerAddr: string;
  stakeId: string;
  stakedHearts: string;
  stakedShares: string;
  stakeTShares: string;
  stakedDays: string;
  startDay: string;
  endDay: string;
  timestamp: string;
  isAutoStake: boolean;
  transactionHash: string;
  stakeEnd?: StakeEnd;
}

export interface StakeStartsQuery {
  stakeStarts: StakeStart[];
} 