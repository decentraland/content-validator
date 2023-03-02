import { Avatar, Entity } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import {
  DeploymentToValidate,
  OK,
  SubgraphAccessCheckerComponents,
  ValidateFn,
  validationFailed,
  ValidationResponse
} from '../../../types'
import { isOldEmote } from '../../profile'
import { ADR_74_TIMESTAMP, ADR_75_TIMESTAMP } from '../../timestamps'
import { validateAfterADR75, validateAll } from '../../validations'
import { createPointerValidateFn } from '../common/profiles'

export function createNamesOwnershipValidateFn({
  externalCalls,
  theGraphClient
}: Pick<SubgraphAccessCheckerComponents, 'externalCalls' | 'theGraphClient'>): ValidateFn {
  async function validateFn(deployment: DeploymentToValidate) {
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const names = deployment.entity.metadata.avatars
      .filter((avatar: Avatar) => avatar.hasClaimedName)
      .map((avatar: Avatar) => avatar.name)
      .filter((name: string) => name && name.trim().length > 0)
    const namesCheckResult = await theGraphClient.ownsNamesAtTimestamp(ethAddress, names, deployment.entity.timestamp)
    if (!namesCheckResult.result)
      return validationFailed(
        `The following names (${namesCheckResult.failing?.join(
          ', '
        )}) are not owned by the address ${ethAddress.toLowerCase()}).`
      )
    return OK
  }

  return validateAfterADR75(validateFn)
}

export function createItemOwnershipValidateFn({
  externalCalls,
  theGraphClient
}: Pick<SubgraphAccessCheckerComponents, 'externalCalls' | 'theGraphClient'>): ValidateFn {
  async function sanitizeUrn(urn: string): Promise<string | undefined> {
    if (!urn.startsWith('dcl://')) {
      return urn
    }
    const parsed = await parseUrn(urn)
    return parsed?.uri?.toString()
  }

  async function allOnChainWearableUrns(entity: Entity) {
    const allWearablesInProfilePromises: Promise<string | undefined>[] = []
    for (const avatar of entity.metadata.avatars) {
      for (const wearableId of avatar.avatar.wearables) {
        const isBaseAvatar = wearableId.includes('base-avatars')
        if (!isBaseAvatar && !isOldEmote(wearableId)) {
          allWearablesInProfilePromises.push(sanitizeUrn(wearableId))
        }
      }
    }

    return (await Promise.all(allWearablesInProfilePromises)).filter((wearableId): wearableId is string => !!wearableId)
  }

  async function allEmoteUrns(entity: Entity) {
    const allEmotesInProfilePromises: Promise<string | undefined>[] = []
    const allAvatars = entity.metadata?.avatars ?? []
    for (const avatar of allAvatars) {
      const allEmotes = avatar.avatar.emotes ?? []
      for (const { urn } of allEmotes) {
        if (!isOldEmote(urn)) {
          allEmotesInProfilePromises.push(sanitizeUrn(urn))
        }
      }
    }

    return (await Promise.all(allEmotesInProfilePromises)).filter((wearableId): wearableId is string => !!wearableId)
  }

  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const depoymentTimestamp = deployment.entity.timestamp
    const itemUrns: string[] = []
    if (depoymentTimestamp >= ADR_75_TIMESTAMP) {
      for (const urn of await allOnChainWearableUrns(deployment.entity)) {
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
}

export function createProfileValidateFn(
  components: Pick<SubgraphAccessCheckerComponents, 'theGraphClient' | 'externalCalls'>
) {
  return validateAll(
    createPointerValidateFn(components),
    createNamesOwnershipValidateFn(components),
    createItemOwnershipValidateFn(components)
  )
}
