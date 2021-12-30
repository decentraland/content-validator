import { DeploymentToValidate, ExternalCalls, OK, Validation, ValidationArgs, ValidationResponse } from '../types'
import { access } from './access-checker/access'
import { content } from './content'
import { decentralandAddress } from './decentraland-address'
import { entityStructure } from './entity-structure'
import { ipfsHashing } from './ipfs-hashing'
import { metadata } from './metadata-schema'
import { mustHaveFailedBefore } from './must-have-failed-before'
import { noNewer } from './no-newer'
import { noRedeploy } from './no-redeploy'
import { rateLimit } from './rate-limit'
import { recent } from './recent'
import { signature } from './signature'
import { size } from './size'
import { wearable } from './wearable'

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

// TODO define date for entities v4
export const ADR_X_TIMESTAMP = 0

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

export const statefulValidations = [
  noRedeploy,
  signature,
  recent,
  noNewer,
  access,
  size,
  mustHaveFailedBefore,
  wearable,
  content,
  decentralandAddress,
  rateLimit,
]

export const statelessValidations = [entityStructure, ipfsHashing, metadata]
