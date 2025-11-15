import { ContentValidatorComponents, DeploymentToValidate, fromErrors, ValidateFn, ValidationResponse } from '../types'
import { validateAll } from './validations'

/**
 * Validates that all hashes that belong to the entity's content are actually uploaded or stored.
 * If no content is present, this validation will not produce an error.
 * @public
 */
export function createAllHashesWereUploadedOrStoredValidateFn({
  externalCalls
}: Pick<ContentValidatorComponents, 'externalCalls'>): ValidateFn {
  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity, files } = deployment
    const errors: string[] = []
    if (entity.content) {
      const alreadyStoredHashes = await externalCalls.isContentStoredAlready(
        entity.content?.map((file) => file.hash) ?? []
      )

      for (const { hash } of entity.content) {
        // Validate that all hashes in entity were uploaded, or were already stored on the service
        if (!(files.has(hash) || alreadyStoredHashes.get(hash))) {
          errors.push(`This hash is referenced in the entity but was not uploaded or previously available: ${hash}`)
        }
      }
    }
    return fromErrors(...errors)
  }
}

/**
 * Validates that all hashes that belong to uploaded files are actually reported on the entity
 * by checking that the entity's content hashes are correspond to the uploaded files.
 * @public
 */
export async function allHashesInUploadedFilesAreReportedInTheEntityValidateFn(deployment: DeploymentToValidate) {
  const { entity, files } = deployment
  const errors: string[] = []
  // Validate that all hashes that belong to uploaded files are actually reported on the entity
  const entityHashes = new Set(entity.content?.map(({ hash }) => hash) ?? [])
  for (const [hash] of files) {
    if (!entityHashes.has(hash) && hash !== entity.id) {
      errors.push(`This hash was uploaded but is not referenced in the entity: ${hash}`)
    }
  }
  return fromErrors(...errors)
}

/**
 * Validate that uploaded and reported hashes are corrects and files corresponds to snapshots
 * @public
 */
export function createContentValidateFn(components: ContentValidatorComponents): ValidateFn {
  return validateAll(
    createAllHashesWereUploadedOrStoredValidateFn(components),
    allHashesInUploadedFilesAreReportedInTheEntityValidateFn
  )
}
