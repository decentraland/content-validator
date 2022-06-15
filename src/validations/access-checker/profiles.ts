import { EthAddress, Entity } from '@dcl/schemas'
import { OK, Validation, validationFailed } from '../../types'
import { parseUrn } from '@dcl/urn-resolver'
import { Avatar } from '@dcl/schemas'
import { ADR_75_TIMESTAMP } from '../index'
import { allowList } from '../profile'

/**
 * Validate that the pointers are valid, and that the Ethereum address has write access to them
 * @public
 */
export const profiles: Validation = {
  validate: async ({ logs, externalCalls, theGraphClient }, deployment) => {
    const pointers = deployment.entity.pointers
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    if (pointers.length !== 1)
      return validationFailed(
        `Only one pointer is allowed when you create a Profile. Received: ${pointers}`
      )

    const pointer: string = pointers[0].toLowerCase()

    if (pointer.startsWith('default')) {
      if (!externalCalls.isAddressOwnedByDecentraland(ethAddress))
        return validationFailed(
          `Only Decentraland can add or modify default profiles`
        )
    } else if (!EthAddress.validate(pointer)) {
      return validationFailed(
        `The given pointer is not a valid ethereum address.`
      )
    } else if (pointer !== ethAddress.toLowerCase()) {
      return validationFailed(
        `You can only alter your own profile. The pointer address and the signer address are different (pointer:${pointer} signer: ${ethAddress.toLowerCase()}).`
      )
    }

    if (deployment.entity.timestamp < ADR_75_TIMESTAMP) return OK

    try {
      const names = allClaimedNames(deployment.entity)
      if (names.length > 0) {
        const ownedNames =
          await theGraphClient.checkForNamesOwnershipWithTimestamp(
            ethAddress,
            names,
            deployment.entity.timestamp
          )
        const notOwnedNames = names.filter((name) => !ownedNames.has(name))
        if (notOwnedNames.length > 0)
          return validationFailed(
            `The following names (${notOwnedNames}) are not owned by the address ${ethAddress.toLowerCase()}).`
          )
      }

      const wearableUrns = await allWearablesUrns(deployment.entity)
      if (wearableUrns.length > 0) {
        const ownedWearables =
          await theGraphClient.checkForWearablesOwnershipWithTimestamp(
            ethAddress,
            wearableUrns,
            deployment.entity.timestamp
          )
        const notOwned = wearableUrns.filter(
          (wearable) => !ownedWearables.has(wearable)
        )
        if (notOwned.length > 0)
          return validationFailed(
            `The following wearables (${notOwned}) are not owned by the address ${ethAddress.toLowerCase()}).`
          )
      }

      return OK
    } catch (error) {
      logs.getLogger('profiles access checker').error(JSON.stringify(error))
      return validationFailed('Oops. Something went wrong')
    }
  }
}

const allClaimedNames = (entity: Entity): string[] =>
  entity.metadata.avatars
    .filter((avatar: Avatar) => avatar.hasClaimedName)
    .map((avatar: Avatar) => avatar.name)
    .filter((name: string) => name && name.trim().length > 0)

const isBaseAvatar = (wearable: string): boolean =>
  wearable.includes('base-avatars')

const isOldEmote = (wearable: string): boolean => allowList.has(wearable)

const translateWearablesIdFormat = async (
  wearableId: string
): Promise<string | undefined> => {
  if (!wearableId.startsWith('dcl://')) {
    return wearableId
  }
  const parsed = await parseUrn(wearableId)
  return parsed?.uri?.toString()
}

const allWearablesUrns = async (entity: Entity) => {
  const allWearablesInProfilePromises: Promise<string | undefined>[] = []
  for (const avatar of entity.metadata.avatars) {
    for (const wearableId of avatar.avatar.wearables) {
      if (!isBaseAvatar(wearableId) && !isOldEmote(wearableId)) {
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
