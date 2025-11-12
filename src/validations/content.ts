import { Avatar, EntityType, Profile } from '@dcl/schemas'
import { ContentValidatorComponents, DeploymentToValidate, fromErrors, ValidateFn, ValidationResponse } from '../types'
import { ADR_158_TIMESTAMP, ADR_45_TIMESTAMP } from './timestamps'
import {
  validateAfterADR290RejectedTimestamp,
  validateAll,
  validateUpToADR290OptionalityTimestamp
} from './validations'

function correspondsToASnapshot(fileName: string, hash: string, metadata: Profile) {
  const fileNameWithoutExtension = fileName.replace(/.[^/.]+$/, '')

  return metadata.avatars.some((avatar: Avatar) =>
    Object.entries(avatar.avatar?.snapshots ?? {}).some((key) => key[0] === fileNameWithoutExtension && key[1] === hash)
  )
}

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
 * Conditionally validates that all content uploaded with the profile entity belongs to a snapshot
 * before the ADR_45_TIMESTAMP o in the optional period of the ADR 290.
 * This validation is only applied to profile entities.
 * If no content is present, this validation will not produce an error.
 * @public
 */
export async function allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity } = deployment
    const errors: string[] = []
    for (const { file, hash } of entity.content ?? []) {
      // Validate all content files correspond to at least one avatar snapshot
      if (entity.type === EntityType.PROFILE) {
        if (!entity.metadata || !entity.metadata.avatars || entity.metadata.avatars?.length === 0) {
          errors.push(`Entity is missing metadata or avatars`)
        } else if (!correspondsToASnapshot(file, hash, entity.metadata)) {
          errors.push(
            `This file is not expected: '${file}' or its hash is invalid: '${hash}'. Please, include only valid snapshot files.`
          )
        }
      }
    }
    return fromErrors(...errors)
  }
  return validateUpToADR290OptionalityTimestamp(ADR_45_TIMESTAMP, validateFn)(deployment)
}

/**
 * Conditionally validates that all mandatory content files are present for the profile entity
 * before the ADR_158_TIMESTAMP or in the optional period of the ADR 290.
 * If no content is present, this validation will not produce an error.
 * @public
 */
export async function allMandatoryContentFilesArePresentValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity } = deployment
    const errors: string[] = []
    if (entity.type === EntityType.PROFILE) {
      const fileNames = entity.content.map((a) => a.file.toLowerCase())
      if (!fileNames.includes('body.png')) {
        errors.push(`Profile entity is missing file 'body.png'`)
      }
      if (!fileNames.includes('face256.png')) {
        errors.push(`Profile entity is missing file 'face256.png'`)
      }
    }
    return fromErrors(...errors)
  }
  return validateUpToADR290OptionalityTimestamp(ADR_158_TIMESTAMP, validateFn)(deployment)
}

/**
 * Conditionally validates that the entity should not have content files after the rejected ADR 290 timestamp.
 * This validation is only applied to profile entities.
 * @public
 */
export async function entityShouldNotHaveContentFilesValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity } = deployment
    const errors: string[] = []
    if (entity.type === EntityType.PROFILE) {
      if (entity.content.length > 0) {
        errors.push(`Entity has content files when it should not: ${entity.content.map((a) => a.file).join(', ')}`)
      }
      if (deployment.files.size > 0) {
        errors.push(`Entity has uploaded files when it should not: ${Array.from(deployment.files.keys()).join(', ')}`)
      }
    }
    return fromErrors(...errors)
  }

  return validateAfterADR290RejectedTimestamp(validateFn)(deployment)
}

/**
 * Validate that uploaded and reported hashes are corrects and files corresponds to snapshots
 * @public
 */
export function createContentValidateFn(components: ContentValidatorComponents): ValidateFn {
  return validateAll(
    entityShouldNotHaveContentFilesValidateFn,
    createAllHashesWereUploadedOrStoredValidateFn(components),
    allHashesInUploadedFilesAreReportedInTheEntityValidateFn,
    allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn,
    allMandatoryContentFilesArePresentValidateFn
  )
}
