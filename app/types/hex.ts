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