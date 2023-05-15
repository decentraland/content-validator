import { ContentMapping, EntityType } from '@dcl/schemas'
import { DeploymentToValidate, OK, validationFailed, ValidationResponse } from '../types'
import { validateAfterADR173, validateAfterADR236, validateAll, validateIfTypeMatches } from './validations'

/**
 * Validate that given scene deployment does not contain worldConfiguration section
 * @public
 */
export const noWorldsConfigurationValidateFn = validateAfterADR173(async function validateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const sceneHasWorldConfiguration = deployment.entity.metadata?.worldConfiguration !== undefined
  if (sceneHasWorldConfiguration) {
    return validationFailed('Scenes cannot have worldConfiguration section after ADR 173.')
  }
  return OK
})

/**
 * Validate that given scene deployment thumbnail is a file embedded in the deployment
 * @public
 */
export const embeddedThumbnail = validateAfterADR236(async function validateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const sceneThumbnail = deployment.entity.metadata?.display.navmapThumbnail
  if (sceneThumbnail) {
    const isFilePresent = deployment.entity.content.some((content: ContentMapping) => content.file === sceneThumbnail)
    if (!isFilePresent) {
      return validationFailed(`Scene thumbnail '${sceneThumbnail}' must be a file included in the deployment.`)
    }
  }
  return OK
})

/**
 * Validate that given scene deployment is valid
 * @public
 */
export const sceneValidateFn = validateIfTypeMatches(
  EntityType.SCENE,
  validateAll(noWorldsConfigurationValidateFn, embeddedThumbnail)
)
