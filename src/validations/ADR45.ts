import { Entity } from '@dcl/schemas'
import { DeploymentToValidate, OK, validationFailed, ValidationResponse } from '../types'
import { ADR_45_TIMESTAMP } from './timestamps'

const entityIsNotVersion3 = (entity: Entity) => entity.version !== 'v3'

const entityWasDeployedAfterADR45 = (entity: Entity) => entity.timestamp > ADR_45_TIMESTAMP

/**
 * Validate that entity meets ADR-45 validations
 * @public
 */
export async function adr45ValidateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
  const { entity } = deployment

  if (entityIsNotVersion3(entity) && entityWasDeployedAfterADR45(entity))
    return validationFailed(
      'Only entities v3 are allowed after the ADR-45. Check http://adr.decentraland.org/adr/ADR-45 for more information'
    )

  return OK
}
