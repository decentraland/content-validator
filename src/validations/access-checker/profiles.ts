import { Avatar, Entity, EthAddress } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import { OK, Validation, validationFailed } from '../../types'
import { isOldEmote } from '../profile'
import { ADR_74_TIMESTAMP, ADR_75_TIMESTAMP } from '../timestamps'
import { conditionalValidation, validationAfterADR75, validationGroup } from '../validations'

export const pointerIsValid: Validation = {
  validate: async ({ externalCalls }, deployment) => {
    const pointers = deployment.entity.pointers
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    if (pointers.length !== 1)
      return validationFailed(`Only one pointer is allowed when you create a Profile. Received: ${pointers}`)

    const pointer: string = pointers[0].toLowerCase()

    if (pointer.startsWith('default')) {
      if (!externalCalls.isAddressOwnedByDecentraland(ethAddress))
        return validationFailed(`Only Decentraland can add or modify default profiles`)
    } else if (!EthAddress.validate(pointer)) {
      return validationFailed(`The given pointer is not a valid ethereum address.`)
    } else if (pointer !== ethAddress.toLowerCase()) {
      return validationFailed(
        `You can only alter your own profile. The pointer address and the signer address are different (pointer:${pointer} signer: ${ethAddress.toLowerCase()}).`
      )
    }
    return OK
  }
}

function allClaimedNames(entity: Entity): string[] {
  return entity.metadata.avatars
    .filter((avatar: Avatar) => avatar.hasClaimedName)
    .map((avatar: Avatar) => avatar.name)
    .filter((name: string) => name && name.trim().length > 0)
}

export const ownsNames: Validation = validationAfterADR75({
  validate: async ({ externalCalls, theGraphClient }, deployment) => {
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const names = allClaimedNames(deployment.entity)
    const namesCheckResult = await theGraphClient.checkForNamesOwnershipWithTimestamp(
      ethAddress,
      names,
      deployment.entity.timestamp
    )
    if (!namesCheckResult.result)
      return validationFailed(
        `The following names (${namesCheckResult.failing?.join(
          ', '
        )}) are not owned by the address ${ethAddress.toLowerCase()}).`
      )
    return OK
  }
})

function isBaseAvatar(urn: string): boolean {
  return urn.includes('base-avatars')
}

async function sanitizeUrn(urn: string): Promise<string | undefined> {
  if (!urn.startsWith('dcl://')) {
    return urn
  }
  const parsed = await parseUrn(urn)
  return parsed?.uri?.toString()
}

async function allWearableUrns(entity: Entity) {
  const allWearablesInProfilePromises: Promise<string | undefined>[] = []
  for (const avatar of entity.metadata.avatars) {
    for (const wearableId of avatar.avatar.wearables) {
      if (!isBaseAvatar(wearableId) && !isOldEmote(wearableId)) {
        allWearablesInProfilePromises.push(sanitizeUrn(wearableId))
      }
    }
  }

  return (await Promise.all(allWearablesInProfilePromises)).filter((wearableId): wearableId is string => !!wearableId)
}

export const ownsWearables: Validation = validationAfterADR75({
  validate: async ({ externalCalls, theGraphClient }, deployment) => {
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    const wearableUrns = await allWearableUrns(deployment.entity)
    const wearablesCheckResult = await theGraphClient.ownsItemsAtTimestamp(
      ethAddress,
      wearableUrns,
      deployment.entity.timestamp
    )
    if (!wearablesCheckResult.result) {
      return validationFailed(
        `The following wearables (${wearablesCheckResult.failing?.join(
          ', '
        )}) are not owned by the address ${ethAddress.toLowerCase()}).`
      )
    }

    return OK
  }
})

async function allEmoteUrns(entity: Entity) {
  const allEmotesInProfilePromises: Promise<string | undefined>[] = []
  const allAvatars = entity.metadata?.avatars ?? []
  for (const avatar of allAvatars) {
    const allEmotes = avatar.avatar.emotes ?? []
    for (const { slot, urn } of allEmotes) {
      allEmotesInProfilePromises.push(sanitizeUrn(urn))
    }
  }

  return (await Promise.all(allEmotesInProfilePromises)).filter((wearableId): wearableId is string => !!wearableId)
}

export const ownsItems: Validation = conditionalValidation(
  (deployment) =>
    deployment.entity.timestamp >= ADR_74_TIMESTAMP || deployment.entity.timestamp >= ADR_75_TIMESTAMP,
  {
    validate: async ({ externalCalls, theGraphClient }, deployment) => {
      const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
      const depoymentTimestamp = deployment.entity.timestamp
      const itemUrns: string[] = []
      if (depoymentTimestamp >= ADR_75_TIMESTAMP) {
        for (const urn of await allWearableUrns(deployment.entity)) {
          itemUrns.push(urn)
        }
      }
      if (depoymentTimestamp >= ADR_74_TIMESTAMP) {
        for (const urn of await allEmoteUrns(deployment.entity)) {
          itemUrns.push(urn)
        }
      }
      const itemsOwnershipResult = await theGraphClient.ownsItemsAtTimestamp(
        ethAddress,
        itemUrns,
        deployment.entity.timestamp
      )
      if (!itemsOwnershipResult.result) {
        return validationFailed(
          `The following items (${itemsOwnershipResult.failing?.join(
            ', '
          )}) are not owned by the address ${ethAddress.toLowerCase()}).`
        )
      }

      return OK
    }
  })

export const profiles: Validation = validationGroup(pointerIsValid, ownsNames, ownsItems)
