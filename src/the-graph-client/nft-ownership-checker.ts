import { EthAddress } from '@dcl/schemas'
import { ContentValidatorComponents, NftOwnershipChecker } from '../types'

/**
 * @internal
 */
export const createNftOwnershipChecker = (
  components: Pick<ContentValidatorComponents, 'logs' | 'theGraphClient'>
): NftOwnershipChecker => {
  const NFT_FRAGMENTS_PER_QUERY = 10
  const logger = components.logs.getLogger('NftOwnershipChecker')
  const theGraphClient = components.theGraphClient

  /** Return a set of the NFTs that are actually owned by the user */
  const checkForOwnership = async (
    address: EthAddress,
    nfts: string[],
    theGraphCheck: (address: EthAddress, nfts: string[]) => Promise<string[]>
  ): Promise<Set<string>> => {
    const result: Set<string> = new Set()
    let offset = 0
    while (offset < nfts.length) {
      const slice = nfts.slice(offset, offset + NFT_FRAGMENTS_PER_QUERY)
      try {
        const queryResult = await theGraphCheck(address, slice)
        queryResult.forEach((res) => result.add(res))
      } catch (error: any) {
        logger.error(error)
      } finally {
        offset += NFT_FRAGMENTS_PER_QUERY
      }
    }

    return result
  }

  const checkForNameOwnership = async (
    address: EthAddress,
    nfts: string[]
  ): Promise<Set<string>> => {
    return await checkForOwnership(
      address,
      nfts,
      async (address: EthAddress, nfts: string[]) => {
        const result = await theGraphClient.checkForNamesOwnership([
          [address, nfts]
        ])
        return result.find((res) => res.owner === address)?.names ?? []
      }
    )
  }

  const checkForNameOwnershipWithTimestamp = async (
    address: EthAddress,
    nfts: string[],
    timestamp: number
  ): Promise<Set<string>> => {
    await theGraphClient.findBlocksForTimestamp('blocksSubgraph', timestamp)
    return await checkForOwnership(
      address,
      nfts,
      async (address: EthAddress, nfts: string[]) => {
        const result = await theGraphClient.checkForNamesOwnership([
          [address, nfts]
        ])
        return result.find((res) => res.owner === address)?.names ?? []
      }
    )
  }

  const checkForWearablesOwnership = async (
    address: EthAddress,
    nfts: string[]
  ): Promise<Set<string>> => {
    return await checkForOwnership(
      address,
      nfts,
      async (address: EthAddress, nfts: string[]) => {
        const result = await theGraphClient.checkForWearablesOwnership([
          [address, nfts]
        ])
        return result.find((res) => res.owner === address)?.urns ?? []
      }
    )
  }

  return {
    checkForNameOwnership,
    checkForNameOwnershipWithTimestamp,
    checkForWearablesOwnership
  }
}
