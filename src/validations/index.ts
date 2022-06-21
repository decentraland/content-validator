import { DeploymentToValidate, ExternalCalls } from '../types'
import { access } from './access-checker/access'
import { content } from './content'
import { entityStructure } from './entity-structure'
import { ipfsHashing } from './ipfs-hashing'
import { emote } from './items/emotes'
import { items } from './items/items'
import { wearable } from './items/wearables'
import { metadata } from './metadata-schema'
import { profile } from './profile'
import { signature } from './signature'
import { size } from './size'

/**
 * @public
 */
export const calculateDeploymentSize = async (
  deployment: DeploymentToValidate,
  externalCalls: ExternalCalls
): Promise<number | string> => {
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

/**
 * Stateful validations that are run on a deployment.
 * @public
 */
export const statefulValidations = [signature, access, size, items, wearable, emote, profile, content] as const

/**
 * Stateless validations that are run on a deployment.
 * @public
 */
export const statelessValidations = [entityStructure, ipfsHashing, metadata] as const

/**
 * All validations that are run on a deployment.
 * @public
 */
export const validations = [...statelessValidations, ...statefulValidations] as const
