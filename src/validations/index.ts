import { DeploymentToValidate, ExternalCalls, OK, Validation, ValidationArgs, ValidationResponse } from '../types'
import { access } from './access-checker/access'
import { content } from './content'
import { decentralandAddress } from './decentraland-address'
import { entityStructure } from './entity-structure'
import { ipfsHashing } from './ipfs-hashing'
import { metadata } from './metadata-schema'
import { signature } from './signature'
import { size } from './size'
import { wearable } from './wearable'

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

// todo: review/define date for entities v4 (for the time being, it is set for test purposes)
/**
 * @public
 */
export const ADR_45_TIMESTAMP = 1648954800000

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
 * @public
 */
export const statefulValidations = [signature, access, size, wearable, content, decentralandAddress]

/**
 * @public
 */
export const statelessValidations = [entityStructure, ipfsHashing, metadata]
