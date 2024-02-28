import { EntityType } from '@dcl/schemas'
import { DeploymentToValidate, OK, ValidateFn } from '../types'
import {
  ADR_158_TIMESTAMP,
  ADR_173_TIMESTAMP,
  ADR_232_TIMESTAMP,
  ADR_236_TIMESTAMP,
  ADR_244_TIMESTAMP,
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

export function validateAfterADR158(validate: ValidateFn): ValidateFn {
  return validateIfConditionMet((deployment) => deployment.entity.timestamp >= ADR_158_TIMESTAMP, validate)
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
