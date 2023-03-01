import { EntityType } from '@dcl/schemas'
import { DeploymentToValidate, OK, ValidateFn, validationFailed, ValidationResponse } from '../types'
import { validateAfterADR173, validateIfTypeMatches } from './validations'

function validateIfScene(validateFn: ValidateFn): ValidateFn {
  return validateIfTypeMatches(EntityType.SCENE, validateFn)
}

/**
 * Validate that given scene deployment does not contain worldConfiguration section
 * @public
 */
export const noWorldsConfigurationValidateFn = validateIfScene(
  validateAfterADR173(async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const sceneHasWorldConfiguration = deployment.entity.metadata?.worldConfiguration !== undefined
    if (sceneHasWorldConfiguration) {
      return validationFailed('Scenes cannot have worldConfiguration section after ADR 173.')
    }
    return OK
  })
)

/**
 * Validate that given scene deployment is valid
 * @public
 */
export const sceneValidateFn = noWorldsConfigurationValidateFn
