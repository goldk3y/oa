import { ApolloClient, InMemoryCache, ApolloLink, HttpLink } from '@apollo/client';

function createApolloClient() {
  const httpLink = new HttpLink({
    uri: 'https://graph.pulsechain.com/subgraphs/name/Codeakk/Hex',
  });

  return new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
      },
    },
  });
}

export const client = createApolloClient(); 