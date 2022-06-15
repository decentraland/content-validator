import {
  DeploymentToValidate,
  ExternalCalls
} from '../types'
import { access } from './access-checker/access'
import { content } from './content'
import { entityStructure } from './entity-structure'
import { ipfsHashing } from './ipfs-hashing'
import { items } from './items/items'
// import { wearable } from './items/wearables'
import { metadata } from './metadata-schema'
import { profile } from './profile'
import { signature } from './signature'
import { size } from './size'

/**
 * 1656633600000 = 2022-07-01T00:00:00Z
 * @public
 */
export const ADR_74_TIMESTAMP = process.env.ADR_74_TIMESTAMP
  ? parseInt(process.env.ADR_74_TIMESTAMP)
  : 1656633600000

/**
 * 1652191200000 = 2022-05-10T14:00:00Z
 * @public
 */
export const ADR_45_TIMESTAMP = process.env.ADR_45_TIMESTAMP
  ? parseInt(process.env.ADR_45_TIMESTAMP)
  : 1652191200000

/**
 * 1655294400000 = 2022-06-15T12:00:00Z
 * @public
 */
export const ADR_75_TIMESTAMP = process.env.ADR_75_TIMESTAMP
  ? parseInt(process.env.ADR_75_TIMESTAMP)
  : 1655294400000

/**
 * DCL Launch Day
 * @public
 */
export const LEGACY_CONTENT_MIGRATION_TIMESTAMP = 1582167600000

/**
 * @public
 */
export const calculateDeploymentSize = async (
  deployment: DeploymentToValidate,
  externalCalls: ExternalCalls
): Promise<number | string> => {
  let totalSize = 0
  for (const hash of new Set(
    deployment.entity.content?.map((item) => item.hash) ?? []
  )) {
    const uploadedFile = deployment.files.get(hash)
    if (uploadedFile) {
      totalSize += uploadedFile.byteLength
    } else {
      const contentSize = await externalCalls.fetchContentFileSize(hash)
      if (contentSize === undefined)
        return `Couldn't fetch content file with hash: ${hash}`
      totalSize += contentSize
    }
  }
  return totalSize
}

/**
 * Stateful validations that are run on a deployment.
 * @public
 */
export const statefulValidations = [
  signature,
  access,
  size,
  // wearable,
  profile,
  content,
  items
] as const

/**
 * Stateless validations that are run on a deployment.
 * @public
 */
export const statelessValidations = [
  entityStructure,
  ipfsHashing,
  metadata
] as const

/**
 * All validations that are run on a deployment.
 * @public
 */
export const validations = [
  ...statelessValidations,
  ...statefulValidations
] as const
