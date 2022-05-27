import { EthAddress } from '@dcl/schemas'
import { ExternalCalls } from '../../types'

export type TheGraphComponent = {
  checkForWearablesOwnership: (
    wearableIdsToCheck: [EthAddress, string[]][]
  ) => Promise<{ owner: EthAddress; urns: string[] }[]>
}

type Query<QueryResult, ReturnType> = {
  description: string
  subgraph: keyof URLs
  query: string
  mapper: (queryResult: QueryResult) => ReturnType
}

type URLs = {
  ensSubgraph: string
  collectionsSubgraph: string
  maticCollectionsSubgraph: string
  thirdPartyRegistrySubgraph: string
}

export function createTheGraph(externalCalls: ExternalCalls, urls: URLs): TheGraphComponent {
  /**
   * This function returns all the owners from the given wearables URNs. It looks for them first in Ethereum and then in Matic
   * @param wearableIdsToCheck pairs of ethAddress and a list of urns to check ownership
   * @returns the pairs of ethAddress and list of urns
   */
  const checkForWearablesOwnership = async (
    wearableIdsToCheck: [EthAddress, string[]][]
  ): Promise<{ owner: EthAddress; urns: string[] }[]> => {
    const ethereumWearablesOwnersPromise = getOwnedWearables(wearableIdsToCheck, 'collectionsSubgraph')
    const maticWearablesOwnersPromise = getOwnedWearables(wearableIdsToCheck, 'maticCollectionsSubgraph')

    const [ethereumWearablesOwners, maticWearablesOwners] = await Promise.all([
      ethereumWearablesOwnersPromise,
      maticWearablesOwnersPromise
    ])

    return concatWearables(ethereumWearablesOwners, maticWearablesOwners)
  }

  const concatWearables = (
    ethereumWearablesOwners: { owner: EthAddress; urns: string[] }[],
    maticWearablesOwners: { owner: EthAddress; urns: string[] }[]
  ) => {
    const allWearables: Map<string, string[]> = new Map<string, string[]>()

    ethereumWearablesOwners.forEach((a) => {
      allWearables.set(a.owner, a.urns)
    })
    maticWearablesOwners.forEach((b) => {
      const existingUrns = allWearables.get(b.owner) ?? []
      allWearables.set(b.owner, existingUrns.concat(b.urns))
    })

    return Array.from(allWearables.entries()).map(([owner, urns]) => ({ owner, urns }))
  }

  const getOwnedWearables = async (
    wearableIdsToCheck: [string, string[]][],
    subgraph: keyof URLs
  ): Promise<{ owner: EthAddress; urns: string[] }[]> => {
    try {
      return getOwnersByWearable(wearableIdsToCheck, subgraph)
    } catch (error) {
      console.error(error)
      return []
    }
  }

  const getOwnersByWearable = (
    wearableIdsToCheck: [string, string[]][],
    subgraph: keyof URLs
  ): Promise<{ owner: EthAddress; urns: string[] }[]> => {
    const subgraphQuery = `{` + wearableIdsToCheck.map((query) => getWearablesFragment(query)).join('\n') + `}`
    const mapper = (response: { [owner: string]: { urn: string }[] }) =>
      Object.entries(response).map(([addressWithPrefix, wearables]) => ({
        owner: addressWithPrefix.substring(1),
        urns: wearables.map(({ urn }) => urn)
      }))
    const query: Query<{ [owner: string]: { urn: string }[] }, { owner: EthAddress; urns: string[] }[]> = {
      description: 'check for wearables ownership',
      subgraph: subgraph,
      query: subgraphQuery,
      mapper
    }
    return runQuery(query, {})
  }

  const getWearablesFragment = ([ethAddress, wearableIds]: [EthAddress, string[]]) => {
    const urnList = wearableIds.map((wearableId) => `"${wearableId}"`).join(',')
    // We need to add a 'P' prefix, because the graph needs the fragment name to start with a letter
    return `
      P${ethAddress}: nfts(where: { owner: "${ethAddress}", searchItemType_in: ["wearable_v1", "wearable_v2", "smart_wearable_v1", "emote_v1"], urn_in: [${urnList}] }, first: 1000) {
        urn
      }
    `
  }

  const runQuery = async <QueryResult, ReturnType>(
    query: Query<QueryResult, ReturnType>,
    variables: Record<string, any>
  ): Promise<ReturnType> => {
    try {
      const response = await externalCalls.queryGraph<QueryResult>(urls[query.subgraph], query.query, variables)
      return query.mapper(response)
    } catch (error) {
      console.error(
        `Failed to execute the following query to the subgraph ${urls[query.subgraph]} ${query.description}'.`,
        error
      )
      throw new Error('Internal server error')
    }
  }

  return {
    checkForWearablesOwnership
  }
}
