import { EthAddress } from '@dcl/schemas'
import { ContentValidatorComponents, TheGraphClient, URLs } from '../types'
import ms from 'ms'

/**
 * @public
 */
export const createTheGraphClient = (
  components: Pick<ContentValidatorComponents, 'logs' | 'externalCalls'>
): TheGraphClient => {
  const logger = components.logs.getLogger('TheGraphClient')

  const urls: URLs = {
    collectionsSubgraph: components.externalCalls.subgraphs.L1.collections,
    blocksSubgraph: components.externalCalls.subgraphs.L1.blocks,
    maticBlocksSubgraph: components.externalCalls.subgraphs.L2.blocks,
    ensSubgraph: components.externalCalls.subgraphs.L1.ensOwner,
    maticCollectionsSubgraph: components.externalCalls.subgraphs.L2.collections,
    thirdPartyRegistrySubgraph:
      components.externalCalls.subgraphs.L2.thirdPartyRegistry
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

  const getNamesForBlockFragment = (
    block: number,
    ethAddress: EthAddress,
    names: string[]
  ) => {
    const nameList = names.map((name) => `"${name}"`).join(',')
    return `
  B${block}: nfts(
    block: { number: ${block} }
    where: { owner: "${ethAddress}", category: ens, name_in: [${nameList}] }
    first: 1000
  ) {
    name
  }`
  }

  const checkForWearablesOwnershipWithTimestamp = async (
    ethAddress: EthAddress,
    wearableIdsToCheck: string[],
    timestamp: number
  ): Promise<Set<string>> => {
    const ethereumWearablesOwnersPromise = getOwnersByWearableWithTimestamp(
      ethAddress,
      wearableIdsToCheck,
      timestamp,
      'blocksSubgraph',
      'collectionsSubgraph'
    )
    const maticWearablesOwnersPromise = getOwnersByWearableWithTimestamp(
      ethAddress,
      wearableIdsToCheck,
      timestamp,
      'maticBlocksSubgraph',
      'maticCollectionsSubgraph'
    )

    const [ethereumWearablesOwners, maticWearablesOwners] = await Promise.all([
      ethereumWearablesOwnersPromise,
      maticWearablesOwnersPromise
    ])

    return new Set([...ethereumWearablesOwners, ...maticWearablesOwners])
  }

  const getOwnersByWearableWithTimestamp = async (
    ethAddress: EthAddress,
    wearableIdsToCheck: string[],
    timestamp: number,
    blocksSubgraph: keyof URLs,
    collectionsSubgraph: keyof URLs
  ): Promise<Set<string>> => {
    const blocks = await findBlocksForTimestamp(blocksSubgraph, timestamp)

    const blocksToCheck: number[] = [
      blocks.blockNumberAtDeployment ?? -1,
      blocks.blockNumberFiveMinBeforeDeployment ?? -1
    ].filter((block) => block !== -1)

    const subgraphQuery =
      `{` +
      blocksToCheck
        .map((block) =>
          getWearablesForBlockFragment(block, ethAddress, wearableIdsToCheck)
        )
        .join('\n') +
      `}`

    const mapper = (response: { [owner: string]: { urn: string }[] }) =>
      Object.entries(response).reduce<Set<string>>(
        (set: Set<string>, [, names]) => {
          names.forEach(({ urn }) => set.add(urn))
          return set
        },
        new Set<string>()
      )
    const query: Query<{ [block: string]: { urn: string }[] }, Set<string>> = {
      description: 'check for wearables ownership',
      subgraph: collectionsSubgraph,
      query: subgraphQuery,
      mapper
    }
    return runQuery(query, {})
  }

  const getWearablesForBlockFragment = (
    block: number,
    ethAddress: EthAddress,
    wearableIds: string[]
  ) => {
    const urnList = wearableIds.map((wearableId) => `"${wearableId}"`).join(',')
    return `
  B${block}: nfts(
    block: {number: ${block}}
    where: {
      owner: "${ethAddress}",
      searchItemType_in: ["wearable_v1", "wearable_v2", "smart_wearable_v1", "emote_v1"], 
      urn_in: [${urnList}]
    }
    first: 1000
  ) {
    urn
  }`
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
    } catch (error) {
      console.log(error)
      logger.error(
        `Failed to execute the following query to the subgraph ${
          urls[query.subgraph]
        } ${query.description}'.`,
        {
          query: query.query,
          variables: JSON.stringify(variables)
        }
      )
      throw new Error('Internal server error')
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
        min: { number: string }[]
        max: { number: string }[]
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
        const blockNumberAtDeployment = response.max[0].number
        const blockNumberFiveMinBeforeDeployment = response.min[0].number
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

    return await runQuery(query, {
      timestamp: timestampSec,
      timestamp5Min: timestamp5MinAgo
    })
  }

  return {
    checkForNamesOwnershipWithTimestamp,
    checkForWearablesOwnershipWithTimestamp,
    findBlocksForTimestamp
  }
}

const QUERY_BLOCKS_FOR_TIMESTAMP = `
query getBlockForTimestampRange($timestamp: Int!, $timestamp5Min: Int!) {
  min: blocks(
    where: {timestamp_gte: $timestamp5Min, timestamp_lte: $timestampMax}
    first: 1
    orderBy: timestamp
    orderDirection: desc
  ) {
    number
  }
  max: blocks(
    where: {timestamp_gte: $timestamp5Min, timestamp_lte: $timestampMax}
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
