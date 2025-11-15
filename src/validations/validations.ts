import { EntityType } from '@dcl/schemas'
import { DeploymentToValidate, OK, ValidateFn } from '../types'
import {
  ADR_173_TIMESTAMP,
  ADR_232_TIMESTAMP,
  ADR_236_TIMESTAMP,
  ADR_244_TIMESTAMP,
  ADR_290_OPTIONAL_TIMESTAMP,
  ADR_290_REJECTED_TIMESTAMP,
  ADR_45_TIMESTAMP,
  ADR_74_TIMESTAMP,
  ADR_75_TIMESTAMP
} from './timestamps'

export function validateAll(...validationFns: ValidateFn[]): ValidateFn {
  return async (deployment: DeploymentToValidate) => {
    for (const validateFn of validationFns) {
      const response = await validateFn(deployment)
      if (!response.ok) {
        return response
      }
    }
    return OK
  }
}

export function validateIfConditionMet(
  condition: (deployment: DeploymentToValidate) => boolean | Promise<boolean>,
  validateFn: ValidateFn
): ValidateFn {
  return async (deployment: DeploymentToValidate) => {
    const conditionIsMet = await condition(deployment)
    if (conditionIsMet) {
      return validateFn(deployment)
    }
    return OK
  }
}

export function validateAfterADR45(validate: ValidateFn): ValidateFn {
  return validateIfConditionMet((deployment) => deployment.entity.timestamp >= ADR_45_TIMESTAMP, validate)
}

export function validateAfterADR75(validate: ValidateFn): ValidateFn {
  return validateIfConditionMet((deployment) => deployment.entity.timestamp >= ADR_75_TIMESTAMP, validate)
}

export function validateAfterADR74(validate: ValidateFn): ValidateFn {
  return validateIfConditionMet((deployment) => deployment.entity.timestamp >= ADR_74_TIMESTAMP, validate)
}

export function validateAfterADR173(validate: ValidateFn): ValidateFn {
  return validateIfConditionMet((deployment) => deployment.entity.timestamp >= ADR_173_TIMESTAMP, validate)
}

export function validateAfterADR232(validate: ValidateFn): ValidateFn {
  return validateIfConditionMet((deployment) => deployment.entity.timestamp >= ADR_232_TIMESTAMP, validate)
}

export function validateAfterADR236(validate: ValidateFn): ValidateFn {
  return validateIfConditionMet((deployment) => deployment.entity.timestamp >= ADR_236_TIMESTAMP, validate)
}

export function validateAfterADR244(validate: ValidateFn): ValidateFn {
  return validateIfConditionMet((deployment) => deployment.entity.timestamp >= ADR_244_TIMESTAMP, validate)
}

export function validateIfTypeMatches(entityType: EntityType, validate: ValidateFn) {
  return validateIfConditionMet((deployment) => deployment.entity.type === entityType, validate)
}

export function validateAfterADR290RejectedTimestamp(validate: ValidateFn): ValidateFn {
  return validateIfConditionMet((deployment) => deployment.entity.timestamp >= ADR_290_REJECTED_TIMESTAMP, validate)
}

/**
 * Validates only for profile entities after the provided timestamp and before the rejected timestamp.
 * In the optionality period, validate only for profiles that have content files, files uploaded or snapshots present.
 * @public
 */
export function validateUpToADR290OptionalityTimestamp(fromTimestamp: number, validate: ValidateFn): ValidateFn {
  return validateIfConditionMet(
    (deployment) =>
      // Validate before the rejected timestamp
      deployment.entity.timestamp < ADR_290_REJECTED_TIMESTAMP &&
      // Validate after the optional timestamp
      ((deployment.entity.timestamp >= ADR_290_OPTIONAL_TIMESTAMP &&
        (deployment.entity.content.length > 0 ||
          deployment.files.size > 0 ||
          deployment.entity.metadata?.avatars?.[0]?.avatar?.snapshots)) ||
        // Validate from the provided timestamp
        (deployment.entity.timestamp >= fromTimestamp && deployment.entity.timestamp < ADR_290_REJECTED_TIMESTAMP)),
    validate
  )
}
