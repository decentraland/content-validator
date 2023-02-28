import { ContentValidatorComponents, DeploymentToValidate, ExternalCalls, ValidateFn } from '../types'
import { adr45ValidateFn } from './ADR45'
import { createContentValidateFn } from './content'
import { entityStructureValidationFn } from './entity-structure'
import { ipfsHashingValidateFn } from './ipfs-hashing'
import { emoteValidateFn } from './items/emotes'
import { wearableValidateFn } from './items/wearables'
import { metadataValidateFn } from './metadata-schema'
import { createProfileValidateFn } from './profile'
import { sceneValidateFn } from './scene'
import { createSignatureValidateFn } from './signature'
import { createSizeValidateFn } from './size'

/**
 * @public
 */
export async function calculateDeploymentSize(
  deployment: DeploymentToValidate,
  externalCalls: ExternalCalls
): Promise<number | string> {
  let totalSize = 0
  for (const hash of new Set(deployment.entity.content?.map((item) => item.hash) ?? [])) {
    const uploadedFile = deployment.files.get(hash)
    if (uploadedFile) {
      totalSize += uploadedFile.byteLength
    } else {
      const contentSize = await externalCalls.fetchContentFileSize(hash)
      if (contentSize === undefined) return `Couldn't fetch content file with hash: ${hash}`
      totalSize += contentSize
    }
  }
  return totalSize
}

export function createValidateFns(components: ContentValidatorComponents): ValidateFn[] {
  return [
    // Stateful validations that are run on a deployment.
    createSignatureValidateFn(components),
    createSizeValidateFn(components),
    wearableValidateFn,
    emoteValidateFn,
    createProfileValidateFn(components),
    sceneValidateFn,
    createContentValidateFn(components),

    // Stateless validations that are run on a deployment.
    entityStructureValidationFn,
    ipfsHashingValidateFn,
    metadataValidateFn,
    adr45ValidateFn
  ]
}
