import { EntityType } from '@dcl/schemas'
import { ContentValidatorComponents, DeploymentToValidate, OK, ValidateFn, validationFailed } from '../types'
import { validateAfterADR173, validateIfTypeMatches } from './validations'

function sceneHasWorldConfiguration(deployment: DeploymentToValidate): boolean {
  return deployment.entity.metadata?.worldConfiguration !== undefined
}

/**
 * Validate that given scene deployment does not contain worldConfiguration section
 * @public
 */
export const noWorldsConfiguration: ValidateFn = validateAfterADR173(
  async (components: ContentValidatorComponents, deployment: DeploymentToValidate) => {
    if (sceneHasWorldConfiguration(deployment)) {
      return validationFailed('Scenes cannot have worldConfiguration section after ADR 173.')
    }
    return OK
  }
)
/**
 * Validate that given scene deployment is valid
 * @public
 */
export const scene: ValidateFn = validateIfTypeMatches(EntityType.SCENE, noWorldsConfiguration)
