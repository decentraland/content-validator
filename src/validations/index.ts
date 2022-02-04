import { DeploymentToValidate, ExternalCalls, OK, Validation, ValidationArgs, ValidationResponse } from '../types'
import { access } from './access-checker/access'
import { content } from './content'
import { entityStructure } from './entity-structure'
import { ipfsHashing } from './ipfs-hashing'
import { metadata } from './metadata-schema'
import { signature } from './signature'
import { size } from './size'
import { wearable } from './wearable'
import { profile } from './profile'

/**
 * @public
 */
export const validateInRow = async (
  validationArgs: ValidationArgs,
  ...validations: Validation[]
): Promise<ValidationResponse> => {
  for (const validation of validations) {
    const response = await validation.validate(validationArgs)
    if (!response.ok) return response
  }
  return OK
}

/**
 * 1648771200000 = April 1st 2022 UTC
 * @public
 */
export const ADR_45_TIMESTAMP = process.env.ADR_45_TIMESTAMP ? parseInt(process.env.ADR_45_TIMESTAMP) : 1648771200000

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
  for (const hash of new Set(deployment.entity.content?.map((item) => item.hash) ?? [])) {
    const uploadedFile = deployment.files.get(hash)
    if (uploadedFile) {
      totalSize += uploadedFile.byteLength
    } else {
      const contentSize = await externalCalls.fetchContentFileSize(hash)
      if (!contentSize) return `Couldn't fetch content file with hash: ${hash}`
      totalSize += contentSize
    }
  }
  return totalSize
}

/**
 * Stateful validations that are run on a deployment.
 * @public
 */
export const statefulValidations = [signature, access, size, wearable, profile, content] as const

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
