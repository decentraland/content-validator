import { ADR_X_TIMESTAMP, calculateDeploymentSize } from '.'
import { OK, Validation, validationFailed } from '../types'

/** Validate that the full request size is within limits
 *
 * ADR X: After given TIMESTAMPT will also include previous deployments in the validation
 */
export const size: Validation = {
  validate: async ({ deployment, externalCalls }) => {
    const { entity } = deployment
    const maxSizeInMB = externalCalls.getMaxUploadSizePerTypeInMB(entity.type)
    let errors: string[] = []
    if (!maxSizeInMB) {
      return validationFailed(`Type ${entity.type} is not supported yet`)
    }
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024
    let totalSize = 0
    if (entity.timestamp > ADR_X_TIMESTAMP) {
      const result = await calculateDeploymentSize(deployment, externalCalls)
      if (typeof result === 'string') return validationFailed(result)
      totalSize = result
    } else {
      totalSize = Object.values(deployment.files).reduce((acc, file) => acc + file.byteLength, 0)
    }
    const sizePerPointer = totalSize / entity.pointers.length
    if (sizePerPointer > maxSizeInBytes) {
      errors = [
        `The deployment is too big. The maximum allowed size per pointer is ${maxSizeInMB} MB for ${
          entity.type
        }. You can upload up to ${entity.pointers.length * maxSizeInBytes} bytes but you tried to upload ${totalSize}.`,
      ]
    }
    return errors.length > 0 ? validationFailed(...errors) : OK
  },
}
