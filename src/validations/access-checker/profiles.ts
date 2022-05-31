import { isAddress } from '@ethersproject/address'
import { Entity, Pointer } from 'dcl-catalyst-commons'
import { OK, Validation, validationFailed } from '../../types'
import { parseUrn } from '@dcl/urn-resolver'
import { Avatar } from '@dcl/schemas'
import { ADR_XXX_TIMESTAMP } from '../index'

/**
 * Validate that the pointers are valid, and that the Ethereum address has write access to them
 * @public
 */
export const profiles: Validation = {
  validate: async (deployment, { externalCalls, theGraphClient, logs }) => {
    const pointers = deployment.entity.pointers
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    if (pointers.length !== 1)
      return validationFailed(
        `Only one pointer is allowed when you create a Profile. Received: ${pointers}`
      )

    const pointer: Pointer = pointers[0].toLowerCase()

    if (pointer.startsWith('default')) {
      if (!externalCalls.isAddressOwnedByDecentraland(ethAddress))
        return validationFailed(
          `Only Decentraland can add or modify default profiles`
        )
    } else if (!isAddress(pointer)) {
      return validationFailed(
        `The given pointer is not a valid ethereum address.`
      )
    } else if (pointer !== ethAddress.toLowerCase()) {
      return validationFailed(
        `You can only alter your own profile. The pointer address and the signer address are different (pointer:${pointer} signer: ${ethAddress.toLowerCase()}).`
      )
    }

    if (deployment.entity.timestamp < ADR_XXX_TIMESTAMP) return OK

    // const collectionsSubgraph: string = externalCalls.subgraphs.L1.collections
    // const maticCollectionsSubgraph: string =
    //   externalCalls.subgraphs.L2.collections
    // const ensSubgraph: string = externalCalls.subgraphs.L2.ensOwner
    // const thirdPartyRegistrySubgraph: string =
    //   externalCalls.subgraphs.L2.thirdPartyRegistry

    // createTheGraphClient(
    //     components.queryGraph,
    //   {
    //     ensSubgraph,
    //     collectionsSubgraph,
    //     maticCollectionsSubgraph,
    //     thirdPartyRegistrySubgraph
    //   },
    //   logs
    // )

    const logger = logs.getLogger('profiles access validator')

    logger.debug(deployment.entity.metadata.avatars[0].avatar.wearables)

    const names = allNames(deployment.entity)
    const wearableUrns = await allWearablesUrns(deployment.entity)
    console.log('names', names, 'wearableUrns', wearableUrns)

    const response = await theGraphClient.checkForWearablesOwnership([
      [pointer, wearableUrns]
    ])
    console.log(response)
    return OK
  }
}

function allNames(entity: Entity): string[] {
  return entity.metadata.avatars
    .map((avatar: Avatar) => avatar.name)
    .filter((name: string) => name && name.trim().length > 0)
}

async function allWearablesUrns(entity: Entity) {
  const allWearablesInProfilePromises: Promise<string | undefined>[] = []
  for (const avatar of entity.metadata.avatars) {
    for (const wearableId of avatar.avatar.wearables) {
      if (!isBaseAvatar(wearableId)) {
        allWearablesInProfilePromises.push(
          translateWearablesIdFormat(wearableId)
        )
      }
    }
  }

  return (await Promise.all(allWearablesInProfilePromises)).filter(
    (wearableId): wearableId is string => !!wearableId
  )
}

function isBaseAvatar(wearable: string): boolean {
  return wearable.includes('base-avatars')
}

async function translateWearablesIdFormat(
  wearableId: string
): Promise<string | undefined> {
  if (!wearableId.startsWith('dcl://')) {
    return wearableId
  }
  const parsed = await parseUrn(wearableId)
  return parsed?.uri?.toString()
}
