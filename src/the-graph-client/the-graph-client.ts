import { parseUrn } from '@dcl/urn-resolver'
import { EthAddress } from '@dcl/schemas'
import { ThirdPartyIntegration, WearableId, WearablesFilters } from './types'
import { ContentValidatorComponents, TheGraphClient, URLs } from '../types'
import ms from 'ms'

/**
 * @internal
 */
export const createTheGraphClient = (
  components: Pick<ContentValidatorComponents, 'logs' | 'externalCalls'>,
  urls: URLs
): TheGraphClient => {
  const MAX_PAGE_SIZE = 1000

  const logger = components.logs.getLogger('TheGraphClient')

  const findOwnersByName = async (
    names: string[]
  ): Promise<{ name: string; owner: EthAddress }[]> => {
    const query: Query<
      { nfts: { name: string; owner: { address: EthAddress } }[] },
      { name: string; owner: EthAddress }[]
    > = {
      description: 'fetch owners by name',
      subgraph: 'ensSubgraph',
      query: QUERY_OWNER_BY_NAME,
      mapper: (response) =>
        response.nfts.map(({ name, owner }) => ({ name, owner: owner.address }))
    }

    return splitQueryVariablesIntoSlices(query, names, (slicedNames) => ({
      names: slicedNames
    }))
  }

  const checkForNamesOwnership = async (
    namesToCheck: [EthAddress, string[]][]
  ): Promise<{ owner: EthAddress; names: string[] }[]> => {
    const subgraphQuery =
      `{` +
      namesToCheck.map((query) => getNamesFragment(query)).join('\n') +
      `}`
    const mapper = (response: { [owner: string]: { name: string }[] }) =>
      Object.entries(response).map(([addressWithPrefix, names]) => ({
        owner: addressWithPrefix.substring(1),
        names: names.map(({ name }) => name)
      }))
    const query: Query<
      { [owner: string]: { name: string }[] },
      { owner: EthAddress; names: string[] }[]
    > = {
      description: 'check for names ownership',
      subgraph: 'ensSubgraph',
      query: subgraphQuery,
      mapper
    }
    return runQuery(query, {})
  }

  const checkForNamesOwnershipWithTimestamp = async (
    ethAddress: EthAddress,
    namesToCheck: string[],
    timestamp: number
  ): Promise<Set<string>> => {
    const blocks = await findBlocksForTimestamp('blocksSubgraph', timestamp)

    const blocksToCheck: number[] = [
      blocks.blockNumberAtDeployment ?? -1,
      blocks.blockNumberFiveMinBeforeDeployment ?? -1
    ].filter((block) => block !== -1)

    const namesQuery =
      `{` +
      blocksToCheck
        .map((block) =>
          getNamesForBlockFragment(block, ethAddress, namesToCheck)
        )
        .join('\n') +
      `}`

    const mapper = (response: {
      [block: string]: { name: string }[]
    }): Set<string> =>
      Object.entries(response).reduce<Set<string>>(
        (set: Set<string>, [, names]) => {
          names.forEach(({ name }) => set.add(name))
          return set
        },
        new Set<string>()
      )

    const query: Query<{ [block: string]: { name: string }[] }, Set<string>> = {
      description: 'check for names ownership',
      subgraph: 'ensSubgraph',
      query: namesQuery,
      mapper
    }
    return runQuery(query, {})
  }

  function getNamesFragment([ethAddress, names]: [EthAddress, string[]]) {
    const nameList = names.map((name) => `"${name}"`).join(',')
    // We need to add a 'P' prefix, because the graph needs the fragment name to start with a letter
    return `
      P${ethAddress}: nfts(where: { owner: "${ethAddress}", category: ens, name_in: [${nameList}] }, first: 1000) {
        name
      }
    `
  }

  const getNamesForBlockFragment = (
    block: number,
    ethAddress: EthAddress,
    names: string[]
  ) => {
    const nameList = names.map((name) => `"${name}"`).join(',')
    return `
  B${block}: nfts(
    block: {number: ${block}}
    where: {owner: "${ethAddress}", category: ens, name_in: [${nameList}]}
    first: 1000
  ) {
    name
  }`
  }

  /**
   * This method returns all the owners from the given wearables URNs. It looks for them first in Ethereum and then in Matic
   * @param wearableIdsToCheck pairs of ethAddress and a list of urns to check ownership
   * @returns the pairs of ethAddress and list of urns
   */
  const checkForWearablesOwnership = async (
    wearableIdsToCheck: [EthAddress, string[]][]
  ): Promise<{ owner: EthAddress; urns: string[] }[]> => {
    const ethereumWearablesOwnersPromise = getOwnedWearables(
      wearableIdsToCheck,
      'collectionsSubgraph'
    )
    const maticWearablesOwnersPromise = getOwnedWearables(
      wearableIdsToCheck,
      'maticCollectionsSubgraph'
    )

    const [ethereumWearablesOwners, maticWearablesOwners] = await Promise.all([
      ethereumWearablesOwnersPromise,
      maticWearablesOwnersPromise
    ])

    return concatWearables(ethereumWearablesOwners, maticWearablesOwners)
  }

  const getAllCollections = async (): Promise<
    { name: string; urn: string }[]
  > => {
    const l1CollectionsPromise = getCollections('collectionsSubgraph')
    const l2CollectionsPromise = getCollections('maticCollectionsSubgraph')

    const [l1Collections, l2Collections] = await Promise.all([
      l1CollectionsPromise,
      l2CollectionsPromise
    ])
    return l1Collections.concat(l2Collections)
  }

  const getCollections = async (subgraph: keyof URLs) => {
    try {
      const query: Query<
        { collections: { name: string; urn: string }[] },
        { name: string; urn: string }[]
      > = {
        description: 'fetch collections',
        subgraph: subgraph,
        query: QUERY_COLLECTIONS,
        mapper: (response) => response.collections
      }
      return runQuery(query, {})
    } catch {
      return []
    }
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

    return Array.from(allWearables.entries()).map(([owner, urns]) => ({
      owner,
      urns
    }))
  }

  async function getOwnedWearables(
    wearableIdsToCheck: [string, string[]][],
    subgraph: keyof URLs
  ): Promise<{ owner: EthAddress; urns: string[] }[]> {
    try {
      return getOwnersByWearable(wearableIdsToCheck, subgraph)
    } catch (error: any) {
      logger.error(error)
      return []
    }
  }

  /**
   * This method returns the list of third party integrations as well as collections
   */
  const getThirdPartyIntegrations = async (): Promise<
    ThirdPartyIntegration[]
  > => {
    const query: Query<
      {
        thirdParties: {
          id: string
          metadata: { thirdParty: { name: string; description: string } }
        }[]
      },
      ThirdPartyIntegration[]
    > = {
      description: 'fetch third parties',
      subgraph: 'thirdPartyRegistrySubgraph',
      query: QUERY_THIRD_PARTIES,
      mapper: (response) =>
        response.thirdParties.map((tp) => ({
          urn: tp.id,
          ...tp.metadata.thirdParty
        }))
    }
    return runQuery(query, { thirdPartyType: 'third_party_v1' })
  }

  /**
   * This method returns the third party resolver API to be used to query assets from any collection
   * of given third party integration
   */
  const findThirdPartyResolver = async (
    subgraph: keyof URLs,
    id: string
  ): Promise<string | undefined> => {
    const query: Query<
      { thirdParties: [{ resolver: string }] },
      string | undefined
    > = {
      description: 'fetch third party resolver',
      subgraph: subgraph,
      query: QUERY_THIRD_PARTY_RESOLVER,
      mapper: (response) => response.thirdParties[0]?.resolver
    }
    return await runQuery(query, { id })
  }

  const getOwnersByWearable = (
    wearableIdsToCheck: [string, string[]][],
    subgraph: keyof URLs
  ): Promise<{ owner: EthAddress; urns: string[] }[]> => {
    const subgraphQuery =
      `{` +
      wearableIdsToCheck
        .map((query) => getWearablesFragment(query))
        .join('\n') +
      `}`
    const mapper = (response: { [owner: string]: { urn: string }[] }) =>
      Object.entries(response).map(([addressWithPrefix, wearables]) => ({
        owner: addressWithPrefix.substring(1),
        urns: wearables.map(({ urn }) => urn)
      }))
    const query: Query<
      { [owner: string]: { urn: string }[] },
      { owner: EthAddress; urns: string[] }[]
    > = {
      description: 'check for wearables ownership',
      subgraph: subgraph,
      query: subgraphQuery,
      mapper
    }
    return runQuery(query, {})
  }

  const getWearablesFragment = ([ethAddress, wearableIds]: [
    EthAddress,
    string[]
  ]) => {
    const urnList = wearableIds.map((wearableId) => `"${wearableId}"`).join(',')
    // We need to add a 'P' prefix, because the graph needs the fragment name to start with a letter
    return `
      P${ethAddress}: nfts(where: { owner: "${ethAddress}", searchItemType_in: ["wearable_v1", "wearable_v2", "smart_wearable_v1", "emote_v1"], urn_in: [${urnList}] }, first: 1000) {
        urn
      }
    `
  }

  /**
   * Given an ethereum address, this method returns all wearables from ethereum and matic that are asociated to it.
   * @param owner
   */
  const findWearablesByOwner = async (
    owner: EthAddress
  ): Promise<WearableId[]> => {
    const ethereumWearablesPromise = getWearablesByOwner(
      'collectionsSubgraph',
      owner
    )
    const maticWearablesPromise = getWearablesByOwner(
      'maticCollectionsSubgraph',
      owner
    )
    const [ethereumWearables, maticWearables] = await Promise.all([
      ethereumWearablesPromise,
      maticWearablesPromise
    ])

    return ethereumWearables.concat(maticWearables)
  }

  const getWearablesByOwner = async (
    subgraph: keyof URLs,
    owner: string
  ): Promise<string[]> => {
    const query: Query<
      { nfts: { urn: string; collection: { isApproved: boolean } }[] },
      { id: WearableId; isApproved: boolean }[]
    > = {
      description: 'fetch wearables by owner',
      subgraph: subgraph,
      query: QUERY_WEARABLES_BY_OWNER,
      mapper: (response) =>
        response.nfts.map(({ urn, collection }) => ({
          id: urn,
          isApproved: collection.isApproved
        }))
    }
    const wearables = await paginatableQuery(query, {
      owner: owner.toLowerCase()
    })
    return wearables
      .filter((wearable) => wearable.isApproved)
      .map((wearable) => wearable.id)
  }

  const findWearablesByFilters = async (
    filters: WearablesFilters,
    pagination: { limit: number; lastId: string | undefined }
  ): Promise<WearableId[]> => {
    // Order will be L1 > L2
    const L1_NETWORKS = ['mainnet', 'ropsten', 'kovan', 'rinkeby', 'goerli']
    const L2_NETWORKS = ['matic', 'mumbai']

    let limit = pagination.limit
    let lastId = pagination.lastId
    let lastIdLayer: string | undefined = lastId
      ? await getProtocol(lastId)
      : undefined

    const result: WearableId[] = []

    if (limit >= 0 && (!lastIdLayer || L1_NETWORKS.includes(lastIdLayer))) {
      const l1Result = await findWearablesByFiltersInSubgraph(
        'collectionsSubgraph',
        { ...filters, lastId },
        limit + 1
      )
      result.push(...l1Result)
      limit -= l1Result.length
      lastId = undefined
      lastIdLayer = undefined
    }

    if (limit >= 0 && (!lastIdLayer || L2_NETWORKS.includes(lastIdLayer))) {
      const l2Result = await findWearablesByFiltersInSubgraph(
        'maticCollectionsSubgraph',
        { ...filters, lastId },
        limit + 1
      )
      result.push(...l2Result)
    }

    return result
  }

  const getProtocol = async (urn: string) => {
    const parsed = await parseUrn(urn)
    return parsed?.type === 'blockchain-collection-v1-asset' ||
      parsed?.type === 'blockchain-collection-v2-asset'
      ? parsed.network
      : undefined
  }

  const findWearablesByFiltersInSubgraph = (
    subgraph: keyof URLs,
    filters: WearablesFilters & { lastId?: string },
    limit: number
  ): Promise<WearableId[]> => {
    const subgraphQuery = buildFilterQuery(filters)
    let mapper: (response: any) => WearableId[]
    if (filters.collectionIds) {
      mapper = (response: { collections: { items: { urn: string }[] }[] }) =>
        response.collections
          .map(({ items }) => items.map(({ urn }) => urn))
          .flat()
    } else {
      mapper = (response: { items: { urn: string }[] }) =>
        response.items.map(({ urn }) => urn)
    }
    const query = {
      description: 'fetch wearables by filters',
      subgraph,
      query: subgraphQuery,
      mapper,
      default: []
    }

    return runQuery(query, {
      ...filters,
      lastId: filters.lastId ?? '',
      first: limit
    })
  }

  const buildFilterQuery = (
    filters: WearablesFilters & { lastId?: string }
  ): string => {
    const whereClause: string[] = [
      `searchItemType_in: ["wearable_v1", "wearable_v2", "smart_wearable_v1", "emote_v1"]`
    ]
    const params: string[] = []
    if (filters.textSearch) {
      params.push('$textSearch: String')
      whereClause.push(`searchText_contains: $textSearch`)
    }

    if (filters.wearableIds) {
      params.push('$wearableIds: [String]!')
      whereClause.push(`urn_in: $wearableIds`)
    }

    if (filters.lastId) {
      params.push('$lastId: String!')
      whereClause.push(`urn_gt: $lastId`)
    }

    const itemsQuery = `
      items(where: {${whereClause.join(
        ','
      )}}, first: $first, orderBy: urn, orderDirection: asc) {
        urn
      }
    `

    if (filters.collectionIds) {
      params.push('$collectionIds: [String]!')

      return `
        query WearablesByFilters(${params.join(',')}, $first: Int!) {
          collections(where: { urn_in: $collectionIds }, first: 1000, orderBy: urn, orderDirection: asc) {
            ${itemsQuery}
          }
        }`
    } else {
      return `
        query WearablesByFilters(${params.join(',')}, $first: Int!) {
          ${itemsQuery}
        }`
    }
  }

  /** This method takes a query that could be paginated and performs the pagination internally */
  const paginatableQuery = async <QueryResult, ReturnType extends Array<any>>(
    query: Query<QueryResult, ReturnType>,
    variables: Record<string, any>
  ): Promise<ReturnType> => {
    let result: ReturnType | undefined = undefined
    let shouldContinue = true
    let offset = 0
    while (shouldContinue) {
      const queried = await runQuery(query, {
        ...variables,
        first: MAX_PAGE_SIZE,
        skip: offset
      })
      if (!result) {
        result = queried
      } else {
        result.push(...queried)
      }
      shouldContinue = queried.length === MAX_PAGE_SIZE
      offset += MAX_PAGE_SIZE
    }
    return result!
  }

  /**
   * This method takes a query that has an array input variable, and makes multiple queries if necessary.
   * This is so that the input doesn't exceed the maximum limit
   */
  const splitQueryVariablesIntoSlices = async <
    QueryResult,
    ReturnType extends Array<any>
  >(
    query: Query<QueryResult, ReturnType>,
    input: string[],
    inputToVariables: (input: string[]) => Record<string, any>
  ): Promise<ReturnType | []> => {
    let result: ReturnType | undefined = undefined
    let offset = 0
    while (offset < input.length) {
      const slice = input.slice(offset, offset + MAX_PAGE_SIZE)
      const queried = await runQuery(query, inputToVariables(slice))
      if (!result) {
        result = queried
      } else {
        result.push(...queried)
      }
      offset += MAX_PAGE_SIZE
    }
    return result ?? []
  }

  const runQuery = async <QueryResult, ReturnType>(
    query: Query<QueryResult, ReturnType>,
    variables: Record<string, any>
  ): Promise<ReturnType> => {
    try {
      const response = await components.externalCalls.queryGraph<QueryResult>(
        urls[query.subgraph],
        query.query,
        variables
      )
      return query.mapper(response)
    } catch (error: any) {
      logger.error(
        `Failed to execute the following query to the subgraph ${
          urls[query.subgraph]
        } ${query.description}'.`,
        error
      )
      throw new Error('Internal server error')
    }
  }

  // When we want to find a block for a specific timestamp, we define an access window. This means that
  // we will place will try to find the closes block to the timestamp, but only if it's within the window
  const ACCESS_WINDOW_IN_SECONDS = ms('15s') / 1000

  const getWindowFromTimestamp = (
    timestamp: number
  ): {
    max: number
    min: number
  } => {
    const windowMin = timestamp - Math.floor(ACCESS_WINDOW_IN_SECONDS / 2)
    const windowMax = timestamp + Math.ceil(ACCESS_WINDOW_IN_SECONDS / 2)
    return {
      max: windowMax,
      min: windowMin
    }
  }

  const findBlocksForTimestamp = async (
    subgraph: keyof URLs,
    timestamp: number
  ): Promise<{
    blockNumberAtDeployment: number | undefined
    blockNumberFiveMinBeforeDeployment: number | undefined
  }> => {
    const query: Query<
      {
        before: { number: string }[]
        after: { number: string }[]
        fiveMinBefore: { number: string }[]
        fiveMinAfter: { number: string }[]
      },
      {
        blockNumberAtDeployment: number | undefined
        blockNumberFiveMinBeforeDeployment: number | undefined
      }
    > = {
      description: 'fetch blocks for timestamp',
      subgraph: subgraph,
      query: QUERY_BLOCKS_FOR_TIMESTAMP,
      mapper: (response) => {
        // To get the deployment's block number, we check the one immediately after the entity's timestamp. Since it could not exist, we default to the one immediately before.
        const blockNumberAtDeployment =
          response.after[0]?.number ?? response.before[0]?.number
        const blockNumberFiveMinBeforeDeployment =
          response.fiveMinAfter[0]?.number ?? response.fiveMinBefore[0]?.number
        if (
          blockNumberAtDeployment === undefined &&
          blockNumberFiveMinBeforeDeployment === undefined
        ) {
          throw new Error(`Failed to find blocks for the specific timestamp`)
        }

        return {
          blockNumberAtDeployment: !!blockNumberAtDeployment
            ? parseInt(blockNumberAtDeployment)
            : undefined,
          blockNumberFiveMinBeforeDeployment:
            !!blockNumberFiveMinBeforeDeployment
              ? parseInt(blockNumberFiveMinBeforeDeployment)
              : undefined
        }
      }
    }

    const timestampSec = Math.ceil(timestamp / 1000)
    const timestamp5MinAgo = timestampSec - 60 * 5
    const window = getWindowFromTimestamp(timestampSec)
    const window5MinAgo = getWindowFromTimestamp(timestamp5MinAgo)

    try {
      return await runQuery(query, {
        timestamp: timestampSec,
        timestampMax: window.max,
        timestampMin: window.min,
        timestamp5Min: timestamp5MinAgo,
        timestamp5MinMax: window5MinAgo.max,
        timestamp5MinMin: window5MinAgo.min
      })
    } catch (e) {
      const error = (e as any)?.message
      logger.error(`Error fetching the block number for timestamp`, {
        timestamp,
        error
      })
      throw error
    }
  }

  return {
    checkForNamesOwnership,
    checkForNamesOwnershipWithTimestamp,
    checkForWearablesOwnership,
    findBlocksForTimestamp,
    findOwnersByName,
    findThirdPartyResolver,
    findWearablesByFilters,
    findWearablesByOwner,
    getAllCollections,
    getThirdPartyIntegrations
  }
}

const QUERY_THIRD_PARTIES = `
{
  thirdParties(where: {isApproved: true}) {
    id
		metadata {
      thirdParty {
        name
        description
      }
    }
  }
}
`

const QUERY_THIRD_PARTY_RESOLVER = `
query ThirdPartyResolver($id: String!) {
  thirdParties(where: {id: $id, isApproved: true}) {
    id
    resolver
  }
}
`

const QUERY_WEARABLES_BY_OWNER: string = `
  query WearablesByOwner($owner: String, $first: Int, $skip: Int) {
    nfts(where: {owner: $owner, searchItemType_in: ["wearable_v1", "wearable_v2", "smart_wearable_v1", "emote_v1"]}, first: $first, skip: $skip) {
      urn,
      collection {
        isApproved
      }
    }
  }`

const QUERY_OWNER_BY_NAME = `
  query FetchOwnersByName($names: [String]) {
    nfts(
      where: {
        name_in: $names,
        category: ens
      })
    {
      name
      owner {
        address
      }
    }
  }`

// NOTE: Even though it isn't necessary right now, we might require some pagination in the future
const QUERY_COLLECTIONS = `
  {
    collections (first: 1000, orderBy: urn, orderDirection: asc) {
      urn,
      name,
    }
  }`

const QUERY_BLOCKS_FOR_TIMESTAMP = `
query getBlockForTimestamp($timestamp: Int!, $timestampMin: Int!, $timestampMax: Int!, $timestamp5Min: Int!, $timestamp5MinMax: Int!, $timestamp5MinMin: Int!) {
  before: blocks(
    where: {timestamp_lte: $timestamp, timestamp_gte: $timestampMin}
    first: 1
    orderBy: timestamp
    orderDirection: desc
  ) {
    number
  }
  after: blocks(
    where: {timestamp_gte: $timestamp, timestamp_lte: $timestampMax}
    first: 1
    orderBy: timestamp
    orderDirection: asc
  ) {
    number
  }
  fiveMinBefore: blocks(
    where: {timestamp_lte: $timestamp5Min, timestamp_gte: $timestamp5MinMin}
    first: 1
    orderBy: timestamp
    orderDirection: desc
  ) {
    number
  }
  fiveMinAfter: blocks(
    where: {timestamp_gte: $timestamp5Min, timestamp_lte: $timestamp5MinMax}
    first: 1
    orderBy: timestamp
    orderDirection: asc
  ) {
    number
  }
}`

type Query<QueryResult, ReturnType> = {
  description: string
  subgraph: keyof URLs
  query: string
  mapper: (queryResult: QueryResult) => ReturnType
}
